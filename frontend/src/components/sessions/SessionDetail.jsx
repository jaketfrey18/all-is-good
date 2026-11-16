import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CloudUpload, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { api, errText } from "@/lib/api";
import { useSession, uploadFile } from "./sessionApi";
import { SessionFiles } from "./SessionFiles";

const DropZone = ({ onFiles }) => {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${over ? "border-[#ff4757] bg-[#ff4757]/10" : "border-white/20 hover:border-[#ff4757]/60"}`} data-testid="session-dropzone">
      <CloudUpload className="w-9 h-9 mx-auto text-[#ff4757]" />
      <p className="font-semibold mt-2">Drop files here or click to choose</p>
      <p className="text-xs text-white/50 mt-1">Sorted into Audio, Video, Images and Docs automatically</p>
      <input ref={input} type="file" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} data-testid="session-file-input" />
    </div>
  );
};

const Uploads = ({ items }) => items.length ? (
  <ul className="space-y-1.5" data-testid="session-upload-queue">
    {items.map((u) => (
      <li key={u.key} className="text-xs">
        <div className="flex justify-between"><span className="truncate">{u.name}</span><span className={u.error ? "text-[#ff4757]" : "text-white/60"}>{u.error || `${u.pct}%`}</span></div>
        <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden"><div className="h-full bg-[#ff4757] transition-[width] duration-300" style={{ width: `${u.pct}%` }} /></div>
      </li>
    ))}
  </ul>
) : null;

const DropboxBar = ({ s, onSync, busy }) => {
  const pending = s.files.filter((f) => f.status === "in_app" || f.status === "error").length;
  if (!s.folder) return <p className="text-xs text-[#ffb347]" data-testid="session-dropbox-note">This world has no Dropbox folder linked, so files stay in the app.</p>;
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 text-xs space-y-2" data-testid="session-dropbox-bar">
      <p className="text-white/60 break-all">Dropbox: <span className="text-white/90">{s.folder}/…</span></p>
      {!s.can_write && <p className="text-[#ffb347]" data-testid="session-dropbox-note">Saving to Dropbox is off, so files are kept safely in the app. Turn on files.content.write in your Dropbox app, reconnect in Admin, then press Send.</p>}
      {pending > 0 && <button onClick={onSync} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-[#e0141b] font-bold disabled:opacity-60" data-testid="session-sync-button">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send {pending} to Dropbox</button>}
    </div>
  );
};

export const SessionDetail = ({ sid, onBack }) => {
  const qc = useQueryClient();
  const q = useSession(sid);
  const [ups, setUps] = useState([]);
  const [busy, setBusy] = useState(false);
  const patch = (key, v) => setUps((a) => a.map((u) => (u.key === key ? { ...u, ...v } : u)));
  const onFiles = async (files) => {
    const batch = files.map((f) => ({ key: crypto.randomUUID(), name: f.name, pct: 0, file: f }));
    setUps((a) => [...batch, ...a]);
    for (const u of batch) {
      try { await uploadFile(sid, u.file, (pct) => patch(u.key, { pct })); setUps((a) => a.filter((x) => x.key !== u.key)); } catch (e) { patch(u.key, { error: errText(e) }); }
      qc.invalidateQueries({ queryKey: ["session", sid] });
    }
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };
  const sync = async () => {
    setBusy(true);
    try { const r = (await api.post(`/sessions/${sid}/sync`)).data; toast.success(`Sending ${r.queued} file(s) to Dropbox`); qc.invalidateQueries({ queryKey: ["session", sid] }); } catch (e) { toast.error(errText(e)); }
    setBusy(false);
  };
  const s = q.data;
  return (
    <div className="space-y-5" data-testid="session-detail">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-mono text-white/60 hover:text-white" data-testid="session-back-button"><ArrowLeft className="w-3.5 h-3.5" /> all sessions</button>
      {!s ? <Loader2 className="w-6 h-6 animate-spin text-[#ff4757]" /> : (<>
        <div><h3 className="font-display text-2xl font-extrabold" data-testid="session-detail-name">{s.name}</h3>
          <p className="text-xs text-white/50">{new Date(s.created_at).toLocaleDateString()} · {s.files.length} files</p></div>
        <DropZone onFiles={onFiles} />
        <Uploads items={ups} />
        <DropboxBar s={s} onSync={sync} busy={busy} />
        {s.files.length ? <SessionFiles files={s.files} sid={sid} /> : <p className="text-sm text-white/40">No files yet.</p>}
      </>)}
    </div>
  );
};
