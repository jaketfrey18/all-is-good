import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";

export const Suggestions = ({ world, onPick }) => {
  const [draft, setDraft] = useState("");
  const [need, setNeed] = useState("");
  const q = useQuery({ queryKey: ["suggest", world, need], enabled: !!world, queryFn: async () => (await api.get("/assets/suggest", { params: { world, need } })).data });
  const items = q.data?.items || [];
  return (
    <section className="border-t border-white/10 p-3 space-y-2" data-testid="suggested-assets">
      <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/55"><Sparkles className="w-3.5 h-3.5 text-[#ff4757]" /> Suggested from your other Worlds</p>
      <form onSubmit={(e) => { e.preventDefault(); setNeed(draft.trim()); }} className="flex items-center gap-1 h-9 rounded-full bg-white/[0.06] border border-white/10 pl-3 pr-1">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What do you need? e.g. hip-hop beat" className="flex-1 bg-transparent outline-none text-xs" data-testid="suggest-need-input" />
        <button className="w-7 h-7 grid place-items-center rounded-full hover:bg-white/10" aria-label="Suggest" data-testid="suggest-need-button"><Search className="w-3.5 h-3.5" /></button>
      </form>
      {q.isLoading && <Loader2 className="w-4 h-4 animate-spin text-[#ff4757]" />}
      <ul className="space-y-1">
        {items.map((f) => (
          <li key={(f.asset_id || f.path) + f.project_slug}>
            <button onClick={() => onPick(f)} className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-white/5" data-testid="suggested-asset-item">
              <span className="block text-sm font-semibold truncate">{f.name}</span>
              <span className="block text-[11px] text-white/50 truncate" title={f.why}>{f.why}</span>
            </button>
          </li>
        ))}
        {q.data && !items.length && <li className="text-xs text-white/40 px-1" data-testid="suggest-empty">{need ? "Nothing tagged or named like that yet." : "Tag assets (or type what you need) to get suggestions."}</li>}
      </ul>
    </section>
  );
};
