import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Circle, Square, Download, Loader2, Save, AlertTriangle, MonitorSpeaker } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { errText } from "@/lib/api";
import { uploadChunks } from "@/components/sessions/sessionApi";
import { useMyWorlds } from "./assetsApi";
import { useProjects } from "@/lib/hooks";

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const supported = () => !!(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder);
const pickMime = () => ["audio/webm;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));

function useTabRecorder() {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState(null);
  const r = useRef({});
  const cleanup = () => {
    const x = r.current;
    clearInterval(x.timer); cancelAnimationFrame(x.raf);
    x.stream?.getTracks().forEach((t) => t.stop());
    x.ctx?.close().catch(() => {});
    setLevel(0);
  };
  useEffect(() => cleanup, []);
  const start = async () => {
    setError(""); setBlob(null);
    if (!supported()) { setError("This browser can't capture tab audio. Use Chrome or Edge on a computer."); return; }
    const mime = pickMime();
    if (!mime) { setError("This browser can't record WebM audio. Use Chrome or Edge."); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: false, selfBrowserSurface: "exclude", systemAudio: "include", surfaceSwitching: "include" });
    } catch (e) { setError(e?.name === "NotAllowedError" ? "Sharing was cancelled." : `Couldn't start sharing: ${e?.message || e}`); return; }
    const audio = stream.getAudioTracks();
    if (!audio.length) {
      stream.getTracks().forEach((t) => t.stop());
      setError("No audio came through. Pick a browser tab (not a window or screen) and switch on “Share tab audio”, then try again.");
      return;
    }
    stream.getVideoTracks().forEach((t) => t.stop());
    const audioStream = new MediaStream(audio);
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(audioStream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => { an.getByteTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v - 128)); setLevel(p / 128); r.current.raf = requestAnimationFrame(tick); };
    const rec = new MediaRecorder(audioStream, { mimeType: mime, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { setBlob(new Blob(chunks, { type: "audio/webm" })); cleanup(); setState("done"); };
    audio[0].onended = () => rec.state === "recording" && rec.stop();
    r.current = { stream: audioStream, ctx, rec, timer: setInterval(() => setSecs((s) => s + 1), 1000) };
    setSecs(0); rec.start(1000); tick(); setState("recording");
  };
  const stop = () => r.current.rec?.state === "recording" && r.current.rec.stop();
  const reset = () => { setBlob(null); setSecs(0); setState("idle"); };
  return { state, error, secs, level, blob, start, stop, reset };
}

const Meter = ({ level }) => (
  <div className="flex items-end gap-[3px] h-8" data-testid="recorder-level">
    {Array.from({ length: 24 }).map((_, i) => <span key={i} className={`w-1.5 rounded-full transition-[height] duration-75 ${i / 24 < level * 1.4 ? "bg-[#ff4757]" : "bg-white/15"}`} style={{ height: `${20 + (i % 5) * 15}%` }} />)}
  </div>
);

