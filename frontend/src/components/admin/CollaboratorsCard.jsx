import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { api, errText } from "@/lib/api";

export const CollaboratorsCard = () => {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/users", f); setF({ name: "", email: "", password: "" }); qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Collaborator added"); } catch (ex) { toast.error(errText(ex)); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}? They lose access to everything.`)) return;
    try { await api.delete(`/admin/users/${u.id}`); qc.invalidateQueries({ queryKey: ["users"] }); } catch (ex) { toast.error(errText(ex)); }
  };

  return (
    <section className="rounded-[24px] bg-white/80 border border-[#f1d6cc] p-6" data-testid="collaborators-card">
      <h2 className="font-display text-2xl font-extrabold">Collaborators</h2>
      <ul className="mt-4 space-y-2">
        {data.map((u) => (
          <li key={u.id} className="flex items-center gap-3 text-sm" data-testid={`collaborator-row-${u.email}`}>
            <span className="min-w-0 flex-1"><span className="font-semibold">{u.name}</span> <span className="opacity-60">{u.email}</span>{u.role === "admin" && <span className="ml-1 text-xs text-[#e0141b]">admin</span>}</span>
            {u.role !== "admin" && <button onClick={() => remove(u)} className="p-1.5 rounded-full text-[#e0141b] hover:bg-[#fde2e2]" aria-label="Remove" data-testid={`collaborator-remove-${u.email}`}><Trash2 className="w-4 h-4" /></button>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-5 space-y-2" data-testid="collaborator-form">
        <Input required placeholder="Name" value={f.name} onChange={set("name")} data-testid="collaborator-name-input" />
        <Input required type="email" placeholder="Email" value={f.email} onChange={set("email")} data-testid="collaborator-email-input" />
        <Input required type="text" minLength={8} placeholder="Temporary password (8+ chars)" value={f.password} onChange={set("password")} data-testid="collaborator-password-input" />
        <button className="w-full h-10 rounded-full bg-[#1d1414] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#e0141b] transition-colors" data-testid="collaborator-add-button"><UserPlus className="w-4 h-4" /> Add collaborator</button>
      </form>
    </section>
  );
};
