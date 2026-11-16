import { motion } from "framer-motion";

const INK = "#1d1414";
const RED = "#e8141b";

export const Sun = () => (
  <g>
    <defs>
      <radialGradient id="sun-g" cx="50%" cy="40%" r="60%">
        <stop offset="0" stopColor="#ff3b22" />
        <stop offset="1" stopColor="#e30f0c" />
      </radialGradient>
      <radialGradient id="sun-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0.6" stopColor="#ff4a3a" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ff4a3a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="800" cy="500" r="470" fill="url(#sun-halo)" />
    <motion.circle cx="800" cy="500" r="370" fill="url(#sun-g)" animate={{ r: [370, 376, 370] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
  </g>
);

const CLOUD = "M0 40 C-6 14 28 2 46 16 C58 -14 112 -12 122 14 C142 0 178 10 172 36 C194 40 190 64 166 64 L12 64 C-12 64 -16 44 0 40 Z";

const Cloud = ({ id, x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <defs><clipPath id={id}><path d={CLOUD} /></clipPath></defs>
    <path d={CLOUD} fill="#fff7f4" />
    <g clipPath={`url(#${id})`} stroke={RED} strokeWidth="1.6" opacity="0.8">
      {Array.from({ length: 22 }).map((_, i) => <line key={i} x1={-20 + i * 10} y1="66" x2={10 + i * 10} y2="34" />)}
    </g>
    <path d={CLOUD} fill="none" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
  </g>
);

export const Clouds = () => (
  <motion.g animate={{ x: [0, 18, 0] }} transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}>
    <Cloud id="cl1" x={20} y={210} s={1.3} />
    <Cloud id="cl2" x={1240} y={130} s={1.5} />
  </motion.g>
);

const FROND = "M0 0 C 28 -26 62 -24 86 -6 C 60 -14 30 -10 0 0 Z";

const Palm = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={INK}>
    <path d="M-3 0 C -6 -70 2 -140 -2 -200 L 4 -200 C 8 -140 2 -70 5 0 Z" />
    {[-160, -130, -100, -70, -40, -10, 20].map((a) => <path key={a} d={FROND} transform={`translate(1 -200) rotate(${a})`} />)}
  </g>
);

const TOWERS = [[1290, 60, 34], [1326, 95, 30], [1360, 150, 40], [1404, 200, 34], [1442, 290, 38], [1484, 230, 30], [1518, 170, 36], [1558, 120, 32], [1594, 80, 30]];

export const Skyline = () => (
  <g>
    {TOWERS.map(([x, h, w], i) => (
      <g key={i}>
        <rect x={x} y={470 - h} width={w} height={h} fill="#fffaf8" stroke={INK} strokeWidth="1.8" />
        {Array.from({ length: Math.floor(h / 14) }).map((_, j) => (
          <line key={j} x1={x + 5} x2={x + w - 5} y1={470 - h + 8 + j * 14} y2={470 - h + 8 + j * 14} stroke={INK} strokeWidth="0.9" opacity="0.7" />
        ))}
      </g>
    ))}
    <line x1="1461" y1="180" x2="1461" y2="152" stroke={INK} strokeWidth="2" />
    <Palm x={1610} y={470} s={1.15} />
    <Palm x={240} y={470} s={0.85} />
  </g>
);

function buildMesh() {
  const rows = 14, cols = 60, W = 1760;
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    const t = r / (rows - 1);
    const base = 470 + Math.pow(t, 1.4) * 230;
    const row = [];
    for (let c = 0; c <= cols; c += 1) {
      const x = -80 + c * (W / cols);
      const edge = Math.pow(Math.min(1, Math.abs(x - 800) / 700), 1.6);
      const hill = Math.max(0, Math.sin(x / 130 + r * 0.45) * 0.55 + Math.sin(x / 260 - r * 0.2) * 0.45);
      row.push([x, base - (60 + t * 70) * hill * edge - 40 * edge * (1 - t)]);
    }
    grid.push(row);
  }
  const line = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  return { rows: grid.map(line), cols: grid[0].map((_, c) => line(grid.map((row) => row[c]))), top: line(grid[0]) };
}

const MESH = buildMesh();

export const Mesh = () => (
  <g>
    <path d={`${MESH.top} L1680,900 L-80,900 Z`} fill="#fff3ef" />
    <g fill="none" stroke="#ff2d24" strokeWidth="1" opacity="0.55">
      {MESH.rows.map((d, i) => <path key={`r${i}`} d={d} />)}
      {MESH.cols.map((d, i) => <path key={`c${i}`} d={d} opacity="0.7" />)}
    </g>
  </g>
);

export const Floor = () => (
  <g>
    <defs>
      <linearGradient id="floor-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f9d6ce" />
        <stop offset="1" stopColor="#e9877a" />
      </linearGradient>
      <clipPath id="floor-clip"><rect x="-80" y="700" width="1760" height="260" /></clipPath>
    </defs>
    <rect x="-80" y="700" width="1760" height="260" fill="url(#floor-g)" />
    <g clipPath="url(#floor-clip)" stroke="#ff2d24" strokeWidth="1.2" opacity="0.4">
      {Array.from({ length: 31 }).map((_, i) => <line key={i} x1="800" y1="600" x2={-1000 + i * 120} y2="960" />)}
      {[712, 732, 758, 790, 830, 880].map((y) => <line key={y} x1="-80" x2="1680" y1={y} y2={y} />)}
    </g>
  </g>
);

const Flower = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-14" rx="10" ry="15" fill={RED} transform={`rotate(${a})`} />)}
    <circle r="5" fill="#ffb02e" />
  </g>
);

const Leaf = ({ x, y, r, s = 1 }) => (
  <path d="M0 0 C 30 -22 90 -22 130 0 C 90 14 30 14 0 0 Z" fill="#1a1212" transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity="0.92" />
);

export const Flowers = () => (
  <g>
    <Leaf x={-20} y={880} r={-35} s={1.4} /><Leaf x={10} y={930} r={-10} s={1.2} /><Leaf x={-40} y={800} r={-60} s={1.2} />
    <Leaf x={1620} y={880} r={-145} s={1.4} /><Leaf x={1590} y={930} r={-170} s={1.2} /><Leaf x={1640} y={800} r={-120} s={1.2} />
    <Flower x={70} y={860} s={1.2} /><Flower x={150} y={900} s={0.9} />
    <Flower x={1530} y={860} s={1.2} /><Flower x={1450} y={905} s={0.9} />
  </g>
);

export const Swoosh = () => null;
