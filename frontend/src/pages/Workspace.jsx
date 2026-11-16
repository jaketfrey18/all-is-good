import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { WorldTools } from "@/components/WorldTools";
import { useAuth } from "@/context/AuthContext";
import { FileBrowser } from "@/components/workspace/FileBrowser";
import { FilePreview } from "@/components/workspace/FilePreview";
import { GwaLanding } from "@/components/world/GwaLanding";
import { api } from "@/lib/api";

const EmptyState = ({ title, body }) => (
  <div className="rounded-[28px] border-2 border-dashed border-[#e6cbbb] bg-white/60 p-12 text-center" data-testid="workspace-empty-state">
    <FolderOpen className="w-12 h-12 mx-auto text-[#e8a23b]" />
    <p className="font-display text-2xl font-extrabold mt-4">{title}</p>
    <p className="text-[#7a5f56] mt-2">{body}</p>
  </div>
);

const Header = ({ p }) => (
  <section className="relative overflow-hidden rounded-[32px] bg-[#2d2422] text-[#fff8f0]" data-testid="workspace-header">
    <img src={p.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 blur-sm scale-110" />
    <div className="relative grid md:grid-cols-[220px_1fr] gap-8 p-8 sm:p-12 items-end">
      <img src={p.cover_url} alt={p.title} className="w-44 md:w-full aspect-[3/4] object-cover rounded-2xl shadow-[0_0_0_3px_#ff8a3d,0_25px_60px_-15px_rgba(0,0,0,0.6)]" />
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#ffb59a]" data-testid="workspace-category">{p.category}</p>
        <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl mt-2" data-testid="workspace-title">{p.title}</h1>
        {p.subtitle && <p className="text-base md:text-lg text-white/80 mt-1">{p.subtitle}</p>}
        <p className="mt-5 max-w-2xl text-white/85" data-testid="workspace-description">{p.description}</p>
      </div>
    </div>
  </section>
);

export default function Workspace() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [file, setFile] = useState(null);
  const path = params.get("path") || "";
  const setPath = (p) => setParams(p ? { path: p } : {});
  const { user } = useAuth();
  const project = useQuery({ queryKey: ["project", slug], queryFn: async () => (await api.get(`/projects/${slug}`)).data, retry: false });
  const dbx = useQuery({ queryKey: ["dbx-status"], queryFn: async () => (await api.get("/dropbox/status")).data });
  const files = project.data && (!project.data.dropbox_path ? (
    <EmptyState title="No folder linked yet" body="An admin can link a Dropbox folder to this project from the admin panel." />
  ) : dbx.data && !dbx.data.connected ? (
    <EmptyState title="Dropbox isn't connected" body="Files will appear here once Dropbox is connected in the admin panel." />
  ) : dbx.data ? (
    <FileBrowser slug={slug} path={path} setPath={setPath} onOpen={setFile} />
  ) : null);

  if (slug === "gwa" && project.data) {
    return (<><GwaLanding p={project.data} files={files} /><FilePreview slug={slug} file={file} onClose={() => setFile(null)} /></>);
  }

  return (
    <div className="min-h-screen bg-[#fff8f0]" data-testid="workspace-page">
      <div className="sticky top-0 z-30 bg-[#fff6f2]/85 backdrop-blur-xl border-b border-[#f1d6cc]"><TopNav active="worlds" /></div>
      <main className="max-w-[1320px] mx-auto px-5 sm:px-10 pt-8 pb-24">
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-sm hover:text-[#e8262f] mb-6" data-testid="workspace-back-link"><ArrowLeft className="w-4 h-4" /> back to the cooked world</Link>
        {project.isLoading && <p className="font-mono text-sm">cooking…</p>}
        {project.error && <EmptyState title="Project not found" body="This dish isn't on the menu." />}
        {project.data && (
          <div className="space-y-12 rise">
            <Header p={project.data} />
            {user && <WorldTools slug={slug} />}
            <section>
              <h2 className="font-display text-lg font-bold uppercase tracking-[0.2em] mb-6">Workspace files</h2>
              {files}
            </section>
          </div>
        )}
      </main>
      <FilePreview slug={slug} file={file} onClose={() => setFile(null)} />
    </div>
  );
}
