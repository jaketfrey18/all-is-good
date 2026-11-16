import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { api, errText } from "@/lib/api";

export const VersionsPanel = ({ lyricId, editor, onClose }) => {
  const qc = useQueryClient();
  const key = ["versions", lyricId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get(`/lyrics/${lyricId}/versions`)).data });

  const save = async () => {
    const label = window.prompt("Name this version", "Checkpoint");
    if (label === null) return;
    try {
      await api.post(`/lyrics/${lyricId}/versions`, { content: editor.getJSON(), text: editor.getText({ blockSeparator: "\n" }), label: label || "Checkpoint" });
      qc.invalidateQueries({ queryKey: key });
      toast.success("Version saved");
    } catch (e) { toast.error(errText(e)); }
  };
  const restore = async (v) => {
    if (!window.confirm("Restore this version? Current text is saved as a version first.")) return;
    await api.post(`/lyrics/${lyricId}/versions`, { content: editor.getJSON(), text: editor.getText({ blockSeparator: "\n" }), label: "Before restore" }).catch(() => {});
    editor.commands.setContent(v.content);
    qc.invalidateQueries({ queryKey: key });
    toast.success("Version restored for everyone");
  };

  return (
    <aside className="absolute right-4 top-20 bottom-4 w-80 z-40 rounded-2xl bg-[#1f1819]/95 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col" data-testid="lyric-versions-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="font-display text-lg font-bold text-white">Versions</p>
        <div className="flex gap-1">
          <button onClick={save} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#e0141b] text-white text-xs font-bold" data-testid="lyric-save-version-button"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full text-white/70 hover:bg-white/10" data-testid="lyric-versions-close"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1" data-scrollable="true">
        {isLoading && <li className="p-3 text-xs text-white/50">Loading…</li>}
        {!isLoading && !data.length && <li className="p-3 text-xs text-white/50">No versions yet. Versions save automatically every few minutes while writing.</li>}
        {data.map((v) => (
          <li key={v.id} className="group p-3 rounded-xl hover:bg-white/5" data-testid="lyric-version-item">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white truncate">{v.label || "Autosave"}</p>
              <button onClick={() => restore(v)} className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-[#ff6b6b] transition-opacity" data-testid="lyric-version-restore"><RotateCcw className="w-3 h-3" /> Restore</button>
            </div>
            <p className="text-[11px] font-mono text-white/45">{new Date(v.created_at).toLocaleString()} · {v.author}</p>
            <p className="text-xs text-white/60 mt-1 line-clamp-2 whitespace-pre-line">{v.text.slice(0, 140) || "(empty)"}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
};
