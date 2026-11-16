from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import asyncio
import logging
import os
import re
import uuid
from contextlib import suppress
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import html
from fastapi.responses import HTMLResponse

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: F401
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

import dropbox_svc as dbx
from auth import hash_password, verify_password, create_access_token
from core import client, db, now_iso, current_user, current_admin
import collab

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

CATEGORIES = ["projects", "worlds", "media", "presentations"]

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "projects": [IndexModel([("slug", ASCENDING)], name="slug", unique=True),
                 IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("order", ASCENDING)], name="order")],
    "login_attempts": [IndexModel([("identifier", ASCENDING)], name="identifier")],
    "oauth_states": [IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0)],
    "canvases": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("world_slug", ASCENDING)], name="world")],
    "lyrics": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("world_slug", ASCENDING)], name="world")],
    "lyric_versions": [IndexModel([("lyric_id", ASCENDING), ("created_at", ASCENDING)], name="lyric_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()
api = APIRouter(prefix="/api")


# ---------- Models ----------
class LoginIn(BaseModel):
    email: str
    password: str


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    slug: Optional[str] = None
    subtitle: str = ""
    category: str = "projects"
    description: str = ""
    cover_url: str = ""
    dropbox_path: str = ""
    order: int = 0


class Project(ProjectIn):
    id: str
    slug: str
    created_at: str
    updated_at: str


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or uuid.uuid4().hex[:8]


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    fwd = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    ident = f"{fwd or (request.client.host if request.client else 'x')}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5:
        if datetime.fromisoformat(att["last"]) > datetime.now(timezone.utc) - timedelta(minutes=15):
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_many({"identifier": ident})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"last": now_iso()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_many({"identifier": ident})
    token = create_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    return {"token": token, "user": {"id": user["id"], "email": email, "name": user.get("name"), "role": user["role"]}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


# ---------- Projects ----------
@api.get("/projects", response_model=List[Project])
async def list_projects(category: Optional[str] = None):
    q = {"category": category} if category else {}
    return await db.projects.find(q, {"_id": 0}).sort("order", 1).to_list(500)


@api.get("/projects/{slug}", response_model=Project)
async def get_project(slug: str):
    p = await db.projects.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    return p


async def _unique_slug(base: str, exclude_id: Optional[str] = None) -> str:
    slug, i = base, 2
    while await db.projects.find_one({"slug": slug, "id": {"$ne": exclude_id}}):
        slug, i = f"{base}-{i}", i + 1
    return slug


def _validate(body: ProjectIn):
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Category must be one of {', '.join(CATEGORIES)}")


@api.post("/projects", response_model=Project)
async def create_project(body: ProjectIn, _: dict = Depends(current_admin)):
    _validate(body)
    doc = body.model_dump()
    doc.update(id=str(uuid.uuid4()), slug=await _unique_slug(slugify(body.slug or body.title)),
               created_at=now_iso(), updated_at=now_iso())
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/projects/{pid}", response_model=Project)
async def update_project(pid: str, body: ProjectIn, _: dict = Depends(current_admin)):
    _validate(body)
    existing = await db.projects.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Project not found")
    data = body.model_dump()
    data["slug"] = await _unique_slug(slugify(body.slug or body.title), pid)
    data["updated_at"] = now_iso()
    await db.projects.update_one({"id": pid}, {"$set": data})
    return await db.projects.find_one({"id": pid}, {"_id": 0})


@api.delete("/projects/{pid}")
async def delete_project(pid: str, _: dict = Depends(current_admin)):
    res = await db.projects.delete_one({"id": pid})
    if not res.deleted_count:
        raise HTTPException(404, "Project not found")
    return {"ok": True}


# ---------- Project files (public, scoped to mapped folder) ----------
async def _project_root(slug: str) -> str:
    p = await db.projects.find_one({"slug": slug}, {"_id": 0, "dropbox_path": 1})
    if not p:
        raise HTTPException(404, "Project not found")
    if not p.get("dropbox_path"):
        raise HTTPException(409, "No Dropbox folder linked to this project yet")
    return p["dropbox_path"]


def _scoped(root: str, path: Optional[str]) -> str:
    path = path or root
    if not dbx.inside(root, path):
        raise HTTPException(403, "Path outside project folder")
    return path


@api.get("/projects/{slug}/files")
async def project_files(slug: str, path: Optional[str] = None):
    root = await _project_root(slug)
    path = _scoped(root, path)
    c = await dbx.client(db)
    return {"root": root, "path": path, "items": await dbx.list_folder(c, path)}


@api.get("/projects/{slug}/search")
async def project_search(slug: str, q: str = Query(min_length=1, max_length=200)):
    root = await _project_root(slug)
    c = await dbx.client(db)
    return {"items": await dbx.search(c, q, root, 50)}


@api.get("/projects/{slug}/link")
async def project_link(slug: str, path: str):
    path = _scoped(await _project_root(slug), path)
    c = await dbx.client(db)
    return {"url": await dbx.temp_link(c, path)}


@api.get("/projects/{slug}/thumb")
async def project_thumb(slug: str, path: str):
    path = _scoped(await _project_root(slug), path)
    c = await dbx.client(db)
    data = await dbx.thumbnail(c, path)
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})


# ---------- Global search ----------
@api.get("/search")
async def global_search(q: str = Query("", max_length=200), category: Optional[str] = None,
                        world: Optional[str] = None, kind: Optional[str] = None):
    q = q.strip()
    if not q and not kind and not world:
        raise HTTPException(400, "Type something to search")
    base = {"slug": world} if world else {}
    if category:
        base["category"] = category
    projects = []
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt = {**base, "$or": [{"title": rx}, {"subtitle": rx}, {"description": rx}, {"category": rx}]}
        projects = await db.projects.find(filt, {"_id": 0}).sort("order", 1).to_list(100)
    files, files_available = [], False
    st = await dbx.status(db)
    if st["connected"]:
        files_available = True
        mapped = await db.projects.find({"dropbox_path": {"$ne": ""}, **base},
                                        {"_id": 0, "slug": 1, "title": 1, "dropbox_path": 1}).to_list(100)
        c = await dbx.client(db)

        async def one(p):
            try:
                found = await (dbx.search(c, q, p["dropbox_path"], 40) if q else dbx.list_recursive(c, p["dropbox_path"], 300))
                return [{**f, "project_slug": p["slug"], "project_title": p["title"]} for f in found]
            except HTTPException:
                return []
        for chunk in await asyncio.gather(*[one(p) for p in mapped]):
            files.extend(chunk)
        if kind:
            files = [f for f in files if f["type"] == "file" and dbx.kind_of(f.get("ext", "")) == kind]
    return {"projects": projects, "files": files[:400], "files_available": files_available}


# ---------- Dropbox admin ----------
@api.get("/dropbox/status")
async def dropbox_status():
    st = await dbx.status(db)
    return {"configured": st["configured"], "connected": st["connected"]}


@api.get("/admin/dropbox/status")
async def admin_dropbox_status(_: dict = Depends(current_admin)):
    st = await dbx.status(db)
    st["redirect_uri"] = dbx.redirect_uri()
    return st


@api.get("/admin/dropbox/oauth/start")
async def dropbox_oauth_start(_: dict = Depends(current_admin)):
    return {"url": await dbx.start_url(db)}


def _done_page(ok: bool, reason: str = "") -> HTMLResponse:
    admin = os.environ["FRONTEND_URL"].rstrip("/") + "/admin"
    title = "Dropbox connected. All is good." if ok else "Dropbox connection failed"
    body = "You can close this tab and go back to the app." if ok else html.escape(reason)
    color = "#1f9d55" if ok else "#e8262f"
    return HTMLResponse(f"""<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><title>{title}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8f0;font-family:system-ui,sans-serif;color:#2d2422">
<div style="max-width:460px;padding:40px;text-align:center"><h1 data-testid="oauth-result-title" style="color:{color};font-size:28px">{title}</h1>
<p data-testid="oauth-result-message">{body}</p><a href="{admin}" style="display:inline-block;margin-top:16px;padding:12px 24px;border-radius:999px;background:#2d2422;color:#fff;text-decoration:none">Back to admin</a></div>
<script>try{{if(window.opener){{window.opener.postMessage({{dropbox:{'true' if ok else 'false'}}},'*');{'setTimeout(()=>window.close(),1500);' if ok else ''}}}}}catch(e){{}}</script></body></html>""")


@api.get("/dropbox/oauth/callback")
async def dropbox_oauth_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error or not code or not state:
        return _done_page(False, "You cancelled or Dropbox refused access." if error else "Missing response from Dropbox.")
    try:
        await dbx.finish_oauth(db, code, state)
    except HTTPException as e:
        logger.error("Dropbox OAuth failed: %s", e.detail)
        return _done_page(False, str(e.detail))
    return _done_page(True)


@api.delete("/admin/dropbox/connection")
async def dropbox_disconnect(_: dict = Depends(current_admin)):
    await dbx.disconnect(db)
    return {"ok": True}


@api.get("/admin/dropbox/folders")
async def dropbox_folders(path: str = "", _: dict = Depends(current_admin)):
    c = await dbx.client(db)
    items = await dbx.list_folder(c, path)
    return {"path": path, "items": [i for i in items if i["type"] == "folder"]}


app.include_router(api)
app.include_router(collab.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ["FRONTEND_URL"]],
    allow_methods=["*"],
    allow_headers=["*"],
)

