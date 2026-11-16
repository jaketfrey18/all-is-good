# Assets: recordings upload, rename/tag, media (Range/WAV), cross-World references, suggestions, members-only permissions
import os
import subprocess
import uuid
import pytest
import requests
import imageio_ffmpeg

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}


def make_webm(path="/tmp/TEST_tone.webm", secs=3):
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={secs}",
                    "-c:a", "libopus", path], capture_output=True, check=True)
    return open(path, "rb").read()


def upload_rec(s, world, name, tags, data, chunk=None):
    chunk = chunk or len(data)
    parts = [data[i:i + chunk] for i in range(0, len(data), chunk)]
    uid = "TEST" + uuid.uuid4().hex
    r = None
    for i, p in enumerate(parts):
        r = s.post(f"{API}/assets/recordings", data={"world_slug": world, "name": name, "tags": tags, "upload_id": uid,
                                                       "index": i, "total": len(parts)}, files={"file": ("rec.webm", p, "audio/webm")})
        assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    s.token = r.json()["token"]
    return s


@pytest.fixture(scope="module")
def st(admin):
    prev = admin.get(f"{API}/admin/world-members").json().get("wba", [])
    d = {"assets": [], "clips": [], "users": [], "prev_wba": prev}
    yield d
    for cid in d["clips"]:
        admin.delete(f"{API}/clip-projects/{cid}")
    for aid in d["assets"]:
        admin.delete(f"{API}/assets/{aid}")
    admin.put(f"{API}/worlds/wba/share", json={"user_ids": prev})
    for uid in d["users"]:
        admin.delete(f"{API}/admin/users/{uid}")


class TestRecordings:
    def test_upload_chunked_recording(self, admin, st):
        data = make_webm()
        a = upload_rec(admin, "gwa", "TEST_rec", "hip-hop, #Instrumental", data, chunk=10000)
        st["assets"].append(a["id"])
        st["rec"] = a
        assert a["kind"] == "recording" and a["world_slug"] == "gwa"
        assert a["tags"] == ["hip-hop", "instrumental"]
        assert a["duration"] > 2.5
        assert "storage_path" not in a
        lst = admin.get(f"{API}/assets", params={"world": "gwa"}).json()
        assert any(x["id"] == a["id"] for x in lst)

    def test_bad_recording_415(self, admin):
        r = admin.post(f"{API}/assets/recordings", data={"world_slug": "gwa", "name": "TEST_bad", "tags": "", "upload_id": "TEST" + uuid.uuid4().hex,
                                                         "index": 0, "total": 1}, files={"file": ("x.webm", b"notaudio" * 100, "audio/webm")})
        assert r.status_code == 415

    def test_rename_and_tags_persist(self, admin, st):
        aid = st["rec"]["id"]
        r = admin.patch(f"{API}/assets/{aid}", json={"name": "TEST_rec renamed", "tags": ["Hip-Hop", "instrumental", "#beat"]})
        assert r.status_code == 200
        a = next(x for x in admin.get(f"{API}/assets", params={"world": "gwa"}).json() if x["id"] == aid)
        assert a["name"] == "TEST_rec renamed"
        assert a["tags"] == ["hip-hop", "instrumental", "beat"]

    def test_media_full_range_wav(self, admin, st):
        aid = st["rec"]["id"]
        r = requests.get(f"{API}/assets/{aid}/media", params={"token": admin.token})
        assert r.status_code == 200 and r.headers["content-type"].startswith("audio/webm")
        size = len(r.content)
        rr = requests.get(f"{API}/assets/{aid}/media", params={"token": admin.token}, headers={"Range": "bytes=0-99"})
        assert rr.status_code == 206 and len(rr.content) == 100
        assert rr.headers["content-range"] == f"bytes 0-99/{size}"
        w = requests.get(f"{API}/assets/{aid}/media", params={"token": admin.token, "format": "wav", "dl": 1})
        assert w.status_code == 200 and w.headers["content-type"].startswith("audio/wav")
        assert w.content[:4] == b"RIFF" and "attachment" in w.headers.get("content-disposition", "")

    def test_media_bad_token(self, st):
        r = requests.get(f"{API}/assets/{st['rec']['id']}/media", params={"token": "garbage"})
        assert r.status_code in (401, 403)

    def test_link_and_clip_project(self, admin, st):
        r = admin.get(f"{API}/assets/{st['rec']['id']}/link")
        assert r.status_code == 200 and "/media?token=" in r.json()["url"]
        c = admin.post(f"{API}/clip-projects", json={"world_slug": "gwa", "asset_id": st["rec"]["id"]})
        assert c.status_code == 200, c.text
        st["clips"].append(c.json()["id"])
        assert c.json()["source"]["asset_id"] == st["rec"]["id"]
        assert c.json()["source"]["duration"] > 2.5


