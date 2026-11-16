import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { api, errText } from "@/lib/api";
import { useSyncProvider, useProviderState } from "@/components/lyrics/provider";

const LOCAL = "local-canvas";
const vpKey = (id) => `aig_vp_${id}`;
const sortItems = (m) => Array.from(m.values()).sort((a, b) => (a.z || 0) - (b.z || 0));

function syncMap(ymap, prevList, nextList, stamp) {
  const keep = new Set(nextList.map((x) => x.id));
  prevList.forEach((x) => { if (!keep.has(x.id)) ymap.delete(x.id); });
  const prev = Object.fromEntries(prevList.map((x) => [x.id, x]));
  nextList.forEach((x) => { if (prev[x.id] !== x) ymap.set(x.id, stamp && x.z == null ? { ...x, z: Date.now() } : x); });
}

export function useCanvasDoc(id) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [viewport, setViewport] = useState(null);
  const [items, setItems] = useState([]);
  const [edges, setEdges] = useState([]);
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);
  const provider = useSyncProvider(`canvas/${id}`);
  const { status } = useProviderState(provider);
  const um = useRef(null);

  useEffect(() => {
    setMeta(null); setReady(false); setError(null);
    api.get(`/canvases/${id}`).then((r) => {
      const saved = localStorage.getItem(vpKey(id));
      setViewport(saved ? JSON.parse(saved) : r.data.viewport || { x: 0, y: 0, zoom: 1 });
      setMeta(r.data);
    }).catch((e) => setError(errText(e)));
  }, [id]);

  useEffect(() => {
    if (!provider) { return undefined; }
    const yi = provider.doc.getMap("items"), ye = provider.doc.getMap("edges");
    const read = () => { setItems(sortItems(yi)); setEdges(Array.from(ye.values())); };
    yi.observe(read); ye.observe(read); read();
    const manager = new Y.UndoManager([yi, ye], { trackedOrigins: new Set([LOCAL]), captureTimeout: 1e9 });
    const onStack = () => bump((x) => x + 1);
    manager.on("stack-item-added", onStack);
    manager.on("stack-item-popped", onStack);
    um.current = manager;
    return () => { yi.unobserve(read); ye.unobserve(read); manager.destroy(); };
  }, [provider]);

  useEffect(() => {
    if (!provider || !meta || ready) { return undefined; }
    const check = () => {
      if (!provider.synced) return;
      const yi = provider.doc.getMap("items"), ye = provider.doc.getMap("edges");
      if (yi.size === 0 && meta.items?.length) {
        provider.doc.transact(() => {
          meta.items.forEach((it, i) => yi.set(it.id, { ...it, z: it.z ?? i }));
          (meta.edges || []).forEach((e) => ye.set(e.id, e));
        });
      }
      setReady(true);
    };
    check();
    provider.listeners.add(check);
    return () => provider.listeners.delete(check);
  }, [provider, meta, ready]);

  useEffect(() => {
    if (!viewport) { return undefined; }
    const t = setTimeout(() => localStorage.setItem(vpKey(id), JSON.stringify(viewport)), 400);
    return () => clearTimeout(t);
  }, [viewport, id]);

  const state = ready && meta && viewport ? { ...meta, items, edges, viewport } : null;
  const ref = useRef(state);
  ref.current = state;

  const current = useCallback(() => {
    const d = provider.doc;
    return { ...ref.current, items: sortItems(d.getMap("items")), edges: Array.from(d.getMap("edges").values()) };
  }, [provider]);

  const patch = useCallback((p) => {
    const cur = current();
    const next = typeof p === "function" ? p(cur) : p;
    if (next.viewport) setViewport(next.viewport);
    if (next.shared_with) setMeta((m) => ({ ...m, shared_with: next.shared_with }));
    if (next.name) { setMeta((m) => ({ ...m, name: next.name })); api.put(`/canvases/${id}`, { name: next.name }).catch(() => {}); }
    if (next.items || next.edges) {
      provider.doc.transact(() => {
        if (next.items) syncMap(provider.doc.getMap("items"), cur.items, next.items, true);
        if (next.edges) syncMap(provider.doc.getMap("edges"), cur.edges, next.edges, false);
      }, LOCAL);
    }
  }, [current, provider, id]);

  const pushHistory = useCallback(() => um.current?.stopCapturing(), []);
  const snapshot = useCallback(() => { um.current?.stopCapturing(); return current(); }, [current]);
  const change = useCallback((fn) => { um.current?.stopCapturing(); patch(fn); um.current?.stopCapturing(); }, [patch]);
  const undo = useCallback(() => um.current?.undo(), []);
  const redo = useCallback(() => um.current?.redo(), []);

  const saving = status === "online" ? "saved" : status === "denied" ? "error" : "saving";
  const denied = status === "denied" ? "You don't have access to this canvas." : null;
  return {
    state, error: error || denied, saving, ref, patch, change, pushHistory, snapshot, undo, redo,
    canUndo: (um.current?.undoStack.length || 0) > 0, canRedo: (um.current?.redoStack.length || 0) > 0,
  };
}