SEED = [
    ("GWA", "Gods With Amnesia", "worlds", "/covers/gwa.jpg"),
    ("Yakshalokaus", "", "worlds", "/covers/yakshalokaus.jpg"),
    ("Jasmin's Journey", "", "projects", "/covers/jasmin.jpg"),
    ("WBA", "Wealth Builders Association", "presentations", "/covers/wba.jpg"),
    ("Riley's Magical Meals", "", "media", "/covers/riley.jpg"),
]


async def seed():
    email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": email}):
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "name": "Admin", "role": "admin",
                                   "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]), "created_at": now_iso()})
    if await db.projects.count_documents({}) == 0:
        for i, (title, sub, cat, cover) in enumerate(SEED):
            await db.projects.insert_one({"id": str(uuid.uuid4()), "slug": slugify(title.replace("'", "")), "title": title,
                                          "subtitle": sub, "category": cat, "cover_url": cover, "dropbox_path": "",
                                          "description": "[Add a short description of this project in the admin panel]",
                                          "order": i, "created_at": now_iso(), "updated_at": now_iso()})


@app.on_event("startup")
async def startup():
    await seed()
    app.state.index_task = asyncio.create_task(ensure_indexes())
    app.state.flush_task = asyncio.create_task(collab.flush_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    app.state.flush_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
