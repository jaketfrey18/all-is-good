import { motion } from "framer-motion";

export const Sun = () => (
  <g>
    <defs>
      <radialGradient id="sun-g" cx="50%" cy="35%" r="65%">
        <stop offset="0" stopColor="#ff7a4d" />
        <stop offset="0.7" stopColor="#f24a2c" />
        <stop offset="1" stopColor="#e5432c" />
      </radialGradient>
      <radialGradient id="sun-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0.55" stopColor="#ff8a5c" stopOpacity="0.35" />
        <stop offset="1" stopColor="#ff8a5c" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="800" cy="380" r="420" fill="url(#sun-halo)" />
    <motion.circle cx="800" cy="380" r="300" fill="url(#sun-g)" animate={{ r: [300, 306, 300] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
  </g>
);

const Cloud = ({ x, y, s = 1, o = 0.9 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <ellipse cx="0" cy="0" rx="120" ry="34" fill="#f39a86" />
    <ellipse cx="-50" cy="-22" rx="60" ry="40" fill="#f6ad97" />
    <ellipse cx="30" cy="-38" rx="70" ry="50" fill="#f8bba6" />
    <ellipse cx="95" cy="-14" rx="55" ry="34" fill="#f4a38f" />
    <ellipse cx="10" cy="8" rx="140" ry="18" fill="#ee8f7c" opacity="0.7" />
  </g>
);

export const Clouds = () => (
  <motion.g animate={{ x: [0, 25, 0] }} transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}>
    <Cloud x={1090} y={190} s={1.25} />
    <Cloud x={1330} y={260} s={0.85} o={0.8} />
    <Cloud x={960} y={300} s={0.7} o={0.75} />
    <Cloud x={1520} y={180} s={0.9} o={0.7} />
    <Cloud x={150} y={250} s={0.8} o={0.55} />
    <Cloud x={420} y={330} s={0.6} o={0.5} />
  </motion.g>
);

export const Swoosh = () => (
  <g fill="none" strokeLinecap="round">
    <path d="M-60 470 C 120 260, 280 120, 560 -40" stroke="#e8352a" strokeWidth="34" opacity="0.75" />
    <path d="M-40 420 C 160 230, 330 110, 600 -30" stroke="#f04a35" strokeWidth="12" opacity="0.6" />
    <path d="M-80 520 C 90 330, 250 200, 470 40" stroke="#e8352a" strokeWidth="6" opacity="0.5" />
    <path d="M10 380 C 200 200, 350 90, 640 -20" stroke="#ff6b4a" strokeWidth="3" opacity="0.5" />
    <path d="M-30 560 C 140 360, 300 260, 520 120" stroke="#e8352a" strokeWidth="2" opacity="0.35" />
  </g>
);

const Palm = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#5b3a34" fill="none" strokeLinecap="round">
    <path d="M0 0 C -4 -60, 6 -120, 2 -170" strokeWidth="4" />
    {[[-50, -150], [-42, -185], [10, -200], [48, -185], [55, -150], [-20, -205], [35, -205]].map(([dx, dy], i) => (
      <path key={i} d={`M2 -170 Q ${dx * 0.5} ${-185 + (dy + 170) * 0.2}, ${dx} ${dy}`} strokeWidth="3.5" />
    ))}
  </g>
);

const BUILDINGS = [[1300, 70, 40], [1345, 110, 34], [1385, 150, 46], [1438, 230, 38], [1480, 300, 30], [1515, 190, 42], [1562, 130, 36], [1600, 90, 40], [1250, 50, 44]];

export const Skyline = () => (
  <g opacity="0.75">
    {BUILDINGS.map(([x, h, w], i) => (
      <rect key={i} x={x} y={500 - h} width={w} height={h} fill={i % 2 ? "#d9a092" : "#cf9284"} />
    ))}
    <rect x="1491" y="170" width="8" height="40" fill="#cf9284" />
    {BUILDINGS.map(([x, h, w], i) => (
      <g key={`w${i}`} fill="#f2c7b8" opacity="0.6">
        {Array.from({ length: Math.floor(h / 22) }).map((_, j) => <rect key={j} x={x + 6} y={500 - h + 10 + j * 22} width={w - 12} height="3" />)}
      </g>
    ))}
    <Palm x={1240} y={500} s={0.9} />
    <Palm x={1420} y={505} s={1.25} />
    <Palm x={1540} y={500} s={1.05} />
    <Palm x={1620} y={505} s={1.4} />
  </g>
);

function buildMesh() {
  const rows = 15, cols = 56, W = 1760;
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    const t = r / (rows - 1);
    const base = 470 + Math.pow(t, 1.5) * 250;
    const amp = 45 + t * 120;
    const row = [];
    for (let c = 0; c <= cols; c += 1) {
      const x = -80 + c * (W / cols);
      const hill = Math.sin(x / 150 + r * 0.55) * 0.6 + Math.sin(x / 70 - r * 0.35) * 0.35;
      const edge = Math.min(1, Math.abs(x - 800) / 650);
      row.push([x, base - amp * Math.max(0, hill) * (0.25 + edge)]);
    }
    grid.push(row);
  }
  const line = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  return { rows: grid.map(line), cols: grid[0].map((_, c) => line(grid.map((row) => row[c]))), top: line(grid[0]) };
}

