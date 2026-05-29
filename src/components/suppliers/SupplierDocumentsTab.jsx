import { useEffect, useMemo, useState } from "react";
import Notice from "../Notice";
import { supabase } from "../../lib/supabase";
import { useToast } from "../ToastProvider";
import { saveWithToast } from "../../lib/saveWithToast";

const DOCUMENT_TYPES = [
  "Contract",
  "SLA",
  "DAP/DAB",
  "Verwerkersovereenkomst",
  "DPIA",
  "Offerte",
  "Accountantsdocument",
  "Security",
  "Audit",
  "Overig",
];

function emptyRow(organizationId, supplierId) {
  return {
    id: null,
    organization_id: organizationId,
    supplier_id: supplierId,
    title: "",
    document_type: "",
    document_url: "",
    external_url: "",
    storage_provider: "Teams/SharePoint",
    source_system: "Teams/SharePoint",
    storage_mode: "link",
    folder_url: "",
    version: "",
    owner_name: "",
    sensitivity: "Intern",
    notes: "",
  };
}

function getUrl(row) {
  return row.external_url || row.document_url || "";
}

function isLikelyTeamsOrSharePointUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host.includes("sharepoint.com") || host.includes("teams.microsoft.com") || host.includes("office.com") || host.includes("microsoft.com");
  } catch {
    return false;
  }
}

