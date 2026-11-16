# Session Drop API tests: sessions CRUD, chunked upload, file category/download/delete, sync 409, permissions
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="module")
def state(admin):
    st = {"sessions": [], "users": []}
    yield st
    for sid in st["sessions"]:
        admin.delete(f"{API}/sessions/{sid}")
    for uid in st["users"]:
        admin.delete(f"{API}/admin/users/{uid}")


def upload(client, sid, name, data, ctype, chunk=None):
    chunk = chunk or len(data) or 1
    parts = [data[i:i + chunk] for i in range(0, len(data), chunk)] or [b""]
    uid = str(uuid.uuid4())
    res = None
    for i, p in enumerate(parts):
        res = client.post(f"{API}/sessions/{sid}/upload",
                          data={"upload_id": uid, "index": str(i), "total": str(len(parts)), "name": name},
                          files={"file": (name, p, ctype)})
    return res


# Auth
def test_unauth_401():
    assert requests.get(f"{API}/sessions?world=gwa").status_code == 401
    assert requests.post(f"{API}/sessions", json={"world_slug": "gwa", "name": "x"}).status_code == 401


# Create / list / read
def test_create_list_read(admin, state):
    r = admin.post(f"{API}/sessions", json={"world_slug": "gwa", "name": "TEST_Vocals take"})
    assert r.status_code == 200, r.text
    s = r.json()
    state["sessions"].append(s["id"])
    state["sid"] = s["id"]
    assert s["file_count"] == 0 and s["world_slug"] == "gwa"
    print("folder:", s["folder"])
    lst = admin.get(f"{API}/sessions?world=gwa").json()
    assert any(x["id"] == s["id"] for x in lst)
    d = admin.get(f"{API}/sessions/{s['id']}").json()
    assert d["name"] == "TEST_Vocals take" and d["files"] == [] and d["can_write"] is False


def test_create_validation(admin):
    assert admin.post(f"{API}/sessions", json={"world_slug": "gwa", "name": ""}).status_code == 422
    assert admin.post(f"{API}/sessions", json={"world_slug": "nope-xyz", "name": "TEST_x"}).status_code == 404


def test_whitespace_name(admin, state):
    r = admin.post(f"{API}/sessions", json={"world_slug": "gwa", "name": "   "})
    print("whitespace name:", r.status_code, r.text[:200])
    if r.status_code == 200:
        state["sessions"].append(r.json()["id"])


# Upload + categorize
def test_uploads_categorized(admin, state):
    sid = state["sid"]
    files = {}
    for name, data, ct, exp in [("TEST_beat.mp3", os.urandom(20000), "audio/mpeg", "Audio"),
                                ("TEST_cover.png", os.urandom(5000), "image/png", "Images"),
                                ("TEST_notes.txt", b"hello lyrics\n" * 50, "text/plain", "Docs")]:
        r = upload(admin, sid, name, data, ct, chunk=4096)
        assert r.status_code == 200, r.text
        f = r.json()
        print(name, f["category"], f["status"], f["size"])
        assert f["size"] == len(data) and f["status"] == "in_app"
        files[name] = (f, data, exp)
    state["files"] = files
    for name, (f, data, exp) in files.items():
        assert f["category"] == exp, f"{name}: {f['category']} != {exp}"
    lst = admin.get(f"{API}/sessions?world=gwa").json()
    s = next(x for x in lst if x["id"] == sid)
    assert s["file_count"] == 3


def test_download_same_bytes(admin, admin_token, state):
    for name, (f, data, _) in state["files"].items():
        r = requests.get(f"{API}/session-files/{f['id']}/download", params={"token": admin_token})
        assert r.status_code == 200 and r.content == data, name
    f = state["files"]["TEST_beat.mp3"][0]
    assert requests.get(f"{API}/session-files/{f['id']}/download").status_code == 401
    assert requests.get(f"{API}/session-files/{f['id']}/download", params={"token": "bad"}).status_code == 401


def test_unicode_filename_download(admin, admin_token, state):
    r = upload(admin, state["sid"], "TEST_Ünïcode — song 🎵.wav", b"RIFFxxxx" * 10, "audio/wav")
    assert r.status_code == 200, r.text
    f = r.json()
    d = requests.get(f"{API}/session-files/{f['id']}/download", params={"token": admin_token})
    print("unicode download:", d.status_code)
    assert d.status_code == 200


def test_patch_category(admin, state):
    f = state["files"]["TEST_notes.txt"][0]
    assert admin.patch(f"{API}/session-files/{f['id']}", json={"category": "Other"}).status_code == 200
    d = admin.get(f"{API}/sessions/{state['sid']}").json()
    assert next(x for x in d["files"] if x["id"] == f["id"])["category"] == "Other"
    assert admin.patch(f"{API}/session-files/{f['id']}", json={"category": "Bogus"}).status_code == 400


def test_sync_409(admin, state):
    r = admin.post(f"{API}/sessions/{state['sid']}/sync")
    assert r.status_code == 409
    print("sync:", r.json())


def test_bad_chunk(admin, state):
    r = admin.post(f"{API}/sessions/{state['sid']}/upload",
                   data={"upload_id": "x", "index": "0", "total": "1", "name": "a.txt"}, files={"file": ("a.txt", b"a")})
    assert r.status_code == 400


def test_collaborator_isolation(admin, state):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = admin.post(f"{API}/admin/users", json={"name": "TEST_collab", "email": email, "password": "TestPass#123"})
    assert r.status_code in (200, 201), r.text
    state["users"].append(r.json().get("id") or r.json().get("user", {}).get("id"))
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass#123"}).json()["token"]
    c = requests.Session()
    c.headers.update({"Authorization": f"Bearer {tok}"})
    lst = c.get(f"{API}/sessions?world=gwa").json()
    assert all(x["id"] != state["sid"] for x in lst)
    assert c.get(f"{API}/sessions/{state['sid']}").status_code == 404
    f = state["files"]["TEST_beat.mp3"][0]
    assert c.patch(f"{API}/session-files/{f['id']}", json={"category": "Other"}).status_code == 404
    assert c.delete(f"{API}/session-files/{f['id']}").status_code == 404
    assert requests.get(f"{API}/session-files/{f['id']}/download", params={"token": tok}).status_code == 404
    assert upload(c, state["sid"], "x.txt", b"x", "text/plain").status_code == 404
    assert c.delete(f"{API}/sessions/{state['sid']}").status_code == 404
    # collaborator own session
    own = c.post(f"{API}/sessions", json={"world_slug": "gwa", "name": "TEST_collab session"})
    print("collab create:", own.status_code, own.text[:150])
    if own.status_code == 200:
        state["sessions"].append(own.json()["id"])
        assert c.delete(f"{API}/sessions/{own.json()['id']}").status_code == 200


def test_delete_file_and_session(admin, state):
    f = state["files"]["TEST_cover.png"][0]
    assert admin.delete(f"{API}/session-files/{f['id']}").status_code == 200
    assert admin.patch(f"{API}/session-files/{f['id']}", json={"category": "Other"}).status_code == 404
    d = admin.get(f"{API}/sessions/{state['sid']}").json()
    assert all(x["id"] != f["id"] for x in d["files"])
    sid = state["sid"]
    assert admin.delete(f"{API}/sessions/{sid}").status_code == 200
    assert admin.get(f"{API}/sessions/{sid}").status_code == 404
