import { Plus, PenLine, StickyNote, Square, FolderOpen, FileText, Mic } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLyrics } from "@/components/WorldLists";

export const AddMenu = ({ world, onNewLyric, onOpenLyric, onNote, onFrame, onFiles, onLyricIds, onRecord }) => {
  const { data: lyrics = [] } = useLyrics(world);
  const available = lyrics.filter((l) => !onLyricIds.includes(l.id));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="absolute right-6 bottom-6 z-30 w-16 h-16 rounded-full bg-[#e0141b] text-white grid place-items-center shadow-[0_0_30px_rgba(224,20,27,0.65)] hover:scale-105 active:scale-95 transition-transform" aria-label="Add" data-testid="canvas-add-button">
          <Plus className="w-8 h-8" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-56" data-testid="canvas-add-menu">
        <DropdownMenuItem onClick={onNewLyric} data-testid="add-new-lyric"><PenLine className="w-4 h-4 mr-2" /> New Lyric Pad</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="add-open-lyric"><FileText className="w-4 h-4 mr-2" /> Open lyric document</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            {!available.length && <DropdownMenuItem disabled>None to add</DropdownMenuItem>}
            {available.map((l) => <DropdownMenuItem key={l.id} onClick={() => onOpenLyric(l)} data-testid={`add-lyric-${l.id}`}>{l.title}</DropdownMenuItem>)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNote} data-testid="add-note"><StickyNote className="w-4 h-4 mr-2" /> Text note</DropdownMenuItem>
        <DropdownMenuItem onClick={onFrame} data-testid="add-frame"><Square className="w-4 h-4 mr-2" /> Frame</DropdownMenuItem>
        <DropdownMenuItem onClick={onFiles} data-testid="add-files"><FolderOpen className="w-4 h-4 mr-2" /> Dropbox files</DropdownMenuItem>
        <DropdownMenuItem onClick={onRecord} data-testid="add-record-audio"><Mic className="w-4 h-4 mr-2" /> Record tab audio</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
