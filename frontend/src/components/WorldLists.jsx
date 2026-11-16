import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutDashboard, PenLine, Trash2, Scissors } from "lucide-react";
import { toast } from "sonner";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const useCanvases = (world) => useQuery({ queryKey: ["canvases", world || "all"], queryFn: async () => (await api.get("/canvases", { params: world ? { world } : {} })).data });
export const useLyrics = (world) => useQuery({ queryKey: ["lyrics", world || "all"], queryFn: async () => (await api.get("/lyrics", { params: world ? { world } : {} })).data });
export const useClipProjects = (world) => useQuery({ queryKey: ["clip-projects", world || "all"], queryFn: async () => (await api.get("/clip-projects", { params: world ? { world } : {} })).data });

export async function createCanvas(world_slug, name = "Canvas") {
  return (await api.post("/canvases", { world_slug, name })).data;
}

const Item = ({ to, Icon, title, sub, onDelete, testid }) => (
  <li className="group flex items-center gap-3 rounded-2xl border border-[#8080802e] bg-[#80808010] hover:bg-[#80808022] transition-colors pr-2">
    <Link to={to} className="flex-1 min-w-0 flex items-center gap-3 p-3" data-testid={testid}>
      <span className="w-10 h-10 rounded-xl bg-[#e0141b]/15 text-[#ff4757] grid place-items-center shrink-0"><Icon className="w-5 h-5" /></span>
      <span className="min-w-0"><span className="block font-semibold truncate">{title}</span><span className="block text-xs opacity-55 truncate">{sub}</span></span>
    </Link>
    {onDelete && <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 w-8 h-8 grid place-items-center rounded-full text-[#ff4757] hover:bg-[#ff4757]/10 transition-opacity" aria-label="Delete" data-testid={`${testid}-delete`}><Trash2 className="w-4 h-4" /></button>}
  </li>
);

export const WorldLists = ({ world, worlds = [], showWorld }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [target, setTarget] = useState(world || "");
  const canvases = useCanvases(world);
  const lyrics = useLyrics(world);
  const clipsQ = useClipProjects(world);
  const label = (slug) => worlds.find((w) => w.slug === slug)?.title || slug;
  const pick = target || world;

  const newCanvas = async () => {
    if (!pick) return toast.error("Pick a world first");
    try { const c = await createCanvas(pick); navigate(`/canvas/${c.id}`); } catch (e) { toast.error(errText(e)); }
  };
  const newLyric = async () => {
    if (!pick) return toast.error("Pick a world first");
    try { const l = (await api.post("/lyrics", { world_slug: pick, title: "Untitled lyrics" })).data; navigate(`/lyrics/${l.id}`); } catch (e) { toast.error(errText(e)); }
  };
  const remove = async (kind, id) => {
    if (!window.confirm("Delete permanently?")) return;
    try { await api.delete(`/${kind}/${id}`); qc.invalidateQueries({ queryKey: [kind] }); } catch (e) { toast.error(errText(e)); }
  };
  const mine = (o) => user?.role === "admin" || o.owner_id === user?.id;
  const head = "flex items-center justify-between mb-3";
  const add = "inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#e0141b] text-white text-sm font-bold hover:brightness-110 transition-[filter]";

  return (
    <div className="space-y-6">
      {showWorld && (
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 px-4 rounded-full bg-transparent border border-[#80808055] text-sm" data-testid="tools-world-select">
          <option value="" className="bg-[#1f1819] text-white">Choose a world…</option>
          {worlds.map((w) => <option key={w.slug} value={w.slug} className="bg-[#1f1819] text-white">{w.title}</option>)}
        </select>
      )}
      <div className="grid md:grid-cols-2 gap-8">
        <section data-testid="canvas-list">
          <div className={head}><h2 className="font-display text-xl font-bold">Canvases</h2><button onClick={newCanvas} className={add} data-testid="new-canvas-button"><Plus className="w-4 h-4" /> New canvas</button></div>
          <ul className="space-y-2">
            {(canvases.data || []).map((c) => <Item key={c.id} to={`/canvas/${c.id}`} Icon={LayoutDashboard} title={c.name} sub={`${showWorld ? label(c.world_slug) + " · " : ""}${new Date(c.updated_at).toLocaleString()}`} onDelete={mine(c) ? () => remove("canvases", c.id) : null} testid={`canvas-link-${c.id}`} />)}
            {canvases.data && !canvases.data.length && <li className="text-sm opacity-50">No canvases yet.</li>}
          </ul>
        </section>
        <section data-testid="lyric-list">
          <div className={head}><h2 className="font-display text-xl font-bold">Lyric Pad</h2><button onClick={newLyric} className={add} data-testid="new-lyric-button"><Plus className="w-4 h-4" /> New lyrics</button></div>
          <ul className="space-y-2">
            {(lyrics.data || []).map((l) => <Item key={l.id} to={`/lyrics/${l.id}`} Icon={PenLine} title={l.title} sub={`${showWorld ? label(l.world_slug) + " · " : ""}${new Date(l.updated_at).toLocaleString()}`} onDelete={mine(l) ? () => remove("lyrics", l.id) : null} testid={`lyric-link-${l.id}`} />)}
            {lyrics.data && !lyrics.data.length && <li className="text-sm opacity-50">No lyric documents yet.</li>}
          </ul>
        </section>
        <section data-testid="clip-project-list" className="md:col-span-2">
          <div className={head}><h2 className="font-display text-xl font-bold">Clip Studio</h2><button onClick={() => navigate(`/media?kind=video${pick ? `&world=${pick}` : ""}`)} className={add} data-testid="new-clip-project-button"><Plus className="w-4 h-4" /> Pick a video or audio file</button></div>
          <ul className="grid md:grid-cols-2 gap-2">
            {(clipsQ.data || []).map((c) => <Item key={c.id} to={`/studio/${c.id}`} Icon={Scissors} title={c.name} sub={`${showWorld ? label(c.world_slug) + " · " : ""}${c.source?.name || ""}`} onDelete={mine(c) ? () => remove("clip-projects", c.id) : null} testid={`clip-project-link-${c.id}`} />)}
            {clipsQ.data && !clipsQ.data.length && <li className="text-sm opacity-50">No clip projects yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
};
