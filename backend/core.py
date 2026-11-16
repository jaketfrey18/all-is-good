import os
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

from auth import read_token

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def user_by_id(uid: str):
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


async def current_user(request: Request) -> dict:
    payload = read_token(request)
    user = await user_by_id(payload["sub"])
    if not user:
        raise HTTPException(401, "Account not found")
    return user


async def optional_user(request: Request):
    try:
        return await current_user(request)
    except HTTPException:
        return None


async def member_slugs(user) -> list:
    if not user:
        return []
    q = {} if user.get("role") == "admin" else {"members": user["id"]}
    return [p["slug"] for p in await db.projects.find(q, {"_id": 0, "slug": 1}).to_list(500)]


async def require_member(slug: str, user) -> dict:
    p = await db.projects.find_one({"slug": slug}, {"_id": 0, "slug": 1, "title": 1, "dropbox_path": 1, "members": 1})
    if not p:
        raise HTTPException(404, "World not found")
    if not user:
        raise HTTPException(401, "Sign in to see this World's files")
    if user.get("role") != "admin" and user["id"] not in p.get("members", []):
        raise HTTPException(403, f"You're not a member of {p['title']}")
    return p


async def current_admin(request: Request) -> dict:
    user = await current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user
