import { useEffect, useState } from "react";
import Notice from "../Notice";
import { supabase } from "../../lib/supabase";
import { useToast } from "../ToastProvider";
import { saveWithToast } from "../../lib/saveWithToast";

function emptyRow(organizationId, supplierId) {
  return {
    id: null,
    organization_id: organizationId,
    supplier_id: supplierId,
    title: "",
    document_type: "",
    document_url: "",
    storage_provider: "Teams/SharePoint",
    folder_url: "",
    notes: "",
  };
}

export default function SupplierDocumentsTab({ supplier, organization }) {
  const client = supabase();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingIndex, setUploadingIndex] = useState(null);

  async function load() {
    if (!client || !supplier?.id || !organization?.id) return;
    setLoading(true);
    setError("");
    const { data, error } = await client
      .from("supplier_documents")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [supplier?.id, organization?.id]);

  function setField(idx, key, value) {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function addRow() { setRows((prev) => [emptyRow(organization?.id, supplier?.id), ...prev]); }


  function safeFileName(name) {
    return String(name || "document")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "document";
  }

  async function uploadFile(idx, file) {
    setError("");
    setMessage("");
    if (!client || !file || !supplier?.id || !organization?.id) return;
    setUploadingIndex(idx);
    try {
      const path = `${organization.id}/${supplier.id}/${Date.now()}_${safeFileName(file.name)}`;
      const { error: uploadError } = await client.storage
        .from("supplier-documents")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage.from("supplier-documents").getPublicUrl(path);
      const publicUrl = publicData?.publicUrl || "";

      setRows((prev) => prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          title: row.title || file.name,
          document_type: row.document_type || (file.name.split(".").pop() || "bestand").toUpperCase(),
          storage_provider: "Supabase Storage",
          folder_url: "supplier-documents",
          document_url: publicUrl || path,
          notes: row.notes || `Geüpload via VendorScorePro. Storage path: ${path}`,
        };
      }));
      toast.success("Document geüpload. Klik daarna op Opslaan om de verwijzing vast te leggen.");
      setMessage("Document geüpload. Sla de rij nog op om de verwijzing te bewaren.");
    } catch (err) {
      const msg = err?.message || "Upload mislukt.";
      setError(`${msg} Controleer of Supabase Storage bucket 'supplier-documents' bestaat en de juiste policies heeft.`);
      toast.error("Upload mislukt.");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function saveRow(row) {
    setError("");
    setMessage("");
    if (!client) return;
    if (!row.title?.trim()) { setError("Titel is verplicht."); return; }
    if (!row.document_url?.trim()) { setError("Document URL is verplicht."); return; }
    const payload = {
      organization_id: organization.id,
      supplier_id: supplier.id,
      title: row.title.trim(),
      document_type: row.document_type?.trim() || null,
      document_url: row.document_url?.trim() || null,
      storage_provider: row.storage_provider?.trim() || null,
      folder_url: row.folder_url?.trim() || null,
      notes: row.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const query = row.id
        ? client.from("supplier_documents").update(payload).eq("id", row.id)
        : client.from("supplier_documents").insert(payload);
      await saveWithToast(query, toast, {
        loading: "Document opslaan...",
        success: "Document opgeslagen.",
        error: "Document opslaan mislukt.",
      });
      setMessage("Document opgeslagen.");
      await load();
    } catch (err) {
      setError(err?.message || "Document opslaan mislukt.");
    }
  }

  async function deleteRow(row) {
    if (!row?.id || !client) {
      setRows((prev) => prev.filter((x) => x !== row));
      return;
    }
    const ok = window.confirm(`Document "${row.title}" verwijderen?`);
    if (!ok) return;
    try {
      await saveWithToast(client.from("supplier_documents").delete().eq("id", row.id), toast, {
        loading: "Document verwijderen...",
        success: "Document verwijderd.",
        error: "Document verwijderen mislukt.",
      });
      setMessage("Document verwijderd.");
      await load();
    } catch (err) {
      setError(err?.message || "Document verwijderen mislukt.");
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Documenten</h2>
          <p className="text-sm text-slate-600 mt-1">
Leg documenten vast via Teams/SharePoint URL of upload een bestand via de lokale verkenner naar Supabase Storage.
          </p>
        </div>
        <button className="btn btn-primary" onClick={addRow}>+ Document</button>
      </div>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="" tone="success">{message}</Notice> : null}
      {loading ? <div className="text-sm text-slate-600">Documenten laden…</div> : null}

      {rows.length === 0 ? (
        <Notice title="Nog geen documenten">Voeg documenten toe en gebruik links naar Teams/SharePoint als bronverwijzing.</Notice>
      ) : null}

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row.id || `new-${idx}`} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="font-semibold">{row.title || `Nieuw document ${idx + 1}`}</div>
              <button className="btn" onClick={() => deleteRow(row)}>Verwijderen</button>
            </div>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Titel *</label>
                <input className="w-full mt-1" value={row.title || ""} onChange={(e) => setField(idx, "title", e.target.value)} placeholder="Bijv. DPA Microsoft 2026" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Documenttype</label>
                <input className="w-full mt-1" value={row.document_type || ""} onChange={(e) => setField(idx, "document_type", e.target.value)} placeholder="Bijv. DPA, SLA, DAB, samenvatting" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Opslagprovider</label>
                <input className="w-full mt-1" value={row.storage_provider || ""} onChange={(e) => setField(idx, "storage_provider", e.target.value)} placeholder="Teams/SharePoint" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Maplink</label>
                <input className="w-full mt-1" value={row.folder_url || ""} onChange={(e) => setField(idx, "folder_url", e.target.value)} placeholder="https://.../leveranciers/microsoft" />
                {row.folder_url ? (
                  <a className="text-xs text-blue-700 underline mt-1 inline-block" href={row.folder_url} target="_blank" rel="noreferrer">Open map</a>
                ) : null}
              </div>
              <div className="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <label className="text-sm font-medium text-slate-700">Upload via lokale verkenner</label>
                <input
                  type="file"
                  className="mt-2 block w-full text-sm"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => uploadFile(idx, e.target.files?.[0])}
                />
                <div className="mt-1 text-xs text-slate-500">
                  Upload naar Supabase Storage bucket <code>supplier-documents</code>. Na upload nog op <strong>Opslaan</strong> klikken.
                </div>
                {uploadingIndex === idx ? <div className="mt-2 text-sm text-slate-600">Uploaden…</div> : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Document URL / Storage pad *</label>
                <input className="w-full mt-1" value={row.document_url || ""} onChange={(e) => setField(idx, "document_url", e.target.value)} placeholder="https://... of Supabase Storage URL" />
                {row.document_url && String(row.document_url).startsWith("http") ? (
                  <a className="text-xs text-blue-700 underline mt-1 inline-block" href={row.document_url} target="_blank" rel="noreferrer">Open document</a>
                ) : row.document_url ? (
                  <div className="text-xs text-slate-500 mt-1">Storagepad vastgelegd: {row.document_url}</div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Notities</label>
                <textarea className="w-full mt-1 min-h-[100px]" value={row.notes || ""} onChange={(e) => setField(idx, "notes", e.target.value)} placeholder="Bijv. laatste versie, ontbrekende bijlage, beoordelen door FG/juridische zaken…" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => saveRow(row)}>Opslaan</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
