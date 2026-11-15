import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, fileKind, fmtSize } from "@/lib/api";

function Viewer({ kind, url, name }) {
  if (kind === "image") return <img src={url} alt={name} className="max-h-[70vh] mx-auto rounded-xl" data-testid="preview-image" />;
  if (kind === "video") return <video src={url} controls autoPlay className="w-full max-h-[70vh] rounded-xl bg-black" data-testid="preview-video" />;
  if (kind === "audio") return <audio src={url} controls autoPlay className="w-full" data-testid="preview-audio" />;
  if (kind === "pdf") return <iframe src={url} title={name} className="w-full h-[70vh] rounded-xl bg-white" data-testid="preview-pdf" />;
  return (
    <div className="py-16 text-center" data-testid="preview-unsupported">
      <p className="font-display text-2xl font-bold">No inline preview for this file type.</p>
      <p className="text-[#7a5f56] mt-2">Download it to open it on your device.</p>
    </div>
  );
}

export const FilePreview = ({ slug, file, onClose }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["link", slug, file?.path],
    queryFn: async () => (await api.get(`/projects/${slug}/link`, { params: { path: file.path } })).data.url,
    enabled: !!file,
    staleTime: 30 * 60 * 1000,
  });
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl bg-[#fff8f0] border-[#f1d9c9]" data-testid="file-preview-dialog">
        <DialogTitle className="font-display text-2xl font-extrabold pr-8 truncate">{file?.name}</DialogTitle>
        <DialogDescription className="font-mono text-xs text-[#7a5f56]">{fmtSize(file?.size)} {file?.modified && `· ${new Date(file.modified).toLocaleDateString()}`}</DialogDescription>
        {isLoading && <div className="h-64 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-[#e8262f]" /></div>}
        {error && <p className="text-[#e8262f]" data-testid="preview-error">Could not load this file.</p>}
        {data && <Viewer kind={fileKind(file.ext)} url={data} name={file.name} />}
        {data && (
          <a href={data} target="_blank" rel="noreferrer" className="self-start inline-flex items-center gap-2 rounded-full bg-[#2d2422] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#e8262f] transition-colors" data-testid="preview-download-link">
            <Download className="w-4 h-4" /> Download
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
};
