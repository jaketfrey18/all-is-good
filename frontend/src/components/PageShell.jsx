import { TopNav } from "@/components/TopNav";

export const PageShell = ({ title, children, testid, active, dark = false }) => (
  <div className={`min-h-screen relative overflow-x-clip ${dark ? "bg-[#141011] text-[#f5ece6]" : "bg-[#fff6f2] text-[#1d1414]"}`} data-testid={testid}>
    <div className={`sticky top-0 z-30 backdrop-blur-xl ${dark ? "bg-[#141011]/85 border-b border-white/5" : "bg-[#fff6f2]/85 border-b border-[#f1d6cc]"}`}><TopNav dark={dark} active={active} /></div>
    <main className="relative max-w-[1320px] mx-auto px-5 sm:px-10 pt-10 pb-24">
      {title && <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl rise">{title}</h1>}
      <div className="rise" style={{ animationDelay: "0.1s" }}>{children}</div>
    </main>
  </div>
);
