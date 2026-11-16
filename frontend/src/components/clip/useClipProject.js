import { useCallback, useEffect, useRef, useState } from "react";
import { api, errText } from "@/lib/api";

export const uid = () => Math.random().toString(36).slice(2, 12);
export const clipLength = (c) => c.segments.reduce((t, s) => t + Math.max(0, s.end - s.start), 0);
export const fmtTime = (t = 0) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

export function useClipProject(id) {
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState("saved");
  const ref = useRef(p);
  ref.current = p;
  const past = useRef([]);
  const future = useRef([]);
  const saved = useRef(null);
  const [, bump] = useState(0);

  useEffect(() => {
    api.get(`/clip-projects/${id}`).then((r) => { saved.current = JSON.stringify([r.data.name, r.data.clips]); setP(r.data); }).catch((e) => setError(errText(e)));
  }, [id]);

  const key = p ? JSON.stringify([p.name, p.clips]) : null;
  useEffect(() => {
    if (!key || key === saved.current) { return undefined; }
    setSaving("saving");
    const t = setTimeout(async () => {
      try { await api.put(`/clip-projects/${id}`, { name: ref.current.name, clips: ref.current.clips }); saved.current = key; setSaving("saved"); } catch { setSaving("error"); }
    }, 800);
    return () => clearTimeout(t);
  }, [key, id]);

  const patch = useCallback((fn) => setP((s) => ({ ...s, ...fn(s) })), []);
  const change = useCallback((fn) => {
    past.current.push(ref.current.clips);
    future.current = [];
    patch(fn);
    bump((x) => x + 1);
  }, [patch]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(ref.current.clips);
    patch(() => ({ clips: prev }));
    bump((x) => x + 1);
  }, [patch]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(ref.current.clips);
    patch(() => ({ clips: next }));
    bump((x) => x + 1);
  }, [patch]);
  const updateClip = useCallback((cid, data, history = true) => {
    const fn = (s) => ({ clips: s.clips.map((c) => (c.id === cid ? { ...c, ...(typeof data === "function" ? data(c) : data) } : c)) });
    if (history) change(fn); else patch(fn);
  }, [change, patch]);

  return { p, error, saving, ref, patch, change, undo, redo, updateClip, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
