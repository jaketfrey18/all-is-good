import { useRef } from "react";
import { fmtTime } from "@/components/clip/useClipProject";

function ticks(duration, zoom) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900];
  const step = steps.find((s) => (duration / s) / zoom < 14) || 1800;
  return Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
}

export const Timeline = ({ duration, time, zoom, clip, mark, onSeek, onTrim, onTrimEnd }) => {
  const inner = useRef(null);
  const toSec = (clientX) => {
    const r = inner.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };
  const pct = (t) => `${(t / (duration || 1)) * 100}%`;

  const scrub = (e) => {
    onSeek(toSec(e.clientX));
    const move = (ev) => onSeek(toSec(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const trim = (i, edge) => (e) => {
    e.stopPropagation();
    const move = (ev) => onTrim(i, edge, toSec(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); onTrimEnd(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-xl bg-[#120e0f] border border-white/10" data-testid="clip-timeline">
      <div ref={inner} className="relative h-28 select-none cursor-text" style={{ width: `${zoom * 100}%`, minWidth: "100%" }} onPointerDown={scrub}>
        {ticks(duration, zoom).map((t) => (
          <div key={t} className="absolute top-0 h-full border-l border-white/[0.07]" style={{ left: pct(t) }}>
            <span className="absolute top-1 left-1 text-[10px] font-mono text-white/40">{fmtTime(t).replace(/\.\d+$/, "")}</span>
          </div>
        ))}
        <div className="absolute left-0 right-0 top-8 h-10 rounded-md bg-white/[0.04]" />
        {mark.in != null && mark.out != null && mark.out > mark.in && (
          <div className="absolute top-8 h-10 bg-amber-400/15 border-x-2 border-amber-400" style={{ left: pct(mark.in), width: pct(mark.out - mark.in) }} data-testid="clip-inout-range" />
        )}
        {clip?.segments.map((s, i) => (
          <div key={i} className="absolute top-[52px] h-12 rounded-md bg-[#e0141b]/70 border border-[#ff4757] shadow-[0_0_14px_rgba(224,20,27,0.5)]" style={{ left: pct(s.start), width: pct(Math.max(0, s.end - s.start)) }} data-testid={`clip-segment-${i}`}>
            <span className="absolute left-2 top-1 text-[10px] font-bold text-white">{i + 1}</span>
            <span onPointerDown={trim(i, "start")} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/40 rounded-l-md" data-testid={`clip-segment-${i}-start`} />
            <span onPointerDown={trim(i, "end")} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/40 rounded-r-md" data-testid={`clip-segment-${i}-end`} />
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: pct(time) }} data-testid="clip-playhead">
          <span className="absolute -top-0 -left-1.5 w-3.5 h-3.5 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
};
