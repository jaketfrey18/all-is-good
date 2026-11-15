import { PageShell } from "@/components/PageShell";

const PILLARS = [
  ["Projects", "[Describe the kind of projects the studio makes]"],
  ["Worlds", "[Describe the universes and IP the studio builds]"],
  ["Media", "[Describe the shows, films and media formats]"],
  ["Presentations", "[Describe the decks and pitches the studio creates]"],
];

export default function StudioPage() {
  return (
    <PageShell eyebrow="Studio" title="A kitchen for stories." testid="studio-page">
      <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#5b4741]" data-testid="studio-intro">
        [Add your studio story here — who you are, what you cook up and why all is good.]
      </p>
      <div className="grid sm:grid-cols-2 gap-5 mt-14">
        {PILLARS.map(([t, d], i) => (
          <div key={t} className="rounded-[22px] border border-[#ecd3c4] bg-white/70 p-8 hover:-translate-y-1 transition-transform duration-300" data-testid={`studio-pillar-${t.toLowerCase()}`}>
            <p className="font-mono text-xs text-[#e8262f]">0{i + 1}</p>
            <p className="font-display text-3xl font-extrabold mt-2">{t}</p>
            <p className="mt-3 text-[#5b4741]">{d}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
