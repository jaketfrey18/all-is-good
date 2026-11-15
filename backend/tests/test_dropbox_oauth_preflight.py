# Dropbox OAuth start preflight tests (iteration 2)
import os
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


@pytest.mark.skip(reason="Obsolete since iteration 3: redirect URI now registered, start returns 200 (see test_dropbox_oauth_scopes.py)")
def test_oauth_start_returns_400_dropbox_says(token):
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/oauth/start",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 400, r.text
    detail = r.json()["detail"]
    assert detail.startswith("Dropbox says: Invalid redirect_uri"), detail
    assert "url" not in r.json()


def test_oauth_start_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/oauth/start", timeout=20)
    assert r.status_code in (401, 403)


def test_status_not_connected_with_redirect_uri(token):
    r = requests.get(f"{BASE_URL}/api/admin/dropbox/status",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["configured"] is True
    assert d["connected"] is False
    assert d["redirect_uri"] == f"{BASE_URL}/api/dropbox/oauth/callback"