export default function SupplierDocumentsTab({ supplier, organization }) {
  const client = supabase();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    setRows((data || []).map((row) => ({ ...row, external_url: row.external_url || row.document_url || "", storage_mode: row.storage_mode || "link", source_system: row.source_system || row.storage_provider || "Teams/SharePoint" })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [supplier?.id, organization?.id]);

  function setField(idx, key, value) {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function addRow() { setRows((prev) => [emptyRow(organization?.id, supplier?.id), ...prev]); }

  async function saveRow(row) {
    setError("");
    setMessage("");
    if (!client) return;
    const url = getUrl(row).trim();
    if (!row.title?.trim()) { setError("Titel is verplicht."); return; }
    if (!url) { setError("Teams/SharePoint-link is verplicht."); return; }
    if (!isLikelyTeamsOrSharePointUrl(url)) {
      const ok = window.confirm("Deze link lijkt geen Teams/SharePoint-link. Toch opslaan?");
      if (!ok) return;
    }
    const payload = {
      organization_id: organization.id,
      supplier_id: supplier.id,
      title: row.title.trim(),
      document_type: row.document_type?.trim() || null,
      document_url: url,
      external_url: url,
      storage_provider: row.storage_provider?.trim() || "Teams/SharePoint",
      source_system: row.source_system?.trim() || "Teams/SharePoint",
      storage_mode: "link",
      folder_url: row.folder_url?.trim() || null,
      version: row.version?.trim() || null,
      owner_name: row.owner_name?.trim() || null,
      sensitivity: row.sensitivity?.trim() || null,
      notes: row.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    try {
      const query = row.id
        ? client.from("supplier_documents").update(payload).eq("id", row.id)
        : client.from("supplier_documents").insert(payload);
      await saveWithToast(query, toast, {
        loading: "Documentlink opslaan...",
        success: "Documentlink opgeslagen.",
        error: "Documentlink opslaan mislukt.",
      });
      setMessage("Documentlink opgeslagen. Het bestand zelf blijft in Teams/SharePoint staan.");
      await load();
    } catch (err) {
      setError(err?.message || "Documentlink opslaan mislukt.");
    }
  }

  async function deleteRow(row) {
    if (!row?.id || !client) {
      setRows((prev) => prev.filter((x) => x !== row));
      return;
    }
    const ok = window.confirm(`Documentlink "${row.title}" verwijderen? Het bronbestand in Teams/SharePoint blijft bestaan.`);
    if (!ok) return;
    try {
      await saveWithToast(client.from("supplier_documents").delete().eq("id", row.id), toast, {
        loading: "Documentlink verwijderen...",
        success: "Documentlink verwijderd.",
        error: "Documentlink verwijderen mislukt.",
      });
      setMessage("Documentlink verwijderd.");
      await load();
    } catch (err) {
      setError(err?.message || "Documentlink verwijderen mislukt.");
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Documentlinks</h2>
          <p className="text-sm text-slate-600 mt-1">
            Registreer alleen links naar Teams/SharePoint. VendorScorePro slaat geen Gilde-documenten extern op.
          </p>
        </div>
        <button className="btn btn-primary" onClick={addRow}>+ Documentlink</button>
      </div>

      <Notice title="Veilige documentregistratie" tone="info">
        Het bronbestand blijft op de Gilde Teams/SharePoint-locatie staan. In VendorScorePro worden alleen metadata en de verwijzing opgeslagen.
      </Notice>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="" tone="success">{message}</Notice> : null}
      {loading ? <div className="text-sm text-slate-600">Documentlinks laden…</div> : null}

      {rows.length === 0 ? (
        <Notice title="Nog geen documentlinks">Voeg een Teams/SharePoint-link toe naar bijvoorbeeld contract, SLA, DPA, offerte of auditdocument.</Notice>
      ) : null}

      <div className="space-y-4">
        {rows.map((row, idx) => {
          const url = getUrl(row);
          return (
            <div key={row.id || `new-${idx}`} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{row.title || `Nieuwe documentlink ${idx + 1}`}</div>
                  <div className="text-xs text-slate-500 mt-1">{row.document_type || "Geen type"} · {row.source_system || row.storage_provider || "Teams/SharePoint"}</div>
                </div>
                <button className="btn" onClick={() => deleteRow(row)}>Verwijderen</button>
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Titel *</label>
                  <input className="w-full mt-1" value={row.title || ""} onChange={(e) => setField(idx, "title", e.target.value)} placeholder="Bijv. DPA Microsoft 2026" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Documenttype</label>
                  <select className="w-full mt-1" value={row.document_type || ""} onChange={(e) => setField(idx, "document_type", e.target.value)}>
                    <option value="">Kies type…</option>
                    {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Bronlocatie</label>
                  <input className="w-full mt-1" value={row.source_system || row.storage_provider || ""} onChange={(e) => { setField(idx, "source_system", e.target.value); setField(idx, "storage_provider", e.target.value); }} placeholder="Teams/SharePoint" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Maplink</label>
                  <input className="w-full mt-1" value={row.folder_url || ""} onChange={(e) => setField(idx, "folder_url", e.target.value)} placeholder="https://.../sites/..." />
                  {row.folder_url ? (
                    <a className="text-xs text-blue-700 underline mt-1 inline-block" href={row.folder_url} target="_blank" rel="noreferrer">Open map</a>
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Teams/SharePoint-link *</label>
                  <input className="w-full mt-1" value={url} onChange={(e) => { setField(idx, "external_url", e.target.value); setField(idx, "document_url", e.target.value); }} placeholder="https://gildeopleidingen.sharepoint.com/..." />
                  {url ? (
                    <a className="text-xs text-blue-700 underline mt-1 inline-block" href={url} target="_blank" rel="noreferrer">Open document in Teams/SharePoint</a>
                  ) : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Versie</label>
                  <input className="w-full mt-1" value={row.version || ""} onChange={(e) => setField(idx, "version", e.target.value)} placeholder="Bijv. 1.0 / definitief / 2026" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Eigenaar</label>
                  <input className="w-full mt-1" value={row.owner_name || ""} onChange={(e) => setField(idx, "owner_name", e.target.value)} placeholder="Bijv. contractmanagement, ICT, privacy" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Classificatie</label>
                  <select className="w-full mt-1" value={row.sensitivity || ""} onChange={(e) => setField(idx, "sensitivity", e.target.value)}>
                    <option value="Intern">Intern</option>
                    <option value="Vertrouwelijk">Vertrouwelijk</option>
                    <option value="Privacygevoelig">Privacygevoelig</option>
                    <option value="Accountant">Accountant</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Opslagmodus</label>
                  <input className="w-full mt-1 bg-slate-50" value="Alleen linkregistratie" disabled />
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
          );
        })}
      </div>
    </div>
  );
}
