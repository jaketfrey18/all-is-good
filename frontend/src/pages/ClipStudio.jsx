import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, SkipBack, SkipForward, Undo2, Redo2, Loader2, ArrowLeft, Repeat, Mic } from "lucide-react";
import { toast } from "sonner";
import { RecorderPanel } from "@/components/library/RecorderPanel";
import { TopNav } from "@/components/TopNav";
import { Slider } from "@/components/ui/slider";
import { useClipProject, uid, fmtTime, clipLength } from "@/components/clip/useClipProject";
import { Preview } from "@/components/clip/Preview";
import { Timeline } from "@/components/clip/Timeline";
import { ClipQueue } from "@/components/clip/ClipQueue";
import { ClipInspector } from "@/components/clip/ClipInspector";
import { ExportDialog, JobList } from "@/components/clip/ExportDialog";
import { api, errText } from "@/lib/api";
import { useProjects } from "@/lib/hooks";

const MODES = ["Clip", "Captions", "AI Assist"];
const FRAME = 1 / 30;
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable); };

const NextPhase = ({ title }) => (
  <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/55" data-testid={`clip-mode-${title.toLowerCase().replace(" ", "-")}-panel`}>
    <p className="font-display text-lg font-bold text-white mb-1">{title}</p>
    {title === "Captions" ? "Transcription, the caption editor, styles and burned-in captions are the next build phase." : "Long-to-short suggestions, hooks and auto-reframing come after captions."}
  </div>
);

