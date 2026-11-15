import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FileGrid } from "@/components/workspace/FileGrid";
import { api, errText } from "@/lib/api";

const Crumbs = ({ root, path, onGo }) => {
  const rel = path.slice(root.length).split("/").filter(Boolean);
  const rootName = root.split("/").filter(Boolean).pop() || "Root";
  return (
    <nav className="flex flex-wrap items-center gap-1 font-mono text-sm" data-testid="file-breadcrumbs">
      <button onClick={() => onGo(root)} className="hover:text-[#e8262f]" data-testid="breadcrumb-root">{rootName}</button>
      {rel.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-[#c9a898]">/</span>
          <button onClick={() => onGo(root + "/" + rel.slice(0, i + 1).join("/"))} className="hover:text-[#e8262f]" data-testid={`breadcrumb-${i}`}>{seg}</button>
        </span>
      ))}
    </nav>
  );
};

const Sidebar = ({ folders, onGo, path, root }) => (
  <aside className="rounded-[22px] bg-white/70 border border-[#ecd3c4] p-5 h-fit lg:sticky lg:top-28" data-testid="folder-sidebar">
    <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#7a5f56]">Folders here</p>
    <ul className="mt-3 space-y-1">
      {path !== root && (
        <li><button onClick={() => onGo(path.slice(0, path.lastIndexOf("/")))} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fbeee4] text-sm" data-testid="folder-up">← Up one level</button></li>
      )}
      {folders.map((f) => (
        <li key={f.path}><button onClick={() => onGo(f.path)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fbeee4] text-sm font-semibold truncate" data-testid={`sidebar-folder-${f.name}`}>{f.name}</button></li>
      ))}
      {!folders.length && path === root && <li className="text-sm text-[#7a5f56] px-3 py-2">No subfolders</li>}
    </ul>
  </aside>
);

export const FileBrowser = ({ slug, path, setPath, onOpen }) => {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = useQuery({
    queryKey: ["files", slug, path],
    queryFn: async () => (await api.get(`/projects/${slug}/files`, { params: path ? { path } : {} })).data,
    retry: false,
  });
  const found = useQuery({
    queryKey: ["psearch", slug, term],
    queryFn: async () => (await api.get(`/projects/${slug}/search`, { params: { q: term } })).data.items,
    enabled: !!term,
  });
  if (list.isLoading) return <div className="h-60 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-[#e8262f]" /></div>;
  if (list.error) return <p className="mt-6 text-[#e8262f]" data-testid="files-error">{errText(list.error)}</p>;
  const { root, path: cur, items } = list.data;
  const open = (it) => (it.type === "folder" ? (setTerm(""), setPath(it.path)) : onOpen(it));
  const shown = term ? found.data || [] : items;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-8">
      <Sidebar folders={items.filter((i) => i.type === "folder")} onGo={(p) => { setTerm(""); setPath(p); }} path={cur} root={root} />
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Crumbs root={root} path={cur} onGo={(p) => { setTerm(""); setPath(p); }} />
          <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a5f56]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this project" className="pl-9 pr-9 rounded-full bg-white" data-testid="workspace-search-input" />
            {term && <button type="button" onClick={() => { setTerm(""); setQ(""); }} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="workspace-search-clear"><X className="w-4 h-4" /></button>}
          </form>
        </div>
        {term && <p className="font-mono text-xs text-[#7a5f56] mb-4" data-testid="workspace-search-summary">{found.isLoading ? "searching…" : `${shown.length} results for “${term}”`}</p>}
        {shown.length ? <FileGrid slug={slug} items={shown} onOpen={open} /> : !found.isLoading && <p className="text-[#7a5f56] py-10" data-testid="files-empty">{term ? "Nothing found." : "This folder is empty."}</p>}
      </div>
    </div>
  );
};
