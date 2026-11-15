import { useSearchParams, Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { useProjects } from "@/components/NotificationsBell";
import { CATEGORIES } from "@/lib/api";

const SPANS = ["md:col-span-7 md:row-span-2", "md:col-span-5", "md:col-span-5", "md:col-span-4", "md:col-span-4", "md:col-span-4"];

const Chip = ({ label, active, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-[0.18em] border transition-colors duration-200 ${active ? "bg-[#2d2422] text-[#fff8f0] border-[#2d2422]" : "border-[#e6cbbb] text-[#3a2a26] hover:border-[#e8262f] hover:text-[#e8262f]"}`}>
    {label}
  </button>
);

export const ProjectTile = ({ p, className = "" }) => (
  <Link to={`/p/${p.slug}`} className={`group relative overflow-hidden rounded-[22px] bg-[#2d2422] min-h-[300px] ${className}`} data-testid={`project-tile-${p.slug}`}>
    <img src={p.cover_url} alt={p.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
    <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/75 to-transparent">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffb59a]">{p.category}</p>
      <p className="font-display text-2xl font-extrabold text-white">{p.title}</p>
      {p.subtitle && <p className="text-sm text-white/80">{p.subtitle}</p>}
    </div>
  </Link>
);

export default function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const cat = params.get("category");
  const { data = [], isLoading } = useProjects(cat);
  const pick = (c) => setParams(c ? { category: c } : {});

  return (
    <PageShell eyebrow="The Cooked World" title="Projects, worlds & everything in between." testid="projects-page">
      <div className="flex flex-wrap gap-3 mt-10" data-testid="projects-filter">
        <Chip label="All" active={!cat} onClick={() => pick(null)} testid="filter-all" />
        {CATEGORIES.map((c) => <Chip key={c} label={c} active={cat === c} onClick={() => pick(c)} testid={`filter-${c}`} />)}
      </div>
      {isLoading ? <p className="mt-12 font-mono text-sm">cooking…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-[300px] gap-5 mt-10" data-testid="projects-grid">
          {data.map((p, i) => <ProjectTile key={p.id} p={p} className={SPANS[i % SPANS.length]} />)}
          {!data.length && <p className="font-display text-2xl font-bold" data-testid="projects-empty">Nothing here yet.</p>}
        </div>
      )}
    </PageShell>
  );
}
