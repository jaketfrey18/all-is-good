import asyncio
import logging
import os
import re
import subprocess
import tempfile
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

import dropbox_svc as dbx
from core import db, now_iso, current_user, user_by_id, member_slugs, require_member
from sessions import receive_chunk, get_object, put_object, parts_to_dropbox, can_write, safe, disposition, APP_NAME

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
_cache: "OrderedDict[str, bytes]" = OrderedDict()
TYPE_HINTS = {
    "audio": {"beat", "beats", "track", "song", "music", "instrumental", "loop", "vocal", "vocals", "sample", "audio", "melody", "hook", "sound"},
    "video": {"video", "clip", "footage", "broll", "scene", "shot"},
    "image": {"image", "photo", "picture", "art", "cover", "artwork", "logo", "still"},
    "doc": {"doc", "script", "pdf", "deck", "notes", "lyrics", "document"},
}


def kind(ext: str) -> str:
    k = dbx.kind_of(ext or "")
    return "doc" if k == "pdf" else k


def norm_tags(tags) -> list:
    if isinstance(tags, str):
        tags = tags.split(",")
    out = []
    for t in tags or []:
        t = re.sub(r"\s+", " ", str(t).strip().lower().lstrip("#"))[:30]
        if t and t not in out:
            out.append(t)
    return out[:20]


def words(text: str) -> set:
    toks = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", (text or "").lower())
    out = set()
    for i, t in enumerate(toks):
        out |= {t, t.replace("-", "")}
        if i + 1 < len(toks):
            out.add(t.replace("-", "") + toks[i + 1].replace("-", ""))
    return {w for w in out if len(w) > 1}


def mint(user: dict, aid: str) -> str:
    payload = {"sub": user["id"], "type": "media", "aid": aid, "exp": datetime.now(timezone.utc) + timedelta(hours=6)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


def read_media_token(token: str, aid: str) -> str:
    try:
        p = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "This media link expired. Reopen the asset.")
    if p.get("type") != "media" or p.get("aid") != aid:
        raise HTTPException(401, "Invalid media link")
    return p["sub"]


async def titles() -> dict:
    return {p["slug"]: p["title"] for p in await db.projects.find({}, {"_id": 0, "slug": 1, "title": 1}).to_list(500)}