function Studio({ cp }) {
  const p = cp.p;
  const media = useRef(null);
  const [activeId, setActiveId] = useState(p.clips[0]?.id);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mark, setMark] = useState({ in: null, out: null });
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState("Clip");
  const [exporting, setExporting] = useState(false);
  const [recording, setRecording] = useState(false);
  const navigate = useNavigate();
  const importRecording = async (a) => {
    try { navigate(`/studio/${(await api.post("/clip-projects", { world_slug: a.world_slug, asset_id: a.id })).data.id}`); } catch (e) { toast.error(errText(e)); }
  };
  const clipPlay = useRef(false);
  const trimming = useRef(false);
  const { data: url } = useQuery({ queryKey: ["clip-src", p.id], queryFn: async () => (await api.get(`/clip-projects/${p.id}/source`)).data.url, staleTime: 3 * 3600 * 1000 });
  const { data: worlds = [] } = useProjects();
  const clip = p.clips.find((c) => c.id === activeId) || p.clips[0];
  const duration = p.source.duration;

  const seek = useCallback((t) => { if (media.current) media.current.currentTime = Math.max(0, Math.min(duration, t)); setTime(t); }, [duration]);
  const toggle = useCallback(() => { const m = media.current; if (!m) return; clipPlay.current = false; if (m.paused) m.play(); else m.pause(); }, []);
  const playClip = () => { if (!clip || !media.current) return; clipPlay.current = true; seek(clip.segments[0].start); media.current.play(); };

  const onTime = (t) => {
    setTime(t);
    if (!clipPlay.current || !clip) return;
    const segs = clip.segments, i = segs.findIndex((s) => t >= s.start - 0.05 && t < s.end);
    if (i === -1 || t >= segs[i].end - 0.03) {
      const next = segs.find((s) => s.start > t - 0.05 && s !== segs[i]);
      const after = segs.findIndex((s) => s === segs[i]) + 1;
      if (i !== -1 && after < segs.length) seek(segs[after].start);
      else if (i === -1 && next) seek(next.start);
      else { media.current.pause(); clipPlay.current = false; }
    }
  };

  const update = (data) => cp.updateClip(clip.id, data, true);
  const live = (data) => cp.updateClip(clip.id, data, false);
  const split = () => {
    const i = clip.segments.findIndex((s) => time > s.start + 0.05 && time < s.end - 0.05);
    if (i === -1) return;
    const s = clip.segments[i];
    update({ segments: [...clip.segments.slice(0, i), { start: s.start, end: time }, { start: time, end: s.end }, ...clip.segments.slice(i + 1)] });
  };
  const addSegment = () => update({ segments: [...clip.segments, { start: mark.in, end: mark.out }] });
  const newClip = () => {
    const ok = mark.in != null && mark.out > mark.in;
    const c = { id: uid(), name: `Clip ${p.clips.length + 1}`, segments: [{ start: ok ? mark.in : time, end: ok ? mark.out : Math.min(duration, time + 30) }], aspect: clip?.aspect || "16:9", crop: { zoom: 1, x: 0.5, y: 0.5 }, volume: 1, muted: false, fade_in: 0, fade_out: 0, selected: true };
    cp.change((s) => ({ clips: [...s.clips, c] }));
    setActiveId(c.id);
  };
  const move = (i, d) => cp.change((s) => { const a = [...s.clips]; [a[i], a[i + d]] = [a[i + d], a[i]]; return { clips: a }; });
  const duplicate = (cid) => cp.change((s) => { const i = s.clips.findIndex((c) => c.id === cid); const c = { ...s.clips[i], id: uid(), name: `${s.clips[i].name} copy` }; return { clips: [...s.clips.slice(0, i + 1), c, ...s.clips.slice(i + 1)] }; });
  const remove = (cid) => { if (p.clips.length === 1) return; cp.change((s) => ({ clips: s.clips.filter((c) => c.id !== cid) })); if (cid === activeId) setActiveId(p.clips.find((c) => c.id !== cid)?.id); };
  const onTrim = (i, edge, sec) => {
    const fn = (c) => ({ segments: c.segments.map((s, j) => (j !== i ? s : edge === "start" ? { ...s, start: Math.min(sec, s.end - 0.1) } : { ...s, end: Math.max(sec, s.start + 0.1) })) });
    cp.updateClip(clip.id, fn, !trimming.current);
    trimming.current = true;
    seek(sec);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (typing()) return;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) cp.redo(); else cp.undo(); return; }
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (k === "i") setMark((m) => ({ ...m, in: time }));
      else if (k === "o") setMark((m) => ({ ...m, out: time }));
      else if (k === "s") split();
      else if (e.key === "ArrowLeft") seek(time - (e.shiftKey ? 1 : FRAME));
      else if (e.key === "ArrowRight") seek(time + (e.shiftKey ? 1 : FRAME));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => { if (media.current) media.current.volume = clip?.muted ? 0 : Math.min(1, clip?.volume ?? 1); }, [clip?.muted, clip?.volume, url]);

  const tb = "w-10 h-10 grid place-items-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30";
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 sm:px-6 pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/tools" className="w-10 h-10 grid place-items-center rounded-full border border-white/20 text-white hover:bg-white/10" aria-label="Back" data-testid="clip-back"><ArrowLeft className="w-4 h-4" /></Link>
        <input value={p.name} onChange={(e) => cp.patch(() => ({ name: e.target.value }))} className="bg-transparent outline-none font-display text-xl font-bold text-white min-w-0 w-64" data-testid="clip-project-name" aria-label="Project name" />
        <div className="flex p-1 rounded-full bg-[#1c1617] border border-white/10" data-testid="clip-modes">
          {MODES.map((m) => <button key={m} onClick={() => setMode(m)} className={`h-9 px-5 rounded-full text-sm font-bold ${mode === m ? "bg-[#e0141b] text-white" : "text-white/65 hover:text-white"}`} data-testid={`clip-mode-${m.toLowerCase().replace(" ", "-")}`}>{m}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setRecording(true)} className="h-9 px-4 mr-2 rounded-full border border-white/15 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:border-[#ff4757]" data-testid="clip-record-audio"><Mic className="w-4 h-4 text-[#ff4757]" /> Record Audio</button>
          <button className={tb} onClick={cp.undo} disabled={!cp.canUndo} aria-label="Undo" data-testid="clip-undo"><Undo2 className="w-4 h-4" /></button>
          <button className={tb} onClick={cp.redo} disabled={!cp.canRedo} aria-label="Redo" data-testid="clip-redo"><Redo2 className="w-4 h-4" /></button>
          <span className={`ml-2 text-[11px] font-mono ${cp.saving === "error" ? "text-[#ff6b6b]" : "text-white/45"}`} data-testid={`clip-save-${cp.saving}`}>{cp.saving === "saved" ? "Saved" : cp.saving === "error" ? "Save failed" : "Saving…"}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
        <ClipQueue clips={p.clips} activeId={clip?.id} onSelect={setActiveId} onToggle={(cid) => cp.updateClip(cid, (c) => ({ selected: !c.selected }))} onMove={move} onDuplicate={duplicate} onDelete={remove} onNew={newClip} onExport={() => setExporting(true)} />
        <section className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-[240px] rounded-2xl bg-[#0d0a0b] border border-white/10 overflow-hidden">
            {url ? <Preview ref={media} url={url} source={p.source} clip={clip} time={time} duration={duration} onTime={onTime} onPlayState={setPlaying} /> : <div className="h-full grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-[#ff4757]" /></div>}
          </div>
          <div className="flex items-center gap-2" data-testid="clip-transport">
            <button className={tb} onClick={() => seek(time - FRAME)} aria-label="Previous frame" data-testid="clip-frame-back"><SkipBack className="w-4 h-4" /></button>
            <button onClick={toggle} className="w-12 h-12 grid place-items-center rounded-full bg-[#e0141b] text-white" aria-label="Play" data-testid="clip-play">{playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}</button>
            <button className={tb} onClick={() => seek(time + FRAME)} aria-label="Next frame" data-testid="clip-frame-forward"><SkipForward className="w-4 h-4" /></button>
            <button onClick={playClip} className="h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white inline-flex items-center gap-1.5" data-testid="clip-play-clip"><Repeat className="w-3.5 h-3.5" /> Play clip ({fmtTime(clip ? clipLength(clip) : 0)})</button>
            <span className="font-mono text-sm text-white tabular-nums ml-2" data-testid="clip-time">{fmtTime(time)} / {fmtTime(duration)}</span>
            <div className="ml-auto flex items-center gap-2 w-40"><span className="text-[10px] font-mono text-white/40">ZOOM</span><Slider min={1} max={40} step={1} value={[zoom]} onValueChange={([v]) => setZoom(v)} data-testid="clip-timeline-zoom" /></div>
          </div>
          <Timeline duration={duration} time={time} zoom={zoom} clip={clip} mark={mark} onSeek={seek} onTrim={onTrim} onTrimEnd={() => { trimming.current = false; }} />
        </section>
        <aside className="w-full lg:w-80 shrink-0 rounded-2xl bg-[#1c1617] border border-white/10 p-4 overflow-y-auto space-y-5" data-testid="clip-side-panel">
          {mode === "Clip" ? <ClipInspector clip={clip} source={p.source} mark={mark} time={time} onUpdate={update} onLive={live} onSnapshot={() => cp.change(() => ({}))} onSplit={split} onAddSegment={addSegment} onSetMark={(k, t) => setMark((m) => ({ ...m, [k]: t }))} /> : <NextPhase title={mode} />}
          <JobList pid={p.id} />
        </aside>
      </div>
      {exporting && <ExportDialog open onOpenChange={setExporting} project={p} clipIds={p.clips.filter((c) => c.selected).map((c) => c.id)} worldFolder={worlds.find((w) => w.slug === p.world_slug)?.dropbox_path} />}
      <RecorderPanel open={recording} onOpenChange={setRecording} world={p.world_slug} onSaved={importRecording} />
    </div>
  );
}

export default function ClipStudio() {
  const { id } = useParams();
  const cp = useClipProject(id);
  return (
    <div className="h-screen flex flex-col bg-[#110d0e]" data-testid="clip-studio-page">
      <TopNav dark active="tools" />
      {cp.error ? <p className="p-10 text-white/60" data-testid="clip-error">{cp.error}</p> : cp.p ? <Studio key={id} cp={cp} /> : <div className="flex-1 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-[#ff4757]" /></div>}
    </div>
  );
}
