# Regression tests for ALL IS GOOD — Cooked World API (auth, projects CRUD, files scoping, search, dropbox status)
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "allisgoodworld@yahoo.com"
ADMIN_PASSWORD = "CookedWorld#2026"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created(auth):
    ids = []
    yield ids
    for pid in ids:
        requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth)


# Auth
class TestAuth:
    def test_login_success_cookie(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL.upper(), "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN_EMAIL and d["user"]["role"] == "admin"
        sc = r.headers.get("set-cookie", "")
        assert "access_token=" in sc and "HttpOnly" in sc

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "nope"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_bruteforce_lockout(self):
        email = f"TEST_lock_{uuid.uuid4().hex[:6]}@x.com"
        codes = [requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "bad"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5
        assert codes[5] == 429

    def test_me(self, auth):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert "password_hash" not in r.json()

    def test_me_cookie(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert s.get(f"{BASE_URL}/api/auth/me").status_code == 200

    @pytest.mark.parametrize("method,path", [
        ("get", "/api/auth/me"), ("post", "/api/projects"), ("put", "/api/projects/x"), ("delete", "/api/projects/x"),
        ("get", "/api/admin/dropbox/status"), ("get", "/api/admin/dropbox/oauth/start"),
        ("delete", "/api/admin/dropbox/connection"), ("get", "/api/admin/dropbox/folders"),
    ])
    def test_admin_routes_unauth(self, method, path):
        r = getattr(requests, method)(f"{BASE_URL}{path}", json={"title": "x"})
        assert r.status_code in (401, 403)

    def test_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401


# Projects
class TestProjects:
    def test_list_seed(self):
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        titles = [p["title"] for p in r.json()]
        for t in ["GWA", "Yakshaloka US", "Jasmin's Journey", "Riley's Magical Meals"]:
            assert t in titles
        assert all("_id" not in p for p in r.json())

    def test_filter_worlds(self):
        r = requests.get(f"{BASE_URL}/api/projects", params={"category": "worlds"})
        titles = {p["title"] for p in r.json()}
        assert {"GWA", "Yakshaloka US"} <= titles
        assert all(p["category"] == "worlds" for p in r.json())

    def test_get_slug_and_404(self):
        assert requests.get(f"{BASE_URL}/api/projects/jasmins-journey").json()["title"] == "Jasmin's Journey"
        assert requests.get(f"{BASE_URL}/api/projects/no-such-thing").status_code == 404

    def test_crud(self, auth, created):
        r = requests.post(f"{BASE_URL}/api/projects", headers=auth, json={"title": "TEST_Proj One", "category": "media", "order": 99})
        assert r.status_code == 200
        p = r.json(); created.append(p["id"])
        assert p["slug"] == "test-proj-one"
        g = requests.get(f"{BASE_URL}/api/projects/{p['slug']}").json()
        assert g["category"] == "media"
        u = requests.put(f"{BASE_URL}/api/projects/{p['id']}", headers=auth,
                         json={"title": "TEST_Proj One", "subtitle": "sub", "category": "worlds", "order": 99})
        assert u.status_code == 200 and u.json()["subtitle"] == "sub"
        assert requests.get(f"{BASE_URL}/api/projects/{p['slug']}").json()["category"] == "worlds"
        d = requests.delete(f"{BASE_URL}/api/projects/{p['id']}", headers=auth)
        assert d.status_code == 200
        created.remove(p["id"])
        assert requests.get(f"{BASE_URL}/api/projects/{p['slug']}").status_code == 404
        assert requests.delete(f"{BASE_URL}/api/projects/{p['id']}", headers=auth).status_code == 404

    def test_invalid_category_and_empty_title(self, auth):
        assert requests.post(f"{BASE_URL}/api/projects", headers=auth, json={"title": "TEST_bad", "category": "zzz"}).status_code == 400
        assert requests.post(f"{BASE_URL}/api/projects", headers=auth, json={"title": ""}).status_code == 422

    def test_duplicate_slug_unique(self, auth, created):
        a = requests.post(f"{BASE_URL}/api/projects", headers=auth, json={"title": "TEST_Dup"}).json(); created.append(a["id"])
        b = requests.post(f"{BASE_URL}/api/projects", headers=auth, json={"title": "TEST_Dup"}).json(); created.append(b["id"])
        assert a["slug"] != b["slug"]


# Files scoping
class TestFiles:
    def test_409_no_folder(self):
        r = requests.get(f"{BASE_URL}/api/projects/rileys-magical-meals/files")
        assert r.status_code == 409

    def test_404_unknown_project_files(self):
        assert requests.get(f"{BASE_URL}/api/projects/nope-xyz/files").status_code == 404

    def test_scope_check(self, auth, created):
        p = requests.post(f"{BASE_URL}/api/projects", headers=auth,
                          json={"title": "TEST_Scoped", "dropbox_path": "/Clients/TEST"}).json()
        created.append(p["id"])
        s = p["slug"]
        assert requests.get(f"{BASE_URL}/api/projects/{s}/files", params={"path": "/Other"}).status_code == 403
        assert requests.get(f"{BASE_URL}/api/projects/{s}/files", params={"path": "/Clients/TEST/../x"}).status_code == 403
        assert requests.get(f"{BASE_URL}/api/projects/{s}/files", params={"path": "/Clients/TESTX"}).status_code == 403
        # inside scope -> dropbox configured but not connected -> 409 (503 if keys missing)
        assert requests.get(f"{BASE_URL}/api/projects/{s}/files", params={"path": "/Clients/TEST/a"}).status_code in (404, 409, 503)
        # link/thumb outside scope should be 403 (scope before client)
        self.link_code = requests.get(f"{BASE_URL}/api/projects/{s}/link", params={"path": "/Other/a.jpg"}).status_code
        self.thumb_code = requests.get(f"{BASE_URL}/api/projects/{s}/thumb", params={"path": "/Other/a.jpg"}).status_code
        assert self.link_code == 403, f"link outside scope returned {self.link_code}"
        assert self.thumb_code == 403, f"thumb outside scope returned {self.thumb_code}"


# Search & dropbox status
class TestSearch:
    def test_search_wba(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "Wealth"})
        assert r.status_code == 200
        d = r.json()
        assert any(p["slug"] == "wba" for p in d["projects"])
        assert d["files_available"] is True  # Dropbox connected since iteration 5

    def test_search_empty_q(self):
        assert requests.get(f"{BASE_URL}/api/search", params={"q": ""}).status_code == 400

    def test_dropbox_status(self, auth):
        # keys configured since iteration 2
        assert requests.get(f"{BASE_URL}/api/dropbox/status").json()["configured"] is True
        a = requests.get(f"{BASE_URL}/api/admin/dropbox/status", headers=auth).json()
        assert a["configured"] is True and a["redirect_uri"].endswith("/api/dropbox/oauth/callback")
        assert requests.get(f"{BASE_URL}/api/admin/dropbox/oauth/start", headers=auth).status_code == 200

    def test_oauth_callback_error_redirect(self):
        r = requests.get(f"{BASE_URL}/api/dropbox/oauth/callback", allow_redirects=False)
        assert r.status_code == 200 and "Dropbox connection failed" in r.text
