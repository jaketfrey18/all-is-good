import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useProjects } from "@/components/NotificationsBell";

export default function ArchivePage() {
  const { data = [] } = useProjects();
  const rows = [...data].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <PageShell eyebrow="Archive" title="Every dish, in order of cooking." testid="archive-page">
      <ul className="mt-12 border-t-2 border-[#2d2422]" data-testid="archive-list">
        {rows.map((p, i) => (
          <li key={p.id}>
            <Link to={`/p/${p.slug}`} className="group grid grid-cols-[48px_1fr_auto] sm:grid-cols-[64px_88px_1fr_160px_140px_32px] items-center gap-4 sm:gap-6 py-5 border-b border-[#ecd3c4] hover:bg-white/70 transition-colors duration-200 px-2" data-testid={`archive-row-${p.slug}`}>
              <span className="font-mono text-sm text-[#e8262f]">{String(i + 1).padStart(2, "0")}</span>
              <img src={p.cover_url} alt="" className="hidden sm:block w-16 h-20 object-cover rounded-lg" />
              <div>
                <p className="font-display text-xl sm:text-3xl font-extrabold tracking-tight group-hover:text-[#e8262f] transition-colors">{p.title}</p>
                {p.subtitle && <p className="text-sm text-[#7a5f56]">{p.subtitle}</p>}
              </div>
              <span className="hidden sm:block font-mono text-xs uppercase tracking-[0.2em] text-[#7a5f56]">{p.category}</span>
              <span className="hidden sm:block font-mono text-xs text-[#7a5f56]">{new Date(p.created_at).toLocaleDateString()}</span>
              <ArrowUpRight className="w-5 h-5 text-[#2d2422] group-hover:text-[#e8262f] transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
