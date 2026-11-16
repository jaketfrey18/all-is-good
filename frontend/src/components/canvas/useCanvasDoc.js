import { useCallback, useEffect, useRef, useState } from "react";
import { api, errText } from "@/lib/api";

export function useCanvasDoc(id) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState("saved");
  const ref = useRef(state);
  ref.current = state;
  const past = useRef([]);
  const future = useRef([]);
  const lastSaved = useRef(null);
  const [, bump] = useState(0);

  useEffect(() => {
    setState(null);
    past.current = []; future.current = [];
    api.get(`/canvases/${id}`).then((r) => {
      lastSaved.current = JSON.stringify([r.data.name, r.data.items, r.data.edges, r.data.viewport]);
      setState(r.data);
    }).catch((e) => setError(errText(e)));
  }, [id]);

  const key = state ? JSON.stringify([state.name, state.items, state.edges, state.viewport]) : null;
  useEffect(() => {
    if (!key || key === lastSaved.current) { return undefined; }
    setSaving("saving");
    const t = setTimeout(async () => {
      const s = ref.current;
      try {
        await api.put(`/canvases/${id}`, { name: s.name, items: s.items, edges: s.edges, viewport: s.viewport });
        lastSaved.current = key;
        setSaving("saved");
      } catch { setSaving("error"); }
    }, 700);
    return () => clearTimeout(t);
  }, [key, id]);

  const patch = useCallback((p) => setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) })), []);
  const snapshot = useCallback(() => ({ items: ref.current.items, edges: ref.current.edges }), []);
  const pushHistory = useCallback((snap) => {
    past.current.push(snap);
    if (past.current.length > 150) past.current.shift();
    future.current = [];
    bump((x) => x + 1);
  }, []);
  const change = useCallback((fn) => { pushHistory(snapshot()); patch(fn); }, [patch, pushHistory, snapshot]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(snapshot());
    patch(prev);
    bump((x) => x + 1);
  }, [patch, snapshot]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(snapshot());
    patch(next);
    bump((x) => x + 1);
  }, [patch, snapshot]);

  return { state, error, saving, ref, patch, change, pushHistory, snapshot, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