class TestReferencesSearchSuggest:
    def test_search_tag(self, admin, st):
        r = admin.get(f"{API}/search", params={"tag": "hip-hop"})
        assert r.status_code == 200
        assert any(f.get("asset_id") == st["rec"]["id"] for f in r.json()["files"])

    def test_search_kind_music(self, admin, st):
        r = admin.get(f"{API}/search", params={"q": "TEST_rec", "kind": "audio"})
        assert r.status_code == 200
        assert any(f.get("asset_id") == st["rec"]["id"] for f in r.json()["files"])
        r2 = admin.get(f"{API}/search", params={"q": "TEST_rec", "kind": "image"})
        assert not any(f.get("asset_id") == st["rec"]["id"] for f in r2.json()["files"])

    def test_reference_no_duplicate(self, admin, st):
        body = {"world_slug": "wba", "source_world": "gwa", "asset_id": st["rec"]["id"]}
        r1 = admin.post(f"{API}/assets/reference", json=body)
        assert r1.status_code == 200, r1.text
        ref = r1.json()
        st["assets"].append(ref["id"])
        st["ref"] = ref
        assert ref["kind"] == "reference" and ref["source"]["world_slug"] == "gwa" and ref["accessible"] is True
        r2 = admin.post(f"{API}/assets/reference", json=body)
        assert r2.json()["id"] == ref["id"]
        wba = admin.get(f"{API}/assets", params={"world": "wba"}).json()
        assert len([x for x in wba if x.get("source", {}).get("asset_id") == st["rec"]["id"]]) == 1
        orig = next(x for x in admin.get(f"{API}/assets", params={"world": "gwa"}).json() if x["id"] == st["rec"]["id"])
        assert orig["name"] == "TEST_rec renamed"

    def test_reference_same_world_400(self, admin, st):
        r = admin.post(f"{API}/assets/reference", json={"world_slug": "gwa", "source_world": "gwa", "asset_id": st["rec"]["id"]})
        assert r.status_code == 400

    def test_reference_media_resolves(self, admin, st):
        r = requests.get(f"{API}/assets/{st['ref']['id']}/media", params={"token": admin.token})
        assert r.status_code == 200 and len(r.content) == st["rec"]["size"]

    def test_suggest(self, admin, st):
        r = admin.get(f"{API}/assets/suggest", params={"world": "wba", "need": "hip hop beat"})
        assert r.status_code == 200
        item = next((i for i in r.json()["items"] if i.get("asset_id") == st["rec"]["id"]), None)
        assert item, r.json()
        assert "Tagged hip-hop" in item["why"] and "from" in item["why"]


class TestPermissions:
    def test_collaborator_scope(self, admin, st):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = admin.post(f"{API}/admin/users", json={"name": "TEST_collab", "email": email, "password": "TestPass#12345"})
        assert r.status_code in (200, 201), r.text
        uid = r.json().get("id") or r.json().get("user", {}).get("id")
        st["users"].append(uid)
        assert admin.put(f"{API}/worlds/wba/share", json={"user_ids": [uid]}).status_code == 200
        lg = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass#12345"})
        assert lg.status_code == 200
        tok = lg.json()["token"]
        c = requests.Session()
        c.headers.update({"Authorization": f"Bearer {tok}"})
        assert c.get(f"{API}/worlds/mine").json() == ["wba"]
        assert c.get(f"{API}/assets", params={"world": "gwa"}).status_code == 403
        assert c.get(f"{API}/projects/gwa/files").status_code == 403
        s = c.get(f"{API}/search", params={"q": "TEST_rec"}).json()
        assert not any(f.get("project_slug") == "gwa" for f in s["files"])
        wba = c.get(f"{API}/assets", params={"world": "wba"})
        assert wba.status_code == 200
        ref = next(x for x in wba.json() if x["id"] == st["ref"]["id"])
        assert ref["accessible"] is False
        assert c.get(f"{API}/assets/{st['ref']['id']}/link").status_code == 403
        assert requests.get(f"{API}/assets/{st['rec']['id']}/media", params={"token": tok}).status_code == 403
        assert requests.get(f"{API}/assets/{st['ref']['id']}/media", params={"token": tok}).status_code == 403
        assert c.post(f"{API}/assets/reference", json={"world_slug": "wba", "source_world": "gwa", "asset_id": st["rec"]["id"]}).status_code == 403
        assert c.delete(f"{API}/assets/{st['ref']['id']}").status_code == 403
        assert c.get(f"{API}/assets/suggest", params={"world": "gwa"}).status_code == 403
        sug = c.get(f"{API}/assets/suggest", params={"world": "wba", "need": "hip hop beat"}).json()
        assert not any(i.get("project_slug") == "gwa" for i in sug["items"])
        assert c.put(f"{API}/worlds/wba/share", json={"user_ids": []}).status_code == 403

    def test_anonymous(self):
        assert requests.get(f"{API}/projects/gwa/files").status_code == 401
        assert requests.get(f"{API}/assets", params={"world": "gwa"}).status_code == 401
        r = requests.get(f"{API}/search", params={"q": "TEST_rec"})
        assert r.status_code == 200 and r.json()["files"] == []
