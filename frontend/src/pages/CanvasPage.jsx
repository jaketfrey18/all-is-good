import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, CloudUpload } from "lucide-react";
import { SessionDrop } from "@/components/sessions/SessionDrop";
import { RecorderPanel } from "@/components/library/RecorderPanel";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { useCanvasDoc } from "@/components/canvas/useCanvasDoc";
import { useStage } from "@/components/canvas/useStage";
import { useCanvasActions } from "@/components/canvas/useCanvasActions";
import { CanvasItem } from "@/components/canvas/CanvasItem";
import { FileBody } from "@/components/canvas/MediaBodies";
import { NoteBody, LyricBody, NOTE_COLORS } from "@/components/canvas/Bodies";
import { Edges } from "@/components/canvas/Edges";
import { ContextBar } from "@/components/canvas/ContextBar";
import { LeftToolbar } from "@/components/canvas/LeftToolbar";
import { ZoomBar } from "@/components/canvas/ZoomBar";
import { AddMenu } from "@/components/canvas/AddMenu";
import { FileDrawer, DRAG_TYPE } from "@/components/canvas/FileDrawer";
import { CanvasHeader } from "@/components/canvas/CanvasHeader";
import { FilePreview } from "@/components/workspace/FilePreview";
import { LyricEditor } from "@/components/lyrics/LyricEditor";
import { ShareDialog } from "@/components/ShareDialog";
import { api, errText } from "@/lib/api";

const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable); };
const KEYS = { v: "select", h: "hand", t: "text", f: "frame", l: "link" };

function useKeys({ sel, setSel, act, cv, setTool }) {
  useEffect(() => {
    const onKey = (e) => {
      if (typing()) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) cv.redo(); else cv.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); cv.redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (sel.edge) act.removeEdge(sel.edge); else if (sel.ids.length) act.removeIds(sel.ids); return; }
      if (e.key === "Escape") { setSel({ ids: [], edge: null }); setTool("select"); return; }
      if (!mod && KEYS[e.key]) setTool(KEYS[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, setSel, act, cv, setTool]);
}

