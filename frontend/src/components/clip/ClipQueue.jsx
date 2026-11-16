import { Plus, Copy, Trash2, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { clipLength, fmtTime } from "@/components/clip/useClipProject";

const ib = "w-7 h-7 grid place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-25";

export const ClipQueue = ({ clips, activeId, onSelect, onToggle, onMove, onDuplicate, onDelete, onNew, onExport }) => {
  const picked = clips.filter((c) => c.selected).length;
  return (
    <aside className="w-full lg:w-72 shrink-0 rounded-2xl bg-[#1c1617] border border-white/10 flex flex-col min-h-0" data-testid="clip-queue">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="font-display font-bold text-white">Clip Queue <span className="text-white/40 text-sm">· {clips.length}</span></p>
        <button onClick={onNew} className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-white/10 hover:bg-[#e0141b] text-xs font-bold text-white transition-colors" data-testid="clip-new-button"><Plus className="w-3.5 h-3.5" /> New</button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {clips.map((c, i) => (
          <li key={c.id} onClick={() => onSelect(c.id)} className={`group flex items-center gap-2 p-2 rounded-xl cursor-pointer ${activeId === c.id ? "bg-[#e0141b]/20 ring-1 ring-[#e0141b]" : "hover:bg-white/5"}`} data-testid={`clip-queue-item-${i}`}>
            <span onClick={(e) => e.stopPropagation()}><Checkbox checked={!!c.selected} onCheckedChange={() => onToggle(c.id)} data-testid={`clip-queue-check-${i}`} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{c.name}</p>
              <p className="text-[10px] font-mono text-white/45">{fmtTime(clipLength(c))} · {c.aspect} · {c.segments.length} seg</p>
            </div>
            <div className="flex flex-col">
              <button className={ib} disabled={i === 0} onClick={(e) => { e.stopPropagation(); onMove(i, -1); }} aria-label="Move up" data-testid={`clip-queue-up-${i}`}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button className={ib} disabled={i === clips.length - 1} onClick={(e) => { e.stopPropagation(); onMove(i, 1); }} aria-label="Move down" data-testid={`clip-queue-down-${i}`}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex flex-col opacity-0 group-hover:opacity-100">
              <button className={ib} onClick={(e) => { e.stopPropagation(); onDuplicate(c.id); }} aria-label="Duplicate" data-testid={`clip-queue-dup-${i}`}><Copy className="w-3.5 h-3.5" /></button>
              <button className={ib} onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} aria-label="Delete" data-testid={`clip-queue-del-${i}`}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="p-3 border-t border-white/10">
        <button onClick={onExport} disabled={!picked} className="w-full h-11 rounded-full bg-[#e0141b] text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 hover:brightness-110" data-testid="clip-export-button">
          <Upload className="w-4 h-4" /> Export {picked} clip{picked === 1 ? "" : "s"}
        </button>
      </div>
    </aside>
  );
};
