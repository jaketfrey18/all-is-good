import { useState } from "react";
import { Mic, Link2, Lock } from "lucide-react";
import { fmtSize } from "@/lib/api";
import { useProjects } from "@/lib/hooks";
import { useMyWorlds, useWorldAssets } from "./assetsApi";
import { RecorderPanel } from "./RecorderPanel";
import { Suggestions } from "./Suggestions";

const Item = ({ a, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${active ? "bg-[#e0141b]/20 ring-1 ring-[#e0141b]" : "hover:bg-white/5"}`} data-testid={`library-item-${a.id}`}>
    <span className="w-10 h-10 shrink-0 rounded-lg bg-white/5 grid place-items-center text-[#ff6b6b]">{a.kind === "reference" ? (a.accessible ? <Link2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />) : <Mic className="w-5 h-5" />}</span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold truncate">{a.name}</span>
      <span className="block text-[11px] font-mono text-white/45 truncate">{a.kind === "reference" ? `from ${a.source.world_title}` : `recording · ${fmtSize(a.size)}`}{a.tags?.length ? ` · #${a.tags.join(" #")}` : ""}</span>
    </span>
  </button>
);

export const WorldLibrary = ({ world, setWorld, sel, onSelect }) => {
  const { data: mine = [] } = useMyWorlds();
  const { data: worlds = [] } = useProjects();
  const list = useWorldAssets(world);
  const [rec, setRec] = useState(false);
  const options = worlds.filter((w) => mine.includes(w.slug));
  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="world-library">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <select value={world} onChange={(e) => setWorld(e.target.value)} className="flex-1 min-w-0 h-9 px-3 rounded-full bg-transparent border border-white/15 text-sm" data-testid="library-world-select">
          <option value="" className="bg-[#1f1819]">Choose a World…</option>
          {options.map((w) => <option key={w.slug} value={w.slug} className="bg-[#1f1819]">{w.title}</option>)}
        </select>
        <button onClick={() => setRec(true)} className="h-9 px-4 rounded-full bg-[#e0141b] text-sm font-bold inline-flex items-center gap-1.5 shrink-0" data-testid="library-record-audio-button"><Mic className="w-4 h-4" /> Record Audio</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!world && <p className="p-3 text-sm text-white/45">{options.length ? "Pick a World to see its recordings and referenced assets." : "You're not a member of any World yet. Ask an admin to add you."}</p>}
        {(list.data || []).map((a) => <Item key={a.id} a={a} active={sel?.id === a.id} onClick={() => onSelect({ asset: a })} />)}
        {world && list.data && !list.data.length && <p className="p-3 text-sm text-white/45" data-testid="library-empty">No recordings or referenced assets yet. Record tab audio or search all Worlds and press “Use in This World”. Dropbox files are under Search.</p>}
      </div>
      {world && <Suggestions world={world} onPick={(f) => onSelect({ file: f })} />}
      <RecorderPanel open={rec} onOpenChange={setRec} world={world} onSaved={(a) => { if (a.world_slug !== world) setWorld(a.world_slug); onSelect({ asset: a }); }} />
    </div>
  );
};
