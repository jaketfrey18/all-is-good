import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

const TIPS = [
  ["Search", "Type anything in the fortune-cookie bar — project names and files inside every project's Dropbox folder."],
  ["Browse", "Use the carousel arrows, dots or swipe. Tap the glowing card to open its workspace."],
  ["Filter", "Tap PROJECTS / WORLDS / MEDIA / PRESENTATIONS to narrow the carousel. Tap again to clear."],
  ["Workspaces", "Each project opens into its own file room — folders, previews, videos and decks straight from Dropbox."],
];

export const HelpDialog = ({ icon, className }) => (
  <Dialog>
    <DialogTrigger asChild>
      <button className={className} aria-label="Help" data-testid="nav-help-button">{icon}</button>
    </DialogTrigger>
    <DialogContent className="bg-[#fff8f0] border-[#f1d9c9] max-w-lg" data-testid="help-dialog">
      <DialogTitle className="font-display text-3xl font-extrabold tracking-tight">How the Cooked World works</DialogTitle>
      <DialogDescription className="text-[#8a6a60]">All is good. Here's the short tour.</DialogDescription>
      <ol className="mt-4 space-y-4">
        {TIPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="font-mono text-[#e8262f] text-sm pt-0.5">0{i + 1}</span>
            <div><p className="font-display font-bold text-lg">{t}</p><p className="text-sm text-[#5b4741]">{d}</p></div>
          </li>
        ))}
      </ol>
    </DialogContent>
  </Dialog>
);
