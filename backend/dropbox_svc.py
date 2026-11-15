import asyncio
import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import dropbox
import requests
from cryptography.fernet import Fernet
from fastapi import HTTPException

SCOPES = "account_info.read files.metadata.read files.content.read"
_cache = {"rt": None, "client": None}

IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif", "heic"}


def configured() -> bool:
    return bool(os.environ.get("DROPBOX_APP_KEY") and os.environ.get("DROPBOX_APP_SECRET"))


def redirect_uri() -> str:
    return os.environ["FRONTEND_URL"].rstrip("/") + "/api/dropbox/oauth/callback"


def _fernet():
    return Fernet(os.environ["TOKEN_ENCRYPTION_KEY"].encode())


def now():
    return datetime.now(timezone.utc)


def require_configured():
    if not configured():
        raise HTTPException(503, "Dropbox app keys are not configured")


async def start_url(db) -> str:
    require_configured()
    state = secrets.token_urlsafe(32)
    await db.oauth_states.insert_one({"_id": state, "expires_at": now() + timedelta(minutes=10)})
    params = {"client_id": os.environ["DROPBOX_APP_KEY"], "response_type": "code",
              "token_access_type": "offline", "scope": SCOPES, "state": state,
              "redirect_uri": redirect_uri()}
    return "https://www.dropbox.com/oauth2/authorize?" + urlencode(params)


async def finish_oauth(db, code: str, state: str):
    require_configured()
    saved = await db.oauth_states.find_one_and_delete({"_id": state})
    if not saved or saved["expires_at"].replace(tzinfo=timezone.utc) < now():
        raise HTTPException(400, "Invalid or expired OAuth state")
    r = await asyncio.to_thread(requests.post, "https://api.dropboxapi.com/oauth2/token", data={
        "code": code, "grant_type": "authorization_code",
        "client_id": os.environ["DROPBOX_APP_KEY"], "client_secret": os.environ["DROPBOX_APP_SECRET"],
        "redirect_uri": redirect_uri()}, timeout=20)
    if r.status_code != 200:
        raise HTTPException(502, "Dropbox token exchange failed")
    t = r.json()
    if not t.get("refresh_token"):
        raise HTTPException(502, "No refresh token returned")
    client = _build(t["refresh_token"])
    account = await asyncio.to_thread(client.users_get_current_account)
    await db.connections.replace_one({"_id": "dropbox"}, {
        "_id": "dropbox", "account_id": t.get("account_id"),
        "account_name": account.name.display_name, "account_email": account.email,
        "refresh_token": _fernet().encrypt(t["refresh_token"].encode()).decode(),
        "updated_at": now().isoformat()}, upsert=True)


def _build(refresh_token: str):
    return dropbox.Dropbox(oauth2_refresh_token=refresh_token, app_key=os.environ["DROPBOX_APP_KEY"],
                           app_secret=os.environ["DROPBOX_APP_SECRET"], timeout=30)


async def status(db) -> dict:
    row = await db.connections.find_one({"_id": "dropbox"}, {"refresh_token": 0})
    return {"configured": configured(), "connected": bool(row) and configured(),
            "account_name": row.get("account_name") if row else None,
            "account_email": row.get("account_email") if row else None}


async def client(db):
    require_configured()
    row = await db.connections.find_one({"_id": "dropbox"})
    if not row:
        raise HTTPException(409, "Dropbox is not connected")
    rt = _fernet().decrypt(row["refresh_token"].encode()).decode()
    if _cache["rt"] != rt:
        _cache.update(rt=rt, client=_build(rt))
    return _cache["client"]


async def disconnect(db):
    row = await db.connections.find_one({"_id": "dropbox"})
    if row and configured():
        try:
            c = await client(db)
            await asyncio.to_thread(c.auth_token_revoke)
        except Exception:
            pass
    _cache.update(rt=None, client=None)
    await db.connections.delete_one({"_id": "dropbox"})


def entry(x) -> dict:
    is_folder = isinstance(x, dropbox.files.FolderMetadata)
    d = {"name": x.name, "path": x.path_display, "type": "folder" if is_folder else "file"}
    if not is_folder:
        ext = x.name.rsplit(".", 1)[-1].lower() if "." in x.name else ""
        d.update(size=getattr(x, "size", None), ext=ext, thumb=ext in IMAGE_EXT,
                 modified=x.server_modified.isoformat() if getattr(x, "server_modified", None) else None)
    return d


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except dropbox.exceptions.AuthError:
        raise HTTPException(401, "Dropbox authorization expired. Reconnect Dropbox in the admin panel.")
    except dropbox.exceptions.ApiError:
        raise HTTPException(404, "Dropbox path not found")


async def list_folder(c, path: str) -> list:
    def run():
        res = _call(c.files_list_folder, "" if path in ("", "/") else path)
        items = [entry(x) for x in res.entries]
        while res.has_more:
            res = _call(c.files_list_folder_continue, res.cursor)
            items += [entry(x) for x in res.entries]
        items.sort(key=lambda i: (i["type"] != "folder", i["name"].lower()))
        return items
    return await asyncio.to_thread(run)


async def search(c, q: str, root: str, limit: int = 20) -> list:
    def run():
        opts = dropbox.files.SearchOptions(path=root, max_results=limit)
        res = _call(c.files_search_v2, q, options=opts)
        out = []
        for m in res.matches:
            md = m.metadata
            if md.is_metadata():
                out.append(entry(md.get_metadata()))
        return out
    return await asyncio.to_thread(run)


async def temp_link(c, path: str) -> str:
    res = await asyncio.to_thread(_call, c.files_get_temporary_link, path)
    return res.link


async def thumbnail(c, path: str) -> bytes:
    def run():
        _, resp = _call(c.files_get_thumbnail, path, format=dropbox.files.ThumbnailFormat.jpeg,
                        size=dropbox.files.ThumbnailSize.w640h480)
        return resp.content
    return await asyncio.to_thread(run)


def inside(root: str, path: str) -> bool:
    if not root or ".." in path.split("/"):
        return False
    r, p = root.rstrip("/").lower(), path.rstrip("/").lower()
    return p == r or p.startswith(r + "/")
