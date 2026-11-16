import { ChevronUp, ChevronDown, Trash2, Scissors, Plus, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { fmtTime } from "@/components/clip/useClipProject";

const ASPECTS = ["16:9", "9:16", "1:1", "4:5"];
const lbl = "text-[10px] font-mono uppercase tracking-[0.18em] text-white/45";
const small = "h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-30";

const Row = ({ label, children }) => <div className="space-y-2"><p className={lbl}>{label}</p>{children}</div>;

export const ClipInspector = ({ clip, source, mark, time, onUpdate, onLive, onSnapshot, onSplit, onAddSegment, onSetMark }) => {
  if (!clip) return null;
  const segs = clip.segments;
  const moveSeg = (i, d) => { const s = [...segs]; [s[i], s[i + d]] = [s[i + d], s[i]]; onUpdate({ segments: s }); };
  const crop = clip.crop || { zoom: 1, x: 0.5, y: 0.5 };
  return (
    <div className="space-y-5" data-testid="clip-inspector">
      <input value={clip.name} onFocus={onSnapshot} onChange={(e) => onLive({ name: e.target.value })} className="w-full bg-transparent outline-none font-display text-xl font-bold text-white border-b border-white/10 pb-1 focus:border-[#ff4757]" data-testid="clip-name-input" aria-label="Clip name" />
      <Row label="In / Out">
        <div className="flex flex-wrap gap-2">
          <button className={small} onClick={() => onSetMark("in", time)} data-testid="clip-set-in">In {mark.in != null ? fmtTime(mark.in) : "—"}</button>
          <button className={small} onClick={() => onSetMark("out", time)} data-testid="clip-set-out">Out {mark.out != null ? fmtTime(mark.out) : "—"}</button>
          <button className={small} onClick={onAddSegment} disabled={!(mark.in != null && mark.out > mark.in)} data-testid="clip-add-segment"><Plus className="w-3.5 h-3.5" /> Segment</button>
          <button className={small} onClick={onSplit} data-testid="clip-split"><Scissors className="w-3.5 h-3.5" /> Split</button>
        </div>
      </Row>
      <Row label={`Segments · ${segs.length}`}>
        <ul className="space-y-1">
          {segs.map((s, i) => (
            <li key={i} className="flex items-center gap-1 text-xs font-mono text-white/80 bg-white/[0.04] rounded-lg px-2 py-1" data-testid={`clip-segment-row-${i}`}>
              <span className="text-[#ff6b6b] w-4">{i + 1}</span>
              <span className="flex-1">{fmtTime(s.start)} → {fmtTime(s.end)}</span>
              <button disabled={i === 0} onClick={() => moveSeg(i, -1)} className="p-1 disabled:opacity-20" aria-label="Move segment up" data-testid={`clip-segment-up-${i}`}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button disabled={i === segs.length - 1} onClick={() => moveSeg(i, 1)} className="p-1 disabled:opacity-20" aria-label="Move segment down" data-testid={`clip-segment-down-${i}`}><ChevronDown className="w-3.5 h-3.5" /></button>
              <button disabled={segs.length === 1} onClick={() => onUpdate({ segments: segs.filter((_, j) => j !== i) })} className="p-1 text-[#ff6b6b] disabled:opacity-20" aria-label="Delete segment" data-testid={`clip-segment-del-${i}`}><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      </Row>
      {source.has_video && (
        <>
          <Row label="Aspect ratio">
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECTS.map((a) => <button key={a} onClick={() => onUpdate({ aspect: a })} className={`h-9 rounded-lg text-xs font-bold ${clip.aspect === a ? "bg-[#e0141b] text-white" : "bg-white/10 text-white/75 hover:bg-white/20"}`} data-testid={`clip-aspect-${a.replace(":", "x")}`}>{a}</button>)}
            </div>
          </Row>
          <Row label={`Crop zoom ${crop.zoom.toFixed(2)}×`}><Slider min={1} max={3} step={0.05} value={[crop.zoom]} onValueChange={([v]) => onLive({ crop: { ...crop, zoom: v } })} onPointerDownCapture={onSnapshot} onKeyDownCapture={onSnapshot} data-testid="clip-crop-zoom" /></Row>
          <Row label="Reposition X / Y">
            <Slider min={0} max={1} step={0.01} value={[crop.x]} onValueChange={([v]) => onLive({ crop: { ...crop, x: v } })} onPointerDownCapture={onSnapshot} onKeyDownCapture={onSnapshot} data-testid="clip-crop-x" />
            <Slider min={0} max={1} step={0.01} value={[crop.y]} onValueChange={([v]) => onLive({ crop: { ...crop, y: v } })} onPointerDownCapture={onSnapshot} onKeyDownCapture={onSnapshot} data-testid="clip-crop-y" />
          </Row>
        </>
      )}
      <Row label={`Volume ${Math.round((clip.volume ?? 1) * 100)}%`}>
        <div className="flex items-center gap-3">
          <button onClick={() => onUpdate({ muted: !clip.muted })} className="w-9 h-9 grid place-items-center rounded-full bg-white/10 text-white" aria-label="Mute" data-testid="clip-mute">{clip.muted ? <VolumeX className="w-4 h-4 text-[#ff6b6b]" /> : <Volume2 className="w-4 h-4" />}</button>
          <Slider className="flex-1" min={0} max={2} step={0.05} value={[clip.volume ?? 1]} onValueChange={([v]) => onLive({ volume: v })} onPointerDownCapture={onSnapshot} onKeyDownCapture={onSnapshot} data-testid="clip-volume" />
        </div>
      </Row>
      <Row label="Fade in / out (seconds)">
        <div className="flex gap-2">
          {["fade_in", "fade_out"].map((k) => (
            <input key={k} type="number" min={0} max={10} step={0.1} value={clip[k] || 0} onChange={(e) => onUpdate({ [k]: Math.max(0, Number(e.target.value) || 0) })} className="w-full h-9 px-3 rounded-lg bg-white/10 text-sm text-white outline-none" data-testid={`clip-${k.replace("_", "-")}`} />
          ))}
        </div>
      </Row>
    </div>
  );
};
