import { Link, useLocation, useNavigate } from "react-router-dom";
import { Layers, PlaySquare, Wrench, Search, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export const Logo = ({ className = "h-10" }) => (
  <img src="/logo-all-is-good.png" alt="All is good" className={`${className} w-auto select-none`} draggable={false} data-testid="brand-logo" />
);

const PILLS = [
  { key: "worlds", to: "/", label: "Worlds", Icon: Layers },
  { key: "media", to: "/media", label: "Media", Icon: PlaySquare },
  { key: "tools", to: "/tools", label: "Tools", Icon: Wrench },
];

function AccountMenu({ dark }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const ring = dark ? "border-white/80 text-white hover:bg-white/10" : "border-[#1d1414] text-[#1d1414] hover:bg-white/60";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`w-11 h-11 rounded-full border-2 grid place-items-center transition-colors ${ring}`} aria-label="Account" data-testid="account-menu-button"><UserRound className="w-5 h-5" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" data-testid="account-menu">
        {user ? (
          <>
            <DropdownMenuLabel><p className="font-bold">{user.name}</p><p className="text-xs font-normal opacity-60">{user.email}</p></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/tools")} data-testid="account-menu-tools">My canvases & lyrics</DropdownMenuItem>
            {user.role === "admin" && <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="account-menu-admin">Admin</DropdownMenuItem>}
            <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="account-menu-signout">Sign out</DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => navigate(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)} data-testid="account-menu-signin">Sign in</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const TopNav = ({ dark = false, active }) => {
  const navigate = useNavigate();
  const ink = dark ? "border-white/80 text-white hover:bg-white/10" : "border-[#1d1414] text-[#1d1414] bg-white/30 hover:bg-white/70";
  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-4 sm:px-10 h-[76px]" data-testid="top-nav">
      <Link to="/" className="flex items-center gap-4 shrink-0" data-testid="nav-home-logo">
        <Logo className={dark ? "h-11" : "h-9 sm:h-10"} />
        <span className="hidden sm:block w-[2px] h-9 bg-[#e0141b]" />
        {dark && <span className="hidden lg:block font-display text-2xl font-bold text-white tracking-tight">cooked world.</span>}
      </Link>
      <nav className="flex items-center gap-2 sm:gap-5">
        {PILLS.map(({ key, to, label, Icon }) => (
          <Link key={key} to={to} data-testid={`nav-pill-${key}`}
            className={`inline-flex items-center gap-2 h-10 sm:h-11 px-3 sm:px-6 rounded-full border-2 font-bold text-sm sm:text-base transition-colors duration-200 ${active === key ? "bg-[#e0141b] border-[#e0141b] text-white shadow-[0_6px_20px_-6px_rgba(224,20,27,0.8)]" : ink}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button onClick={() => navigate("/media")} aria-label="Search" data-testid="nav-search-button"
          className={`hidden sm:grid w-11 h-11 rounded-full border-2 place-items-center transition-colors ${dark ? "border-white/80 text-white hover:bg-white/10" : "border-[#1d1414] text-[#1d1414] hover:bg-white/60"}`}>
          <Search className="w-5 h-5" />
        </button>
        <AccountMenu dark={dark} />
      </div>
    </header>
  );
};
