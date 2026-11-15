import { Nav } from "@/components/Nav";

export const PageShell = ({ eyebrow, title, children, testid }) => (
  <div className="min-h-screen bg-[#fff8f0] relative" data-testid={testid}>
    <div className="pointer-events-none absolute -top-40 right-[-10%] w-[620px] h-[620px] rounded-full bg-[#ff5a3c] opacity-[0.12] blur-3xl" />
    <div className="sticky top-0 z-30"><Nav tone="solid" /></div>
    <main className="relative max-w-[1320px] mx-auto px-5 sm:px-10 pt-14 pb-24">
      {eyebrow && <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#e8262f] rise">{eyebrow}</p>}
      {title && <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl mt-3 text-[#2d2422] rise" style={{ animationDelay: "0.08s" }}>{title}</h1>}
      <div className="rise" style={{ animationDelay: "0.16s" }}>{children}</div>
    </main>
  </div>
);
