import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
}

function plainTextToHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function normalizeContent(value) {
  if (!value) return "";
  return looksLikeHtml(value) ? value : plainTextToHtml(value);
}

function ToolbarButton({ active, disabled, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-sky-300 bg-sky-50 text-sky-800"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = "Schrijf hier…", minHeight = 240, disabled = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: normalizeContent(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap-contract-editor focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = normalizeContent(value);
    if (editor.getHTML() !== next) editor.commands.setContent(next || "", false);
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <ToolbarButton title="Vet" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton title="Cursief" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>
        <ToolbarButton title="Doorhalen" active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <ToolbarButton title="Kop 2" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Kop 3" active={editor.isActive("heading", { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton title="Normale tekst" active={editor.isActive("paragraph")} disabled={disabled} onClick={() => editor.chain().focus().setParagraph().run()}>Tekst</ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <ToolbarButton title="Opsomming" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Lijst</ToolbarButton>
        <ToolbarButton title="Genummerde lijst" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Lijst</ToolbarButton>
        <ToolbarButton title="Citaat / aandachtspunt" active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</ToolbarButton>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <ToolbarButton title="Ongedaan maken" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
        <ToolbarButton title="Opnieuw" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
      </div>
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