const MESH = buildMesh();

export const Mesh = () => (
  <g>
    <defs>
      <linearGradient id="dune" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f6c9a8" />
        <stop offset="1" stopColor="#eeb08e" />
      </linearGradient>
    </defs>
    <path d={`${MESH.top} L1680,900 L-80,900 Z`} fill="url(#dune)" />
    <g fill="none" stroke="#e2a24c" strokeWidth="1.1" opacity="0.7">
      {MESH.rows.map((d, i) => <path key={`r${i}`} d={d} />)}
      {MESH.cols.map((d, i) => <path key={`c${i}`} d={d} opacity="0.6" />)}
    </g>
  </g>
);

export const Floor = () => (
  <g>
    <defs>
      <linearGradient id="floor-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9a789" stopOpacity="0" />
        <stop offset="0.25" stopColor="#d98c70" stopOpacity="0.85" />
        <stop offset="1" stopColor="#9a5a4c" />
      </linearGradient>
    </defs>
    <rect x="-80" y="690" width="1760" height="260" fill="url(#floor-g)" />
    {[740, 770, 805, 845].map((y, i) => (
      <rect key={y} x={300 + i * 30} y={y} width={1000 - i * 60} height="2" fill="#ffd9b8" opacity={0.35 - i * 0.06} />
    ))}
  </g>
);

const Flower = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="0" cy="-14" rx="9" ry="15" fill="#ff7a2a" transform={`rotate(${a})`} />
    ))}
    <circle r="6" fill="#ffcf5a" />
  </g>
);

const Leaf = ({ x, y, r, s = 1 }) => (
  <ellipse cx={x} cy={y} rx={70 * s} ry={18 * s} fill="#2f3a24" opacity="0.92" transform={`rotate(${r} ${x} ${y})`} />
);

export const Flowers = () => (
  <g>
    <Leaf x={40} y={820} r={-40} s={1.6} /><Leaf x={120} y={870} r={-15} s={1.3} /><Leaf x={-10} y={760} r={-70} s={1.4} />
    <Leaf x={1560} y={820} r={40} s={1.6} /><Leaf x={1480} y={875} r={15} s={1.3} /><Leaf x={1610} y={760} r={70} s={1.4} />
    <Flower x={70} y={790} s={1.1} /><Flower x={150} y={840} s={0.8} /><Flower x={20} y={870} s={0.9} />
    <Flower x={1530} y={790} s={1.1} /><Flower x={1450} y={845} s={0.85} /><Flower x={1590} y={865} s={0.9} />
  </g>
);
