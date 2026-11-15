import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft } from "lucide-react";
import { FortuneCookie } from "@/components/FortuneCookie";

const PHRASE = "All is good. Search the Cooked World...";

function useTypewriter(active) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) { return undefined; }
    const done = n >= PHRASE.length;
    const t = setTimeout(() => setN(done ? 0 : n + 1), done ? 3200 : 55 + Math.random() * 60);
    return () => clearTimeout(t);
  }, [n, active]);
  return PHRASE.slice(0, n);
}

export const SearchBar = ({ initial = "", compact = false }) => {
  const [q, setQ] = useState(initial);
  const [focused, setFocused] = useState(false);
  const typed = useTypewriter(!q && !focused);
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form onSubmit={submit} className={`relative flex items-center w-full bg-[#fffaf5]/95 backdrop-blur-md rounded-full border-[2.5px] border-[#2d2422] shadow-[0_18px_50px_-18px_rgba(160,50,20,0.55),inset_0_0_0_6px_#fff] ${compact ? "h-16 pl-4 pr-2" : "h-[76px] sm:h-[88px] pl-4 sm:pl-6 pr-2.5"}`} data-testid="search-form">
      <FortuneCookie className={`cookie-float shrink-0 ${compact ? "w-16" : "w-20 sm:w-28"}`} />
      <span className="mx-3 sm:mx-5 w-[2px] h-10 bg-[#2d2422] rounded-full shrink-0" />
      <div className="relative flex-1 min-w-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Search the Cooked World"
          placeholder={focused ? "Search projects, worlds, files…" : ""}
          className="w-full bg-transparent outline-none font-mono text-base sm:text-xl lg:text-2xl text-[#2d2422] placeholder:text-[#a68b80]"
          data-testid="search-input"
        />
        {!q && !focused && (
          <span className="pointer-events-none absolute inset-0 flex items-center font-mono text-base sm:text-xl lg:text-2xl text-[#2d2422] whitespace-nowrap overflow-hidden" data-testid="search-typewriter">
            {typed}<span className="caret ml-0.5 inline-block w-[2px] h-6 bg-[#e8262f]" />
          </span>
        )}
      </div>
      <button type="submit" className="shrink-0 ml-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ff5a45] to-[#e8262f] text-white font-bold tracking-wide px-4 sm:px-7 h-12 sm:h-14 shadow-[0_10px_24px_-8px_rgba(232,38,47,0.8)] hover:brightness-110 active:scale-95 transition-[filter,transform] duration-150" data-testid="search-enter-button">
        <span className="hidden sm:inline text-lg">ENTER</span>
        <CornerDownLeft className="w-5 h-5" />
      </button>
    </form>
  );
};
