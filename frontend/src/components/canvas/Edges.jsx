const center = (i) => [i.x + i.w / 2, i.y + i.h / 2];

export const Edges = ({ items, edges, selectedEdge, onSelect }) => {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  return (
    <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width="1" height="1" style={{ zIndex: 0 }} data-testid="canvas-edges">
      {edges.map((e) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        const [x1, y1] = center(a), [x2, y2] = center(b);
        const mx = (x1 + x2) / 2;
        const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        const sel = selectedEdge === e.id;
        return (
          <g key={e.id}>
            <path d={d} stroke="transparent" strokeWidth="16" fill="none" className="pointer-events-auto cursor-pointer" onPointerDown={(ev) => { ev.stopPropagation(); onSelect(e.id); }} data-testid="canvas-edge" />
            <path d={d} stroke={sel ? "#ff4757" : "rgba(255,107,90,0.55)"} strokeWidth={sel ? 3 : 2} fill="none" strokeDasharray={sel ? "0" : "6 6"} />
          </g>
        );
      })}
    </svg>
  );
};
