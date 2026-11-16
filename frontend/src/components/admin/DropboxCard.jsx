import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Link2, Unlink } from "lucide-react";
import { api, errText } from "@/lib/api";

export const useAdminDropbox = () =>
  useQuery({ queryKey: ["admin-dbx"], queryFn: async () => (await api.get("/admin/dropbox/status")).data });

export const DropboxCard = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useAdminDropbox();

  const connect = async () => {
    const win = window.open("about:blank", "_blank");
    try {
      const { url } = (await api.get("/admin/dropbox/oauth/start")).data;
      if (win) {
        win.location.href = url;
        toast.info("Finish signing in to Dropbox in the new tab. This page updates by itself.", { id: "dbx-wait", duration: 10000 });
        waitForConnection();
      } else {
        window.top.location.href = url;
      }
    } catch (e) {
      win?.close();
      toast.error(errText(e), { duration: 15000 });
    }
  };
  const waitForConnection = () => {
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const st = (await api.get("/admin/dropbox/status").catch(() => ({ data: {} }))).data;
      if (st.connected) {
        clearInterval(timer);
        toast.success("Dropbox connected. All is good.", { id: "dbx-ok" });
        qc.invalidateQueries();
      } else if (tries > 100) clearInterval(timer);
    }, 3000);
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Dropbox? Project workspaces will stop showing files.")) return;
    try { await api.delete("/admin/dropbox/connection"); toast.success("Dropbox disconnected"); qc.invalidateQueries(); } catch (e) { toast.error(errText(e)); }
  };

  return (
    <section className="rounded-[24px] bg-[#2d2422] text-[#fff8f0] p-7 lg:sticky lg:top-28" data-testid="dropbox-card">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ffb59a]">Integration</p>
      <h2 className="font-display text-3xl font-extrabold mt-1">Dropbox</h2>
      {isLoading ? <Loader2 className="w-6 h-6 animate-spin mt-6" /> : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2" data-testid="dropbox-status">
            <span className={`w-2.5 h-2.5 rounded-full ${data?.connected ? "bg-emerald-400" : "bg-[#ff7a4d]"}`} />
            <span className="text-sm">{!data?.configured ? "App keys missing" : data?.connected ? "Connected" : "Not connected"}</span>
          </div>
          {data?.connected && (
            <p className="text-sm text-white/75" data-testid="dropbox-account">{data.account_name}<br /><span className="font-mono text-xs">{data.account_email}</span></p>
          )}
          {!data?.configured && <p className="text-sm text-white/70">Add the Dropbox App Key and App Secret to enable connecting.</p>}
          {data?.connected && !data?.can_write && (
            <p className="text-xs text-white/60" data-testid="dropbox-write-hint">Saving to Dropbox (lyric backups, clip exports) needs the files.content.write permission. Tick it in your Dropbox app's Permissions tab, Submit, then Disconnect and Connect again.</p>
          )}
          {data?.missing_scopes?.length > 0 && (
            <p className="text-sm text-[#ffb59a]" data-testid="dropbox-missing-scopes">Missing permissions: {data.missing_scopes.join(", ")}. Turn them on in your Dropbox app's Permissions tab, click Submit, then disconnect and connect again.</p>
          )}
          {data?.configured && !data?.connected && (
            <button onClick={connect} className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-[#e8262f] font-bold hover:brightness-110 transition-[filter]" data-testid="dropbox-connect-button"><Link2 className="w-4 h-4" /> Connect Dropbox</button>
          )}
          {data?.connected && (
            <button onClick={disconnect} className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-full border border-white/30 text-sm hover:bg-white/10 transition-colors" data-testid="dropbox-disconnect-button"><Unlink className="w-4 h-4" /> Disconnect</button>
          )}
          <div className="pt-4 border-t border-white/15">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Redirect URI for your Dropbox app</p>
            <p className="font-mono text-[11px] break-all mt-1 text-white/80 select-all" data-testid="dropbox-redirect-uri">{data?.redirect_uri}</p>
          </div>
        </div>
      )}
    </section>
  );
};
