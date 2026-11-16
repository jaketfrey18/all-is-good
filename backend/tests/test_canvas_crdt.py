# Canvas real-time CRDT sync: /api/ws/canvas/{id} access control, concurrent item merge, persistence, name PUT
import asyncio
import os
import uuid

import pytest
import requests
import websockets
from pycrdt import Doc, Map

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


async def connect(cid, tok, d):
    ws = await websockets.connect(f"{WS_BASE}/api/ws/canvas/{cid}?token={tok}&cid={d.client_id}")
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


class TestCanvasCRDT:
    state = {}

    @pytest.fixture(scope="class", autouse=True)
    def setup_and_cleanup(self):
        st = self.state
        st["admin"] = login(**ADMIN)
        a = H(st["admin"])
        st["users"] = []
        for tag in ("ccollab", "coutsider"):
            email = f"test_{tag}_{uuid.uuid4().hex[:6]}@example.com"
            r = requests.post(f"{BASE_URL}/api/admin/users", headers=a,
                              json={"name": f"TEST_{tag}", "email": email, "password": "TestPass#123"})
            assert r.status_code == 200, r.text
            st["users"].append(r.json()["id"])
            st[tag] = login(email, "TestPass#123")
        r = requests.post(f"{BASE_URL}/api/canvases", headers=a, json={"world_slug": "gwa", "name": "TEST_crdt"})
        assert r.status_code == 200
        st["cv"] = r.json()["id"]
        requests.put(f"{BASE_URL}/api/canvases/{st['cv']}/share", headers=a, json={"user_ids": [st["users"][0]]})
        yield
        requests.delete(f"{BASE_URL}/api/canvases/{st['cv']}", headers=a)
        for uid in st["users"]:
            requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=a)

    def test_01_ws_rejects_outsider_and_bad_token(self):
        async def go(tok):
            try:
                async with websockets.connect(f"{WS_BASE}/api/ws/canvas/{self.state['cv']}?token={tok}&cid=1") as ws:
                    await asyncio.wait_for(ws.recv(), 5)
                    return "open"
            except Exception as e:
                return f"rejected:{type(e).__name__}"
        assert asyncio.run(go("garbage")).startswith("rejected")
        assert asyncio.run(go(self.state["coutsider"])).startswith("rejected")
        assert asyncio.run(go(self.state["admin"])) == "open"

    def test_02_concurrent_items_merge_and_persist(self):
        st, cv = self.state, self.state["cv"]

        async def go():
            da, db_ = Doc(), Doc()
            ma, mb = da.get("items", type=Map), db_.get("items", type=Map)
            wa = await connect(cv, st["admin"], da)
            wb = await connect(cv, st["ccollab"], db_)
            sa, sb = da.get_state(), db_.get_state()
            ma["a1"] = {"id": "a1", "type": "note", "x": 0, "y": 0, "w": 240, "h": 170, "data": {"text": "TEST_admin"}}
            mb["b1"] = {"id": "b1", "type": "note", "x": 300, "y": 0, "w": 240, "h": 170, "data": {"text": "TEST_collab"}}
            await wa.send(bytes([0]) + da.get_update(sa))
            await wb.send(bytes([0]) + db_.get_update(sb))
            await asyncio.gather(drain(wa, da), drain(wb, db_))
            ka, kb = sorted(ma.keys()), sorted(mb.keys())
            # move a1 from collaborator side
            sb = db_.get_state()
            it = dict(mb["a1"])
            it["x"] = 999
            mb["a1"] = it
            await wb.send(bytes([0]) + db_.get_update(sb))
            await asyncio.gather(drain(wa, da), drain(wb, db_))
            moved = ma["a1"]["x"]
            await wa.close()
            await wb.close()
            await asyncio.sleep(2.5)
            dc = Doc()
            mc = dc.get("items", type=Map)
            wc = await connect(cv, st["admin"], dc)
            kc = sorted(mc.keys())
            xc = mc["a1"]["x"]
            await wc.close()
            return ka, kb, kc, moved, xc
        ka, kb, kc, moved, xc = asyncio.run(go())
        assert ka == kb == kc == ["a1", "b1"]
        assert moved == 999 and xc == 999

    def test_03_rest_name_put_does_not_touch_state(self):
        st, a = self.state, H(self.state["admin"])
        r = requests.put(f"{BASE_URL}/api/canvases/{st['cv']}", headers=a, json={"name": "TEST_crdt_renamed"})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/canvases/{st['cv']}", headers=a).json()
        assert g["name"] == "TEST_crdt_renamed" and "state" not in g and "_id" not in g

        async def go():
            d = Doc()
            m = d.get("items", type=Map)
            ws = await connect(st["cv"], st["ccollab"], d)
            keys = sorted(m.keys())
            await ws.close()
            return keys
        assert asyncio.run(go()) == ["a1", "b1"]
