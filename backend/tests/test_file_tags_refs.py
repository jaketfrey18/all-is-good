# Dropbox file tags (PUT /api/file-tags) + tag search + Dropbox-file references (admin), restores tags afterwards
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def first_file(admin):
    r = admin.get(f"{API}/projects/gwa/files")
    if r.status_code != 200:
        pytest.skip(f"gwa files unavailable {r.status_code}")
    files = [i for i in r.json()["items"] if i["type"] == "file"]
    if not files:
        folders = [i for i in r.json()["items"] if i["type"] == "folder"]
        for f in folders[:5]:
            sub = admin.get(f"{API}/projects/gwa/files", params={"path": f["path"]}).json()["items"]
            files = [i for i in sub if i["type"] == "file"]
            if files:
                break
    if not files:
        pytest.skip("no gwa files")
    return files[0]


class TestFileTagsAndRefs:
    def test_tag_search_reference(self, admin):
        f = first_file(admin)
        prev = admin.get(f"{API}/search", params={"q": f["name"], "world": "gwa"}).json()["files"]
        prev_tags = next((x.get("tags", []) for x in prev if x.get("path", "").lower() == f["path"].lower()), [])
        ref_id = None
        try:
            r = admin.put(f"{API}/file-tags", json={"world_slug": "gwa", "path": f["path"], "size": f.get("size"), "tags": prev_tags + ["#TEST_tmptag"]})
            assert r.status_code == 200 and "test_tmptag" in r.json()["tags"]
            s = admin.get(f"{API}/search", params={"tag": "test_tmptag"}).json()["files"]
            assert any(x.get("path", "").lower() == f["path"].lower() for x in s)
            bad = admin.put(f"{API}/file-tags", json={"world_slug": "wba", "path": f["path"], "tags": ["x"]})
            assert bad.status_code == 403
            ref = admin.post(f"{API}/assets/reference", json={"world_slug": "wba", "source_world": "gwa", "path": f["path"], "size": f.get("size")})
            assert ref.status_code == 200, ref.text
            ref_id = ref.json()["id"]
            assert ref.json()["source"]["path"] == f["path"] and "test_tmptag" in ref.json()["tags"]
            again = admin.post(f"{API}/assets/reference", json={"world_slug": "wba", "source_world": "gwa", "path": f["path"]})
            assert again.json()["id"] == ref_id
            link = admin.get(f"{API}/assets/{ref_id}/link")
            assert link.status_code == 200 and link.json()["url"].startswith("http")
            outside = admin.post(f"{API}/assets/reference", json={"world_slug": "wba", "source_world": "gwa", "path": "/etc/passwd"})
            assert outside.status_code == 403
        finally:
            admin.put(f"{API}/file-tags", json={"world_slug": "gwa", "path": f["path"], "size": f.get("size"), "tags": prev_tags})
            if ref_id:
                admin.delete(f"{API}/assets/{ref_id}")
