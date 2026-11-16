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


async def current_admin(request: Request) -> dict:
    user = await current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user
