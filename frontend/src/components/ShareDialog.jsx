import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { useUsers, colorFor, initials } from "@/lib/hooks";
import { api, errText } from "@/lib/api";

export const ShareDialog = ({ open, onOpenChange, kind, id, ownerId, sharedWith, onSaved }) => {
  const { user } = useAuth();
  const { data: users = [] } = useUsers(open);
  const [picked, setPicked] = useState(sharedWith);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPicked(sharedWith); }, [open, sharedWith]);
  const others = users.filter((u) => u.id !== ownerId);
  const toggle = (uid) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/${kind}/${id}/share`, { user_ids: picked });
      onSaved?.(data.shared_with);
      toast.success("Sharing updated");
      onOpenChange(false);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1819] border-white/10 text-white max-w-md" data-testid="share-dialog">
        <DialogTitle className="font-display text-2xl font-extrabold">Share</DialogTitle>
        <DialogDescription className="text-white/55">Only people you tick can open this. Admins can see everything.</DialogDescription>
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {!others.length && <li className="text-sm text-white/50 py-3" data-testid="share-no-users">No collaborators yet. {user?.role === "admin" ? "Add them in Admin → Collaborators." : "Ask an admin to add collaborators."}</li>}
          {others.map((u) => (
            <li key={u.id}>
              <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer" data-testid={`share-user-${u.email}`}>
                <Checkbox checked={picked.includes(u.id)} onCheckedChange={() => toggle(u.id)} disabled={u.role === "admin"} />
                <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold text-[#141011]" style={{ background: colorFor(u.id) }}>{initials(u.name)}</span>
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{u.name}{u.role === "admin" && " · admin"}</span><span className="block text-xs text-white/50 truncate">{u.email}</span></span>
              </label>
            </li>
          ))}
        </ul>
        <button onClick={save} disabled={busy} className="h-11 rounded-full bg-[#e0141b] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="share-save-button">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
      </DialogContent>
    </Dialog>
  );
};
