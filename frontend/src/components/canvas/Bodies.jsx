import { Maximize2 } from "lucide-react";
import { LyricEditor } from "@/components/lyrics/LyricEditor";

export const NOTE_COLORS = ["#2a2122", "#3a1d1f", "#3b2f17", "#1d2b33"];

export const NoteBody = ({ item, onText }) => (
  <textarea
    value={item.data.text || ""}
    onChange={(e) => onText(e.target.value)}
    onPointerDown={(e) => e.stopPropagation()}
    placeholder="Type a note…"
    data-scrollable="true"
    className="w-full h-full resize-none bg-transparent outline-none p-3 text-[15px] leading-relaxed text-white/90 placeholder:text-white/25"
    style={{ background: item.data.color || NOTE_COLORS[0] }}
    data-testid="canvas-note-input"
  />
);

export const LyricBody = ({ item, expanded, onExpand }) =>
  expanded ? (
    <button onClick={onExpand} className="w-full h-full grid place-items-center text-sm text-white/50" data-testid="canvas-lyric-expanded-placeholder">
      <span className="inline-flex items-center gap-2"><Maximize2 className="w-4 h-4" /> Open in focus mode</span>
    </button>
  ) : (
    <div className="w-full h-full" data-testid="canvas-lyric-body"><LyricEditor lyricId={item.data.lyric_id} mode="card" /></div>
  );
