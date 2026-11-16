import { Undo2, Redo2, Minus, Plus, Maximize } from "lucide-react";

const b = "w-10 h-10 grid place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors";

export const ZoomBar = ({ zoom, onUndo, onRedo, canUndo, canRedo, onZoom, onFit, saving }) => (
  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 h-14 rounded-full bg-[#1c1617]/90 backdrop-blur-xl border border-[#4a2a2a] shadow-[0_0_30px_-10px_rgba(255,71,87,0.4)]" data-testid="canvas-zoombar" onPointerDown={(e) => e.stopPropagation()}>
    <button className={b} onClick={onUndo} disabled={!canUndo} aria-label="Undo" data-testid="canvas-undo"><Undo2 className="w-5 h-5" /></button>
    <button className={b} onClick={onRedo} disabled={!canRedo} aria-label="Redo" data-testid="canvas-redo"><Redo2 className="w-5 h-5" /></button>
    <span className="w-px h-6 bg-white/15 mx-2" />
    <button className={b} onClick={() => onZoom(1 / 1.2)} aria-label="Zoom out" data-testid="canvas-zoom-out"><Minus className="w-5 h-5" /></button>
    <span className="w-14 text-center text-sm font-semibold text-white tabular-nums" data-testid="canvas-zoom-level">{Math.round(zoom * 100)}%</span>
    <button className={b} onClick={() => onZoom(1.2)} aria-label="Zoom in" data-testid="canvas-zoom-in"><Plus className="w-5 h-5" /></button>
    <span className="w-px h-6 bg-white/15 mx-2" />
    <button className={b} onClick={onFit} aria-label="Fit to content" data-testid="canvas-fit"><Maximize className="w-5 h-5" /></button>
    <span className={`ml-1 w-2 h-2 rounded-full ${saving === "saved" ? "bg-emerald-400" : saving === "error" ? "bg-[#ff4757]" : "bg-amber-400"}`} title={`Layout ${saving}`} data-testid={`canvas-save-${saving}`} />
  </div>
);
