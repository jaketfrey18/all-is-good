import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, Eye } from "lucide-react";
import { FileIcon } from "@/components/workspace/FileIcon";
import { fileKind, fmtSize, thumbUrl } from "@/lib/api";
import { useTempLink } from "@/lib/hooks";

const stop = (e) => e.stopPropagation();

const ImageBody = ({ slug, d }) => (
  <img src={thumbUrl(slug, d.path)} alt={d.name} draggable={false} className="w-full h-full object-cover" data-testid="canvas-image" />
);

function VideoBody({ slug, d }) {
  const [on, setOn] = useState(false);
  const { data: url, isLoading } = useTempLink(slug, d.path, on);
  if (on && url) return <video src={url} controls autoPlay className="w-full h-full bg-black object-contain" onPointerDown={stop} data-testid="canvas-video" />;
  return (
    <button onClick={() => setOn(true)} onPointerDown={stop} className="w-full h-full grid place-items-center bg-gradient-to-br from-[#2a1d1e] to-[#151011] group" data-testid="canvas-video-play">
      <span className="w-14 h-14 rounded-full bg-[#e0141b] grid place-items-center shadow-[0_0_30px_rgba(224,20,27,0.6)] group-hover:scale-105 transition-transform">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" fill="white" />}
      </span>
    </button>
  );
}

export function usePeaks(url, size) {
  const [peaks, setPeaks] = useState(null);
  useEffect(() => {
    if (!url || size > 40 * 1024 * 1024) { return undefined; }
    let alive = true;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        const ch = audio.getChannelData(0);
        const n = 96, step = Math.floor(ch.length / n);
        const out = Array.from({ length: n }, (_, i) => {
          let m = 0;
          for (let j = i * step; j < (i + 1) * step; j += 64) m = Math.max(m, Math.abs(ch[j]));
          return m;
        });
        ctx.close();
        if (alive) setPeaks(out);
      } catch { if (alive) setPeaks(false); }
    })();
    return () => { alive = false; };
  }, [url, size]);
  return peaks;
}

function AudioBody({ slug, d }) {
  const { data: url } = useTempLink(slug, d.path);
  const peaks = usePeaks(url, d.size || 0);
  const el = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const bars = peaks || Array.from({ length: 96 }, (_, i) => 0.25 + 0.2 * Math.abs(Math.sin(i * 0.7)));
  const toggle = () => { if (!el.current) return; if (playing) el.current.pause(); else el.current.play(); };
  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (el.current?.duration) el.current.currentTime = ((e.clientX - r.left) / r.width) * el.current.duration;
  };
  return (
    <div className="w-full h-full flex items-center gap-3 px-3" onPointerDown={stop} data-testid="canvas-audio">
      <button onClick={toggle} disabled={!url} className="w-11 h-11 shrink-0 rounded-full bg-[#e0141b] grid place-items-center disabled:opacity-40" data-testid="canvas-audio-toggle">
        {playing ? <Pause className="w-5 h-5 text-white" fill="white" /> : <Play className="w-5 h-5 text-white ml-0.5" fill="white" />}
      </button>
      <div className="flex-1 h-full flex items-center gap-[2px] cursor-pointer" onClick={seek} data-testid="canvas-audio-waveform">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(6, b * 85)}%`, background: i / bars.length < pos ? "#ff4757" : "rgba(255,255,255,0.22)" }} />
        ))}
      </div>
      {url && <audio ref={el} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setPos(e.target.currentTime / (e.target.duration || 1))} />}
    </div>
  );
}

const OtherBody = ({ d, onPreview }) => (
  <div className="w-full h-full flex items-center gap-3 px-4">
    <FileIcon item={{ type: "file", ext: d.ext }} className="w-9 h-9 shrink-0" />
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white truncate">{d.name}</p><p className="text-[11px] font-mono text-white/45">{d.ext} · {fmtSize(d.size)}</p></div>
    <button onClick={onPreview} onPointerDown={stop} className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#e0141b] transition-colors" aria-label="Preview" data-testid="canvas-file-preview"><Eye className="w-4 h-4 text-white" /></button>
  </div>
);

export const FileBody = ({ slug, item, onPreview }) => {
  const d = item.data;
  const k = fileKind(d.ext);
  if (k === "image") return <ImageBody slug={slug} d={d} />;
  if (k === "video") return <VideoBody slug={slug} d={d} />;
  if (k === "audio") return <AudioBody slug={slug} d={d} />;
  return <OtherBody d={d} onPreview={onPreview} />;
};
