export const FortuneCookie = ({ className = "" }) => (
  <svg viewBox="0 0 140 90" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="fc-dough" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f9d58a" />
        <stop offset="0.55" stopColor="#e9a94a" />
        <stop offset="1" stopColor="#b8701f" />
      </linearGradient>
    </defs>
    <path d="M10 58 C 8 30, 40 12, 62 30 C 70 18, 96 22, 92 48 C 90 70, 60 84, 36 80 C 20 78, 11 70, 10 58 Z" fill="url(#fc-dough)" stroke="#9a5a18" strokeWidth="1.5" />
    <path d="M30 60 C 40 44, 56 40, 66 46" fill="none" stroke="#a8641c" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <g transform="rotate(-24 95 40)">
      <rect x="56" y="30" width="78" height="20" rx="2" fill="#fffdf8" stroke="#e7d7c8" />
      <text x="95" y="44" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="11" fill="#e8262f">all is good.</text>
    </g>
  </svg>
);
