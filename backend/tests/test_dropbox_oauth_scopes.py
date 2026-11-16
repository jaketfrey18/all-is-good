# Dropbox OAuth (iteration 3): no scope param, missing_scopes, callback HTML result page
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
    assert isinstance(d["connected"], bool)  # Dropbox is connected since iteration 5
    assert d["missing_scopes"] == []
    assert d["redirect_uri"] == f"{BASE_URL}/api/dropbox/oauth/callback"


# Callback result HTML page (iteration 4: replaces redirects)
def _page(params):
    r = requests.get(f"{BASE_URL}/api/dropbox/oauth/callback", params=params, allow_redirects=False, timeout=30)
    assert r.status_code == 200, r.status_code
    assert r.headers["content-type"].startswith("text/html")
    assert "Back to admin" in r.text and f'href="{BASE_URL}/admin"' in r.text
    return r.text


def test_callback_access_denied():
    t = _page({"error": "access_denied"})
    assert "Dropbox connection failed" in t
    assert "You cancelled or Dropbox refused access." in t


def test_callback_bogus_state():
    t = _page({"code": "x", "state": "bogus"})
    assert "Dropbox connection failed" in t
    assert "Invalid or expired OAuth state" in t


def test_callback_missing_params():
    t = _page({})
    assert "Dropbox connection failed" in t and "Missing response from Dropbox." in t


def test_callback_reason_is_escaped():
    t = _page({"error": "<script>alert(1)</script>"})
    assert "<script>alert(1)</script>" not in t


def test_public_status():
    r = requests.get(f"{BASE_URL}/api/dropbox/status", timeout=20)
    assert r.status_code == 200
    assert set(r.json().keys()) == {"configured", "connected"}
