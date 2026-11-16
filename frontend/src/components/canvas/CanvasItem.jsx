import { StickyNote, Square, PenLine, FileImage, FileVideo, FileAudio, File } from "lucide-react";
import { fileKind } from "@/lib/api";

const ICONS = { note: StickyNote, frame: Square, lyric: PenLine, image: FileImage, video: FileVideo, audio: FileAudio };

export const itemKind = (it) => (it.type === "file" ? fileKind(it.data.ext) : it.type);

export const itemTitle = (it) => {
  if (it.type === "file") return it.data.name;
  if (it.type === "lyric") return it.data.title || "Lyric Pad";
  if (it.type === "frame") return it.data.label || "Frame";
  return "Note";
};

export const CanvasItem = ({ item, selected, linkSource, onDown, onHeaderDown, onResizeDown, children }) => {
  const Icon = ICONS[itemKind(item)] || File;
  const frame = item.type === "frame";
  const shell = frame
    ? "border-2 border-dashed border-[#ff6b5a]/45 bg-[#ff6b5a]/[0.035]"
    : "bg-[#211a1b] border border-[#3b2b2b] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]";
  return (
    <div
      className={`absolute rounded-2xl ${shell} ${selected ? "ring-2 ring-[#ff4757] ring-offset-2 ring-offset-[#151112]" : ""} ${linkSource ? "ring-2 ring-amber-400" : ""}`}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: frame ? 0 : 1 }}
      onPointerDown={onDown}
      data-testid={`canvas-item-${item.type}`}
      data-item-id={item.id}
    >
      <div onPointerDown={onHeaderDown} className={`h-8 px-3 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none rounded-t-2xl ${frame ? "" : "border-b border-white/5"}`} data-testid="canvas-item-handle">
        <Icon className="w-3.5 h-3.5 text-[#ff6b6b] shrink-0" />
        <span className="text-xs font-semibold text-white/80 truncate">{itemTitle(item)}</span>
        {item.group && <span className="ml-auto text-[10px] font-mono text-white/35">group</span>}
      </div>
      <div className="absolute inset-x-0 top-8 bottom-0 overflow-hidden rounded-b-2xl">{children}</div>
      {selected && (
        <div onPointerDown={onResizeDown} className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-[#ff4757] border-2 border-[#151112] cursor-nwse-resize" data-testid="canvas-item-resize" />
      )}
    </div>
  );
};
