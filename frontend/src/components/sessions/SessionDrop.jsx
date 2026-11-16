import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, AudioLines, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSessions } from "./sessionApi";
import { SessionDetail } from "./SessionDetail";

export const sessionSub = (s) => {
  const parts = Object.entries(s.counts || {}).map(([k, n]) => `${n} ${k.toLowerCase()}`);
  return [`${s.file_count || 0} files`, ...parts].join(" · ");
};

const SessionList = ({ world, onOpen }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const list = useSessions(world);
  const [name, setName] = useState("");
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { const s = (await api.post("/sessions", { world_slug: world, name: name.trim() })).data; setName(""); qc.invalidateQueries({ queryKey: ["sessions"] }); onOpen(s.id); } catch (err) { toast.error(errText(err)); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Delete session "${s.name}"? Files already in Dropbox stay there.`)) return;
    try { await api.delete(`/sessions/${s.id}`); qc.invalidateQueries({ queryKey: ["sessions"] }); } catch (err) { toast.error(errText(err)); }
  };
  return (
    <div className="space-y-5">
      <form onSubmit={create} className="flex gap-2" data-testid="session-create-form">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="New session name, e.g. Vocals take 2"
          className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/15 px-4 text-sm outline-none focus:border-[#ff4757]" data-testid="session-name-input" />
        <button className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[#e0141b] font-bold text-sm hover:brightness-110 transition-[filter]" data-testid="session-create-button"><Plus className="w-4 h-4" /> Start</button>
      </form>
      <ul className="space-y-2" data-testid="session-list">
        {(list.data || []).map((s) => (
          <li key={s.id} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors pr-2">
            <button onClick={() => onOpen(s.id)} className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left" data-testid={`session-open-${s.id}`}>
              <span className="w-10 h-10 rounded-xl bg-[#e0141b]/15 text-[#ff4757] grid place-items-center shrink-0"><AudioLines className="w-5 h-5" /></span>
              <span className="min-w-0"><span className="block font-semibold truncate">{s.name}</span><span className="block text-xs text-white/50 truncate">{new Date(s.created_at).toLocaleDateString()} · {sessionSub(s)}</span></span>
            </button>
            {(user?.role === "admin" || s.owner_id === user?.id) && <button onClick={() => remove(s)} className="opacity-0 group-hover:opacity-100 w-8 h-8 grid place-items-center rounded-full text-[#ff4757] hover:bg-[#ff4757]/10 transition-opacity" aria-label="Delete session" data-testid={`session-delete-${s.id}`}><Trash2 className="w-4 h-4" /></button>}
          </li>
        ))}
        {list.data && !list.data.length && <li className="text-sm text-white/40">No sessions yet. Start one above.</li>}
      </ul>
    </div>
  );
};

export const SessionDrop = ({ open, onOpenChange, world, sessionId }) => {
  const [sid, setSid] = useState(sessionId || null);
  useEffect(() => { if (open) setSid(sessionId || null); }, [open, sessionId]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-[#151112] text-white border-l border-[#4a2a2a] overflow-y-auto" data-testid="session-drop-drawer">
        <SheetHeader className="mb-6 pt-4 text-left">
          <SheetTitle className="font-display text-3xl font-extrabold text-white">Session Drop</SheetTitle>
          <SheetDescription className="text-white/55">Drop a session's files once. They're kept in the app and filed into Dropbox by type.</SheetDescription>
        </SheetHeader>
        {sid ? <SessionDetail sid={sid} onBack={() => setSid(null)} /> : <SessionList world={world} onOpen={setSid} />}
      </SheetContent>
    </Sheet>
  );
};