function Workspace({ cv }) {
  const stageRef = useRef(null);
  const stage = useStage(cv, stageRef);
  const [sel, setSel] = useState({ ids: [], edge: null });
  const [tool, setTool] = useState("select");
  const [drawer, setDrawer] = useState({ open: false, kind: "all" });
  const [linkFrom, setLinkFrom] = useState(null);
  const [preview, setPreview] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [lyricShare, setLyricShare] = useState(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const act = useCanvasActions({ cv, stage, stageRef, setSel });
  const navigate = useNavigate();
  useKeys({ sel, setSel, act, cv, setTool });
  const s = cv.state;
  const { vp } = stage;

  const onTool = (k) => {
    if (["image", "video", "audio"].includes(k)) { setDrawer((d) => ({ open: !(d.open && d.kind === k), kind: k })); return; }
    setTool(k);
    setLinkFrom(null);
  };

  const onBg = (e) => {
    if (e.button === 1 || tool === "hand" || tool === "select" || tool === "link") {
      setSel({ ids: [], edge: null });
      setLinkFrom(null);
      stage.startPan(e);
      return;
    }
    const at = stage.toWorld(e.clientX, e.clientY);
    if (tool === "text") act.addNote(at);
    if (tool === "frame") act.addFrame(at);
    setTool("select");
  };

  const pickIds = (item, e) => {
    if (e.shiftKey) return sel.ids.includes(item.id) ? sel.ids.filter((x) => x !== item.id) : [...sel.ids, item.id];
    return sel.ids.includes(item.id) ? sel.ids : [item.id];
  };

  const onItemDown = (item) => (e) => {
    e.stopPropagation();
    if (tool === "link") {
      if (!linkFrom) setLinkFrom(item.id);
      else { act.connect(linkFrom, item.id); setLinkFrom(null); setTool("select"); }
      return;
    }
    setSel({ ids: pickIds(item, e), edge: null });
  };

  const onHeaderDown = (item) => (e) => {
    if (tool === "link") return;
    e.stopPropagation();
    const ids = pickIds(item, e);
    setSel({ ids, edge: null });
    if (ids.includes(item.id)) act.drag(e, act.expandIds(ids), "move");
  };

  const onDrop = (e) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    act.addFile(JSON.parse(raw), stage.toWorld(e.clientX, e.clientY));
  };

  const download = async (item) => {
    try { window.open((await api.get(`/projects/${s.world_slug}/link`, { params: { path: item.data.path } })).data.url, "_blank"); } catch (e) { toast.error(errText(e)); }
  };
  const openLyricShare = async (item) => {
    try { setLyricShare((await api.get(`/lyrics/${item.data.lyric_id}`)).data); } catch (e) { toast.error(errText(e)); }
  };
  const focusLyric = (item) => document.querySelector(`[data-item-id="${item.id}"] .ProseMirror`)?.focus();

  const actions = {
    clip: async (it) => {
      try { navigate(`/studio/${(await api.post("/clip-projects", { world_slug: s.world_slug, path: it.data.path })).data.id}`); } catch (e) { toast.error(errText(e)); }
    },
    preview: (it) => setPreview(it.data), download, expand: (it) => setExpanded(it), editLyric: focusLyric, shareLyric: openLyricShare,
    noteColor: (it, c) => act.setData(it.id, { color: c }, true),
    renameFrame: (it) => { const n = window.prompt("Frame name", it.data.label); if (n) act.setData(it.id, { label: n }, true); },
    group: () => act.group(sel.ids), ungroup: () => act.ungroup(sel.ids),
    deleteItems: () => act.removeIds(sel.ids), deleteEdge: () => act.removeEdge(sel.edge),
  };

  const body = (it) => {
    if (it.type === "file") return <FileBody slug={s.world_slug} item={it} onPreview={() => setPreview(it.data)} />;
    if (it.type === "note") return <NoteBody item={it} onText={(text) => act.setData(it.id, { text })} />;
    if (it.type === "lyric") return <LyricBody item={it} expanded={expanded?.id === it.id} onExpand={() => setExpanded(it)} />;
    return null;
  };

  const gridSize = 26 * vp.zoom;
  const cursor = tool === "hand" ? "grab" : tool === "text" || tool === "frame" ? "crosshair" : tool === "link" ? "alias" : "default";

  return (
    <>
      <div ref={stageRef} className="absolute inset-0 overflow-hidden touch-none" onPointerDown={onBg}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); }} onDrop={onDrop}
        style={{ cursor, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1.3px)", backgroundSize: `${gridSize}px ${gridSize}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
        data-testid="canvas-stage" data-item-count={s.items.length}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
          <Edges items={s.items} edges={s.edges} selectedEdge={sel.edge} onSelect={(id) => setSel({ ids: [], edge: id })} />
          {s.items.map((it) => (
            <CanvasItem key={it.id} item={it} selected={sel.ids.includes(it.id)} linkSource={linkFrom === it.id}
              onDown={onItemDown(it)} onHeaderDown={onHeaderDown(it)} onResizeDown={(e) => { e.stopPropagation(); act.drag(e, [it.id], "resize"); }}>
              {body(it)}
            </CanvasItem>
          ))}
        </div>
      </div>
      <CanvasHeader cv={cv} />
      <LeftToolbar tool={tool} onTool={onTool} drawerKind={drawer.kind} drawerOpen={drawer.open} />
      {drawer.open && <FileDrawer slug={s.world_slug} kind={drawer.kind} setKind={(k) => setDrawer({ open: true, kind: k })} onClose={() => setDrawer((d) => ({ ...d, open: false }))} onAdd={(f) => act.addFile(f)} />}
      <ContextBar sel={sel} items={s.items} vp={vp} actions={actions} noteColors={NOTE_COLORS} />
      <ZoomBar zoom={vp.zoom} onUndo={cv.undo} onRedo={cv.redo} canUndo={cv.canUndo} canRedo={cv.canRedo} onZoom={stage.zoomBy} onFit={() => stage.fit(s.items)} saving={cv.saving} />
      <AddMenu world={s.world_slug} onLyricIds={s.items.filter((i) => i.type === "lyric").map((i) => i.data.lyric_id)}
        onNewLyric={() => act.addLyric()} onOpenLyric={(l) => act.addLyric(l)} onNote={() => act.addNote()} onFrame={() => act.addFrame()} onFiles={() => setDrawer({ open: true, kind: "all" })} onRecord={() => setRecOpen(true)} />
      {expanded && (
        <div className="absolute inset-4 sm:inset-8 z-40 rounded-3xl bg-[#1a1415]/95 backdrop-blur-xl border border-[#4a2a2a] shadow-[0_0_80px_-10px_rgba(255,71,87,0.35)] overflow-hidden" data-testid="lyric-focus-overlay" onPointerDown={(e) => e.stopPropagation()}>
          <LyricEditor lyricId={expanded.data.lyric_id} mode="full" onCollapse={() => setExpanded(null)} />
        </div>
      )}
      <FilePreview slug={s.world_slug} file={preview} onClose={() => setPreview(null)} />
      {lyricShare && <ShareDialog open onOpenChange={(o) => !o && setLyricShare(null)} kind="lyrics" id={lyricShare.id} ownerId={lyricShare.owner_id} sharedWith={lyricShare.shared_with || []} />}
      <button onClick={() => setDropOpen(true)} onPointerDown={(e) => e.stopPropagation()} className="absolute left-4 bottom-5 z-30 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-[#1c1617]/90 backdrop-blur-xl border border-[#4a2a2a] text-white text-sm font-semibold hover:border-[#ff4757] transition-colors" data-testid="canvas-session-drop-button"><CloudUpload className="w-4 h-4 text-[#ff4757]" /> <span className="hidden sm:inline">Session Drop</span></button>
      <SessionDrop open={dropOpen} onOpenChange={setDropOpen} world={s.world_slug} />
      <RecorderPanel open={recOpen} onOpenChange={setRecOpen} world={s.world_slug} />
    </>
  );
}

export default function CanvasPage() {
  const { id } = useParams();
  const cv = useCanvasDoc(id);
  const ready = cv.state && cv.state.id === id;
  return (
    <div className="h-screen bg-[#110d0e] overflow-hidden" data-testid="canvas-page">
      <TopNav dark active="tools" />
      <div className="absolute top-[84px] left-2 right-2 sm:left-6 sm:right-6 bottom-3 sm:bottom-5 rounded-[28px] border border-[#3a2424] bg-[#151112] overflow-hidden shadow-[inset_0_0_120px_rgba(255,71,87,0.06),0_0_50px_-20px_rgba(255,71,87,0.4)]">
        {cv.error ? (
          <div className="h-full grid place-items-center text-white/60 text-sm" data-testid="canvas-error">{cv.error} <Link to="/tools" className="text-[#ff4757] ml-2">Back to tools</Link></div>
        ) : ready ? <Workspace key={id} cv={cv} /> : (
          <div className="h-full grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-[#ff4757]" /></div>
        )}
      </div>
    </div>
  );
}
