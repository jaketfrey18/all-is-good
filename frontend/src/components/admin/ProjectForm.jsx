import { useState } from "react";
import { FolderSearch, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderPicker } from "@/components/admin/FolderPicker";
import { CATEGORIES } from "@/lib/api";

const EMPTY = { title: "", subtitle: "", category: "projects", description: "", cover_url: "", dropbox_path: "", order: 0 };

const Field = ({ label, children }) => <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.15em] text-[#7a5f56]">{label}</Label>{children}</div>;

export const ProjectForm = ({ project, onClose, onSave, dropboxConnected }) => {
  const [f, setF] = useState(project ? { ...EMPTY, ...project } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { title, subtitle, category, description, cover_url, dropbox_path, order, slug } = f;
    await onSave({ title, subtitle, category, description, cover_url, dropbox_path, slug, order: Number(order) || 0 });
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#fff8f0] border-[#f1d9c9] max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="project-form-dialog">
        <DialogTitle className="font-display text-3xl font-extrabold">{project ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription>Shows in the carousel, archive and search.</DialogDescription>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-2">
          <Field label="Title"><Input required value={f.title} onChange={set("title")} data-testid="project-form-title-input" /></Field>
          <Field label="Subtitle"><Input value={f.subtitle} onChange={set("subtitle")} data-testid="project-form-subtitle-input" /></Field>
          <Field label="Category">
            <Select value={f.category} onValueChange={set("category")}>
              <SelectTrigger data-testid="project-form-category-select"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} data-testid={`category-option-${c}`}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Carousel order"><Input type="number" value={f.order} onChange={set("order")} data-testid="project-form-order-input" /></Field>
          <div className="sm:col-span-2"><Field label="Cover image URL"><Input value={f.cover_url} onChange={set("cover_url")} placeholder="https://…" data-testid="project-form-cover-input" /></Field></div>
          <div className="sm:col-span-2"><Field label="Description"><Textarea rows={4} value={f.description} onChange={set("description")} data-testid="project-form-description-input" /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Dropbox folder">
              <div className="flex gap-2">
                <Input value={f.dropbox_path} onChange={set("dropbox_path")} placeholder="/Projects/My Project" className="font-mono text-sm" data-testid="project-form-dropbox-path-input" />
                <button type="button" disabled={!dropboxConnected} onClick={() => setPicking(true)} className="shrink-0 inline-flex items-center gap-2 px-4 rounded-md border border-[#e6cbbb] bg-white text-sm font-semibold hover:border-[#e8262f] disabled:opacity-50 transition-colors" data-testid="project-form-browse-dropbox-button">
                  <FolderSearch className="w-4 h-4" /> Browse
                </button>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-11 px-6 rounded-full border border-[#e6cbbb] font-semibold" data-testid="project-form-cancel-button">Cancel</button>
            <button disabled={busy} className="h-11 px-7 rounded-full bg-[#e8262f] text-white font-bold inline-flex items-center gap-2 disabled:opacity-60 hover:brightness-110 transition-[filter]" data-testid="project-form-save-button">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </form>
        {picking && <FolderPicker open onClose={() => setPicking(false)} onPick={set("dropbox_path")} initial={f.dropbox_path.slice(0, f.dropbox_path.lastIndexOf("/"))} />}
      </DialogContent>
    </Dialog>
  );
};
