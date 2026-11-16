import { useEffect, useRef, useState } from "react";
import { Undo2, Redo2, History, Download, CloudUpload, Share2, Minimize2, Plus } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, errText } from "@/lib/api";
import { initials } from "@/lib/hooks";
import { VersionsPanel } from "@/components/lyrics/VersionsPanel";
import { ShareDialog } from "@/components/ShareDialog";

const SECTIONS = ["Intro", "Verse", "Pre-Hook", "Hook", "Chorus", "Bridge", "Outro"];
const btn = "w-9 h-9 grid place-items-center rounded-full text-white/75 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30";

export const Peers = ({ peers, me }) => (
  <div className="flex -space-x-2" data-testid="lyric-presence">
    {[me, ...peers].filter(Boolean).slice(0, 6).map((p, i) => (
      <span key={p.cid ?? `me${i}`} title={p.name} className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold text-[#141011] ring-2 ring-[#1c1617]" style={{ background: p.color }}>{initials(p.name)}</span>
    ))}
  </div>
);

const STATUS = { online: ["bg-emerald-400", "Live"], connecting: ["bg-amber-400", "Connecting"], offline: ["bg-[#ff4757]", "Offline — edits kept, will sync"], denied: ["bg-[#ff4757]", "No access"] };

function TitleInput({ lyricId, meta, onMetaChange }) {
  const [title, setTitle] = useState(meta.title);
  const t = useRef(null);
  useEffect(() => setTitle(meta.title), [meta.title]);
  const change = (v) => {
    setTitle(v);
    clearTimeout(t.current);
    if (v.trim()) t.current = setTimeout(() => api.patch(`/lyrics/${lyricId}`, { title: v.trim() }).then(() => onMetaChange({ ...meta, title: v.trim() })), 700);
  };
  return <input value={title} onChange={(e) => change(e.target.value)} className="bg-transparent outline-none font-display text-2xl font-extrabold text-white min-w-0 flex-1" data-testid="lyric-title-input" aria-label="Lyric title" />;
}

export const LyricToolbar = ({ editor, mode, lyricId, meta, status, peers, sync, onCollapse, onMetaChange }) => {
  const [versions, setVersions] = useState(false);
  const [share, setShare] = useState(false);
  const [dot, label] = STATUS[status] || STATUS.connecting;
  const full = mode === "full";

  const exportTxt = () => {
    const blob = new Blob([`${meta.title}\n\n${editor.getText({ blockSeparator: "\n" })}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.title.replace(/[\\/:*?"<>|]+/g, "") || "lyrics"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const backup = async () => {
    try {
      sync.schedule(editor.getText({ blockSeparator: "\n" }));
      await sync.flush();
      const { data } = await api.post(`/lyrics/${lyricId}/backup`);
      toast.success(`Backed up to Dropbox: ${data.path}`);
    } catch (e) { toast.error(errText(e), { duration: 12000 }); }
  };
  const insert = (s) => editor.chain().focus().insertContent([{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: s }] }, { type: "paragraph" }]).run();

  return (
    <div className={`flex items-center gap-1 ${full ? "px-6 py-4 border-b border-white/10" : "px-3 py-1.5 border-b border-white/5"}`} onPointerDown={(e) => e.stopPropagation()}>
      {full && <TitleInput lyricId={lyricId} meta={meta} onMetaChange={onMetaChange} />}
      <span className={`flex items-center gap-1.5 text-[11px] font-mono text-white/60 ${full ? "mr-3" : "mr-auto"}`} data-testid="lyric-sync-status"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
      <Peers peers={peers} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className={btn} title="Add section" data-testid="lyric-section-button"><Plus className="w-4 h-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent>{SECTIONS.map((s) => <DropdownMenuItem key={s} onClick={() => insert(s)} data-testid={`lyric-section-${s.toLowerCase()}`}>{s}</DropdownMenuItem>)}</DropdownMenuContent>
      </DropdownMenu>
      <button className={btn} onClick={() => editor.chain().focus().undo().run()} title="Undo" data-testid="lyric-undo-button"><Undo2 className="w-4 h-4" /></button>
      <button className={btn} onClick={() => editor.chain().focus().redo().run()} title="Redo" data-testid="lyric-redo-button"><Redo2 className="w-4 h-4" /></button>
      {full && (
        <>
          <button className={btn} onClick={() => setVersions((v) => !v)} title="Version history" data-testid="lyric-versions-button"><History className="w-4 h-4" /></button>
          <button className={btn} onClick={exportTxt} title="Export .txt" data-testid="lyric-export-button"><Download className="w-4 h-4" /></button>
          <button className={btn} onClick={backup} title="Back up to Dropbox" data-testid="lyric-backup-button"><CloudUpload className="w-4 h-4" /></button>
          <button className={btn} onClick={() => setShare(true)} title="Share" data-testid="lyric-share-button"><Share2 className="w-4 h-4" /></button>
          {onCollapse && <button className={btn} onClick={onCollapse} title="Collapse to card" data-testid="lyric-collapse-button"><Minimize2 className="w-4 h-4" /></button>}
        </>
      )}
      {versions && <VersionsPanel lyricId={lyricId} editor={editor} onClose={() => setVersions(false)} />}
      <ShareDialog open={share} onOpenChange={setShare} kind="lyrics" id={lyricId} ownerId={meta.owner_id} sharedWith={meta.shared_with || []} onSaved={(ids) => onMetaChange({ ...meta, shared_with: ids })} />
    </div>
  );
};
