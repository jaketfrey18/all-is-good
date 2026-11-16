# Collaboration API: admin users, canvases, lyrics, versions, share/access, global search, Yjs websocket
import asyncio
import os
import uuid

import pytest
import requests
import websockets
from pycrdt import Doc, Text

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestCollab:
    """Sequential collab flow, all in one class so it stays on one xdist worker."""
    state = {}

    @pytest.fixture(scope="class", autouse=True)
    def setup_and_cleanup(self):
        st = self.state
        st["admin"] = login(**ADMIN)
        st["created"] = {"users": [], "canvases": [], "lyrics": []}
        yield
        a = H(st["admin"])
        for lid in st["created"]["lyrics"]:
            requests.delete(f"{BASE_URL}/api/lyrics/{lid}", headers=a)
        for cid in st["created"]["canvases"]:
            requests.delete(f"{BASE_URL}/api/canvases/{cid}", headers=a)
        for uid in st["created"]["users"]:
            requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=a)

    def _mk_user(self, tag):
        email = f"test_{tag}_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=H(self.state["admin"]),
                          json={"name": f"TEST_{tag}", "email": email, "password": "TestPass#123"})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["role"] == "collaborator" and u["email"] == email and "password_hash" not in u
        self.state["created"]["users"].append(u["id"])
        return u, login(email, "TestPass#123")

    # --- admin users
    def test_01_admin_create_users(self):
        st = self.state
        st["c1"], st["c1tok"] = self._mk_user("collab")
        st["c2"], st["c2tok"] = self._mk_user("outsider")
        users = requests.get(f"{BASE_URL}/api/users", headers=H(st["admin"])).json()
        assert any(u["id"] == st["c1"]["id"] for u in users)

    def test_02_admin_user_validation(self):
        a = H(self.state["admin"])
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=a, json={"name": "TEST_x", "email": self.state["c1"]["email"], "password": "TestPass#123"})
        assert r.status_code == 409
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=a, json={"name": "TEST_x", "email": "bad", "password": "TestPass#123"})
        assert r.status_code == 400
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=a, json={"name": "TEST_x", "email": "a@b.co", "password": "short"})
        assert r.status_code == 422

    def test_03_collab_forbidden_admin(self):
        c = H(self.state["c1tok"])
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=c, json={"name": "TEST_y", "email": "y@z.co", "password": "TestPass#123"})
        assert r.status_code == 403
        r = requests.delete(f"{BASE_URL}/api/admin/users/{self.state['c2']['id']}", headers=c)
        assert r.status_code == 403
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=c).json()
        assert me.get("role") == "collaborator" or me.get("user", {}).get("role") == "collaborator"

    # --- canvases
    def test_04_canvas_crud(self):
        st, a = self.state, H(self.state["admin"])
        r = requests.post(f"{BASE_URL}/api/canvases", headers=a, json={"world_slug": "gwa", "name": "TEST_canvas"})
        assert r.status_code == 200, r.text
        c = r.json()
        st["created"]["canvases"].append(c["id"])
        st["canvas"] = c["id"]
        assert c["items"] == [] and c["edges"] == [] and c["viewport"]["zoom"] == 1
        bad = requests.post(f"{BASE_URL}/api/canvases", headers=a, json={"world_slug": "nope-x", "name": "TEST_c"})
        assert bad.status_code == 404
        items = [{"id": "n1", "type": "note", "x": 10, "y": 20, "w": 200, "h": 100, "text": "hi"}]
        edges = [{"id": "e1", "from": "n1", "to": "n1"}]
        r = requests.put(f"{BASE_URL}/api/canvases/{c['id']}", headers=a, json={"items": items, "edges": edges, "viewport": {"x": 5, "y": 6, "zoom": 1.5}})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/canvases/{c['id']}", headers=a).json()
        assert g["items"] == items and g["edges"] == edges and g["viewport"]["zoom"] == 1.5

    def test_05_canvas_access_and_share(self):
        st = self.state
        c1 = H(st["c1tok"])
        lst = requests.get(f"{BASE_URL}/api/canvases", headers=c1).json()
        assert all(x["id"] != st["canvas"] for x in lst)
        assert requests.get(f"{BASE_URL}/api/canvases/{st['canvas']}", headers=c1).status_code == 404
        r = requests.put(f"{BASE_URL}/api/canvases/{st['canvas']}/share", headers=H(st["admin"]), json={"user_ids": [st["c1"]["id"], "bogus"]})
        assert r.status_code == 200 and r.json()["shared_with"] == [st["c1"]["id"]]
        lst = requests.get(f"{BASE_URL}/api/canvases", headers=c1).json()
        assert any(x["id"] == st["canvas"] for x in lst)
        for x in lst:
            assert x["owner_id"] == st["c1"]["id"] or st["c1"]["id"] in x.get("shared_with", [])
        assert requests.delete(f"{BASE_URL}/api/canvases/{st['canvas']}", headers=c1).status_code == 403
        p = requests.post(f"{BASE_URL}/api/canvases/{st['canvas']}/presence", headers=c1)
        assert p.status_code == 200 and any(u["id"] == st["c1"]["id"] for u in p.json())
        assert requests.post(f"{BASE_URL}/api/canvases/{st['canvas']}/presence", headers=H(st["c2tok"])).status_code == 404

    # --- lyrics
    def test_06_lyric_crud_share(self):
        st, a = self.state, H(self.state["admin"])
        r = requests.post(f"{BASE_URL}/api/lyrics", headers=a, json={"world_slug": "gwa", "title": "TEST_lyric"})
        assert r.status_code == 200
        lid = r.json()["id"]
        st["created"]["lyrics"].append(lid)
        st["lyric"] = lid
        assert requests.patch(f"{BASE_URL}/api/lyrics/{lid}", headers=a, json={"title": "TEST_lyric2", "text": "hello verse"}).status_code == 200
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=a).json()["title"] == "TEST_lyric2"
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c1tok"])).status_code == 404
        r = requests.put(f"{BASE_URL}/api/lyrics/{lid}/share", headers=a, json={"user_ids": [st["c1"]["id"]]})
        assert r.json()["shared_with"] == [st["c1"]["id"]]
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c1tok"])).status_code == 200
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c2tok"])).status_code == 404
        assert requests.delete(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c1tok"])).status_code == 403
        lst = requests.get(f"{BASE_URL}/api/lyrics", headers=H(st["c2tok"])).json()
        assert all(x["id"] != lid for x in lst)

    def test_07_lyric_via_canvas_access(self):
        st, a = self.state, H(self.state["admin"])
        r = requests.post(f"{BASE_URL}/api/lyrics", headers=a, json={"world_slug": "gwa", "title": "TEST_canvaslyric", "canvas_id": st["canvas"]})
        lid = r.json()["id"]
        st["created"]["lyrics"].append(lid)
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c1tok"])).status_code == 200
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=H(st["c2tok"])).status_code == 404

    def test_08_versions_export_backup(self):
        st, a = self.state, H(self.state["admin"])
        lid = st["lyric"]
        v = requests.post(f"{BASE_URL}/api/lyrics/{lid}/versions", headers=a, json={"content": {"type": "doc"}, "text": "hello verse", "label": "TEST_v1"})
        assert v.status_code == 200 and v.json()["label"] == "TEST_v1"
        dup = requests.post(f"{BASE_URL}/api/lyrics/{lid}/versions", headers=a, json={"content": {}, "text": "hello verse", "label": ""})
        assert dup.json().get("skipped") is True
        vs = requests.get(f"{BASE_URL}/api/lyrics/{lid}/versions", headers=a).json()
        assert len(vs) == 1 and vs[0]["text"] == "hello verse"
        ex = requests.get(f"{BASE_URL}/api/lyrics/{lid}/export", headers=a)
        assert ex.status_code == 200 and "hello verse" in ex.text and ".txt" in ex.headers.get("content-disposition", "")
        b = requests.post(f"{BASE_URL}/api/lyrics/{lid}/backup", headers=a)
        print("backup:", b.status_code, b.text)
        assert b.status_code == 409 and "files.content.write" in b.text

    # --- websocket
    def test_09_ws_rejects_bad_token(self):
        async def go(tok):
            try:
                async with websockets.connect(f"{WS_BASE}/api/ws/lyrics/{self.state['lyric']}?token={tok}&cid=1") as ws:
                    await asyncio.wait_for(ws.recv(), 5)
                    return "open"
            except Exception as e:
                return f"rejected:{type(e).__name__}"
        assert asyncio.run(go("garbage")).startswith("rejected")
        assert asyncio.run(go(self.state["c2tok"])).startswith("rejected")

    def test_10_ws_crdt_merge_and_persist(self):
        st, lid = self.state, self.state["lyric"]

        async def client(tok, d):
            ws = await websockets.connect(f"{WS_BASE}/api/ws/lyrics/{lid}?token={tok}&cid={d.client_id}")
            first = await asyncio.wait_for(ws.recv(), 5)
            assert first[0] == 0
            d.apply_update(first[1:])
            return ws

        async def drain(ws, d, t=1.5):
            end = asyncio.get_event_loop().time() + t
            while True:
                rem = end - asyncio.get_event_loop().time()
                if rem <= 0:
                    return
                try:
                    m = await asyncio.wait_for(ws.recv(), rem)
                    if m[0] == 0:
                        d.apply_update(m[1:])
                except asyncio.TimeoutError:
                    return

        async def go():
            da, db_ = Doc(), Doc()
            ta, tb = da.get("t", type=Text), db_.get("t", type=Text)
            wa = await client(st["admin"], da)
            wb = await client(st["c1tok"], db_)
            sa, sb = da.get_state(), db_.get_state()
            ta += "ADMIN_TEXT "
            tb += "COLLAB_TEXT "
            await wa.send(bytes([0]) + da.get_update(sa))
            await wb.send(bytes([0]) + db_.get_update(sb))
            await asyncio.gather(drain(wa, da), drain(wb, db_))
            ra, rb = str(ta), str(tb)
            await wa.close()
            await wb.close()
            await asyncio.sleep(2.5)
            dc = Doc()
            tc = dc.get("t", type=Text)
            wc = await client(st["admin"], dc)
            rc = str(tc)
            await wc.close()
            return ra, rb, rc
        ra, rb, rc = asyncio.run(go())
        print(ra, "|", rb, "|", rc)
        for s in (ra, rb, rc):
            assert "ADMIN_TEXT" in s and "COLLAB_TEXT" in s
        assert ra == rb == rc

    # --- search
    def test_11_search(self):
        a = H(self.state["admin"])
        assert requests.get(f"{BASE_URL}/api/search").status_code == 400
        r = requests.get(f"{BASE_URL}/api/search", params={"kind": "audio"}, headers=a)
        assert r.status_code == 200
        d = r.json()
        print("audio files:", len(d["files"]), "available", d["files_available"])
        assert d["files_available"] is True
        assert all(f["type"] == "file" for f in d["files"])
        r = requests.get(f"{BASE_URL}/api/search", params={"kind": "video"}, headers=a).json()
        print("video files:", len(r["files"]))
        assert len(r["files"]) > 0
        assert all("project_slug" in f for f in r["files"])
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "gwa"}, headers=a).json()
        print("q=gwa projects:", len(r["projects"]), "files:", len(r["files"]))
        r = requests.get(f"{BASE_URL}/api/search", params={"world": "gwa", "kind": "image"}, headers=a).json()
        assert all(f["project_slug"] == "gwa" for f in r["files"])

    def test_12_delete_and_verify(self):
        st, a = self.state, H(self.state["admin"])
        lid = st["created"]["lyrics"].pop()
        assert requests.delete(f"{BASE_URL}/api/lyrics/{lid}", headers=a).status_code == 200
        assert requests.get(f"{BASE_URL}/api/lyrics/{lid}", headers=a).status_code == 404
        uid = st["created"]["users"].pop()
        assert requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=a).status_code == 200
        assert requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=a).status_code == 404
