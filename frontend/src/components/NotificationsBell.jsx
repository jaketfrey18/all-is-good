import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

export const useProjects = (category) =>
  useQuery({
    queryKey: ["projects", category || "all"],
    queryFn: async () => (await api.get("/projects", { params: category ? { category } : {} })).data,
  });

export const NotificationsBell = ({ icon, className }) => {
  const { data = [] } = useProjects();
  const recent = [...data].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`${className} relative`} aria-label="Updates" data-testid="nav-bell-button">
          {icon}
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#e8262f] ring-2 ring-[#fff0e6]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 bg-[#fff8f0] border-[#f1d9c9]" data-testid="notifications-popover">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a6a60]">Recently updated</p>
        <ul className="mt-3 space-y-2">
          {recent.map((p) => (
            <li key={p.id}>
              <Link to={`/p/${p.slug}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors" data-testid={`notification-item-${p.slug}`}>
                <img src={p.cover_url} alt="" className="w-10 h-12 object-cover rounded-md" />
                <div>
                  <p className="font-display font-bold leading-tight">{p.title}</p>
                  <p className="text-xs text-[#8a6a60]">{new Date(p.updated_at).toLocaleDateString()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
