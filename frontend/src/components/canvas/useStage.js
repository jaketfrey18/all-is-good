import { useCallback, useEffect, useRef } from "react";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function useStage(cv, stageRef) {
  const vp = cv.state?.viewport || { x: 0, y: 0, zoom: 1 };
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const setVp = useCallback((v) => cv.patch({ viewport: v }), [cv.patch]); // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = useCallback((cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    const v = vpRef.current;
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  }, [stageRef]);

  const zoomAt = useCallback((factor, cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    const v = vpRef.current;
    const z = clamp(v.zoom * factor, 0.1, 4);
    const px = cx - r.left, py = cy - r.top;
    setVp({ zoom: z, x: px - (px - v.x) * (z / v.zoom), y: py - (py - v.y) * (z / v.zoom) });
  }, [setVp, stageRef]);

  const zoomBy = useCallback((f) => {
    const r = stageRef.current.getBoundingClientRect();
    zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
  }, [zoomAt, stageRef]);

  const fit = useCallback((items) => {
    const r = stageRef.current.getBoundingClientRect();
    if (!items.length) return setVp({ x: 0, y: 0, zoom: 1 });
    const minX = Math.min(...items.map((i) => i.x)), minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.w)), maxY = Math.max(...items.map((i) => i.y + i.h));
    const z = clamp(Math.min((r.width - 160) / (maxX - minX), (r.height - 200) / (maxY - minY)), 0.1, 1.5);
    return setVp({ zoom: z, x: (r.width - (maxX - minX) * z) / 2 - minX * z, y: (r.height - (maxY - minY) * z) / 2 - minY * z });
  }, [setVp, stageRef]);

  const startPan = useCallback((e) => {
    const sx = e.clientX, sy = e.clientY, v0 = vpRef.current;
    const move = (ev) => setVp({ ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [setVp]);

  const ready = !!cv.state;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) { return undefined; }
    const onWheel = (e) => {
      const scrollable = e.target.closest?.("[data-scrollable]");
      if (scrollable && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
      else { const v = vpRef.current; setVp({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready, stageRef, zoomAt, setVp]);

  return { vp, toWorld, zoomAt, zoomBy, fit, startPan };
}
