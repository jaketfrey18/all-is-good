import asyncio
import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

import dropbox_svc as dbx
from auth import decode_token
from clips import upload_big
from collab import visible_filter, require_world, is_admin
from core import db, now_iso, current_user, user_by_id

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "cooked-world"
TMP = Path(tempfile.gettempdir()) / "session_uploads"
TMP.mkdir(exist_ok=True)
MAX_BYTES = 1024 * 1024 * 1024
CATEGORIES = ["Audio", "Video", "Images", "Docs", "Other"]
KIND_TO_CAT = {"audio": "Audio", "video": "Video", "image": "Images", "pdf": "Docs", "doc": "Docs"}
SYNC_LOCK = asyncio.Semaphore(2)
_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def _storage(method: str, path: str, headers: Optional[dict] = None, data=None):
    for attempt in range(2):
        if attempt and hasattr(data, "seek"):
            data.seek(0)
        r = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(attempt > 0), **(headers or {})}, data=data, timeout=600)
        if r.status_code == 404 and attempt == 0:
            continue
        r.raise_for_status()
        return r


def put_object(path: str, fp, content_type: str) -> dict:
    return _storage("PUT", path, data=fp, headers={"Content-Type": content_type}).json()


def get_object(path: str) -> bytes:
    return _storage("GET", path).content


def category_for(name: str) -> str:
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    return KIND_TO_CAT.get(dbx.kind_of(ext), "Other")


def safe(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "", name).strip()[:120] or "file"


async def can_write() -> bool:
    row = await db.connections.find_one({"_id": "dropbox"}, {"scopes": 1})
    return "files.content.write" in (row or {}).get("scopes", [])


async def get_session(sid: str, user: dict) -> dict:
    s = await db.sessions.find_one({"id": sid, **visible_filter(user)}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Session not found")
    return s


async def get_file(fid: str, user: dict) -> dict:
    f = await db.session_files.find_one({"id": fid, "is_deleted": False}, {"_id": 0})
    if not f:
        raise HTTPException(404, "File not found")
    await get_session(f["session_id"], user)
    return f


# ---------- Sessions ----------
class SessionIn(BaseModel):
    world_slug: str
    name: str = Field(min_length=1, max_length=80)
    notes: str = Field(default="", max_length=2000)


class SessionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=2000)


@router.get("/sessions")
async def list_sessions(world: Optional[str] = None, user: dict = Depends(current_user)):
    q = {**visible_filter(user), **({"world_slug": world} if world else {})}
    rows = await db.sessions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    ids = [r["id"] for r in rows]
    counts = {}
    async for c in db.session_files.aggregate([
        {"$match": {"session_id": {"$in": ids}, "is_deleted": False}},
        {"$group": {"_id": {"s": "$session_id", "c": "$category"}, "n": {"$sum": 1}}},
    ]):
        counts.setdefault(c["_id"]["s"], {})[c["_id"]["c"]] = c["n"]
    for r in rows:
        r["counts"] = counts.get(r["id"], {})
        r["file_count"] = sum(r["counts"].values())
    return rows


@router.post("/sessions")
async def create_session(body: SessionIn, user: dict = Depends(current_user)):
    world = await require_world(body.world_slug)
    if not body.name.strip():
        raise HTTPException(400, "Give the session a name")
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    root = world.get("dropbox_path", "").rstrip("/")
    doc = {"id": str(uuid.uuid4()), "world_slug": body.world_slug, "name": body.name.strip(), "notes": body.notes,
           "folder": f"{root}/Sessions/{day} {safe(body.name)}" if root else "",
           "owner_id": user["id"], "shared_with": [], "created_at": now_iso(), "updated_at": now_iso()}
    await db.sessions.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "counts": {}, "file_count": 0}


