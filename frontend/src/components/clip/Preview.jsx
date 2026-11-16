import { forwardRef } from "react";
import { usePeaks } from "@/components/canvas/MediaBodies";

const RATIO = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5 };

export const Preview = forwardRef(({ url, source, clip, onTime, onPlayState, time, duration }, ref) => {
  const peaks = usePeaks(source.has_video ? null : url, source.size || 0);
  const crop = clip?.crop || { zoom: 1, x: 0.5, y: 0.5 };
  const events = { onTimeUpdate: (e) => onTime(e.target.currentTime), onPlay: () => onPlayState(true), onPause: () => onPlayState(false), onSeeked: (e) => onTime(e.target.currentTime) };
  if (!source.has_video) {
    const bars = peaks || Array.from({ length: 96 }, (_, i) => 0.2 + 0.25 * Math.abs(Math.sin(i * 0.6)));
    return (
      <div className="w-full h-full flex flex-col justify-center px-8" data-testid="clip-audio-preview">
        <div className="h-40 flex items-center gap-[3px]">
          {bars.map((b, i) => <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(4, b * 100)}%`, background: i / bars.length < time / (duration || 1) ? "#ff4757" : "rgba(255,255,255,0.2)" }} />)}
        </div>
        <audio ref={ref} src={url} {...events} />
      </div>
    );
  }
  const ratio = RATIO[clip?.aspect || "16:9"];
  return (
    <div className="w-full h-full grid place-items-center p-4" data-testid="clip-video-preview">
      <div className="relative max-w-full max-h-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10" style={{ aspectRatio: ratio, height: ratio < 1 ? "100%" : "auto", width: ratio >= 1 ? "100%" : "auto" }}>
        <video ref={ref} src={url} {...events} playsInline className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `${crop.x * 100}% ${crop.y * 100}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x * 100}% ${crop.y * 100}%`, filter: clip?.muted ? "none" : undefined }} />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono text-white/80" data-testid="clip-aspect-badge">{clip?.aspect}</span>
      </div>
    </div>
  );
});
Preview.displayName = "Preview";
