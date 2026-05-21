import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import Notice from "../Notice";
import { AI_RISK_CLASSIFICATIONS, AI_RECOMMENDATIONS, aiRiskLabel } from "../../lib/aiRegister";

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
  ai_risk_classification: "unknown",
  ai_category: "",
  ai_provider: "",
  ai_model: "",
  ai_use_case: "",
  ai_decision_impact: "ondersteunend",
  ai_human_in_loop: true,
  ai_trains_on_customer_data: false,
  ai_processes_personal_data: false,
  ai_automated_decision_making: false,
  ai_data_location: "",
  ai_governance_notes: "",
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
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadRows();
  }, [supplier?.id, orgId]);

  async function loadRows() {
    if (!supplier?.id || !orgId || !client) return;

    setLoading(true);
    setErr("");
    setSuccess('');

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

    const usesAi = !!form.uses_ai;
    const payload = {
      organization_id: orgId,
      supplier_id: supplier.id,
      name: form.name.trim(),
      service: form.service.trim() || null,
      country: form.country.trim() || null,
      processes_personal_data: !!form.processes_personal_data,
      uses_ai: usesAi,
      risk_level: form.risk_level || "medium",
      notes: form.notes.trim() || null,

      // AI-governance velden. Deze kolommen worden toegevoegd via supabase/v0.9.23_subprocessors_ai_register_fields.sql.
      ai_type: usesAi ? form.ai_type.trim() || null : null,
      ai_risk_classification: usesAi ? form.ai_risk_classification || "unknown" : null,
      ai_category: usesAi ? form.ai_category || null : null,
      ai_provider: usesAi ? form.ai_provider.trim() || null : null,
      ai_model: usesAi ? form.ai_model.trim() || null : null,
      ai_use_case: usesAi ? form.ai_use_case.trim() || null : null,
      ai_decision_impact: usesAi ? form.ai_decision_impact || "ondersteunend" : null,
      ai_human_in_loop: usesAi ? !!form.ai_human_in_loop : null,
      ai_trains_on_customer_data: usesAi ? !!form.ai_trains_on_customer_data : null,
      ai_processes_personal_data: usesAi ? !!form.ai_processes_personal_data : null,
      ai_automated_decision_making: usesAi ? !!form.ai_automated_decision_making : null,
      ai_data_location: usesAi ? form.ai_data_location.trim() || null : null,
      ai_governance_notes: usesAi ? form.ai_governance_notes.trim() || null : null,
    };

    const { data, error } = await client
      .from("subprocessors")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      const missingColumnHint = error.message?.includes("column")
        ? " Controleer of supabase/v0.9.23_subprocessors_ai_register_fields.sql is uitgevoerd."
        : "";
      setErr(error.message + missingColumnHint);
      setSaving(false);
      return;
    }

    const savedAi = !usesAi || !!data?.uses_ai;
    if (!savedAi) {
      setErr("Subverwerker is aangemaakt, maar AI-status kwam niet terug uit Supabase. Controleer RLS/payload.");
      setSaving(false);
      await loadRows();
      return;
    }

    setForm(EMPTY_FORM);
    setSuccess('Subverwerker inclusief AI-governance succesvol opgeslagen.');
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
      {success ? <Notice title="Succes" tone="success">{success}</Notice> : null}

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
          <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
            <div>
              <div className="font-semibold text-slate-900">AI-registratie</div>
              <div className="text-sm text-slate-600 mt-1">
                Leg vast welk soort AI wordt gebruikt, waarvoor, met welke data en welke governance-maatregelen nodig zijn.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Type AI</label>
                <input
                  className="w-full"
                  value={form.ai_type}
                  onChange={(e) => setField("ai_type", e.target.value)}
                  placeholder="Bijv. Generatieve AI, OCR, classificatie, voorspelling"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">EU AI Act risicoklasse</label>
                <select className="w-full" value={form.ai_risk_classification} onChange={(e) => setField("ai_risk_classification", e.target.value)}>
                  {AI_RISK_CLASSIFICATIONS.map((risk) => (
                    <option key={risk.value} value={risk.value}>{risk.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">AI-categorie / toepassing</label>
                <select className="w-full" value={form.ai_category} onChange={(e) => setField("ai_category", e.target.value)}>
                  <option value="">Kies categorie</option>
                  <option value="generatief">Generatieve AI / contentgeneratie</option>
                  <option value="chatbot">Chatbot / virtuele assistent</option>
                  <option value="classificatie">Classificatie / routering</option>
                  <option value="ocr">OCR / documentherkenning</option>
                  <option value="analytics">Analytics / voorspelling</option>
                  <option value="onderwijsbeoordeling">Onderwijsbeoordeling / studieadvies</option>
                  <option value="hr_recruitment">HR / recruitment / personeelsbeoordeling</option>
                  <option value="security">Security / anomaliedetectie</option>
                  <option value="biometrie">Biometrie / identificatie</option>
                  <option value="emotieherkenning">Emotieherkenning</option>
                  <option value="anders">Anders</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">AI-provider</label>
                <input className="w-full" value={form.ai_provider} onChange={(e) => setField("ai_provider", e.target.value)} placeholder="Bijv. OpenAI, Microsoft, Google, eigen model" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Model / dienst</label>
                <input className="w-full" value={form.ai_model} onChange={(e) => setField("ai_model", e.target.value)} placeholder="Bijv. GPT-4.1, Azure AI Search, OCR-engine" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Use case</label>
                <textarea className="w-full min-h-[90px]" value={form.ai_use_case} onChange={(e) => setField("ai_use_case", e.target.value)} placeholder="Beschrijf waarvoor AI wordt gebruikt en in welk proces." />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Impact op besluitvorming</label>
                <select className="w-full" value={form.ai_decision_impact} onChange={(e) => setField("ai_decision_impact", e.target.value)}>
                  <option value="ondersteunend">Ondersteunend / advies</option>
                  <option value="semi_automatisch">Semi-automatisch</option>
                  <option value="automatisch">Automatische besluitvorming</option>
                  <option value="onbekend">Onbekend</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">AI datalocatie</label>
                <input className="w-full" value={form.ai_data_location} onChange={(e) => setField("ai_data_location", e.target.value)} placeholder="Bijv. EU, Nederland, VS, onbekend" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input type="checkbox" className="mt-1" checked={!!form.ai_human_in_loop} onChange={(e) => setField("ai_human_in_loop", e.target.checked)} />
                <div><div className="text-sm font-semibold">Human-in-the-loop</div><div className="text-xs text-slate-600">Menselijke controle op AI-output.</div></div>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input type="checkbox" className="mt-1" checked={!!form.ai_processes_personal_data} onChange={(e) => setField("ai_processes_personal_data", e.target.checked)} />
                <div><div className="text-sm font-semibold">AI verwerkt persoonsgegevens</div><div className="text-xs text-slate-600">Neem dit mee in DPA/DPIA.</div></div>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input type="checkbox" className="mt-1" checked={!!form.ai_trains_on_customer_data} onChange={(e) => setField("ai_trains_on_customer_data", e.target.checked)} />
                <div><div className="text-sm font-semibold">Training op klantdata</div><div className="text-xs text-slate-600">Risico: hergebruik van Gilde-data voor modeltraining.</div></div>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input type="checkbox" className="mt-1" checked={!!form.ai_automated_decision_making} onChange={(e) => setField("ai_automated_decision_making", e.target.checked)} />
                <div><div className="text-sm font-semibold">Automatische besluitvorming</div><div className="text-xs text-slate-600">Extra AVG/AI Act aandachtspunt.</div></div>
              </label>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-semibold">Aanbevelingen voor registratie</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {AI_RECOMMENDATIONS.map((rec) => (
                  <li key={rec.title}><strong>{rec.title}:</strong> {rec.advice}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">AI-governance notities</label>
              <textarea className="w-full min-h-[90px]" value={form.ai_governance_notes} onChange={(e) => setField("ai_governance_notes", e.target.value)} placeholder="Bijv. DPIA nodig, AI-register bijwerken, leverancier vragen om modelkaart, data niet gebruiken voor training, menselijke controle verplicht." />
            </div>
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
                      {row.ai_risk_classification ? <span className="badge">{aiRiskLabel(row.ai_risk_classification)}</span> : null}
                      {row.ai_category ? <span className="badge">{row.ai_category}</span> : null}
                      {row.ai_provider ? <span className="badge">Provider: {row.ai_provider}</span> : null}
                    </div>
                  </div>

                  <button className="btn" onClick={() => deleteRow(row.id)}>
                    Verwijderen
                  </button>
                </div>

                {row.uses_ai ? (
                  <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">AI-governance</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div><strong>Risicoklasse:</strong> {aiRiskLabel(row.ai_risk_classification)}</div>
                      <div><strong>Model/dienst:</strong> {row.ai_model || "Niet bekend"}</div>
                      <div><strong>Impact:</strong> {row.ai_decision_impact || "Niet bekend"}</div>
                      <div><strong>Datalocatie:</strong> {row.ai_data_location || "Niet bekend"}</div>
                      <div><strong>Human-in-the-loop:</strong> {row.ai_human_in_loop ? "Ja" : "Nee/Niet bekend"}</div>
                      <div><strong>Persoonsgegevens:</strong> {row.ai_processes_personal_data ? "Ja" : "Nee/Niet bekend"}</div>
                      <div><strong>Training op klantdata:</strong> {row.ai_trains_on_customer_data ? "Ja" : "Nee/Niet bekend"}</div>
                    </div>
                    {row.ai_use_case ? <div className="mt-2 whitespace-pre-wrap"><strong>Use case:</strong> {row.ai_use_case}</div> : null}
                    {row.ai_governance_notes ? <div className="mt-2 whitespace-pre-wrap"><strong>Notities:</strong> {row.ai_governance_notes}</div> : null}
                  </div>
                ) : null}

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