function SaveForm({ blob, world, setWorld, onSaved, secs }) {
  const { data: mine = [] } = useMyWorlds();
  const { data: worlds = [] } = useProjects();
  const qc = useQueryClient();
  const [name, setName] = useState(`Recording ${new Date().toLocaleString()}`);
  const [tags, setTags] = useState("");
  const [pct, setPct] = useState(null);
  const url = useRef(URL.createObjectURL(blob)).current;
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const save = async () => {
    if (!world) return toast.error("Pick a World to save into");
    setPct(0);
    try {
      const a = await uploadChunks("/assets/recordings", new File([blob], "recording.webm", { type: "audio/webm" }), { world_slug: world, name: name.trim() || "Recording", tags }, setPct);
      toast.success(`Saved to ${a.world_title} Media Library`);
      qc.invalidateQueries({ queryKey: ["assets", world] });
      onSaved?.(a);
    } catch (e) { toast.error(errText(e)); setPct(null); }
  };
  const inp = "w-full h-10 rounded-xl bg-white/[0.06] border border-white/15 px-3 text-sm outline-none focus:border-[#ff4757]";
  return (
    <div className="space-y-3" data-testid="recorder-save-form">
      <audio src={url} controls className="w-full" data-testid="recorder-preview" />
      <a href={url} download={`${name || "recording"}.webm`} className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white" data-testid="recorder-download"><Download className="w-3.5 h-3.5" /> Download WebM ({fmt(secs)})</a>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inp} placeholder="Name" data-testid="recorder-name-input" />
      <input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} placeholder="Tags, comma separated (e.g. hip-hop, instrumental)" data-testid="recorder-tags-input" />
      <select value={world} onChange={(e) => setWorld(e.target.value)} className={inp} data-testid="recorder-world-select">
        <option value="" className="bg-[#1f1819]">Save to World…</option>
        {worlds.filter((w) => mine.includes(w.slug)).map((w) => <option key={w.slug} value={w.slug} className="bg-[#1f1819]">{w.title}</option>)}
      </select>
      <button onClick={save} disabled={pct !== null} className="w-full h-11 rounded-full bg-[#e0141b] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="recorder-save-button">
        {pct !== null ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving {pct}%</> : <><Save className="w-4 h-4" /> Save to Media Library</>}
      </button>
    </div>
  );
}

export const RecorderPanel = ({ open, onOpenChange, world: initialWorld = "", onSaved }) => {
  const rec = useTabRecorder();
  const [world, setWorld] = useState(initialWorld);
  useEffect(() => { if (open) setWorld(initialWorld); }, [open, initialWorld]);
  const close = (o) => { if (!o && rec.state === "recording") return toast.error("Stop the recording first"); if (!o) rec.reset(); onOpenChange(o); };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-[#1a1415] border-[#4a2a2a] text-white max-w-md shadow-[0_0_60px_-15px_rgba(255,71,87,0.5)]" data-testid="recorder-panel">
        <DialogTitle className="font-display text-2xl font-extrabold flex items-center gap-2"><MonitorSpeaker className="w-5 h-5 text-[#ff4757]" /> Record tab audio</DialogTitle>
        <DialogDescription className="text-white/55">Records the sound playing in a browser tab you choose, not your microphone. In the share dialog pick a tab and turn on “Share tab audio”.</DialogDescription>
        {rec.error && <p className="flex gap-2 text-sm text-[#ffb347] bg-[#ffb347]/10 rounded-xl p-3" data-testid="recorder-error"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{rec.error}</p>}
        {rec.state !== "done" && (
          <div className="flex items-center gap-4 rounded-2xl bg-black/30 border border-white/10 p-4">
            {rec.state === "recording"
              ? <button onClick={rec.stop} className="w-14 h-14 rounded-full bg-white text-[#e0141b] grid place-items-center" aria-label="Stop" data-testid="recorder-stop-button"><Square className="w-5 h-5" fill="currentColor" /></button>
              : <button onClick={rec.start} className="w-14 h-14 rounded-full bg-[#e0141b] grid place-items-center shadow-[0_0_25px_rgba(224,20,27,0.6)] hover:scale-105 transition-transform" aria-label="Start recording" data-testid="recorder-start-button"><Circle className="w-6 h-6" fill="white" /></button>}
            <div className="flex-1">
              <p className="font-mono text-2xl tabular-nums" data-testid="recorder-timer">{fmt(rec.secs)}</p>
              <p className="text-[11px] text-white/45">{rec.state === "recording" ? "Recording… stop here or with the browser's Stop sharing" : "Ready"}</p>
            </div>
            <Meter level={rec.level} />
          </div>
        )}
        {rec.state === "done" && rec.blob && (<>
          <SaveForm blob={rec.blob} world={world} setWorld={setWorld} secs={rec.secs} onSaved={(a) => { rec.reset(); onOpenChange(false); onSaved?.(a); }} />
          <button onClick={rec.reset} className="text-xs text-white/50 hover:text-white" data-testid="recorder-discard-button">Discard and record again</button>
        </>)}
      </DialogContent>
    </Dialog>
  );
};
