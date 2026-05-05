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
    contract_type: "",
    document_url: "",
    document_location: "Teams / SharePoint",
    version: "",
    start_date: "",
    end_date: "",
    notice_period: "",
    owner_name: "",
    notes: "",
  };
}

export default function SupplierContractsTab({ supplier, organization }) {
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
      .from("supplier_contracts")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("supplier_id", supplier.id)
      .order("start_date", { ascending: false, nullsFirst: false });
    if (error) {
      setError(error.message);
      toast.error(error.message || "Contracten laden mislukt.");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [supplier?.id, organization?.id]);

  function setField(idx, key, value) {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    setRows((prev) => [emptyRow(organization?.id, supplier?.id), ...prev]);
    setError("");
    setMessage("");
  }

  async function saveRow(row) {
    setError("");
    setMessage("");
    if (!client) {
      setError("Supabase client niet beschikbaar.");
      toast.error("Supabase client niet beschikbaar.");
      return;
    }
    if (!row.title?.trim()) {
      setError("Titel is verplicht.");
      toast.error("Titel is verplicht.");
      return;
    }
    const payload = {
      organization_id: organization.id,
      supplier_id: supplier.id,
      title: row.title.trim(),
      contract_type: row.contract_type?.trim() || null,
      document_url: row.document_url?.trim() || null,
      document_location: row.document_location?.trim() || null,
      version: row.version?.trim() || null,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      notice_period: row.notice_period?.trim() || null,
      owner_name: row.owner_name?.trim() || null,
      notes: row.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const query = row.id
        ? client.from("supplier_contracts").update(payload).eq("id", row.id)
        : client.from("supplier_contracts").insert([payload]);

      await saveWithToast(query, toast, {
        loading: "Contract opslaan...",
        success: "Contract opgeslagen.",
        error: "Contract opslaan mislukt.",
      });
      setMessage("Contract opgeslagen.");
      await load();
    } catch (err) {
      setError(err?.message || "Contract opslaan mislukt.");
    }
  }

  async function deleteRow(row) {
    if (!row?.id || !client) {
      setRows((prev) => prev.filter((x) => x !== row));
      toast.info("Conceptregel verwijderd.");
      return;
    }
    const ok = window.confirm(`Contract "${row.title}" verwijderen?`);
    if (!ok) return;
    try {
      await saveWithToast(client.from("supplier_contracts").delete().eq("id", row.id), toast, {
        loading: "Contract verwijderen...",
        success: "Contract verwijderd.",
        error: "Contract verwijderen mislukt.",
      });
      setMessage("Contract verwijderd.");
      await load();
    } catch (err) {
      setError(err?.message || "Contract verwijderen mislukt.");
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Contracten</h2>
          <p className="text-sm text-slate-600 mt-1">
            Leg hier de contractmetadata vast. Dit tabblad slaat de echte contractgegevens op in de contracttabel. Verwijs met links naar Teams of SharePoint in plaats van bestanden te dupliceren.
          </p>
        </div>
        <button className="btn btn-primary" onClick={addRow} type="button">+ Contract</button>
      </div>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="" tone="success">{message}</Notice> : null}
      {loading ? <div className="text-sm text-slate-600">Contracten laden…</div> : null}

      {rows.length === 0 ? (
        <Notice title="Nog geen contracten">
          Voeg je eerste contract toe. Gebruik bij <strong>Document URL</strong> een link naar de map of het document in Teams/SharePoint.
        </Notice>
      ) : null}

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row.id || `new-${idx}`} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="font-semibold">{row.title || `Nieuw contract ${idx + 1}`}</div>
              <button className="btn" onClick={() => deleteRow(row)} type="button">Verwijderen</button>
            </div>

            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`contract-title-${idx}`} className="text-sm font-medium text-slate-700">Titel *</label>
                <input id={`contract-title-${idx}`} name={`contract-title-${idx}`} className="w-full mt-1" value={row.title || ""} onChange={(e) => setField(idx, "title", e.target.value)} placeholder="Bijv. Hoofdcontract Microsoft 365" />
              </div>
              <div>
                <label htmlFor={`contract-type-${idx}`} className="text-sm font-medium text-slate-700">Contracttype</label>
                <input id={`contract-type-${idx}`} name={`contract-type-${idx}`} className="w-full mt-1" value={row.contract_type || ""} onChange={(e) => setField(idx, "contract_type", e.target.value)} placeholder="Bijv. SaaS, raamovereenkomst, SLA" />
              </div>
              <div>
                <label htmlFor={`contract-start-${idx}`} className="text-sm font-medium text-slate-700">Startdatum</label>
                <input id={`contract-start-${idx}`} name={`contract-start-${idx}`} type="date" className="w-full mt-1" value={row.start_date || ""} onChange={(e) => setField(idx, "start_date", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`contract-end-${idx}`} className="text-sm font-medium text-slate-700">Einddatum</label>
                <input id={`contract-end-${idx}`} name={`contract-end-${idx}`} type="date" className="w-full mt-1" value={row.end_date || ""} onChange={(e) => setField(idx, "end_date", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`contract-notice-${idx}`} className="text-sm font-medium text-slate-700">Opzegtermijn</label>
                <input id={`contract-notice-${idx}`} name={`contract-notice-${idx}`} className="w-full mt-1" value={row.notice_period || ""} onChange={(e) => setField(idx, "notice_period", e.target.value)} placeholder="Bijv. 3 maanden" />
              </div>
              <div>
                <label htmlFor={`contract-version-${idx}`} className="text-sm font-medium text-slate-700">Versie</label>
                <input id={`contract-version-${idx}`} name={`contract-version-${idx}`} className="w-full mt-1" value={row.version || ""} onChange={(e) => setField(idx, "version", e.target.value)} placeholder="Bijv. v1.2" />
              </div>
              <div>
                <label htmlFor={`contract-owner-${idx}`} className="text-sm font-medium text-slate-700">Eigenaar</label>
                <input id={`contract-owner-${idx}`} name={`contract-owner-${idx}`} className="w-full mt-1" value={row.owner_name || ""} onChange={(e) => setField(idx, "owner_name", e.target.value)} placeholder="Bijv. Frank Starren" />
              </div>
              <div>
                <label htmlFor={`contract-location-${idx}`} className="text-sm font-medium text-slate-700">Documentlocatie</label>
                <input id={`contract-location-${idx}`} name={`contract-location-${idx}`} className="w-full mt-1" value={row.document_location || ""} onChange={(e) => setField(idx, "document_location", e.target.value)} placeholder="Bijv. Teams / Leveranciers / Microsoft" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`contract-url-${idx}`} className="text-sm font-medium text-slate-700">Document URL</label>
                <input id={`contract-url-${idx}`} name={`contract-url-${idx}`} className="w-full mt-1" value={row.document_url || ""} onChange={(e) => setField(idx, "document_url", e.target.value)} placeholder="https://..." />
                {row.document_url ? (
                  <a className="text-xs text-blue-700 underline mt-1 inline-block" href={row.document_url} target="_blank" rel="noreferrer">Open link</a>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`contract-notes-${idx}`} className="text-sm font-medium text-slate-700">Notities</label>
                <textarea id={`contract-notes-${idx}`} name={`contract-notes-${idx}`} className="w-full mt-1 min-h-[110px]" value={row.notes || ""} onChange={(e) => setField(idx, "notes", e.target.value)} placeholder="Bijv. scope, verlengopties, aandachtspunten, ontbrekende documenten…" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => saveRow(row)} type="button">Opslaan</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
