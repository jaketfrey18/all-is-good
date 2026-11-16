import { useState } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { errText } from "@/lib/api";

export const TagEditor = ({ tags = [], onSave, testid = "tag-editor" }) => {
  const [list, setList] = useState(tags);
  const [draft, setDraft] = useState("");
  const commit = async (next) => {
    const prev = list;
    setList(next);
    try { await onSave(next); } catch (e) { setList(prev); toast.error(errText(e)); }
  };
  const add = (e) => {
    e.preventDefault();
    const t = draft.trim().toLowerCase().replace(/^#/, "");
    if (t && !list.includes(t)) commit([...list, t]);
    setDraft("");
  };
  return (
    <form onSubmit={add} className="flex flex-wrap items-center gap-1.5" data-testid={testid}>
      {list.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-[#ff4757]/15 text-[#ff8a94] text-xs font-semibold" data-testid={`${testid}-tag-${t}`}>
          #{t}<button type="button" onClick={() => commit(list.filter((x) => x !== t))} className="w-5 h-5 grid place-items-center rounded-full hover:bg-white/10" aria-label={`Remove ${t}`}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <span className="inline-flex items-center h-7 rounded-full border border-white/15 pl-2.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder="add tag" className="bg-transparent outline-none text-xs w-20" data-testid={`${testid}-input`} />
        <button className="w-7 h-7 grid place-items-center" aria-label="Add tag" data-testid={`${testid}-add`}><Plus className="w-3.5 h-3.5" /></button>
      </span>
    </form>
  );
};
