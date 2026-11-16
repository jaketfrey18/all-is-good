import { Cloud, CloudOff, Download, Loader2, Trash2, HardDrive } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errText, fmtSize } from "@/lib/api";
import { CATEGORIES, downloadUrl } from "./sessionApi";

const STATUS = {
  in_app: { Icon: HardDrive, label: "Saved in app", cls: "text-[#ffb347]" },
  syncing: { Icon: Loader2, label: "Sending to Dropbox", cls: "text-[#7fc8ff] [&>svg]:animate-spin" },
  in_dropbox: { Icon: Cloud, label: "In Dropbox", cls: "text-[#5fd38a]" },
  error: { Icon: CloudOff, label: "Dropbox failed", cls: "text-[#ff4757]" },
};

const Row = ({ f, sid }) => {
  const qc = useQueryClient();
  const st = STATUS[f.status] || STATUS.in_app;
  const refresh = () => qc.invalidateQueries({ queryKey: ["session", sid] });
  const setCat = async (category) => {
    try { await api.patch(`/session-files/${f.id}`, { category }); refresh(); qc.invalidateQueries({ queryKey: ["sessions"] }); } catch (e) { toast.error(errText(e)); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${f.name} from this session?`)) return;
    try { await api.delete(`/session-files/${f.id}`); refresh(); qc.invalidateQueries({ queryKey: ["sessions"] }); } catch (e) { toast.error(errText(e)); }
  };
  const locked = f.status === "syncing" || f.status === "in_dropbox";
  return (
    <li className="group flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2" data-testid={`session-file-${f.id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" title={f.name}>{f.name}</p>
        <p className={`text-[11px] flex items-center gap-1 ${st.cls}`} title={f.error || f.dropbox_path || ""} data-testid={`session-file-status-${f.id}`}>
          <st.Icon className="w-3 h-3" /> {st.label} <span className="text-white/40">· {fmtSize(f.size)}</span>
        </p>
      </div>
      <select value={f.category} disabled={locked} onChange={(e) => setCat(e.target.value)}
        className="h-8 rounded-full bg-[#241b1c] border border-white/15 text-xs px-2 disabled:opacity-50" data-testid={`session-file-category-${f.id}`}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <a href={downloadUrl(f.id)} className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10" aria-label="Download" data-testid={`session-file-download-${f.id}`}><Download className="w-4 h-4" /></a>
      <button onClick={remove} className="w-8 h-8 grid place-items-center rounded-full text-[#ff4757] hover:bg-[#ff4757]/10" aria-label="Remove" data-testid={`session-file-delete-${f.id}`}><Trash2 className="w-4 h-4" /></button>
    </li>
  );
};

export const SessionFiles = ({ files, sid }) => (
  <div className="space-y-5" data-testid="session-files">
    {CATEGORIES.filter((c) => files.some((f) => f.category === c)).map((c) => (
      <section key={c}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/50 mb-2">{c} · {files.filter((f) => f.category === c).length}</p>
        <ul className="space-y-1.5">{files.filter((f) => f.category === c).map((f) => <Row key={f.id} f={f} sid={sid} />)}</ul>
      </section>
    ))}
  </div>
);
