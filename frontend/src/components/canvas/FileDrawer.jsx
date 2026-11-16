import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, ChevronLeft, Folder, Plus, Loader2 } from "lucide-react";
import { FileIcon } from "@/components/workspace/FileIcon";
import { api, errText, fileKind, fmtSize, thumbUrl } from "@/lib/api";

const KINDS = [["all", "All"], ["image", "Images"], ["video", "Video"], ["audio", "Audio"], ["pdf", "PDF"], ["doc", "Docs"]];
export const DRAG_TYPE = "application/x-cooked-file";
const matches = (f, kind) => kind === "all" || f.type === "folder" || fileKind(f.ext) === kind || (kind === "doc" && fileKind(f.ext) === "deck");

function useFiles(slug, path, term) {
  const list = useQuery({ queryKey: ["files", slug, path], queryFn: async () => (await api.get(`/projects/${slug}/files`, { params: path ? { path } : {} })).data, retry: false });
  const found = useQuery({ queryKey: ["psearch", slug, term], queryFn: async () => (await api.get(`/projects/${slug}/search`, { params: { q: term } })).data.items, enabled: !!term });
  return { list, found };
}

const Row = ({ f, onOpen, onAdd, slug }) => (
  <li draggable={f.type === "file"} onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(f)); e.dataTransfer.effectAllowed = "copy"; }}
    className="group flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 cursor-grab active:cursor-grabbing" data-testid={`drawer-item-${f.name}`}>
    <button onClick={() => f.type === "folder" && onOpen(f.path)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
      <span className="w-11 h-9 shrink-0 rounded-lg overflow-hidden bg-white/5 grid place-items-center">
        {f.thumb ? <img src={thumbUrl(slug, f.path)} alt="" loading="lazy" className="w-full h-full object-cover" draggable={false} /> : f.type === "folder" ? <Folder className="w-5 h-5 text-[#f0b44c]" /> : <FileIcon item={f} className="w-5 h-5" />}
      </span>
      <span className="min-w-0"><span className="block text-[13px] font-medium text-white/90 truncate">{f.name}</span><span className="block text-[10px] font-mono text-white/40">{f.type === "folder" ? "folder" : `${f.ext} · ${fmtSize(f.size)}`}</span></span>
    </button>
    {f.type === "file" && <button onClick={() => onAdd(f)} className="opacity-0 group-hover:opacity-100 w-7 h-7 grid place-items-center rounded-full bg-[#e0141b] text-white transition-opacity" aria-label="Add to canvas" data-testid="drawer-add-item"><Plus className="w-4 h-4" /></button>}
  </li>
);

export const FileDrawer = ({ slug, kind, setKind, onClose, onAdd }) => {
  const [path, setPath] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const { list, found } = useFiles(slug, path, term);
  const cur = list.data?.path || "";
  const root = list.data?.root || "";
  const items = (term ? found.data || [] : list.data?.items || []).filter((f) => matches(f, kind));
  return (
    <aside className="absolute left-20 top-20 bottom-4 w-[300px] z-20 rounded-2xl bg-[#1c1617]/95 backdrop-blur-xl border border-[#3b2b2b] flex flex-col shadow-2xl" data-testid="canvas-file-drawer" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="font-display font-bold text-white">Dropbox</p>
        <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full text-white/60 hover:bg-white/10" data-testid="drawer-close"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="relative mx-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Search this world" className="w-full h-9 pl-9 pr-3 rounded-full bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-[#ff4757]" data-testid="drawer-search-input" />
      </form>
      <div className="flex flex-wrap gap-1 px-3 pt-2">
        {KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`h-7 px-2.5 rounded-full text-[11px] font-semibold ${kind === k ? "bg-[#e0141b] text-white" : "text-white/60 hover:bg-white/10"}`} data-testid={`drawer-kind-${k}`}>{l}</button>)}
      </div>
      {!term && cur && root && cur !== root && (
        <button onClick={() => setPath(cur.slice(0, cur.lastIndexOf("/")))} className="mx-3 mt-2 flex items-center gap-1 text-xs text-white/60 hover:text-white" data-testid="drawer-up"><ChevronLeft className="w-3.5 h-3.5" /> {cur.slice(root.length) || "/"}</button>
      )}
      <ul className="flex-1 overflow-y-auto p-2 mt-1" data-scrollable="true">
        {(list.isLoading || found.isLoading) && <li className="p-4 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-[#ff4757]" /></li>}
        {list.error && <li className="p-3 text-xs text-white/55" data-testid="drawer-error">{errText(list.error)}</li>}
        {items.map((f) => <Row key={f.path} f={f} slug={slug} onOpen={(p) => { setTerm(""); setQ(""); setPath(p); }} onAdd={onAdd} />)}
        {list.data && !items.length && !found.isLoading && <li className="p-3 text-xs text-white/40">Nothing here.</li>}
      </ul>
      <p className="px-4 pb-3 text-[10px] font-mono text-white/30">Drag files onto the canvas</p>
    </aside>
  );
};
