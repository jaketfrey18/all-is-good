import { useCallback } from "react";
import { toast } from "sonner";
import { api, errText, fileKind } from "@/lib/api";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const FILE_SIZE = { image: [320, 240], video: [440, 290], audio: [380, 120], pdf: [300, 110], doc: [300, 110] };
const SIZE = { note: [240, 170], frame: [640, 420], lyric: [440, 520] };

export function useCanvasActions({ cv, stage, stageRef, setSel }) {
  const viewCenter = useCallback(() => {
    const r = stageRef.current.getBoundingClientRect();
    return stage.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }, [stage, stageRef]);

  const make = useCallback((type, data, at, size) => {
    const [w, h] = size || SIZE[type];
    const p = at || viewCenter();
    return { id: uid(), type, x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2), w, h, data };
  }, [viewCenter]);

  const add = useCallback((item) => {
    cv.change((s) => ({ items: [...s.items, item] }));
    setSel({ ids: [item.id], edge: null });
  }, [cv, setSel]);

  const addFile = useCallback((f, at) => {
    add(make("file", { path: f.path, name: f.name, ext: f.ext, size: f.size }, at, FILE_SIZE[fileKind(f.ext)] || [300, 110]));
  }, [add, make]);

  const addNote = useCallback((at) => add(make("note", { text: "", color: "#2a2122" }, at)), [add, make]);
  const addFrame = useCallback((at) => add(make("frame", { label: "Frame" }, at)), [add, make]);

  const addLyric = useCallback(async (existing) => {
    try {
      const s = cv.ref.current;
      const doc = existing || (await api.post("/lyrics", { world_slug: s.world_slug, title: "Untitled lyrics", canvas_id: s.id })).data;
      add(make("lyric", { lyric_id: doc.id, title: doc.title }));
    } catch (e) { toast.error(errText(e)); }
  }, [add, make, cv.ref]);

  const removeIds = useCallback((ids) => {
    cv.change((s) => ({ items: s.items.filter((i) => !ids.includes(i.id)), edges: s.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to)) }));
    setSel({ ids: [], edge: null });
  }, [cv, setSel]);

  const removeEdge = useCallback((id) => {
    cv.change((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
    setSel({ ids: [], edge: null });
  }, [cv, setSel]);

  const connect = useCallback((from, to) => {
    if (from === to) return;
    cv.change((s) => (s.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)) ? {} : { edges: [...s.edges, { id: uid(), from, to }] }));
  }, [cv]);

  const setData = useCallback((id, data, history = false) => {
    const fn = (s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, data: { ...i.data, ...data } } : i)) });
    if (history) cv.change(fn); else cv.patch(fn);
  }, [cv]);

  const group = useCallback((ids) => {
    const g = uid();
    cv.change((s) => ({ items: s.items.map((i) => (ids.includes(i.id) ? { ...i, group: g } : i)) }));
  }, [cv]);

  const ungroup = useCallback((ids) => {
    cv.change((s) => {
      const gs = new Set(s.items.filter((i) => ids.includes(i.id) && i.group).map((i) => i.group));
      return { items: s.items.map((i) => (gs.has(i.group) ? { ...i, group: undefined } : i)) };
    });
  }, [cv]);

  const expandIds = useCallback((ids) => {
    const items = cv.ref.current.items;
    const gs = new Set(items.filter((i) => ids.includes(i.id) && i.group).map((i) => i.group));
    return items.filter((i) => ids.includes(i.id) || gs.has(i.group)).map((i) => i.id);
  }, [cv.ref]);

  const drag = useCallback((e, ids, mode) => {
    const snap = cv.snapshot();
    const z = stage.vp.zoom;
    const sx = e.clientX, sy = e.clientY;
    const orig = Object.fromEntries(snap.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, i]));
    const move = (ev) => {
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      cv.patch((s) => ({
        items: s.items.map((i) => {
          const o = orig[i.id];
          if (!o) return i;
          return mode === "resize" ? { ...i, w: Math.max(140, Math.round(o.w + dx)), h: Math.max(90, Math.round(o.h + dy)) } : { ...i, x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
        }),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      cv.pushHistory();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [cv, stage.vp.zoom]);

  return { add, addFile, addNote, addFrame, addLyric, removeIds, removeEdge, connect, setData, group, ungroup, expandIds, drag };
}
