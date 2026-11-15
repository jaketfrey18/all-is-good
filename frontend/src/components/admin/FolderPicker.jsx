import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, Loader2, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errText } from "@/lib/api";

export const FolderPicker = ({ open, onClose, onPick, initial = "" }) => {
  const [path, setPath] = useState(initial);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-folders", path],
    queryFn: async () => (await api.get("/admin/dropbox/folders", { params: { path } })).data,
    enabled: open,
    retry: false,
  });
  const up = () => setPath(path.slice(0, path.lastIndexOf("/")));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#fff8f0] border-[#f1d9c9] max-w-lg" data-testid="folder-picker-dialog">
        <DialogTitle className="font-display text-2xl font-extrabold">Pick a Dropbox folder</DialogTitle>
        <DialogDescription className="font-mono text-xs break-all" data-testid="folder-picker-path">{path || "/"}</DialogDescription>
        <div className="h-72 overflow-y-auto rounded-xl border border-[#ecd3c4] bg-white">
          {path && <button onClick={up} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[#fbeee4] border-b border-[#f3e3d8]" data-testid="folder-picker-up"><ChevronLeft className="w-4 h-4" /> Up</button>}
          {isLoading && <div className="p-6 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[#e8262f]" /></div>}
          {error && <p className="p-4 text-sm text-[#e8262f]">{errText(error)}</p>}
          {data?.items.map((f) => (
            <button key={f.path} onClick={() => setPath(f.path)} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#fbeee4] text-left" data-testid={`folder-picker-item-${f.name}`}>
              <Folder className="w-4 h-4 text-[#e8a23b]" fill="#f7c873" /> {f.name}
            </button>
          ))}
          {data && !data.items.length && <p className="p-4 text-sm text-[#7a5f56]">No subfolders.</p>}
        </div>
        <button disabled={!path} onClick={() => { onPick(path); onClose(); }} className="h-11 rounded-full bg-[#e8262f] text-white font-bold disabled:opacity-50 hover:brightness-110 transition-[filter]" data-testid="folder-picker-select-button">
          Use this folder
        </button>
      </DialogContent>
    </Dialog>
  );
};