async def get_asset(aid: str, user: dict) -> dict:
    a = await db.assets.find_one({"id": aid, "is_deleted": False}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Asset not found")
    await require_member(a["world_slug"], user)
    return a


async def resolve(a: dict, user: dict) -> dict:
    """Follow a reference to its original; raises 403 when the user can't access the source World."""
    if a["kind"] != "reference":
        return a
    src = a["source"]
    await require_member(src["world_slug"], user)
    if src.get("asset_id"):
        orig = await db.assets.find_one({"id": src["asset_id"], "is_deleted": False}, {"_id": 0})
        if not orig:
            raise HTTPException(404, "The original recording was deleted")
        return orig
    return {"kind": "file", "world_slug": src["world_slug"], "path": src["path"], "name": src["name"], "ext": src["ext"]}


async def media_url(aid: str, user: dict, internal: bool = False) -> str:
    a = await resolve(await get_asset(aid, user), user)
    if a["kind"] == "file":
        return await dbx.temp_link(await dbx.client(db), a["path"])
    return f"{'http://127.0.0.1:8001' if internal else ''}/api/assets/{a['id']}/media?token={mint(user, a['id'])}"


def shape(a: dict, allowed: list, names: dict) -> dict:
    a = {k: v for k, v in a.items() if k not in ("storage_path", "is_deleted", "_id")}
    a["world_title"] = names.get(a["world_slug"], a["world_slug"])
    if a["kind"] == "reference":
        a["source"]["world_title"] = names.get(a["source"]["world_slug"], a["source"]["world_slug"])
        a["accessible"] = a["source"]["world_slug"] in allowed and not a.get("source_deleted")
    else:
        a["accessible"] = True
    return a


# ---------- Library ----------
@router.get("/assets")
async def list_assets(world: str, user: dict = Depends(current_user)):
    await require_member(world, user)
    allowed, names = await member_slugs(user), await titles()
    rows = await db.assets.find({"world_slug": world, "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [shape(a, allowed, names) for a in rows]


def remux(raw: bytes) -> tuple:
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in.webm", Path(d) / "out.webm"
        src.write_bytes(raw)
        from clips import FFMPEG
        for codec in (["-c", "copy"], ["-c:a", "libopus", "-b:a", "160k"]):
            r = subprocess.run([FFMPEG, "-hide_banner", "-y", "-i", str(src), "-vn", *codec, str(dst)], capture_output=True, timeout=600)
            if r.returncode == 0 and dst.exists() and dst.stat().st_size > 0:
                times = re.findall(rb"time=(\d+):(\d+):([\d.]+)", r.stderr)
                h, mi, s = times[-1] if times else (b"0", b"0", b"0")
                return dst.read_bytes(), int(h) * 3600 + int(mi) * 60 + float(s)
    raise HTTPException(415, "This recording couldn't be read. Try recording again in Chrome or Edge.")


@router.post("/assets/recordings")
async def upload_recording(world_slug: str = Form(...), name: str = Form(...), tags: str = Form(""),
                           upload_id: str = Form(...), index: int = Form(...), total: int = Form(...),
                           file: UploadFile = File(...), user: dict = Depends(current_user)):
    world = await require_member(world_slug, user)
    done = await receive_chunk(upload_id, index, total, file, user)
    if not done:
        return {"received": index}
    raw = b"".join([await asyncio.to_thread(get_object, p) for p in done["parts"]])
    data, dur = await asyncio.to_thread(remux, raw)
    path = f"{APP_NAME}/recordings/{world_slug}/{uuid.uuid4()}.webm"
    res = await asyncio.to_thread(put_object, path, data, "audio/webm")
    fname = safe(name.strip() or "Recording")
    doc = {"id": str(uuid.uuid4()), "kind": "recording", "world_slug": world_slug, "name": fname, "type": "audio", "ext": "webm",
           "tags": norm_tags(tags), "size": len(data), "duration": round(dur, 2), "content_type": "audio/webm",
           "storage_path": res.get("path", path), "status": "in_app", "dropbox_path": None, "owner_id": user["id"],
           "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.assets.insert_one(doc)
    if world.get("dropbox_path") and await can_write():
        asyncio.create_task(push_recording(doc["id"]))
    return shape(doc, [world_slug], await titles())


async def push_recording(aid: str):
    a = await db.assets.find_one({"id": aid}, {"_id": 0})
    w = await db.projects.find_one({"slug": a["world_slug"]}, {"_id": 0, "dropbox_path": 1})
    try:
        dest = await asyncio.to_thread(parts_to_dropbox, await dbx.client(db), [a["storage_path"]], f"{w['dropbox_path'].rstrip('/')}/Recordings/{a['name']}.webm")
        await db.assets.update_one({"id": aid}, {"$set": {"status": "in_dropbox", "dropbox_path": dest}})
    except Exception as exc:
        logger.error("recording push %s failed: %s", aid, exc)
        await db.assets.update_one({"id": aid}, {"$set": {"status": "error", "error": str(exc)[-300:]}})


@router.post("/assets/{aid}/sync")
async def sync_recording(aid: str, user: dict = Depends(current_user)):
    a = await get_asset(aid, user)
    w = await db.projects.find_one({"slug": a["world_slug"]}, {"_id": 0, "dropbox_path": 1})
    if a["kind"] != "recording" or not w.get("dropbox_path"):
        raise HTTPException(409, "Only recordings in a World with a Dropbox folder can be sent")
    if not await can_write():
        raise HTTPException(409, "Dropbox saving is off. Tick files.content.write in your Dropbox app, then reconnect Dropbox in Admin.")
    await push_recording(aid)
    return await db.assets.find_one({"id": aid}, {"_id": 0, "status": 1, "dropbox_path": 1, "error": 1})


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tags: Optional[List[str]] = None


@router.patch("/assets/{aid}")
async def update_asset(aid: str, body: AssetUpdate, user: dict = Depends(current_user)):
    a = await get_asset(aid, user)
    data = {"updated_at": now_iso()}
    if body.name is not None and body.name.strip():
        data["name"] = safe(body.name)
    if body.tags is not None:
        data["tags"] = norm_tags(body.tags)
    await db.assets.update_one({"id": aid}, {"$set": data})
    if "tags" in data and a["kind"] == "recording":
        await db.assets.update_many({"source.asset_id": aid}, {"$set": {"tags": data["tags"], "source.tags": data["tags"]}})
    return {"ok": True, **data}


@router.delete("/assets/{aid}")
async def delete_asset(aid: str, user: dict = Depends(current_user)):
    a = await get_asset(aid, user)
    if user.get("role") != "admin" and a["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the person who added this can remove it")
    await db.assets.update_one({"id": aid}, {"$set": {"is_deleted": True}})
    if a["kind"] == "recording":
        await db.assets.update_many({"source.asset_id": aid}, {"$set": {"source_deleted": True}})
    return {"ok": True}


def _wav(data: bytes) -> bytes:
    from clips import FFMPEG
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", "pipe:0", "-f", "wav", "-acodec", "pcm_s16le", "pipe:1"], input=data, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise HTTPException(500, "WAV conversion failed")
    return r.stdout


async def _bytes(a: dict) -> bytes:
    key = a["storage_path"]
    if key not in _cache:
        _cache[key] = await asyncio.to_thread(get_object, key)
        while len(_cache) > 4:
            _cache.popitem(last=False)
    _cache.move_to_end(key)
    return _cache[key]


@router.get("/assets/{aid}/media")
async def asset_media(aid: str, request: Request, token: str = "", format: str = "webm", dl: int = 0):
    user = await user_by_id(read_media_token(token, aid))
    if not user:
        raise HTTPException(404, "Not found")
    a = await resolve(await get_asset(aid, user), user)
    if a["kind"] != "recording":
        raise HTTPException(400, "Not a recording")
    data = await _bytes(a)
    ctype, name = a["content_type"], f"{a['name']}.webm"
    if format == "wav":
        data, ctype, name = await asyncio.to_thread(_wav, data), "audio/wav", f"{a['name']}.wav"
    headers = {"Accept-Ranges": "bytes", "Content-Disposition": disposition(name, bool(dl))}
    m = re.match(r"bytes=(\d*)-(\d*)", request.headers.get("range", ""))
    if m and format != "wav":
        size = len(data)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        end = min(size - 1, int(m.group(2))) if m.group(1) and m.group(2) else size - 1
        if start >= size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        return Response(data[start:end + 1], status_code=206, media_type=ctype, headers={**headers, "Content-Range": f"bytes {start}-{end}/{size}"})
    return Response(data, media_type=ctype, headers=headers)


@router.get("/assets/{aid}/link")
async def asset_link(aid: str, user: dict = Depends(current_user)):
    return {"url": await media_url(aid, user)}


# ---------- Cross-World references ----------
class ReferenceIn(BaseModel):
    world_slug: str
    source_world: str
    path: Optional[str] = None
    asset_id: Optional[str] = None
    name: Optional[str] = None
    size: Optional[int] = None


@router.post("/assets/reference")
async def create_reference(body: ReferenceIn, user: dict = Depends(current_user)):
    await require_member(body.world_slug, user)
    src_world = await require_member(body.source_world, user)
    if body.world_slug == body.source_world:
        raise HTTPException(400, "This asset already lives in this World")
    if body.asset_id:
        orig = await db.assets.find_one({"id": body.asset_id, "world_slug": body.source_world, "kind": "recording", "is_deleted": False}, {"_id": 0})
        if not orig:
            raise HTTPException(404, "Original not found")
        src = {"world_slug": body.source_world, "asset_id": orig["id"], "path": None, "name": orig["name"], "ext": orig["ext"],
               "size": orig["size"], "owner_id": orig["owner_id"], "tags": orig.get("tags", []), "type": orig["type"]}
        dup = {"source.asset_id": orig["id"]}
    else:
        if not body.path or not dbx.inside(src_world.get("dropbox_path", ""), body.path):
            raise HTTPException(403, "File is outside the source World's folder")
        name = body.path.rsplit("/", 1)[-1]
        meta = await db.file_meta.find_one({"world_slug": body.source_world, "path_lower": body.path.lower()}, {"_id": 0, "tags": 1})
        src = {"world_slug": body.source_world, "asset_id": None, "path": body.path, "name": name,
               "ext": name.rsplit(".", 1)[-1].lower() if "." in name else "", "size": body.size, "owner_id": None, "tags": (meta or {}).get("tags", [])}
        dup = {"source.path": body.path}
    existing = await db.assets.find_one({"world_slug": body.world_slug, "kind": "reference", "is_deleted": False, **dup}, {"_id": 0})
    if existing:
        return shape(existing, await member_slugs(user), await titles())
    doc = {"id": str(uuid.uuid4()), "kind": "reference", "world_slug": body.world_slug, "name": body.name or src["name"].rsplit(".", 1)[0],
           "type": src.get("type") or kind(src["ext"]), "ext": src["ext"], "tags": src["tags"], "source": src, "owner_id": user["id"],
           "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.assets.insert_one(doc)
    return shape(doc, await member_slugs(user), await titles())


class FileTagsIn(BaseModel):
    world_slug: str
    path: str
    size: Optional[int] = None
    tags: List[str]


@router.put("/file-tags")
async def set_file_tags(body: FileTagsIn, user: dict = Depends(current_user)):
    w = await require_member(body.world_slug, user)
    if not dbx.inside(w.get("dropbox_path", ""), body.path):
        raise HTTPException(403, "File is outside this World's folder")
    name = body.path.rsplit("/", 1)[-1]
    tags = norm_tags(body.tags)
    await db.file_meta.update_one({"world_slug": body.world_slug, "path_lower": body.path.lower()},
                                  {"$set": {"path": body.path, "name": name, "ext": name.rsplit(".", 1)[-1].lower() if "." in name else "",
                                            "size": body.size, "tags": tags, "updated_at": now_iso()}}, upsert=True)
    return {"tags": tags}


def _file_item(m: dict, names: dict) -> dict:
    return {"type": "file", "name": m["name"], "path": m["path"], "ext": m["ext"], "size": m.get("size"), "thumb": kind(m["ext"]) == "image",
            "project_slug": m["world_slug"], "project_title": names.get(m["world_slug"], m["world_slug"]), "tags": m.get("tags", [])}


def _rec_item(a: dict, names: dict) -> dict:
    return {"type": "file", "asset_id": a["id"], "name": f"{a['name']}.webm", "path": "", "ext": "webm", "size": a["size"],
            "project_slug": a["world_slug"], "project_title": names.get(a["world_slug"], a["world_slug"]), "tags": a.get("tags", []), "source": "recording", "media_type": "audio"}


def mtype(f: dict) -> str:
    return f.get("media_type") or kind(f.get("ext", ""))


async def augment_search(files: list, user: dict, allowed: list, q: str, kind_f: Optional[str], tag: Optional[str], world: Optional[str]) -> list:
    names = await titles()
    scope = [world] if world and world in allowed else ([] if world else allowed)
    metas = {(m["world_slug"], m["path_lower"]): m for m in await db.file_meta.find({"world_slug": {"$in": scope}}, {"_id": 0}).to_list(5000)}
    for f in files:
        m = metas.get((f.get("project_slug"), (f.get("path") or "").lower()))
        f["tags"] = m["tags"] if m else []
    seen = {(f.get("project_slug"), (f.get("path") or "").lower()) for f in files}
    rx = re.compile(re.escape(q), re.I) if q else None
    for key, m in metas.items():
        if key in seen:
            continue
        if (tag and tag.lower() in m.get("tags", [])) or (rx and any(rx.search(t) for t in m.get("tags", []))):
            files.append(_file_item(m, names))
    aq = {"world_slug": {"$in": scope}, "kind": "recording", "is_deleted": False}
    for a in await db.assets.find(aq, {"_id": 0}).to_list(2000):
        if (tag and tag.lower() in a.get("tags", [])) or (rx and (rx.search(a["name"]) or any(rx.search(t) for t in a.get("tags", [])))) or (not q and not tag):
            files.append(_rec_item(a, names))
    if tag:
        files = [f for f in files if tag.lower() in f.get("tags", [])]
    if kind_f:
        files = [f for f in files if f["type"] == "file" and mtype(f) == ("doc" if kind_f == "pdf" else kind_f)] if kind_f != "pdf" else [f for f in files if f.get("ext") == "pdf"]
    return files


# ---------- Suggestions ----------
@router.get("/assets/suggest")
async def suggest(world: str, need: str = "", user: dict = Depends(current_user)):
    w = await require_member(world, user)
    allowed, names = await member_slugs(user), await titles()
    others = [s for s in allowed if s != world]
    if need.strip():
        ctx = words(need)
    else:
        proj = await db.projects.find_one({"slug": world}, {"_id": 0, "title": 1, "subtitle": 1, "category": 1})
        own = [t for a in await db.assets.find({"world_slug": world, "is_deleted": False}, {"_id": 0, "tags": 1}).to_list(500) for t in a.get("tags", [])]
        own += [t for m in await db.file_meta.find({"world_slug": world}, {"_id": 0, "tags": 1}).to_list(2000) for t in m.get("tags", [])]
        ctx = words(" ".join(own)) | words(f"{proj.get('subtitle', '')}")
    hint = next((k for k, v in TYPE_HINTS.items() if ctx & v), None)
    cands = [_rec_item(a, names) for a in await db.assets.find({"world_slug": {"$in": others}, "kind": "recording", "is_deleted": False}, {"_id": 0}).to_list(1000)]
    cands += [_file_item(m, names) for m in await db.file_meta.find({"world_slug": {"$in": others}, "tags.0": {"$exists": True}}, {"_id": 0}).to_list(2000)]
    if need.strip() and (await dbx.status(db))["connected"]:
        c = await dbx.client(db)
        roots = await db.projects.find({"slug": {"$in": others}, "dropbox_path": {"$ne": ""}}, {"_id": 0, "slug": 1, "dropbox_path": 1}).to_list(50)
        found = await asyncio.gather(*[dbx.search(c, need.strip(), r["dropbox_path"], 10) for r in roots], return_exceptions=True)
        known = {(x["project_slug"], x["path"].lower()) for x in cands}
        for r, res in zip(roots, found):
            for f in res if isinstance(res, list) else []:
                if f["type"] == "file" and (r["slug"], f["path"].lower()) not in known:
                    cands.append({**f, "project_slug": r["slug"], "project_title": names.get(r["slug"], r["slug"]), "tags": []})
    out = []
    for f in cands:
        tag_hits = [t for t in f.get("tags", []) if words(t) & ctx]
        name_hits = sorted(words(f["name"].rsplit(".", 1)[0]) & ctx - {w2 for t in tag_hits for w2 in words(t)})
        type_hit = hint and mtype(f) == hint
        score = 3 * len(tag_hits) + 2 * len(name_hits) + (1 if type_hit else 0)
        if not (tag_hits or name_hits):
            continue
        why = []
        if tag_hits:
            why.append("Tagged " + ", ".join(tag_hits))
        if name_hits:
            why.append("Name mentions " + ", ".join(f"“{n}”" for n in name_hits[:3]))
        if type_hit:
            why.append({"audio": "Music/audio", "video": "Video", "image": "Image", "doc": "Document"}[hint] + " like you need")
        out.append({**f, "score": score, "why": " · ".join(why) + f" · from {f['project_title']}"})
    out.sort(key=lambda x: -x["score"])
    return {"context": sorted(ctx)[:12], "items": out[:8], "world_title": w["title"]}
