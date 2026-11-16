import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FolderCheck, FolderX, Users } from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/lib/hooks";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { useAdminDropbox } from "@/components/admin/DropboxCard";
import { ShareDialog } from "@/components/ShareDialog";
import { api, errText } from "@/lib/api";

export const ProjectsManager = () => {
  const qc = useQueryClient();
  const { data = [] } = useProjects();
  const { data: dbx } = useAdminDropbox();
  const [editing, setEditing] = useState(undefined);
  const [members, setMembers] = useState(null);
  const mem = useQuery({ queryKey: ["world-members"], queryFn: async () => (await api.get("/admin/world-members")).data });

  const save = async (body) => {
    try {
      if (editing) await api.put(`/projects/${editing.id}`, body);
      else await api.post("/projects", body);
      toast.success("Saved");
      setEditing(undefined);
      qc.invalidateQueries();
    } catch (e) { toast.error(errText(e)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? This does not touch its Dropbox files.`)) return;
    try { await api.delete(`/projects/${p.id}`); toast.success("Deleted"); qc.invalidateQueries(); } catch (e) { toast.error(errText(e)); }
  };

  return (
    <section data-testid="projects-manager">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-extrabold">Projects</h2>
        <button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#2d2422] text-white font-semibold hover:bg-[#e8262f] transition-colors" data-testid="add-project-button"><Plus className="w-4 h-4" /> New project</button>
      </div>
      <ul className="mt-6 space-y-3">
        {data.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-3 pr-4 rounded-2xl bg-white/80 border border-[#ecd3c4]" data-testid={`admin-project-row-${p.slug}`}>
            <img src={p.cover_url} alt="" className="w-14 h-[72px] rounded-lg object-cover bg-[#fbeee4]" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold truncate">{p.title}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#7a5f56]">{p.category} · #{p.order}</p>
              <p className="font-mono text-xs mt-1 flex items-center gap-1.5 truncate" data-testid={`admin-project-folder-${p.slug}`}>
                {p.dropbox_path ? <><FolderCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />{p.dropbox_path}</> : <><FolderX className="w-3.5 h-3.5 text-[#e8262f] shrink-0" />No folder linked</>}
              </p>
            </div>
            <button onClick={() => setMembers(p)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full hover:bg-[#fbeee4] text-sm font-semibold" data-testid={`members-project-${p.slug}`}><Users className="w-4 h-4" /> {(mem.data?.[p.slug] || []).length}</button>
            <button onClick={() => setEditing(p)} className="p-2 rounded-full hover:bg-[#fbeee4]" aria-label="Edit" data-testid={`edit-project-${p.slug}`}><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(p)} className="p-2 rounded-full hover:bg-[#fde2e2] text-[#e8262f]" aria-label="Delete" data-testid={`delete-project-${p.slug}`}><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      {editing !== undefined && <ProjectForm project={editing} onClose={() => setEditing(undefined)} onSave={save} dropboxConnected={!!dbx?.connected} />}
      {members && <ShareDialog open onOpenChange={(o) => !o && setMembers(null)} kind="worlds" id={members.slug} ownerId={null} sharedWith={mem.data?.[members.slug] || []} onSaved={() => mem.refetch()} />}
    </section>
  );
};
