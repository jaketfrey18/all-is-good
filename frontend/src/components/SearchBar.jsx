import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";

export const SearchBar = ({ initial = "", dark = false, onSearch }) => {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(q.trim());
    else navigate(q.trim() ? `/media?q=${encodeURIComponent(q.trim())}` : "/media");
  };
  return (
    <form onSubmit={submit} data-testid="search-form"
      className={`relative flex items-center w-full h-[64px] sm:h-[84px] pl-5 sm:pl-8 pr-2.5 rounded-full backdrop-blur-md border transition-shadow duration-300 focus-within:shadow-[0_0_0_4px_rgba(255,71,87,0.25),0_18px_50px_-15px_rgba(224,20,27,0.6)] ${dark ? "bg-white/[0.06] border-white/15" : "bg-white/25 border-white/70 shadow-[0_12px_44px_-14px_rgba(224,20,27,0.45),inset_0_1px_0_rgba(255,255,255,0.85)]"}`}>
      <Search className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 ${dark ? "text-white/70" : "text-[#1d1414]/80"}`} strokeWidth={1.8} />
      <span className={`mx-4 sm:mx-5 w-[2px] h-8 rounded-full shrink-0 ${dark ? "bg-white/40" : "bg-[#1d1414]/60"}`} />
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the Cooked World" data-testid="search-input"
        placeholder="worlds, files, types, folders"
        className={`flex-1 min-w-0 bg-transparent outline-none text-base sm:text-xl font-medium ${dark ? "text-white placeholder:text-white/30" : "text-[#1d1414] placeholder:text-[#1d1414]/60"}`} />
      <button type="submit" data-testid="search-enter-button"
        className="shrink-0 ml-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ff2e2e] to-[#d40d12] text-white font-extrabold tracking-wide px-4 sm:px-7 h-11 sm:h-14 shadow-[0_10px_24px_-8px_rgba(224,20,27,0.9)] hover:brightness-110 active:scale-95 transition-[filter,transform] duration-150">
        <span className="hidden sm:inline text-lg">ENTER</span><CornerDownLeft className="w-5 h-5" />
      </button>
    </form>
  );
};
