import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, Bell, HelpCircle, UserCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/NotificationsBell";
import { HelpDialog } from "@/components/HelpDialog";

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/archive", label: "Archive" },
  { to: "/studio", label: "Studio" },
  { to: "/contact", label: "Contact" },
];

const iconBtn = "p-2 rounded-full text-[#2d2422] hover:bg-white/60 transition-colors duration-200";

function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className={iconBtn} aria-label="Open menu" data-testid="nav-menu-button"><Menu className="w-7 h-7" strokeWidth={1.6} /></button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-[#fff8f0] w-80">
        <SheetTitle className="font-display text-3xl font-extrabold tracking-tight text-[#e8262f]">all is good.</SheetTitle>
        <p className="font-mono text-xs mt-1 text-[#8a6a60]">the cooked world</p>
        <nav className="mt-10 flex flex-col gap-5">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="font-display text-2xl font-bold hover:text-[#e8262f] transition-colors" data-testid={`menu-link-${n.label.toLowerCase()}`}>{n.label}</Link>
          ))}
          <Link to="/admin" className="font-mono text-sm mt-6 text-[#8a6a60] hover:text-[#e8262f]" data-testid="menu-link-admin">Admin →</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export const Nav = ({ tone = "light" }) => {
  const navigate = useNavigate();
  return (
    <header className={`relative z-30 flex items-center justify-between px-5 sm:px-10 py-5 ${tone === "solid" ? "bg-[#fff8f0]/85 backdrop-blur-xl border-b border-[#f1d9c9]" : ""}`} data-testid="site-nav">
      <MobileMenu />
      <nav className="hidden md:flex items-center gap-10 lg:gap-14 text-[17px] font-medium">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-link ${isActive ? "active font-bold" : "text-[#3b2d29] hover:text-[#e8262f]"}`} data-testid={`nav-link-${n.label.toLowerCase()}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-1 sm:gap-3">
        <button className={iconBtn} onClick={() => navigate("/search")} aria-label="Search" data-testid="nav-search-button"><Search className="w-6 h-6" strokeWidth={1.7} /></button>
        <NotificationsBell icon={<Bell className="w-6 h-6" strokeWidth={1.7} />} className={iconBtn} />
        <HelpDialog icon={<HelpCircle className="w-6 h-6" strokeWidth={1.7} />} className={`${iconBtn} hidden sm:inline-flex`} />
        <button className={iconBtn} onClick={() => navigate("/admin")} aria-label="Admin" data-testid="nav-profile-button"><UserCircle2 className="w-7 h-7" strokeWidth={1.6} /></button>
      </div>
    </header>
  );
};
