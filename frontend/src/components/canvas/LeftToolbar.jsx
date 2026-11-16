import { MousePointer2, Hand, Square, Type, Image, PlaySquare, Music, Link2 } from "lucide-react";

export const TOOLS = [
  ["select", MousePointer2, "Select (V)"], ["hand", Hand, "Pan (H)"], ["frame", Square, "Frame (F)"], ["text", Type, "Text note (T)"],
  ["image", Image, "Images"], ["video", PlaySquare, "Video"], ["audio", Music, "Audio"], ["link", Link2, "Connect (L)"],
];

export const LeftToolbar = ({ tool, onTool, drawerKind, drawerOpen }) => (
  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 p-1.5 rounded-full bg-[#1c1617]/90 backdrop-blur-xl border border-[#4a2a2a] shadow-[0_0_30px_-8px_rgba(255,71,87,0.35)]" data-testid="canvas-toolbar" onPointerDown={(e) => e.stopPropagation()}>
    {TOOLS.map(([key, Icon, label]) => {
      const on = tool === key || (drawerOpen && drawerKind === key);
      return (
        <button key={key} onClick={() => onTool(key)} title={label} aria-label={label} data-testid={`tool-${key}`}
          className={`w-11 h-11 rounded-full grid place-items-center transition-colors duration-150 ${on ? "bg-[#e0141b] text-white shadow-[0_0_18px_rgba(224,20,27,0.6)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
          <Icon className="w-5 h-5" />
        </button>
      );
    })}
  </div>
);
