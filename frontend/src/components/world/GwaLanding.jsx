import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Frame, FileText, Clapperboard, CloudUpload, Folder, AudioLines, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { WorldTools } from "@/components/WorldTools";
import { useAuth } from "@/context/AuthContext";
import { useCanvases, useLyrics, useClipProjects, createCanvas } from "@/components/WorldLists";
import { SessionDrop, sessionSub } from "@/components/sessions/SessionDrop";
import { useSessions } from "@/components/sessions/sessionApi";
import { api, errText } from "@/lib/api";

const Tile = ({ Icon, label, onClick, primary, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`flex flex-col items-center justify-center gap-2 h-24 sm:h-28 rounded-2xl border backdrop-blur-md font-semibold text-sm sm:text-base transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 ${primary
      ? "bg-[#e0141b]/90 border-[#ff6b6b] shadow-[0_0_35px_rgba(224,20,27,0.55)]"
      : "bg-[#2a1413]/75 border-[#8a3a33]/70 hover:bg-[#3a1715]/85 hover:shadow-[0_0_30px_-6px_rgba(255,71,87,0.55)]"}`}>
    <Icon className="w-7 h-7" strokeWidth={1.6} /> {label}
  </button>
);

const RecentSessions = ({ list, onOpen, onAll }) => (
  <section data-testid="gwa-recent-sessions">
    <div className="flex items-end justify-between mb-4">
      <h2 className="font-display text-lg md:text-xl font-bold">Recent Sessions</h2>
      <button onClick={onAll} className="inline-flex items-center gap-1.5 text-sm text-white/75 hover:text-white" data-testid="gwa-view-all-sessions">View All Sessions <ArrowRight className="w-4 h-4" /></button>
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      {list.slice(0, 3).map((s) => (
        <button key={s.id} onClick={() => onOpen(s.id)} className="flex items-center gap-4 rounded-2xl border border-[#6a2a26] bg-[#1e1212]/80 p-4 text-left hover:border-[#ff4757] transition-colors" data-testid={`gwa-session-card-${s.id}`}>
          <span className="w-12 h-12 rounded-xl bg-[#e0141b]/15 text-[#ff4757] grid place-items-center shrink-0"><AudioLines className="w-6 h-6" /></span>
          <span className="min-w-0"><span className="block font-semibold truncate">{s.name} – {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span className="block text-sm text-white/55 truncate">{sessionSub(s)}</span></span>
        </button>
      ))}
      {!list.length && <p className="text-sm text-white/45 md:col-span-3" data-testid="gwa-no-sessions">No sessions yet. Use Session Drop to start one.</p>}
    </div>
  </section>
);

export const GwaLanding = ({ p, files }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const slug = p.slug;
  const canvases = useCanvases(slug);
  const lyrics = useLyrics(slug);
  const clipsQ = useClipProjects(slug);
  const sessions = useSessions(slug, !!user);
  const [drop, setDrop] = useState({ open: false, sid: null });
  const guard = (fn) => async () => {
    if (!user) return navigate("/login");
    try { await fn(); } catch (e) { toast.error(errText(e)); }
  };
  const openCanvas = guard(async () => navigate(`/canvas/${canvases.data?.[0]?.id || (await createCanvas(slug)).id}`));
  const openLyric = guard(async () => navigate(`/lyrics/${lyrics.data?.[0]?.id || (await api.post("/lyrics", { world_slug: slug, title: "Untitled lyrics" })).data.id}`));
  const openClip = guard(async () => navigate(clipsQ.data?.[0] ? `/studio/${clipsQ.data[0].id}` : `/media?kind=video&world=${slug}`));
  const openDrop = guard(async () => setDrop({ open: true, sid: null }));
  const toFiles = () => document.getElementById("gwa-files")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[#120c0c] text-[#fff4ec]" data-testid="gwa-landing">
      <div className="sticky top-0 z-30 bg-[#120c0c]/85 backdrop-blur-xl border-b border-[#3a2020]"><TopNav dark active="worlds" /></div>
      <main className="max-w-[1500px] mx-auto px-3 sm:px-6 pt-4 pb-24 space-y-10">
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs text-white/60 hover:text-[#ff4757]" data-testid="workspace-back-link"><ArrowLeft className="w-4 h-4" /> back to the cooked world</Link>
        <section className="relative rounded-[28px] overflow-hidden border border-[#4a2422] shadow-[0_0_80px_-25px_rgba(224,20,27,0.6)]" data-testid="gwa-hero">
          <img src="/gwa-studio.jpg" alt="GWA — The Studio" className="w-full aspect-[16/9] md:aspect-[1672/620] object-cover object-[20%_top] md:object-top" data-testid="gwa-hero-image" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#120c0c] via-[#120c0c]/60 to-transparent pointer-events-none" />
          <h1 className="sr-only" data-testid="workspace-title">{p.title} — The Studio</h1>
          <div className="relative md:absolute md:inset-x-0 md:bottom-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 px-4 md:px-[12%] py-4 md:py-0 bg-[#120c0c] md:bg-transparent" data-testid="gwa-actions">
            <Tile Icon={Frame} label="Open Canvas" onClick={openCanvas} primary testid="gwa-open-canvas" />
            <Tile Icon={FileText} label="Lyric Pad" onClick={openLyric} testid="gwa-lyric-pad" />
            <Tile Icon={Clapperboard} label="Clip Studio" onClick={openClip} testid="gwa-clip-studio" />
            <Tile Icon={CloudUpload} label="Session Drop" onClick={openDrop} testid="gwa-session-drop" />
            <Tile Icon={Folder} label="Files & Media" onClick={toFiles} testid="gwa-files-media" />
          </div>
        </section>
        <div className="px-1 sm:px-4 space-y-12">
          {user && <RecentSessions list={sessions.data || []} onOpen={(sid) => setDrop({ open: true, sid })} onAll={() => setDrop({ open: true, sid: null })} />}
          {user && <WorldTools slug={slug} />}
          <section id="gwa-files" className="rounded-[28px] bg-[#fff8f0] text-[#2d2422] p-5 sm:p-8 scroll-mt-24" data-testid="gwa-files-section">
            <h2 className="font-display text-lg font-bold uppercase tracking-[0.2em] mb-6">Files & Media</h2>
            {files}
          </section>
        </div>
      </main>
      {user && <SessionDrop open={drop.open} onOpenChange={(o) => setDrop((d) => ({ ...d, open: o }))} world={slug} sessionId={drop.sid} />}
    </div>
  );
};
