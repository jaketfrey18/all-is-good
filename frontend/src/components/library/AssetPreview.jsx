import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Lock, Trash2, Scissors, Link2, Mic } from "lucide-react";
import { toast } from "sonner";
import { Viewer } from "@/components/workspace/FilePreview";
import { api, errText, fmtSize } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useAssetLink, mediaUrl } from "./assetsApi";
import { TagEditor } from "./TagEditor";

const btn = "h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors";
const dur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, "0")}`;

export const AssetPreview = ({ a, onRemoved }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const link = useAssetLink(a.id, a.accessible);
  const isRef = a.kind === "reference";
  const refresh = () => qc.invalidateQueries({ queryKey: ["assets", a.world_slug] });
  const patch = async (body) => { await api.patch(`/assets/${a.id}`, body); refresh(); };
  const rename = async (name) => { if (name.trim() && name !== a.name) { try { await patch({ name }); toast.success("Renamed"); } catch (e) { toast.error(errText(e)); } } };
  const remove = async () => {
    if (!window.confirm(isRef ? "Remove this reference? The original is not touched." : "Delete this recording?")) return;
    try { await api.delete(`/assets/${a.id}`); refresh(); onRemoved(); } catch (e) { toast.error(errText(e)); }
  };
  const clip = async () => {
    try { navigate(`/studio/${(await api.post("/clip-projects", { world_slug: a.world_slug, asset_id: a.id })).data.id}`); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto" data-testid="asset-preview">
      <div className="min-w-0">
        <input key={a.id + a.name} defaultValue={a.name} onBlur={(e) => rename(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full bg-transparent outline-none font-display text-2xl font-bold truncate focus:bg-white/5 rounded-lg" aria-label="Asset name" data-testid="asset-name-input" />
        <p className="font-mono text-xs text-white/50 flex items-center gap-1.5 flex-wrap" data-testid="asset-source-info">
          {isRef ? <><Link2 className="w-3.5 h-3.5 text-[#ff6b6b]" /> Referenced from {a.source.world_title} · {a.source.path || `recording “${a.source.name}”`}</>
            : <><Mic className="w-3.5 h-3.5 text-[#ff6b6b]" /> Recording · {dur(a.duration)} · {fmtSize(a.size)} · {a.status === "in_dropbox" ? `Dropbox: ${a.dropbox_path}` : "Saved in app"}</>}
        </p>
      </div>
      <TagEditor key={a.id} tags={a.tags} onSave={(tags) => patch({ tags })} testid="asset-tags" />
      <div className="flex-1 min-h-[160px] grid place-items-center rounded-2xl bg-black/30 overflow-hidden p-4">
        {!a.accessible ? (
          <p className="text-center text-sm text-white/60 max-w-xs" data-testid="asset-no-access"><Lock className="w-6 h-6 mx-auto mb-2 text-[#ff6b6b]" />The original lives in {a.source.world_title}, which you're not a member of. Ask an admin for access.</p>
        ) : link.isLoading ? <Loader2 className="w-8 h-8 animate-spin text-[#ff4757]" /> : link.error ? <p className="text-sm text-[#ff6b6b]" data-testid="asset-link-error">{errText(link.error)}</p>
          : link.data && <Viewer kind={a.type} url={link.data} name={a.name} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {a.kind === "recording" && <>
          <a href={mediaUrl(a.id, "&dl=1")} className={btn} data-testid="asset-download-webm"><Download className="w-4 h-4" /> WebM</a>
          <a href={mediaUrl(a.id, "&format=wav&dl=1")} className={btn} data-testid="asset-download-wav"><Download className="w-4 h-4" /> WAV</a>
        </>}
        {isRef && link.data && <a href={link.data} target="_blank" rel="noreferrer" className={btn} data-testid="asset-download-original"><Download className="w-4 h-4" /> Original</a>}
        {a.accessible && ["audio", "video"].includes(a.type) && <button onClick={clip} className="h-9 px-4 rounded-full bg-[#e0141b] text-sm font-bold inline-flex items-center gap-1.5" data-testid="asset-open-clip-studio"><Scissors className="w-4 h-4" /> Open in Clip Studio</button>}
        {(user?.role === "admin" || a.owner_id === user?.id) && <button onClick={remove} className="ml-auto w-9 h-9 grid place-items-center rounded-full text-[#ff4757] hover:bg-[#ff4757]/10" aria-label="Remove" data-testid="asset-delete-button"><Trash2 className="w-4 h-4" /></button>}
      </div>
    </div>
  );
};
