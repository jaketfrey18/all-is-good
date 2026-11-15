# Dropbox OAuth (iteration 3): no scope param, missing_scopes, callback error redirects
import os
from urllib.parse import urlparse, parse_qs, unquote
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "allisgoodworld@yahoo.com"
PASSWORD = "CookedWorld#2026"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return r.json()["token"]


# OAuth start URL
def test_oauth_start_url_no_scope(token):
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/oauth/start",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    p = urlparse(url)
    assert p.netloc == "www.dropbox.com" and p.path == "/oauth2/authorize"
    q = parse_qs(p.query)
    assert q["token_access_type"] == ["offline"]
    assert q["response_type"] == ["code"]
    assert q["redirect_uri"] == [f"{BASE_URL}/api/dropbox/oauth/callback"]
    assert q.get("state") and len(q["state"][0]) > 20
    assert "scope" not in q and "scope=" not in url


def test_oauth_start_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/oauth/start", timeout=20)
    assert r.status_code in (401, 403)


# Admin status
def test_admin_status(token):
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/status",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is True
    assert d["connected"] is False
    assert d["missing_scopes"] == []
    assert d["redirect_uri"] == f"{BASE_URL}/api/dropbox/oauth/callback"


# Callback error redirects
def _loc(params):
    r = requests.get(f"{BASE_URL}/api/dropbox/oauth/callback", params=params, allow_redirects=False, timeout=30)
    assert r.status_code == 307, r.status_code
    return r.headers["location"]


def test_callback_access_denied():
    loc = _loc({"error": "access_denied"})
    p = urlparse(loc)
    assert p.path == "/admin"
    q = parse_qs(p.query)
    assert q["dropbox"] == ["error"]
    assert q["reason"][0]


def test_callback_bogus_state():
    loc = _loc({"code": "x", "state": "bogus"})
    assert loc.startswith(f"{BASE_URL}/admin?dropbox=error&reason=")
    assert "reason=Invalid%20or%20expired%20OAuth%20state" in loc


def test_callback_missing_params():
    loc = _loc({})
    assert "dropbox=error" in loc and "reason=" in loc


def test_public_status():
    r = requests.get(f"{BASE_URL}/api/dropbox/status", timeout=20)
    assert r.status_code == 200
    assert set(r.json().keys()) == {"configured", "connected"}
