import { Eye, Download, Trash2, Maximize2, Share2, PenLine, Group, Ungroup, Unlink, Scissors } from "lucide-react";
import { fileKind } from "@/lib/api";

const B = ({ Icon, label, onClick, testid, danger }) => (
  <button onClick={onClick} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-colors ${danger ? "text-[#ff6b6b] hover:bg-[#ff4757]/15" : "text-white/85 hover:bg-white/10"}`} data-testid={testid}>
    <Icon className="w-4 h-4" />{label}
  </button>
);

export const ContextBar = ({ sel, items, vp, actions, noteColors }) => {
  const picked = items.filter((i) => sel.ids.includes(i.id));
  if (!picked.length && !sel.edge) return null;
  let left = 0, top = 0;
  if (picked.length) {
    left = Math.min(...picked.map((i) => i.x)) * vp.zoom + vp.x;
    top = Math.min(...picked.map((i) => i.y)) * vp.zoom + vp.y - 54;
  }
  const one = picked.length === 1 ? picked[0] : null;
  const kind = one?.type;
  const grouped = picked.some((i) => i.group);
  return (
    <div className="absolute z-30 flex items-center gap-0.5 p-1 rounded-full bg-[#221a1b]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)]"
      style={sel.edge ? { left: "50%", top: 16, transform: "translateX(-50%)" } : { left: Math.max(8, left), top: Math.max(8, top) }}
      onPointerDown={(e) => e.stopPropagation()} data-testid="canvas-context-bar">
      {sel.edge && <B Icon={Unlink} label="Delete link" onClick={actions.deleteEdge} testid="ctx-delete-link" danger />}
      {kind === "file" && (
        <>
          <B Icon={Eye} label="Preview" onClick={() => actions.preview(one)} testid="ctx-preview" />
          {["video", "audio"].includes(fileKind(one.data.ext)) && <B Icon={Scissors} label="Clip" onClick={() => actions.clip(one)} testid="ctx-clip" />}
          <B Icon={Download} label="Download" onClick={() => actions.download(one)} testid="ctx-download" />
        </>
      )}
      {kind === "lyric" && (
        <>
          <B Icon={PenLine} label="Edit" onClick={() => actions.editLyric(one)} testid="ctx-lyric-edit" />
          <B Icon={Share2} label="Share" onClick={() => actions.shareLyric(one)} testid="ctx-lyric-share" />
          <B Icon={Maximize2} label="Expand" onClick={() => actions.expand(one)} testid="ctx-lyric-expand" />
        </>
      )}
      {kind === "note" && noteColors.map((c) => (
        <button key={c} onClick={() => actions.noteColor(one, c)} className={`w-6 h-6 mx-0.5 rounded-full border-2 ${one.data.color === c ? "border-white" : "border-white/20"}`} style={{ background: c }} aria-label="Note colour" data-testid="ctx-note-color" />
      ))}
      {kind === "frame" && <B Icon={PenLine} label="Rename" onClick={() => actions.renameFrame(one)} testid="ctx-frame-rename" />}
      {picked.length > 1 && !grouped && <B Icon={Group} label="Group" onClick={actions.group} testid="ctx-group" />}
      {grouped && <B Icon={Ungroup} label="Ungroup" onClick={actions.ungroup} testid="ctx-ungroup" />}
      {picked.length > 0 && <B Icon={Trash2} label={picked.length > 1 ? `Delete ${picked.length}` : "Delete"} onClick={actions.deleteItems} testid="ctx-delete" danger />}
    </div>
  );
};
