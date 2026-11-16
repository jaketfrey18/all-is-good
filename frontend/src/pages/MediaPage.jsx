import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PanelLeftClose, PanelLeftOpen, Loader2, Download } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { SearchBar } from "@/components/SearchBar";
import { FileIcon } from "@/components/workspace/FileIcon";
import { Viewer } from "@/components/workspace/FilePreview";
import { api, fileKind, fmtSize, thumbUrl } from "@/lib/api";
import { useProjects, useTempLink } from "@/lib/hooks";

const KINDS = [["", "All"], ["video", "Video"], ["audio", "Audio"], ["image", "Images"], ["pdf", "PDF"], ["doc", "Docs"]];
const chip = (on) => `h-9 px-4 rounded-full text-sm font-semibold border transition-colors ${on ? "bg-[#e0141b] border-[#e0141b] text-white" : "border-white/15 text-white/75 hover:border-white/40"}`;

function PreviewPane({ file }) {
  const { data: url, isLoading } = useTempLink(file?.project_slug, file?.path, !!file);
  if (!file) return <div className="h-full grid place-items-center text-white/30 text-sm" data-testid="media-preview-empty">Select a file</div>;
  return (
    <div className="h-full flex flex-col gap-4 p-6" data-testid="media-preview-pane">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="font-display text-2xl font-bold truncate">{file.name}</p><p className="font-mono text-xs text-white/50 truncate">{file.project_title} · {file.path} · {fmtSize(file.size)}</p></div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 hover:bg-[#e0141b] text-sm font-semibold transition-colors" data-testid="media-download-link"><Download className="w-4 h-4" /> Download</a>}
      </div>
      <div className="flex-1 min-h-0 grid place-items-center rounded-2xl bg-black/30 overflow-hidden">
        {isLoading ? <Loader2 className="w-8 h-8 animate-spin text-[#ff4757]" /> : url && <Viewer kind={fileKind(file.ext)} url={url} name={file.name} />}
      </div>
      <Link to={`/p/${file.project_slug}`} className="text-sm text-[#ff6b6b] hover:underline" data-testid="media-open-world">Open world →</Link>
    </div>
  );
}

const Row = ({ f, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${active ? "bg-[#e0141b]/20 ring-1 ring-[#e0141b]" : "hover:bg-white/5"}`} data-testid="media-result-item">
    <span className="w-14 h-11 shrink-0 rounded-lg overflow-hidden bg-white/5 grid place-items-center">
      {f.thumb ? <img src={thumbUrl(f.project_slug, f.path)} alt="" loading="lazy" className="w-full h-full object-cover" /> : <FileIcon item={f} className="w-6 h-6" />}
    </span>
    <span className="min-w-0"><span className="block text-sm font-semibold truncate">{f.name}</span><span className="block text-[11px] font-mono text-white/45 truncate">{f.project_title} · {f.ext} · {fmtSize(f.size)}</span></span>
  </button>
);

export default function MediaPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const kind = params.get("kind") || "";
  const world = params.get("world") || "";
  const [open, setOpen] = useState(true);
  const [sel, setSel] = useState(null);
  const { data: worlds = [] } = useProjects();
  const set = (k, v) => { const n = Object.fromEntries(params); if (v) n[k] = v; else delete n[k]; setSel(null); setParams(n); };
  const enabled = !!(q || kind || world);
  const res = useQuery({ queryKey: ["search", q, kind, world], enabled, queryFn: async () => (await api.get("/search", { params: { q, kind: kind || undefined, world: world || undefined } })).data });
  const files = res.data?.files || [];

  return (
    <div className="h-screen flex flex-col bg-[#141011] text-[#f5ece6]" data-testid="media-page">
      <TopNav dark active="media" />
      <div className="px-4 sm:px-8 pt-2 pb-4 space-y-4">
        <div className="max-w-4xl"><SearchBar key={q} dark initial={q} onSearch={(v) => set("q", v)} /></div>
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map(([k, l]) => <button key={l} className={chip(kind === k)} onClick={() => set("kind", k)} data-testid={`media-kind-${l.toLowerCase()}`}>{l}</button>)}
          <select value={world} onChange={(e) => set("world", e.target.value)} className="h-9 px-3 rounded-full bg-transparent border border-white/15 text-sm text-white/80" data-testid="media-world-select">
            <option value="" className="bg-[#1f1819]">All worlds</option>
            {worlds.map((w) => <option key={w.slug} value={w.slug} className="bg-[#1f1819]">{w.title}</option>)}
          </select>
          {res.data?.projects?.map((p) => <Link key={p.id} to={`/p/${p.slug}`} className="h-9 px-4 rounded-full bg-white/10 text-sm font-semibold grid place-items-center hover:bg-white/20" data-testid={`media-world-match-${p.slug}`}>World: {p.title}</Link>)}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-4 px-4 sm:px-8 pb-6">
        <aside className={`${open ? "w-full sm:w-[380px]" : "w-12"} shrink-0 rounded-2xl bg-[#1c1617] border border-white/10 flex flex-col transition-[width] duration-300`} data-testid="media-results-panel">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            {open && <span className="text-xs font-mono text-white/50" data-testid="media-results-count">{enabled ? (res.isLoading ? "searching…" : `${files.length} files`) : "Search or pick a type"}</span>}
            <button onClick={() => setOpen(!open)} className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10" data-testid="media-results-toggle" aria-label="Toggle results">{open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}</button>
          </div>
          {open && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {res.data && !res.data.files_available && <p className="p-3 text-sm text-white/50">Dropbox isn't connected.</p>}
              {files.map((f) => <Row key={f.project_slug + f.path} f={f} active={sel?.path === f.path} onClick={() => (f.type === "folder" ? set("q", f.name) : setSel(f))} />)}
              {res.data?.files_available && !files.length && <p className="p-3 text-sm text-white/50" data-testid="media-no-results">No files match.</p>}
            </div>
          )}
        </aside>
        <section className="hidden sm:block flex-1 min-w-0 rounded-2xl bg-[#1c1617] border border-white/10"><PreviewPane file={sel} /></section>
      </div>
    </div>
  );
}
