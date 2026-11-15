import { CATEGORIES } from "@/lib/api";

export const CategoryRow = ({ active, onSelect }) => (
  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6" data-testid="category-row">
    <span className="hidden sm:block h-[2px] w-14 bg-[#e8262f] rounded-full" />
    {CATEGORIES.map((c, i) => (
      <div key={c} className="flex items-center gap-2 sm:gap-6">
        {i > 0 && <span className="text-[#2d2422] font-semibold">/</span>}
        <button
          onClick={() => onSelect(active === c ? null : c)}
          className={`relative font-semibold uppercase text-[10px] sm:text-base tracking-[0.12em] sm:tracking-[0.3em] transition-colors duration-200 ${active === c ? "text-[#e8262f]" : "text-[#2d2422] hover:text-[#e8262f]"}`}
          data-testid={`category-${c}`}
          aria-pressed={active === c}
        >
          {c}
          {active === c && <span className="absolute -bottom-2 left-0 right-[0.3em] h-[2px] bg-[#e8262f]" />}
        </button>
      </div>
    ))}
    <span className="hidden sm:block h-[2px] w-14 bg-[#e8262f] rounded-full" />
  </div>
);
