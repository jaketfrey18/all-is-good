import asyncio
import hashlib
import logging
import re
import time
import uuid
from typing import Optional, List

from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Response
from pydantic import BaseModel, Field
from pycrdt import Doc

import dropbox_svc as dbx
from auth import hash_password, decode_token
from core import db, now_iso, current_user, current_admin, user_by_id

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
PALETTE = ["#ff4757", "#ffa502", "#2ed573", "#1e90ff", "#ff6b81", "#eccc68", "#7bed9f", "#70a1ff", "#a29bfe"]


def color_for(uid: str) -> str:
    return PALETTE[int(hashlib.md5(uid.encode()).hexdigest(), 16) % len(PALETTE)]


def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u.get("name") or u["email"].split("@")[0], "email": u["email"],
            "role": u.get("role"), "color": color_for(u["id"])}


def is_admin(u):
    return u.get("role") == "admin"


# ---------- Users ----------
class NewUser(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: str
    password: str = Field(min_length=8, max_length=128)


@router.get("/users")
async def list_users(_: dict = Depends(current_user)):
    return [public_user(u) for u in await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)]


@router.post("/admin/users")
async def create_user(body: NewUser, _: dict = Depends(current_admin)):
    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Enter a valid email")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "That email already has an account")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": body.name.strip(), "role": "collaborator",
           "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db.users.insert_one(doc)
    return public_user(doc)


@router.delete("/admin/users/{uid}")
async def delete_user(uid: str, admin: dict = Depends(current_admin)):
    if uid == admin["id"]:
        raise HTTPException(400, "You can't remove your own account")
    res = await db.users.delete_one({"id": uid, "role": {"$ne": "admin"}})
    if not res.deleted_count:
        raise HTTPException(404, "Collaborator not found")
    await db.canvases.update_many({}, {"$pull": {"shared_with": uid}})
    await db.lyrics.update_many({}, {"$pull": {"shared_with": uid}})
    return {"ok": True}


# ---------- Access ----------
def visible_filter(user: dict) -> dict:
    return {} if is_admin(user) else {"$or": [{"owner_id": user["id"]}, {"shared_with": user["id"]}]}


