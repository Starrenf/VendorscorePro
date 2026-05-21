import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Notice from "../Notice";
import { supabase } from "../../lib/supabase";
import { useToast } from "../ToastProvider";


function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightedHtml(text, query) {
  const safe = escapeHtml(text);
  const needle = query.trim();
  if (!needle) return safe;
  const re = new RegExp(escapeRegExp(needle), "gi");
  return safe.replace(re, (match) => `<mark class="rounded bg-yellow-200 px-1">${match}</mark>`);
}

function safeFileName(value) {
  return String(value || "contractsamenvatting")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replaceAll(" ", "_") || "contractsamenvatting";
}

function formatDate(value) {
  if (!value) return "Nog niet opgeslagen";
  try {
    return new Date(value).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export default function ApplicationContractSummary({ supplier, organization, application }) {
  const client = supabase();
  const toast = useToast();
  const organizationId = organization?.id || supplier?.organization_id || application?.organization_id || null;
  const supplierId = supplier?.id || application?.supplier_id || null;
  const applicationId = application?.id || null;

  const [rowId, setRowId] = useState(null);
  const [summaryText, setSummaryText] = useState("");
  const [version, setVersion] = useState("1.0");
  const [sourceFile, setSourceFile] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("clean");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canUse = !!client && !!organizationId && !!supplierId && !!applicationId;
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Schrijf of plak hier de contractsamenvatting volgens het Gilde-template…",
      }),
    ],
    content: summaryText || "",
    onUpdate: ({ editor }) => {
      setSummaryText(editor.getHTML());
      setStatus("dirty");
    },
    editorProps: {
      attributes: {
        class: "tiptap-contract-editor min-h-[320px] rounded-b-2xl border border-slate-200 bg-white p-4 focus:outline-none",
      },
    },
  });


  useEffect(() => {
    let alive = true;
    async function load() {
      if (!canUse) return;
      setLoading(true);
      setError("");
      const { data, error } = await client
        .from("application_contract_summaries")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("supplier_id", supplierId)
        .eq("application_id", applicationId)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.warn("application_contract_summaries load failed", error);
        setError("Contractsamenvatting kon niet worden geladen. Controleer of de SQL-tabel en RLS actief zijn.");
      } else if (data) {
        setRowId(data.id || null);
        const loadedText = data.summary_text || data.content || data.text || "";
        setSummaryText(loadedText);
        editor?.commands.setContent(loadedText || "");
        setVersion(data.version || "1.0");
        setSourceFile(data.source_file || data.source_filename || "");
        setUpdatedAt(data.updated_at || data.created_at || null);
        setUpdatedBy(data.updated_by_name || data.updated_by || "");
        setStatus("clean");
      }
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [canUse, client, organizationId, supplierId, applicationId]);

  useEffect(() => {
    if (status !== "dirty") return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return 0;
    return (summaryText.toLowerCase().match(new RegExp(escapeRegExp(needle), "g")) || []).length;
  }, [query, summaryText]);

  const highlightedHtml = useMemo(
    () => buildHighlightedHtml(summaryText, query),
    [summaryText, query],
  );

  function markDirty(setter) {
    return (value) => {
      setter(value);
      setStatus("dirty");
    };
  }

  async function save() {
    if (!canUse) {
      toast.error("Opslaan is nog niet mogelijk: leverancier, applicatie of organisatie ontbreekt.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const { data: userData } = await client.auth.getUser();
      const payload = {
        organization_id: organizationId,
        supplier_id: supplierId,
        application_id: applicationId,
        summary_text: summaryText,
        version: version || "1.0",
        source_file: sourceFile || null,
        updated_by: userData?.user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const query = rowId
        ? client.from("application_contract_summaries").update(payload).eq("id", rowId).select().single()
        : client.from("application_contract_summaries").insert(payload).select().single();

      const { data, error } = await query;
      if (error) throw error;
      setRowId(data?.id || rowId);
      setUpdatedAt(data?.updated_at || payload.updated_at);
      setUpdatedBy(data?.updated_by || payload.updated_by || "");
      setStatus("clean");
      toast.success("Contractsamenvatting opgeslagen.");
    } catch (e) {
      console.warn("contract summary save failed", e);
      setStatus("error");
      setError(e?.message || "Opslaan van contractsamenvatting mislukt.");
      toast.error(e?.message || "Opslaan van contractsamenvatting mislukt.");
    }
  }

  function exportWord() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Contractsamenvatting</title></head><body><h1>Contractsamenvatting ${application?.name || ""}</h1><p><strong>Leverancier:</strong> ${supplier?.name || ""}</p><p><strong>Versie:</strong> ${version || ""}</p><p><strong>Bronbestand:</strong> ${sourceFile || ""}</p><p><strong>Laatst bijgewerkt:</strong> ${formatDate(updatedAt)}</p><hr/><pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${summaryText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(application?.name || supplier?.name)}_contractsamenvatting.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const label = status === "saving" ? "Opslaan…" : status === "dirty" ? "Niet-opgeslagen wijzigingen" : status === "error" ? "Opslaan mislukt" : "Opgeslagen";

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-slate-900">Contractsamenvatting</div>
          <div className="text-xs text-slate-600 mt-1">Applicatie → Details → Contractsamenvatting</div>
        </div>
        <span className="badge">{label}</span>
      </div>

      {!canUse ? <Notice title="Nog niet gereed" tone="warning">Deze samenvatting kan pas worden opgeslagen zodra de applicatie in de database staat.</Notice> : null}
      {error ? <div className="mt-3"><Notice title="Let op" tone="warning">{error}</Notice></div> : null}
      {loading ? <div className="mt-3 text-sm text-slate-600">Contractsamenvatting laden…</div> : null}

      <div className="mt-3 grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Versie</label>
          <input className="w-full mt-1" value={version} onChange={(e) => markDirty(setVersion)(e.target.value)} placeholder="1.0" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Bronbestand</label>
          <input className="w-full mt-1" value={sourceFile} onChange={(e) => markDirty(setSourceFile)(e.target.value)} placeholder="Bijv. SLA, overeenkomst, offerte…" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Zoeken in tekst</label>
          <input className="w-full mt-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoekterm" />
          {query ? <div className="text-xs text-slate-500 mt-1">{matches} resultaat/resultaten</div> : null}
        </div>
      </div>

      <div className="mt-3">
        <label className="text-sm font-medium text-slate-700">Samenvatting</label>

        <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-100 p-2 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleBold().run()}>Vet</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleItalic().run()}>Cursief</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleBulletList().run()}>Bullets</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>Nummering</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button type="button" className="btn" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
        </div>

        <EditorContent editor={editor} />
      </div>

      {query.trim() ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-slate-900">Zoekresultaten</div>
            <span className="badge">{matches} gevonden</span>
          </div>
          <div
            className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-6 text-slate-800"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-500">
          Laatst bijgewerkt: {formatDate(updatedAt)}{updatedBy ? ` · door ${updatedBy}` : ""}
        </div>
        <div className="flex gap-2">
          <button className="btn" type="button" onClick={exportWord} disabled={!summaryText.trim()}>Export naar Word</button>
          <button className="btn btn-primary" type="button" onClick={save} disabled={!canUse || status === "saving"}>{status === "saving" ? "Opslaan…" : "Opslaan"}</button>
        </div>
      </div>
    </div>
  );
}
