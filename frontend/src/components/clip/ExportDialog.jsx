import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errText, API, TOKEN_KEY, fmtSize } from "@/lib/api";

export const useJobs = (pid) => useQuery({
  queryKey: ["clip-jobs", pid],
  queryFn: async () => (await api.get(`/clip-projects/${pid}/jobs`)).data,
  refetchInterval: (q) => ((q.state.data || []).some((j) => ["queued", "running", "uploading"].includes(j.status)) ? 1500 : false),
});

const opt = (on) => `h-10 rounded-xl text-sm font-bold border ${on ? "bg-[#e0141b] border-[#e0141b] text-white" : "border-white/15 text-white/75 hover:border-white/40"}`;

export const JobList = ({ pid }) => {
  const { data = [] } = useJobs(pid);
  const token = localStorage.getItem(TOKEN_KEY) || "";
  if (!data.length) return null;
  return (
    <ul className="space-y-2" data-testid="clip-jobs">
      {data.slice(0, 12).map((j) => (
        <li key={j.id} className="rounded-xl bg-white/[0.04] p-3" data-testid={`clip-job-${j.status}`}>
          <div className="flex items-center gap-2 text-sm text-white">
            {j.status === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : j.status === "error" ? <AlertCircle className="w-4 h-4 text-[#ff6b6b]" /> : <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
            <span className="flex-1 truncate font-semibold">{j.filename}</span>
            {(j.status === "done" || j.downloadable) && <a href={`${API}/clip-jobs/${j.id}/download?token=${encodeURIComponent(token)}`} className="inline-flex items-center gap-1 text-xs text-[#ff6b6b] hover:underline" data-testid="clip-job-download"><Download className="w-3.5 h-3.5" /> {fmtSize(j.size)}</a>}
          </div>
          {["queued", "running", "uploading"].includes(j.status) && <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#ff4757] transition-[width]" style={{ width: `${j.progress || 0}%` }} /></div>}
          {j.dropbox_path && <p className="mt-1 text-[11px] font-mono text-emerald-300/80 truncate">Saved to Dropbox: {j.dropbox_path}</p>}
          {j.error && <p className="mt-1 text-[11px] text-[#ff9b9b]">{j.error}</p>}
        </li>
      ))}
    </ul>
  );
};

export const ExportDialog = ({ open, onOpenChange, project, clipIds, worldFolder }) => {
  const qc = useQueryClient();
  const video = project.source.has_video;
  const [format, setFormat] = useState(video ? "mp4" : "mp3");
  const [dest, setDest] = useState("download");
  const [folder, setFolder] = useState(`${worldFolder || ""}/Clips`);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await api.post(`/clip-projects/${project.id}/export`, { clip_ids: clipIds, format, destination: dest, dropbox_folder: folder });
      qc.invalidateQueries({ queryKey: ["clip-jobs", project.id] });
      toast.success(`Rendering ${clipIds.length} clip${clipIds.length === 1 ? "" : "s"}`);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1819] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" data-testid="clip-export-dialog">
        <DialogTitle className="font-display text-2xl font-extrabold">Export {clipIds.length} clip{clipIds.length === 1 ? "" : "s"}</DialogTitle>
        <DialogDescription className="text-white/55">1080p H.264. Originals are never changed.</DialogDescription>
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-white/45">Format</p>
        <div className="grid grid-cols-3 gap-2">
          {[["mp4", "MP4 video"], ["mp3", "MP3 audio"], ["wav", "WAV audio"]].map(([k, l]) => <button key={k} disabled={k === "mp4" && !video} onClick={() => setFormat(k)} className={`${opt(format === k)} disabled:opacity-30`} data-testid={`clip-export-format-${k}`}>{l}</button>)}
        </div>
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-white/45">Destination</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDest("download")} className={opt(dest === "download")} data-testid="clip-export-dest-download">Download</button>
          <button onClick={() => setDest("dropbox")} className={opt(dest === "dropbox")} data-testid="clip-export-dest-dropbox">Dropbox folder</button>
        </div>
        {dest === "dropbox" && <input value={folder} onChange={(e) => setFolder(e.target.value)} className="h-10 px-3 rounded-xl bg-white/10 font-mono text-sm outline-none" data-testid="clip-export-folder-input" />}
        <button onClick={go} disabled={busy} className="h-11 rounded-full bg-[#e0141b] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="clip-export-start">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Start export</button>
        <JobList pid={project.id} />
      </DialogContent>
    </Dialog>
  );
};
