import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import Notice from "../Notice";

function RiskBadge({ value }) {
  const v = String(value || "medium").toLowerCase();
  const cls =
    v === "high"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : v === "low"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + cls}>
      {v === "high" ? "Hoog" : v === "low" ? "Laag" : "Middel"}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  service: "",
  country: "",
  processes_personal_data: true,
  uses_ai: false,
  ai_type: "",
  risk_level: "medium",
  notes: "",
};

export default function SupplierSubprocessorsTab({ supplier }) {
  const { organization, profile } = useApp();
  const client = supabase();

  const orgId = organization?.id || profile?.organization_id || null;

  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadRows();
  }, [supplier?.id, orgId]);

  async function loadRows() {
    if (!supplier?.id || !orgId || !client) return;

    setLoading(true);
    setErr("");

    const { data, error } = await client
      .from("subprocessors")
      .select("*")
      .eq("supplier_id", supplier.id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function addRow() {
    setErr("");

    if (!form.name.trim()) {
      setErr("Naam van de subverwerker is verplicht.");
      return;
    }

    if (!orgId || !supplier?.id || !client) {
      setErr("Organisatie of leverancier ontbreekt.");
      return;
    }

    setSaving(true);

    const payload = {
      organization_id: orgId,
      supplier_id: supplier.id,
      name: form.name.trim(),
      service: form.service.trim() || null,
      country: form.country.trim() || null,
      processes_personal_data: !!form.processes_personal_data,
      uses_ai: !!form.uses_ai,
      ai_type: form.uses_ai ? form.ai_type.trim() || null : null,
      risk_level: form.risk_level || "medium",
      notes: form.notes.trim() || null,
    };

    const { error } = await client.from("subprocessors").insert(payload);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setForm(EMPTY_FORM);
    await loadRows();
    setSaving(false);
  }

  async function deleteRow(id) {
    if (!window.confirm("Subverwerker verwijderen?")) return;

    const { error } = await client
      .from("subprocessors")
      .delete()
      .eq("id", id);

    if (error) {
      setErr(error.message);
      return;
    }

    await loadRows();
  }

  const aiCount = useMemo(() => rows.filter((r) => !!r.uses_ai).length, [rows]);
  const personalDataCount = useMemo(
    () => rows.filter((r) => !!r.processes_personal_data).length,
    [rows]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Subverwerkers &amp; AI</h2>
        <p className="mt-1 text-sm text-slate-600">
          Registreer welke subverwerkers deze leverancier inzet en of daarbij AI of
          persoonsgegevensverwerking betrokken is.
        </p>
      </div>

      {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subverwerkers
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{rows.length}</div>
          <div className="mt-1 text-sm text-slate-600">
            Geregistreerd bij deze leverancier
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            AI in gebruik
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{aiCount}</div>
          <div className="mt-1 text-sm text-slate-600">
            Subverwerkers met AI-component
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Persoonsgegevens
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {personalDataCount}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Subverwerkers die persoonsgegevens verwerken
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="font-semibold">Nieuwe subverwerker</div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Naam *</label>
            <input
              className="w-full"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Bijv. Microsoft Azure"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Dienst</label>
            <input
              className="w-full"
              value={form.service}
              onChange={(e) => setField("service", e.target.value)}
              placeholder="Bijv. Hosting, AI analyse, Fraudedetectie"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Land</label>
            <input
              className="w-full"
              value={form.country}
              onChange={(e) => setField("country", e.target.value)}
              placeholder="Bijv. Nederland, Ierland, Verenigde Staten"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Risiconiveau</label>
            <select
              className="w-full"
              value={form.risk_level}
              onChange={(e) => setField("risk_level", e.target.value)}
            >
              <option value="low">Laag</option>
              <option value="medium">Middel</option>
              <option value="high">Hoog</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!form.processes_personal_data}
              onChange={(e) => setField("processes_personal_data", e.target.checked)}
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Verwerkt persoonsgegevens
              </div>
              <div className="text-xs text-slate-600">
                Aanvinken als deze subverwerker persoonsgegevens verwerkt.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!form.uses_ai}
              onChange={(e) => setField("uses_ai", e.target.checked)}
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Gebruikt AI
              </div>
              <div className="text-xs text-slate-600">
                Aanvinken als deze subverwerker AI inzet binnen de dienstverlening.
              </div>
            </div>
          </label>
        </div>

        {form.uses_ai ? (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Type AI</label>
            <input
              className="w-full"
              value={form.ai_type}
              onChange={(e) => setField("ai_type", e.target.value)}
              placeholder="Bijv. Generative AI, Fraudedetectie, Classificatie, OCR"
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Notities</label>
          <textarea
            className="w-full min-h-[110px]"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Bijv. subverwerker staat in de DPA, buiten EU hosting, aanvullende afspraken nodig, DPIA gewenst..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={addRow} disabled={saving}>
            {saving ? "Opslaan…" : "Subverwerker toevoegen"}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="font-semibold">Overzicht</div>

        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Subverwerkers laden…</div>
        ) : rows.length === 0 ? (
          <div className="mt-3">
            <Notice title="Nog geen subverwerkers">
              Voor deze leverancier zijn nog geen subverwerkers geregistreerd.
            </Notice>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{row.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                      {row.service ? <span className="badge">{row.service}</span> : null}
                      {row.country ? <span className="badge">{row.country}</span> : null}
                      <RiskBadge value={row.risk_level} />
                      {row.processes_personal_data ? (
                        <span className="badge">Persoonsgegevens</span>
                      ) : (
                        <span className="badge">Geen persoonsgegevens</span>
                      )}
                      {row.uses_ai ? (
                        <span className="badge border-sky-200 bg-sky-50 text-sky-700">
                          AI{row.ai_type ? `: ${row.ai_type}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button className="btn" onClick={() => deleteRow(row.id)}>
                    Verwijderen
                  </button>
                </div>

                {row.notes ? (
                  <div className="mt-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notities
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{row.notes}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