@router.get("/sessions/{sid}")
async def read_session(sid: str, user: dict = Depends(current_user)):
    s = await get_session(sid, user)
    s["files"] = await db.session_files.find({"session_id": sid, "is_deleted": False}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    s["can_write"] = await can_write()
    return s


@router.put("/sessions/{sid}")
async def update_session(sid: str, body: SessionUpdate, user: dict = Depends(current_user)):
    await get_session(sid, user)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = now_iso()
    await db.sessions.update_one({"id": sid}, {"$set": data})
    return {"ok": True}


@router.delete("/sessions/{sid}")
async def delete_session(sid: str, user: dict = Depends(current_user)):
    s = await get_session(sid, user)
    if not is_admin(user) and s["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner can delete this session")
    await db.sessions.delete_one({"id": sid})
    await db.session_files.update_many({"session_id": sid}, {"$set": {"is_deleted": True}})
    return {"ok": True}


# ---------- Files ----------
@router.post("/sessions/{sid}/upload")
async def upload_chunk(sid: str, upload_id: str = Form(...), index: int = Form(...), total: int = Form(...),
                       name: str = Form(...), file: UploadFile = File(...), user: dict = Depends(current_user)):
    s = await get_session(sid, user)
    if not re.fullmatch(r"[a-zA-Z0-9-]{8,64}", upload_id) or total < 1 or not 0 <= index < total:
        raise HTTPException(400, "Bad upload chunk")
    part = TMP / f"{upload_id}.part"
    if index == 0 and part.exists():
        part.unlink()
    with open(part, "ab") as out:
        out.write(await file.read())
    size = part.stat().st_size
    if size > MAX_BYTES:
        part.unlink()
        raise HTTPException(413, "Files can be up to 1 GB")
    if index < total - 1:
        return {"received": index}
    fname = safe(name)
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "bin"
    ctype = file.content_type if file.content_type and file.content_type != "application/octet-stream" else "application/octet-stream"
    path = f"{APP_NAME}/sessions/{sid}/{uuid.uuid4()}.{ext}"
    try:
        with open(part, "rb") as fp:
            res = await asyncio.to_thread(put_object, path, fp, ctype)
    except Exception as exc:
        logger.error("storage put failed: %s", exc)
        raise HTTPException(502, "Couldn't store the file. Please try again.")
    finally:
        part.unlink(missing_ok=True)
    doc = {"id": str(uuid.uuid4()), "session_id": sid, "world_slug": s["world_slug"], "name": fname, "ext": ext, "size": size,
           "content_type": ctype, "category": category_for(fname), "storage_path": res.get("path", path), "status": "in_app",
           "dropbox_path": None, "error": None, "uploaded_by": user["id"], "is_deleted": False, "created_at": now_iso()}
    await db.session_files.insert_one(doc)
    doc.pop("_id", None)
    await db.sessions.update_one({"id": sid}, {"$set": {"updated_at": now_iso()}})
    if s["folder"] and await can_write():
        asyncio.create_task(sync_file(doc["id"]))
    return doc


class FileUpdate(BaseModel):
    category: str


@router.patch("/session-files/{fid}")
async def update_file(fid: str, body: FileUpdate, user: dict = Depends(current_user)):
    f = await get_file(fid, user)
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Unknown category")
    if f["status"] in ("syncing", "in_dropbox"):
        raise HTTPException(409, "This file is already in Dropbox")
    await db.session_files.update_one({"id": fid}, {"$set": {"category": body.category}})
    return {"ok": True}


@router.delete("/session-files/{fid}")
async def delete_file(fid: str, user: dict = Depends(current_user)):
    await get_file(fid, user)
    await db.session_files.update_one({"id": fid}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@router.get("/session-files/{fid}/download")
async def download_file(fid: str, token: str = ""):
    user = await user_by_id(decode_token(token)["sub"])
    if not user:
        raise HTTPException(404, "Not found")
    f = await get_file(fid, user)
    data = await asyncio.to_thread(get_object, f["storage_path"])
    ascii_name = f["name"].encode("ascii", "ignore").decode() or "file"
    disp = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(f["name"])}'
    return Response(content=data, media_type=f["content_type"], headers={"Content-Disposition": disp})


async def sync_file(fid: str):
    async with SYNC_LOCK:
        f = await db.session_files.find_one({"id": fid, "is_deleted": False}, {"_id": 0})
        if not f or f["status"] in ("syncing", "in_dropbox"):
            return
        s = await db.sessions.find_one({"id": f["session_id"]}, {"_id": 0, "folder": 1})
        set_ = lambda **kw: db.session_files.update_one({"id": fid}, {"$set": kw})  # noqa: E731
        await set_(status="syncing", error=None)
        tmp = TMP / f"sync-{fid}"
        try:
            tmp.write_bytes(await asyncio.to_thread(get_object, f["storage_path"]))
            dest = await upload_big(await dbx.client(db), tmp, f"{s['folder']}/{f['category']}/{f['name']}")
            await set_(status="in_dropbox", dropbox_path=dest, synced_at=now_iso())
        except Exception as exc:
            logger.error("session sync %s failed: %s", fid, exc)
            await set_(status="error", error=str(exc)[-300:])
        finally:
            tmp.unlink(missing_ok=True)


@router.post("/sessions/{sid}/sync")
async def sync_session(sid: str, user: dict = Depends(current_user)):
    s = await get_session(sid, user)
    if not s["folder"]:
        raise HTTPException(409, "This world has no Dropbox folder linked yet.")
    if not await can_write():
        raise HTTPException(409, "Dropbox saving is off. In your Dropbox app's Permissions tab tick files.content.write, click Submit, then Disconnect and Connect Dropbox again in Admin.")
    files = await db.session_files.find({"session_id": sid, "is_deleted": False, "status": {"$in": ["in_app", "error"]}}, {"_id": 0, "id": 1}).to_list(1000)
    for f in files:
        asyncio.create_task(sync_file(f["id"]))
    return {"queued": len(files)}
