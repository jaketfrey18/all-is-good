import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { SearchBar } from "@/components/SearchBar";
import { ProjectTile } from "@/pages/ProjectsPage";
import { FileIcon } from "@/components/workspace/FileIcon";
import { api, fmtSize } from "@/lib/api";

const Results = ({ q }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => (await api.get("/search", { params: { q } })).data,
    enabled: !!q,
  });
  if (isLoading) return <p className="mt-10 font-mono text-sm" data-testid="search-loading">searching the cooked world…</p>;
  if (error) return <p className="mt-10 text-[#e8262f]" data-testid="search-error">Search failed. Try again.</p>;
  const { projects = [], files = [], files_available } = data || {};
  return (
    <div className="mt-12 space-y-14" data-testid="search-results">
      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.2em]">Projects <span className="text-[#e8262f]">· {projects.length}</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5 auto-rows-[320px]">
          {projects.map((p) => <ProjectTile key={p.id} p={p} />)}
        </div>
        {!projects.length && <p className="mt-4 text-[#7a5f56]" data-testid="search-no-projects">No projects match “{q}”.</p>}
      </section>
      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.2em]">Files <span className="text-[#e8262f]">· {files.length}</span></h2>
        {!files_available && <p className="mt-4 text-[#7a5f56]" data-testid="search-files-unavailable">File search turns on once Dropbox is connected.</p>}
        <ul className="mt-5 divide-y divide-[#ecd3c4] border-y border-[#ecd3c4]">
          {files.map((f) => (
            <li key={f.path}>
              <Link to={`/p/${f.project_slug}?path=${encodeURIComponent(f.type === "folder" ? f.path : f.path.slice(0, f.path.lastIndexOf("/")))}`} className="flex items-center gap-4 py-4 px-2 hover:bg-white/70 transition-colors" data-testid="search-file-result">
                <FileIcon item={f} className="w-6 h-6" />
                <div className="min-w-0 flex-1"><p className="font-semibold truncate">{f.name}</p><p className="font-mono text-xs text-[#7a5f56] truncate">{f.project_title} · {f.path}</p></div>
                <span className="font-mono text-xs text-[#7a5f56]">{fmtSize(f.size)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {files_available && !files.length && <p className="mt-4 text-[#7a5f56]">No files match.</p>}
      </section>
    </div>
  );
};

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  return (
    <PageShell eyebrow="Search" title={q ? `“${q}”` : "Search the Cooked World"} testid="search-page">
      <div className="mt-8 max-w-3xl"><SearchBar key={q} initial={q} compact /></div>
      {q ? <Results q={q} /> : <p className="mt-10 text-[#7a5f56]">Type a project, world or file name.</p>}
    </PageShell>
  );
}
