import { useEffect, useReducer, useState } from "react";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { TOKEN_KEY } from "@/lib/api";

const WS_BASE = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws");
const UPDATE = 0, AWARENESS = 1, LEAVE = 2;

class LyricProvider {
  constructor(id) {
    this.id = id;
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);
    this.status = "connecting";
    this.synced = false;
    this.listeners = new Set();
    this.closed = false;
    this.retry = 0;
    this.doc.on("update", (u, origin) => { if (origin !== this) this.send(UPDATE, u); });
    this.awareness.on("update", ({ added, updated, removed }, origin) => {
      if (origin === this) return;
      this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, added.concat(updated, removed)));
    });
    this.connect();
  }

  setStatus(s) { this.status = s; this.listeners.forEach((f) => f()); }

  connect() {
    const token = encodeURIComponent(localStorage.getItem(TOKEN_KEY) || "");
    const ws = new WebSocket(`${WS_BASE}/api/ws/lyrics/${this.id}?token=${token}&cid=${this.doc.clientID}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.send(UPDATE, Y.encodeStateAsUpdate(this.doc));
      this.send(AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    };
    ws.onmessage = (e) => {
      const d = new Uint8Array(e.data);
      const p = d.subarray(1);
      if (d[0] === UPDATE) {
        Y.applyUpdate(this.doc, p, this);
        if (!this.synced) { this.synced = true; }
        if (this.status !== "online") this.setStatus("online");
      } else if (d[0] === AWARENESS) applyAwarenessUpdate(this.awareness, p, this);
      else if (d[0] === LEAVE) removeAwarenessStates(this.awareness, [Number(new TextDecoder().decode(p))], this);
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.setStatus("offline");
      this.retry += 1;
      setTimeout(() => !this.closed && this.connect(), Math.min(8000, 800 * this.retry));
    };
  }

  send(type, payload) {
    if (this.ws?.readyState !== 1) return;
    const m = new Uint8Array(payload.length + 1);
    m[0] = type;
    m.set(payload, 1);
    this.ws.send(m);
  }

  destroy() {
    this.closed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
    this.ws?.close();
    this.doc.destroy();
  }
}

const cache = new Map();

function acquire(id) {
  let e = cache.get(id);
  if (!e) { e = { p: new LyricProvider(id), n: 0 }; cache.set(id, e); }
  e.n += 1;
  return e.p;
}

function release(id) {
  const e = cache.get(id);
  if (!e) return;
  e.n -= 1;
  setTimeout(() => { if (e.n <= 0 && cache.get(id) === e) { e.p.destroy(); cache.delete(id); } }, 3000);
}

export function useLyricProvider(id) {
  const [p, setP] = useState(null);
  useEffect(() => {
    const pr = acquire(id);
    setP(pr);
    return () => release(id);
  }, [id]);
  return p;
}

export function useProviderState(p) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!p) { return undefined; }
    p.listeners.add(force);
    p.awareness.on("change", force);
    return () => { p.listeners.delete(force); p.awareness.off("change", force); };
  }, [p]);
  if (!p) return { status: "connecting", peers: [] };
  const peers = [];
  p.awareness.getStates().forEach((s, cid) => { if (s.user && cid !== p.doc.clientID) peers.push({ cid, ...s.user }); });
  return { status: p.status, peers };
}
