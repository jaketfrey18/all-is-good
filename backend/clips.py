import asyncio
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional, List

import dropbox
import imageio_ffmpeg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import dropbox_svc as dbx
from auth import decode_token
from core import db, now_iso, current_user, user_by_id
from collab import visible_filter, require_world, is_admin

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = Path(__file__).parent / "exports"
OUT_DIR.mkdir(exist_ok=True)
SIZES = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350)}
RUN_LOCK = asyncio.Semaphore(1)


async def probe(url: str) -> dict:
    proc = await asyncio.create_subprocess_exec(FFMPEG, "-hide_banner", "-i", url, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await asyncio.wait_for(proc.communicate(), timeout=60)
    text = err.decode(errors="ignore")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", text)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0
    return {"duration": dur, "has_video": bool(re.search(r"Stream #.*Video:", text)) and "attached pic" not in text,
            "has_audio": bool(re.search(r"Stream #.*Audio:", text))}


async def get_project(pid: str, user: dict) -> dict:
    p = await db.clip_projects.find_one({"id": pid, **visible_filter(user)}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Clip project not found")
    return p


async def source_url(p: dict) -> str:
    world = await require_world(p["world_slug"])
    if not dbx.inside(world.get("dropbox_path", ""), p["source"]["path"]):
        raise HTTPException(403, "Source outside world folder")
    return await dbx.temp_link(await dbx.client(db), p["source"]["path"])


class ProjectIn(BaseModel):
    world_slug: str
    path: str
    name: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    clips: Optional[list] = None
    settings: Optional[dict] = None


def new_clip(name: str, start: float, end: float) -> dict:
    return {"id": uuid.uuid4().hex[:10], "name": name, "segments": [{"start": start, "end": end}], "aspect": "16:9",
            "crop": {"zoom": 1, "x": 0.5, "y": 0.5}, "volume": 1, "muted": False, "fade_in": 0, "fade_out": 0, "selected": True}


@router.get("/clip-projects")
async def list_projects(world: Optional[str] = None, user: dict = Depends(current_user)):
    q = {**visible_filter(user), **({"world_slug": world} if world else {})}
    return await db.clip_projects.find(q, {"_id": 0, "clips": 0}).sort("updated_at", -1).to_list(300)


@router.post("/clip-projects")
async def create_project(body: ProjectIn, user: dict = Depends(current_user)):
    world = await require_world(body.world_slug)
    if not dbx.inside(world.get("dropbox_path", ""), body.path):
        raise HTTPException(403, "File is outside this world's folder")
    name = body.path.rsplit("/", 1)[-1]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    url = await dbx.temp_link(await dbx.client(db), body.path)
    info = await probe(url)
    if not info["duration"]:
        raise HTTPException(400, "Couldn't read this media file")
    doc = {"id": str(uuid.uuid4()), "world_slug": body.world_slug, "owner_id": user["id"], "shared_with": [],
           "name": body.name or name.rsplit(".", 1)[0], "source": {"path": body.path, "name": name, "ext": ext, **info},
           "clips": [new_clip("Clip 1", 0, min(30.0, info["duration"]))],
           "settings": {"format": "mp4" if info["has_video"] else "mp3", "height": 1080},
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.clip_projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/clip-projects/{pid}")
async def read_project(pid: str, user: dict = Depends(current_user)):
    return await get_project(pid, user)


@router.get("/clip-projects/{pid}/source")
async def project_source(pid: str, user: dict = Depends(current_user)):
    return {"url": await source_url(await get_project(pid, user))}


@router.put("/clip-projects/{pid}")
async def update_project(pid: str, body: ProjectUpdate, user: dict = Depends(current_user)):
    await get_project(pid, user)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data["updated_at"] = now_iso()
    await db.clip_projects.update_one({"id": pid}, {"$set": data})
    return {"ok": True, "updated_at": data["updated_at"]}


@router.delete("/clip-projects/{pid}")
async def delete_project(pid: str, user: dict = Depends(current_user)):
    p = await get_project(pid, user)
    if not is_admin(user) and p["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner can delete this project")
    await db.clip_projects.delete_one({"id": pid})
    return {"ok": True}


# ---------- Export ----------
class ExportIn(BaseModel):
    clip_ids: List[str] = Field(min_length=1)
    format: str = "mp4"
    destination: str = "download"
    dropbox_folder: Optional[str] = None


def build_cmd(url: str, clip: dict, src: dict, fmt: str, out: str) -> tuple:
    segs = [s for s in clip["segments"] if s["end"] - s["start"] > 0.05]
    if not segs:
        raise ValueError("Clip has no segments")
    total = sum(s["end"] - s["start"] for s in segs)
    video = fmt == "mp4" and src["has_video"]
    audio = src["has_audio"]
    cmd = [FFMPEG, "-hide_banner", "-y", "-nostats", "-progress", "pipe:1"]
    for s in segs:
        cmd += ["-ss", f"{s['start']:.3f}", "-t", f"{s['end'] - s['start']:.3f}", "-i", url]
    parts, labels = [], ""
    W, H = SIZES.get(clip.get("aspect", "16:9"), SIZES["16:9"])
    c = clip.get("crop") or {}
    z, px, py = max(1.0, float(c.get("zoom", 1))), float(c.get("x", 0.5)), float(c.get("y", 0.5))
    sw, sh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
    vol = 0 if clip.get("muted") else float(clip.get("volume", 1))
    for i, s in enumerate(segs):
        d = s["end"] - s["start"]
        if video:
            parts.append(f"[{i}:v]fps=30,scale={sw}:{sh}:force_original_aspect_ratio=increase,crop={W}:{H}:(iw-{W})*{px:.3f}:(ih-{H})*{py:.3f},setsar=1,tpad=stop_mode=clone:stop_duration={d:.3f},trim=duration={d:.3f},setpts=PTS-STARTPTS[v{i}]")
            labels += f"[v{i}]"
        if audio:
            parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={vol:.2f},apad,atrim=duration={d:.3f},asetpts=PTS-STARTPTS[a{i}]")
            labels += f"[a{i}]"
    n = len(segs)
    parts.append(f"{labels}concat=n={n}:v={1 if video else 0}:a={1 if audio else 0}" + ("[vc]" if video else "") + ("[ac]" if audio else ""))
    fi, fo = float(clip.get("fade_in", 0)), float(clip.get("fade_out", 0))
    if video:
        vf = "[vc]" + (f"fade=t=in:st=0:d={fi}," if fi else "") + (f"fade=t=out:st={max(0, total - fo):.3f}:d={fo}," if fo else "") + "null[vo]"
        parts.append(vf)
    if audio:
        af = "[ac]" + (f"afade=t=in:st=0:d={fi}," if fi else "") + (f"afade=t=out:st={max(0, total - fo):.3f}:d={fo}," if fo else "") + "anull[ao]"
        parts.append(af)
    cmd += ["-filter_complex", ";".join(parts)]
    if video:
        cmd += ["-map", "[vo]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
    if audio:
        cmd += ["-map", "[ao]"]
        cmd += ["-c:a", "aac", "-b:a", "192k"] if fmt == "mp4" else (["-c:a", "libmp3lame", "-b:a", "256k"] if fmt == "mp3" else ["-c:a", "pcm_s16le"])
    if fmt == "mp4":
        cmd += ["-movflags", "+faststart"]
    cmd.append(out)
    return cmd, total


async def upload_big(c, local: Path, dest: str) -> str:
    def run():
        size = local.stat().st_size
        chunk = 32 * 1024 * 1024
        commit = dropbox.files.CommitInfo(path=dest, mode=dropbox.files.WriteMode.add, autorename=True)
        with open(local, "rb") as f:
            if size <= chunk:
                return c.files_upload(f.read(), dest, mode=dropbox.files.WriteMode.add, autorename=True).path_display
            start = c.files_upload_session_start(f.read(chunk))
            cursor = dropbox.files.UploadSessionCursor(session_id=start.session_id, offset=f.tell())
            while size - f.tell() > chunk:
                c.files_upload_session_append_v2(f.read(chunk), cursor)
                cursor.offset = f.tell()
            return c.files_upload_session_finish(f.read(), cursor, commit).path_display
    return await asyncio.to_thread(run)


async def run_job(job_id: str):
    async with RUN_LOCK:
        job = await db.clip_jobs.find_one({"id": job_id}, {"_id": 0})
        p = await db.clip_projects.find_one({"id": job["project_id"]}, {"_id": 0})
        set_ = lambda **kw: db.clip_jobs.update_one({"id": job_id}, {"$set": kw})  # noqa: E731
        try:
            clip = next(c for c in p["clips"] if c["id"] == job["clip_id"])
            await set_(status="running", progress=0)
            url = await dbx.temp_link(await dbx.client(db), p["source"]["path"])
            out = OUT_DIR / f"{job_id}.{job['format']}"
            cmd, total = build_cmd(url, clip, p["source"], job["format"], str(out))
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            err_task = asyncio.create_task(proc.stderr.read())
            async for line in proc.stdout:
                m = re.match(rb"out_time_us=(\d+)", line)
                if m and total:
                    await set_(progress=min(99, int(int(m.group(1)) / 1e6 / total * 100)))
            await proc.wait()
            if proc.returncode != 0:
                raise RuntimeError((await err_task).decode(errors="ignore")[-600:])
            dest = None
            if job["destination"] == "dropbox":
                await set_(status="uploading", progress=99)
                c = await dbx.client(db)
                row = await db.connections.find_one({"_id": "dropbox"}, {"scopes": 1})
                if "files.content.write" not in (row or {}).get("scopes", []):
                    raise RuntimeError("Dropbox write permission is off (files.content.write). The file is ready to download instead.")
                dest = await upload_big(c, out, f"{job['dropbox_folder'].rstrip('/')}/{job['filename']}")
            await set_(status="done", progress=100, dropbox_path=dest, size=out.stat().st_size, finished_at=now_iso())
        except Exception as exc:
            logger.error("clip job %s failed: %s", job_id, exc)
            ready = (OUT_DIR / f"{job_id}.{job['format']}").exists()
            await set_(status="error", error=str(exc)[-400:], downloadable=ready)


def safe(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "", name).strip() or "clip"


@router.post("/clip-projects/{pid}/export")
async def export(pid: str, body: ExportIn, user: dict = Depends(current_user)):
    p = await get_project(pid, user)
    if body.format not in ("mp4", "mp3", "wav"):
        raise HTTPException(400, "Format must be mp4, mp3 or wav")
    if body.format == "mp4" and not p["source"]["has_video"]:
        raise HTTPException(400, "This source has no video — export mp3 or wav")
    world = await require_world(p["world_slug"])
    folder = body.dropbox_folder or f"{world.get('dropbox_path', '')}/Clips"
    if body.destination == "dropbox" and not dbx.inside(world.get("dropbox_path", ""), folder):
        raise HTTPException(403, "Destination must be inside this world's Dropbox folder")
    jobs = []
    for clip in p["clips"]:
        if clip["id"] not in body.clip_ids:
            continue
        job = {"id": str(uuid.uuid4()), "project_id": pid, "clip_id": clip["id"], "clip_name": clip["name"], "format": body.format,
               "destination": body.destination, "dropbox_folder": folder, "filename": f"{safe(clip['name'])}.{body.format}",
               "status": "queued", "progress": 0, "owner_id": user["id"], "created_at": now_iso()}
        await db.clip_jobs.insert_one(job)
        job.pop("_id", None)
        jobs.append(job)
        asyncio.create_task(run_job(job["id"]))
    return jobs


@router.get("/clip-projects/{pid}/jobs")
async def list_jobs(pid: str, user: dict = Depends(current_user)):
    await get_project(pid, user)
    return await db.clip_jobs.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/clip-jobs/{jid}/download")
async def download(jid: str, token: str = ""):
    user = await user_by_id(decode_token(token)["sub"])
    job = await db.clip_jobs.find_one({"id": jid}, {"_id": 0})
    if not user or not job:
        raise HTTPException(404, "Not found")
    await get_project(job["project_id"], user)
    f = OUT_DIR / f"{jid}.{job['format']}"
    if not f.exists():
        raise HTTPException(404, "File not ready")
    return FileResponse(f, filename=job["filename"])
