import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errText } from "@/lib/api";
import { useProjects } from "@/lib/hooks";
import { useMyWorlds } from "./assetsApi";

export const UseInWorld = ({ f, defaultWorld = "" }) => {
  const qc = useQueryClient();
  const { data: mine = [] } = useMyWorlds();
  const { data: worlds = [] } = useProjects();
  const targets = worlds.filter((w) => mine.includes(w.slug) && w.slug !== f.project_slug);
  const [target, setTarget] = useState(targets.some((w) => w.slug === defaultWorld) ? defaultWorld : "");
  const [busy, setBusy] = useState(false);
  const use = async () => {
    if (!target) return toast.error("Pick the World to use it in");
    setBusy(true);
    try {
      const body = { world_slug: target, source_world: f.project_slug, size: f.size, ...(f.asset_id ? { asset_id: f.asset_id } : { path: f.path }) };
      const a = (await api.post("/assets/reference", body)).data;
      toast.success(`Added to ${a.world_title} as a reference. The original stays in ${a.source.world_title}.`);
      qc.invalidateQueries({ queryKey: ["assets", target] });
    } catch (e) { toast.error(errText(e)); }
    setBusy(false);
  };
  if (!targets.length) return null;
  return (
    <div className="flex items-center gap-2" data-testid="use-in-world">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 px-3 rounded-full bg-transparent border border-white/15 text-sm" data-testid="use-in-world-select">
        <option value="" className="bg-[#1f1819]">Use in World…</option>
        {targets.map((w) => <option key={w.slug} value={w.slug} className="bg-[#1f1819]">{w.title}</option>)}
      </select>
      <button onClick={use} disabled={busy} className="h-9 px-4 rounded-full bg-white/10 hover:bg-[#e0141b] text-sm font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60" data-testid="use-in-world-button">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Use in This World
      </button>
    </div>
  );
};