async def get_canvas(cid: str, user: dict) -> dict:
    c = await db.canvases.find_one({"id": cid, **visible_filter(user)}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Canvas not found")
    return c


async def get_lyric(lid: str, user: dict) -> dict:
    doc = await db.lyrics.find_one({"id": lid}, {"_id": 0, "state": 0})
    if not doc:
        raise HTTPException(404, "Lyric document not found")
    if is_admin(user) or doc["owner_id"] == user["id"] or user["id"] in doc.get("shared_with", []):
        return doc
    if doc.get("canvas_id") and await db.canvases.find_one({"id": doc["canvas_id"], **visible_filter(user)}, {"_id": 1}):
        return doc
    raise HTTPException(404, "Lyric document not found")


async def require_world(slug: str) -> dict:
    p = await db.projects.find_one({"slug": slug}, {"_id": 0, "slug": 1, "title": 1, "dropbox_path": 1})
    if not p:
        raise HTTPException(404, "World not found")
    return p


class ShareIn(BaseModel):
    user_ids: List[str]


async def clean_ids(ids: List[str], owner_id: str) -> List[str]:
    found = await db.users.find({"id": {"$in": ids}}, {"id": 1}).to_list(500)
    return [u["id"] for u in found if u["id"] != owner_id]


# ---------- Canvases ----------
class CanvasIn(BaseModel):
    world_slug: str
    name: str = Field(default="Canvas", min_length=1, max_length=80)


class CanvasUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    items: Optional[list] = None
    edges: Optional[list] = None
    viewport: Optional[dict] = None


SUMMARY = {"_id": 0, "id": 1, "name": 1, "world_slug": 1, "owner_id": 1, "shared_with": 1, "updated_at": 1, "created_at": 1}


@router.get("/canvases")
async def list_canvases(world: Optional[str] = None, user: dict = Depends(current_user)):
    q = visible_filter(user)
    if world:
        q = {**q, "world_slug": world}
    return await db.canvases.find(q, SUMMARY).sort("updated_at", -1).to_list(500)


@router.post("/canvases")
async def create_canvas(body: CanvasIn, user: dict = Depends(current_user)):
    await require_world(body.world_slug)
    doc = {"id": str(uuid.uuid4()), "world_slug": body.world_slug, "name": body.name.strip(), "owner_id": user["id"],
           "shared_with": [], "items": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1},
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.canvases.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/canvases/{cid}")
async def read_canvas(cid: str, user: dict = Depends(current_user)):
    return await get_canvas(cid, user)


@router.put("/canvases/{cid}")
async def update_canvas(cid: str, body: CanvasUpdate, user: dict = Depends(current_user)):
    await get_canvas(cid, user)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = now_iso()
    await db.canvases.update_one({"id": cid}, {"$set": data})
    return {"ok": True, "updated_at": data["updated_at"]}


@router.delete("/canvases/{cid}")
async def delete_canvas(cid: str, user: dict = Depends(current_user)):
    c = await get_canvas(cid, user)
    if not is_admin(user) and c["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner can delete this canvas")
    await db.canvases.delete_one({"id": cid})
    return {"ok": True}


@router.put("/canvases/{cid}/share")
async def share_canvas(cid: str, body: ShareIn, user: dict = Depends(current_user)):
    c = await get_canvas(cid, user)
    ids = await clean_ids(body.user_ids, c["owner_id"])
    await db.canvases.update_one({"id": cid}, {"$set": {"shared_with": ids}})
    return {"shared_with": ids}


PRESENCE: dict = {}


@router.post("/canvases/{cid}/presence")
async def canvas_presence(cid: str, user: dict = Depends(current_user)):
    await get_canvas(cid, user)
    room = PRESENCE.setdefault(cid, {})
    room[user["id"]] = (public_user(user), time.time())
    return [u for u, ts in room.values() if time.time() - ts < 30]


# ---------- Lyrics ----------
class LyricIn(BaseModel):
    world_slug: str
    title: str = Field(default="Untitled lyrics", min_length=1, max_length=120)
    canvas_id: Optional[str] = None


class LyricPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    text: Optional[str] = Field(default=None, max_length=200000)


class VersionIn(BaseModel):
    content: dict
    text: str = Field(max_length=200000)
    label: str = Field(default="", max_length=80)


@router.get("/lyrics")
async def list_lyrics(world: Optional[str] = None, user: dict = Depends(current_user)):
    q = visible_filter(user)
    if world:
        q = {**q, "world_slug": world}
    return await db.lyrics.find(q, {"_id": 0, "state": 0, "text": 0}).sort("updated_at", -1).to_list(500)


@router.post("/lyrics")
async def create_lyric(body: LyricIn, user: dict = Depends(current_user)):
    await require_world(body.world_slug)
    if body.canvas_id:
        await get_canvas(body.canvas_id, user)
    doc = {"id": str(uuid.uuid4()), "world_slug": body.world_slug, "title": body.title.strip(), "owner_id": user["id"],
           "canvas_id": body.canvas_id, "shared_with": [], "text": "", "created_at": now_iso(), "updated_at": now_iso()}
    await db.lyrics.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("text", None)
    return doc


@router.get("/lyrics/{lid}")
async def read_lyric(lid: str, user: dict = Depends(current_user)):
    return await get_lyric(lid, user)


@router.patch("/lyrics/{lid}")
async def patch_lyric(lid: str, body: LyricPatch, user: dict = Depends(current_user)):
    await get_lyric(lid, user)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = now_iso()
    await db.lyrics.update_one({"id": lid}, {"$set": data})
    return {"ok": True}


@router.put("/lyrics/{lid}/share")
async def share_lyric(lid: str, body: ShareIn, user: dict = Depends(current_user)):
    doc = await get_lyric(lid, user)
    ids = await clean_ids(body.user_ids, doc["owner_id"])
    await db.lyrics.update_one({"id": lid}, {"$set": {"shared_with": ids}})
    return {"shared_with": ids}


@router.delete("/lyrics/{lid}")
async def delete_lyric(lid: str, user: dict = Depends(current_user)):
    doc = await get_lyric(lid, user)
    if not is_admin(user) and doc["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner can delete this document")
    await db.lyrics.delete_one({"id": lid})
    await db.lyric_versions.delete_many({"lyric_id": lid})
    return {"ok": True}


@router.get("/lyrics/{lid}/versions")
async def list_versions(lid: str, user: dict = Depends(current_user)):
    await get_lyric(lid, user)
    return await db.lyric_versions.find({"lyric_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/lyrics/{lid}/versions")
async def save_version(lid: str, body: VersionIn, user: dict = Depends(current_user)):
    await get_lyric(lid, user)
    last = await db.lyric_versions.find_one({"lyric_id": lid}, sort=[("created_at", -1)])
    if last and last["text"] == body.text and not body.label:
        return {"skipped": True}
    doc = {"id": str(uuid.uuid4()), "lyric_id": lid, "content": body.content, "text": body.text, "label": body.label,
           "author": public_user(user)["name"], "created_at": now_iso()}
    await db.lyric_versions.insert_one(doc)
    doc.pop("_id", None)
    return doc


def safe_name(title: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "", title).strip() or "lyrics"


@router.get("/lyrics/{lid}/export")
async def export_lyric(lid: str, user: dict = Depends(current_user)):
    doc = await get_lyric(lid, user)
    row = await db.lyrics.find_one({"id": lid}, {"text": 1})
    body = f"{doc['title']}\n\n{row.get('text', '')}\n"
    return Response(body, media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{safe_name(doc["title"])}.txt"'})


@router.post("/lyrics/{lid}/backup")
async def backup_lyric(lid: str, user: dict = Depends(current_user)):
    doc = await get_lyric(lid, user)
    world = await require_world(doc["world_slug"])
    if not world.get("dropbox_path"):
        raise HTTPException(409, "This world has no Dropbox folder linked")
    row = await db.lyrics.find_one({"id": lid}, {"text": 1})
    c = await dbx.client(db)
    path = await dbx.upload(db, c, f"{world['dropbox_path']}/Lyrics/{safe_name(doc['title'])}.txt",
                            f"{doc['title']}\n\n{row.get('text', '')}\n".encode())
    return {"path": path}


# ---------- Real-time sync (Yjs over WebSocket) ----------
MSG_UPDATE, MSG_AWARENESS, MSG_LEAVE = 0, 1, 2


class Room:
    def __init__(self, doc: Doc):
        self.doc = doc
        self.clients: dict = {}
        self.aw: dict = {}
        self.dirty = False


ROOMS: dict = {}
ROOM_LOCK = asyncio.Lock()


async def open_room(lid: str) -> Room:
    async with ROOM_LOCK:
        if lid not in ROOMS:
            doc = Doc()
            row = await db.lyrics.find_one({"id": lid}, {"state": 1})
            if row and row.get("state"):
                doc.apply_update(bytes(row["state"]))
            ROOMS[lid] = Room(doc)
        return ROOMS[lid]


async def persist(lid: str, room: Room):
    if room.dirty:
        room.dirty = False
        await db.lyrics.update_one({"id": lid}, {"$set": {"state": Binary(room.doc.get_update()), "updated_at": now_iso()}})


async def flush_loop():
    while True:
        await asyncio.sleep(1.5)
        for lid, room in list(ROOMS.items()):
            try:
                await persist(lid, room)
                if not room.clients:
                    ROOMS.pop(lid, None)
            except Exception as exc:
                logger.error("persist %s: %s", lid, exc)


async def broadcast(room: Room, sender, data: bytes):
    for ws in list(room.clients):
        if ws is not sender:
            try:
                await ws.send_bytes(data)
            except Exception:
                room.clients.pop(ws, None)


@router.websocket("/ws/lyrics/{lid}")
async def lyric_socket(websocket: WebSocket, lid: str, token: str = "", cid: str = ""):
    try:
        user = await user_by_id(decode_token(token)["sub"])
        if not user:
            raise HTTPException(401)
        await get_lyric(lid, user)
    except HTTPException:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    room = await open_room(lid)
    room.clients[websocket] = cid
    await websocket.send_bytes(bytes([MSG_UPDATE]) + room.doc.get_update())
    for aw in list(room.aw.values()):
        await websocket.send_bytes(aw)
    try:
        while True:
            msg = await websocket.receive_bytes()
            if not msg:
                continue
            kind, payload = msg[0], msg[1:]
            if kind == MSG_UPDATE:
                room.doc.apply_update(payload)
                room.dirty = True
                await broadcast(room, websocket, msg)
            elif kind == MSG_AWARENESS:
                room.aw[websocket] = msg
                await broadcast(room, websocket, msg)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        room.clients.pop(websocket, None)
        room.aw.pop(websocket, None)
        if cid:
            await broadcast(room, websocket, bytes([MSG_LEAVE]) + cid.encode())
        await persist(lid, room)
