import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Link2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShareDialog } from "@/components/ShareDialog";
import { useCanvases, createCanvas } from "@/components/WorldLists";
import { useProjects, colorFor, initials } from "@/lib/hooks";
import { api, errText } from "@/lib/api";

function usePresence(id) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    let alive = true;
    const beat = () => api.post(`/canvases/${id}/presence`).then((r) => alive && setPeople(r.data)).catch(() => {});
    beat();
    const t = setInterval(beat, 12000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);
  return people;
}

const pill = "inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/20 bg-[#1c1617]/80 backdrop-blur-xl text-white text-sm font-semibold hover:border-white/40 transition-colors";

export const CanvasHeader = ({ cv }) => {
  const s = cv.state;
  const navigate = useNavigate();
  const { data: worlds = [] } = useProjects();
  const { data: canvases = [] } = useCanvases(s.world_slug);
  const people = usePresence(s.id);
  const [share, setShare] = useState(false);
  const world = worlds.find((w) => w.slug === s.world_slug);

  const switchWorld = async (slug) => {
    try {
      const list = (await api.get("/canvases", { params: { world: slug } })).data;
      navigate(`/canvas/${(list[0] || (await createCanvas(slug))).id}`);
    } catch (e) { toast.error(errText(e)); }
  };
  const newCanvas = async () => {
    const name = window.prompt("Canvas name", `Canvas ${canvases.length + 1}`);
    if (!name) return;
    try { navigate(`/canvas/${(await createCanvas(s.world_slug, name)).id}`); } catch (e) { toast.error(errText(e)); }
  };
  const rename = () => { const n = window.prompt("Rename canvas", s.name); if (n?.trim()) cv.patch({ name: n.trim() }); };

  return (
    <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 pointer-events-auto min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className={pill} data-testid="world-selector"><span className="truncate max-w-[160px]">{world?.title || s.world_slug}</span><ChevronDown className="w-4 h-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuLabel>Worlds</DropdownMenuLabel>
            {worlds.map((w) => <DropdownMenuItem key={w.slug} onClick={() => w.slug !== s.world_slug && switchWorld(w.slug)} data-testid={`world-option-${w.slug}`}>{w.slug === s.world_slug && <Check className="w-4 h-4 mr-2" />}{w.title}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-white/30">/</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="inline-flex items-center gap-1.5 text-[#ff4757] font-semibold truncate" data-testid="canvas-selector">{s.name}<ChevronDown className="w-4 h-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            {canvases.map((c) => <DropdownMenuItem key={c.id} onClick={() => navigate(`/canvas/${c.id}`)} data-testid={`canvas-option-${c.id}`}>{c.id === s.id && <Check className="w-4 h-4 mr-2" />}{c.name}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={rename} data-testid="canvas-rename">Rename this canvas</DropdownMenuItem>
            <DropdownMenuItem onClick={newCanvas} data-testid="canvas-new"><Plus className="w-4 h-4 mr-2" /> New canvas</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center -space-x-2 h-11 px-2 rounded-full bg-[#1c1617]/80 border border-[#ff4757]/40" data-testid="canvas-presence" title="Here now">
          {people.slice(0, 4).map((p) => <span key={p.id} title={p.name} className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold text-[#141011] ring-2 ring-[#1c1617]" style={{ background: colorFor(p.id) }}>{initials(p.name)}</span>)}
          {people.length > 4 && <span className="pl-3 text-sm text-white font-semibold">+{people.length - 4}</span>}
        </div>
        <button className={pill} onClick={() => setShare(true)} data-testid="canvas-share-button"><Link2 className="w-4 h-4" /> Share</button>
      </div>
      <ShareDialog open={share} onOpenChange={setShare} kind="canvases" id={s.id} ownerId={s.owner_id} sharedWith={s.shared_with || []} onSaved={(ids) => cv.patch({ shared_with: ids })} />
    </div>
  );
};
