import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { ySyncPluginKey } from "y-prosemirror";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useLyricProvider, useProviderState } from "@/components/lyrics/provider";
import { LyricToolbar } from "@/components/lyrics/LyricToolbar";

const AUTO_VERSION_MS = 5 * 60 * 1000;

function useTextSync(lyricId) {
  const timer = useRef(null);
  const dirtySinceVersion = useRef(false);
  const latest = useRef("");
  const flush = async () => {
    clearTimeout(timer.current);
    await api.patch(`/lyrics/${lyricId}`, { text: latest.current }).catch(() => {});
  };
  const schedule = (text) => {
    latest.current = text;
    dirtySinceVersion.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { schedule, flush, dirtySinceVersion };
}

function Editor({ lyricId, provider, mode, meta, onCollapse, onMetaChange }) {
  const { user } = useAuth();
  const { status, peers } = useProviderState(provider);
  const sync = useTextSync(lyricId);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder: "Write. Verses, hooks, bridges or nothing at all." }),
      Collaboration.configure({ document: provider.doc, field: "lyrics" }),
      CollaborationCursor.configure({ provider, user: { name: user.name, color: user.color } }),
    ],
    editorProps: { attributes: { class: `lyric-prose ${mode === "full" ? "lyric-full" : "lyric-card"}`, "data-testid": "lyric-editor-content", spellcheck: "true" } },
    onUpdate: ({ editor: ed, transaction }) => {
      if (transaction.getMeta(ySyncPluginKey)?.isChangeOrigin) return;
      sync.schedule(ed.getText({ blockSeparator: "\n" }));
    },
  }, [provider]);

  useEffect(() => {
    if (!editor) { return undefined; }
    const t = setInterval(() => {
      if (!sync.dirtySinceVersion.current) return;
      sync.dirtySinceVersion.current = false;
      api.post(`/lyrics/${lyricId}/versions`, { content: editor.getJSON(), text: editor.getText({ blockSeparator: "\n" }), label: "" }).catch(() => {});
    }, AUTO_VERSION_MS);
    return () => clearInterval(t);
  }, [editor, lyricId, sync.dirtySinceVersion]);

  if (!editor) return null;
  return (
    <div className={`flex flex-col h-full ${mode === "full" ? "" : ""}`} data-testid={`lyric-editor-${mode}`}>
      <LyricToolbar editor={editor} mode={mode} lyricId={lyricId} meta={meta} status={status} peers={peers} sync={sync} onCollapse={onCollapse} onMetaChange={onMetaChange} />
      <div className="flex-1 overflow-y-auto" data-scrollable="true" onPointerDown={(e) => e.stopPropagation()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

export const LyricEditor = ({ lyricId, mode = "full", onCollapse }) => {
  const provider = useLyricProvider(lyricId);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api.get(`/lyrics/${lyricId}`).then((r) => setMeta(r.data)).catch(() => setError(true));
  }, [lyricId]);
  if (error) return <div className="p-6 text-sm text-white/60" data-testid="lyric-no-access">This lyric document was removed or isn't shared with you.</div>;
  if (!provider || !meta) return <div className="h-full grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[#ff4757]" /></div>;
  return <Editor key={lyricId} lyricId={lyricId} provider={provider} mode={mode} meta={meta} onCollapse={onCollapse} onMetaChange={setMeta} />;
};
