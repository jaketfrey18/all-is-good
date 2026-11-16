# Clip Studio Phase 1: clip-projects CRUD, access control, FFmpeg export jobs (mp4 9:16 / mp3), download token, Dropbox-dest error
import os
import re
import subprocess
import time
import uuid

import imageio_ffmpeg
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "allisgoodworld@yahoo.com", "password": "CookedWorld#2026"}
WORLD = "yakshalokaus"
VIDEO = "/Yakshaloka US/FINAL IMAGES/05 VishnuThrowsTejas.mp4"
AUDIO = "/Yakshaloka US/Music/05 VishnuThrowsTejas.mp3"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


def probe_file(path):
    err = subprocess.run([FFMPEG, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return dur, err


def wait_jobs(tok, pid, ids, timeout=240):
    end = time.time() + timeout
    seen_progress = set()
    while time.time() < end:
        jobs = {j["id"]: j for j in requests.get(f"{BASE_URL}/api/clip-projects/{pid}/jobs", headers=H(tok)).json()}
        for i in ids:
            seen_progress.add(jobs[i].get("progress"))
        if all(jobs[i]["status"] in ("done", "error") for i in ids):
            return [jobs[i] for i in ids], seen_progress
        time.sleep(1.5)
    raise AssertionError("jobs did not finish")


class TestClipStudio:
    st = {}

    @pytest.fixture(scope="class", autouse=True)
    def setup(self):
        st = self.st
        st["admin"] = login(**ADMIN)
        email = f"test_clipcollab_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=H(st["admin"]), json={"name": "TEST_clipcollab", "email": email, "password": "TestPass#123"})
        assert r.status_code == 200, r.text
        st["uid"] = r.json()["id"]
        st["collab"] = login(email, "TestPass#123")
        st["pids"] = []
        yield
        for pid in st["pids"]:
            requests.delete(f"{BASE_URL}/api/clip-projects/{pid}", headers=H(st["admin"]))
        requests.delete(f"{BASE_URL}/api/admin/users/{st['uid']}", headers=H(st["admin"]))

    def test_01_reject_outside_world(self):
        r = requests.post(f"{BASE_URL}/api/clip-projects", headers=H(self.st["admin"]), json={"world_slug": WORLD, "path": "/Other Folder/x.mp4"})
        assert r.status_code == 403, r.text
        r = requests.post(f"{BASE_URL}/api/clip-projects", headers=H(self.st["admin"]), json={"world_slug": WORLD, "path": "/Yakshaloka US/../Secret/x.mp4"})
        assert r.status_code in (403, 400, 404), r.text

    def test_02_unauth(self):
        r = requests.post(f"{BASE_URL}/api/clip-projects", json={"world_slug": WORLD, "path": VIDEO})
        assert r.status_code == 401

    def test_03_create_video(self):
        r = requests.post(f"{BASE_URL}/api/clip-projects", headers=H(self.st["admin"]), json={"world_slug": WORLD, "path": VIDEO, "name": "TEST_clipvideo"})
        assert r.status_code == 200, r.text
        p = r.json()
        self.st["pids"].append(p["id"])
        self.st["video"] = p
        assert p["source"]["has_video"] and p["source"]["duration"] > 0
        assert p["clips"][0]["name"] == "Clip 1"
        print("video duration", p["source"]["duration"])

    def test_04_collab_no_access(self):
        pid = self.st["video"]["id"]
        for path in ("", "/source", "/jobs"):
            assert requests.get(f"{BASE_URL}/api/clip-projects/{pid}{path}", headers=H(self.st["collab"])).status_code == 404
        assert requests.put(f"{BASE_URL}/api/clip-projects/{pid}", headers=H(self.st["collab"]), json={"name": "hack"}).status_code == 404
        assert requests.delete(f"{BASE_URL}/api/clip-projects/{pid}", headers=H(self.st["collab"])).status_code == 404
        assert all(x["id"] != pid for x in requests.get(f"{BASE_URL}/api/clip-projects", headers=H(self.st["collab"])).json())

    def test_05_update_persist(self):
        p = self.st["video"]
        dur = p["source"]["duration"]
        base = p["clips"][0]
        c1 = {**base, "id": "c1test", "name": "TEST_A", "aspect": "9:16", "segments": [{"start": 1.0, "end": 2.5}, {"start": 4.0, "end": 5.0}], "selected": True}
        c2 = {**base, "id": "c2test", "name": "TEST_B", "aspect": "16:9", "segments": [{"start": 0.0, "end": min(2.0, dur)}], "fade_in": 0.3, "selected": True}
        r = requests.put(f"{BASE_URL}/api/clip-projects/{p['id']}", headers=H(self.st["admin"]), json={"clips": [c1, c2], "name": "TEST_clipvideo2"})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/clip-projects/{p['id']}", headers=H(self.st["admin"])).json()
        assert g["name"] == "TEST_clipvideo2" and [c["name"] for c in g["clips"]] == ["TEST_A", "TEST_B"]

    def test_06_export_mp4(self, tmp_path):
        pid = self.st["video"]["id"]
        r = requests.post(f"{BASE_URL}/api/clip-projects/{pid}/export", headers=H(self.st["admin"]), json={"clip_ids": ["c1test", "c2test"], "format": "mp4", "destination": "download"})
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert len(jobs) == 2
        done, prog = wait_jobs(self.st["admin"], pid, [j["id"] for j in jobs])
        print("progress seen", prog)
        for j in done:
            assert j["status"] == "done", j
        self.st["job"] = done[0]["id"]
        # download & probe
        for j, (w, h, exp) in zip(done, [(1080, 1920, 2.5), (1920, 1080, None)]):
            d = requests.get(f"{BASE_URL}/api/clip-jobs/{j['id']}/download", params={"token": self.st["admin"]})
            assert d.status_code == 200
            f = tmp_path / f"{j['id']}.mp4"
            f.write_bytes(d.content)
            dur, info = probe_file(str(f))
            print(j["filename"], dur, re.findall(r"Stream #.*", info))
            assert "h264" in info and f"{w}x{h}" in info
            if exp:
                assert abs(dur - exp) < 0.3, dur

    def test_07_download_token(self):
        jid = self.st["job"]
        assert requests.get(f"{BASE_URL}/api/clip-jobs/{jid}/download").status_code in (401, 403, 404)
        assert requests.get(f"{BASE_URL}/api/clip-jobs/{jid}/download", params={"token": "garbage"}).status_code in (401, 403, 404)
        assert requests.get(f"{BASE_URL}/api/clip-jobs/{jid}/download", params={"token": self.st["collab"]}).status_code == 404

    def test_08_dropbox_dest_error(self):
        pid = self.st["video"]["id"]
        r = requests.post(f"{BASE_URL}/api/clip-projects/{pid}/export", headers=H(self.st["admin"]), json={"clip_ids": ["c2test"], "format": "mp4", "destination": "dropbox", "dropbox_folder": "/Elsewhere"})
        assert r.status_code == 403
        r = requests.post(f"{BASE_URL}/api/clip-projects/{pid}/export", headers=H(self.st["admin"]), json={"clip_ids": ["c2test"], "format": "mp4", "destination": "dropbox", "dropbox_folder": "/Yakshaloka US/Clips"})
        assert r.status_code == 200
        done, _ = wait_jobs(self.st["admin"], pid, [r.json()[0]["id"]])
        j = done[0]
        assert j["status"] == "error" and "files.content.write" in j["error"] and j["downloadable"] is True, j
        assert not j.get("dropbox_path")

    def test_09_audio_mp3(self, tmp_path):
        a = self.st["admin"]
        r = requests.post(f"{BASE_URL}/api/clip-projects", headers=H(a), json={"world_slug": WORLD, "path": AUDIO, "name": "TEST_clipaudio"})
        assert r.status_code == 200, r.text
        p = r.json()
        self.st["pids"].append(p["id"])
        assert p["source"]["has_audio"] and not p["source"]["has_video"]
        assert requests.post(f"{BASE_URL}/api/clip-projects/{p['id']}/export", headers=H(a), json={"clip_ids": [p["clips"][0]["id"]], "format": "mp4"}).status_code == 400
        c = {**p["clips"][0], "segments": [{"start": 3.0, "end": 10.5}]}
        requests.put(f"{BASE_URL}/api/clip-projects/{p['id']}", headers=H(a), json={"clips": [c]})
        r = requests.post(f"{BASE_URL}/api/clip-projects/{p['id']}/export", headers=H(a), json={"clip_ids": [c["id"]], "format": "mp3"})
        done, _ = wait_jobs(a, p["id"], [r.json()[0]["id"]])
        assert done[0]["status"] == "done", done[0]
        d = requests.get(f"{BASE_URL}/api/clip-jobs/{done[0]['id']}/download", params={"token": a})
        f = tmp_path / "a.mp3"
        f.write_bytes(d.content)
        dur, info = probe_file(str(f))
        assert "mp3" in info and abs(dur - 7.5) < 0.3, dur

    def test_10_bad_format(self):
        pid = self.st["video"]["id"]
        assert requests.post(f"{BASE_URL}/api/clip-projects/{pid}/export", headers=H(self.st["admin"]), json={"clip_ids": ["c2test"], "format": "avi"}).status_code == 400
        assert requests.post(f"{BASE_URL}/api/clip-projects/{pid}/export", headers=H(self.st["admin"]), json={"clip_ids": [], "format": "mp4"}).status_code == 422
