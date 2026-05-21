import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import AIRiskBadge from "../components/ai/AIRiskBadge";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import {
  AI_RECOMMENDATIONS,
  AI_RISK_CLASSIFICATIONS,
  AI_STATUS_OPTIONS,
  MITIGATION_TYPES,
  aiRiskLabel,
  aiStatusLabel,
  buildAiWarnings,
} from "../lib/aiRegister";

const EMPTY_FORM = {
  id: null,
  supplier_id: "",
  application_id: "",
  subprocessor_id: "",
  name: "",
  description: "",
  ai_use_case: "",
  ai_purpose: "",
  ai_risk_classification: "unknown",
  eu_ai_act_category: "",
  risk_reason: "",
  ai_model_vendor: "",
  ai_model_name: "",
  ai_model_version: "",
  processes_personal_data: false,
  processes_special_category_data: false,
  automated_decision_making: false,
  human_oversight: true,
  trains_on_customer_data: false,
  transparency_measures: "",
  data_location: "",
  eu_data_storage: true,
  retention_period: "",
  dpia_required: false,
  dpia_completed: false,
  dpia_notes: "",
  dpa_present: false,
  subprocessor_known: false,
  security_documentation_present: false,
  status: "concept",
  owner_name: "",
  owner_department: "",
  review_frequency: "jaarlijks",
  last_review_date: "",
  next_review_date: "",
  notes: "",
};

function cleanPayload(form, orgId, userId) {
  return {
    organization_id: orgId,
    supplier_id: form.supplier_id || null,
    application_id: form.application_id || null,
    subprocessor_id: form.subprocessor_id || null,
    name: form.name.trim(),
    description: form.description?.trim() || null,
    ai_use_case: form.ai_use_case?.trim() || null,
    ai_purpose: form.ai_purpose?.trim() || null,
    ai_risk_classification: form.ai_risk_classification || "unknown",
    eu_ai_act_category: form.eu_ai_act_category?.trim() || null,
    risk_reason: form.risk_reason?.trim() || null,
    ai_model_vendor: form.ai_model_vendor?.trim() || null,
    ai_model_name: form.ai_model_name?.trim() || null,
    ai_model_version: form.ai_model_version?.trim() || null,
    processes_personal_data: !!form.processes_personal_data,
    processes_special_category_data: !!form.processes_special_category_data,
    automated_decision_making: !!form.automated_decision_making,
    human_oversight: !!form.human_oversight,
    trains_on_customer_data: !!form.trains_on_customer_data,
    transparency_measures: form.transparency_measures?.trim() || null,
    data_location: form.data_location?.trim() || null,
    eu_data_storage: form.eu_data_storage === "unknown" ? null : !!form.eu_data_storage,
    retention_period: form.retention_period?.trim() || null,
    dpia_required: !!form.dpia_required,
    dpia_completed: !!form.dpia_completed,
    dpia_notes: form.dpia_notes?.trim() || null,
    dpa_present: !!form.dpa_present,
    subprocessor_known: !!form.subprocessor_known,
    security_documentation_present: !!form.security_documentation_present,
    status: form.status || "concept",
    owner_name: form.owner_name?.trim() || null,
    owner_department: form.owner_department?.trim() || null,
    review_frequency: form.review_frequency?.trim() || null,
    last_review_date: form.last_review_date || null,
    next_review_date: form.next_review_date || null,
    notes: form.notes?.trim() || null,
    created_by: userId || null,
    updated_at: new Date().toISOString(),
  };
}

function AiSummaryCard({ label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{hint}</div>
    </div>
  );
}

export default function AIRegister() {
  const { session, organization, profile, loading: appLoading } = useApp();
  const client = supabase();
  const nav = useNavigate();
  const toast = useToast();
  const orgId = organization?.id || profile?.organization_id || null;

  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [mitigations, setMitigations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mitigationForm, setMitigationForm] = useState({ title: "", description: "", mitigation_type: "governance", priority: "medium", due_date: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appLoading) return;
    if (!session) return nav("/login", { replace: true });
    if (!orgId) return nav("/onboarding", { replace: true });
    loadAll();
  }, [session, orgId, appLoading]);

  async function loadAll() {
    if (!client || !orgId) return;
    setLoading(true);
    setErr("");
    const [aiRes, supRes, appRes, mitRes] = await Promise.all([
      client.from("ai_register").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      client.from("suppliers").select("id,name").eq("organization_id", orgId).order("name"),
      client.from("applications").select("id,name,supplier_id").eq("organization_id", orgId).order("name"),
      client.from("ai_register_mitigations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    ]);
    if (aiRes.error) setErr(aiRes.error.message);
    setRows(aiRes.data || []);
    setSuppliers(supRes.data || []);
    setApplications(appRes.data || []);
    setMitigations(mitRes.data || []);
    setLoading(false);
  }

  function edit(row) {
    setSelectedId(row.id);
    setForm({ ...EMPTY_FORM, ...row, supplier_id: row.supplier_id || "", application_id: row.application_id || "", subprocessor_id: row.subprocessor_id || "", last_review_date: row.last_review_date || "", next_review_date: row.next_review_date || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setField(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }

  async function save() {
    setErr("");
    if (!form.name.trim()) return setErr("Naam van AI-toepassing is verplicht.");
    if (!client || !orgId) return;
    setSaving(true);
    const payload = cleanPayload(form, orgId, session?.user?.id);
    const res = form.id
      ? await client.from("ai_register").update(payload).eq("id", form.id).eq("organization_id", orgId).select("*").maybeSingle()
      : await client.from("ai_register").insert(payload).select("*").maybeSingle();
    setSaving(false);
    if (res.error) { setErr(res.error.message); toast.error(res.error.message); return; }
    toast.success("AI-registeritem opgeslagen.");
    setForm(EMPTY_FORM);
    setSelectedId(null);
    await loadAll();
  }

  async function remove(row) {
    if (!window.confirm(`AI-registeritem "${row.name}" verwijderen?`)) return;
    const { error } = await client.from("ai_register").delete().eq("id", row.id).eq("organization_id", orgId);
    if (error) { setErr(error.message); toast.error(error.message); return; }
    toast.success("AI-registeritem verwijderd.");
    await loadAll();
  }

  async function addMitigation(aiRegisterId) {
    if (!mitigationForm.title.trim()) return setErr("Titel van maatregel is verplicht.");
    const payload = { organization_id: orgId, ai_register_id: aiRegisterId, ...mitigationForm, title: mitigationForm.title.trim(), description: mitigationForm.description?.trim() || null, due_date: mitigationForm.due_date || null };
    const { error } = await client.from("ai_register_mitigations").insert(payload);
    if (error) { setErr(error.message); toast.error(error.message); return; }
    toast.success("Maatregel toegevoegd.");
    setMitigationForm({ title: "", description: "", mitigation_type: "governance", priority: "medium", due_date: "" });
    await loadAll();
  }

  const enriched = useMemo(() => rows.map((row) => ({ ...row, supplierName: suppliers.find((s) => s.id === row.supplier_id)?.name || "Niet gekoppeld", applicationName: applications.find((a) => a.id === row.application_id)?.name || "Niet gekoppeld", warnings: buildAiWarnings(row) })), [rows, suppliers, applications]);
  const filtered = enriched.filter((row) => {
    const hay = `${row.name} ${row.description || ""} ${row.supplierName} ${row.applicationName} ${row.ai_model_vendor || ""} ${row.ai_model_name || ""}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (riskFilter === "all" || row.ai_risk_classification === riskFilter);
  });
  const stats = useMemo(() => ({ total: rows.length, high: rows.filter((r) => r.ai_risk_classification === "high" || r.ai_risk_classification === "unacceptable").length, dpia: rows.filter((r) => r.dpia_required && !r.dpia_completed).length, warnings: enriched.reduce((n, r) => n + r.warnings.length, 0) }), [rows, enriched]);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">AI-register</h1>
            <p className="mt-1 text-sm text-slate-600">Registreer AI-toepassingen volgens EU AI Act-risicoklassen, AVG-governance, DPIA-status en mitigerende maatregelen.</p>
          </div>
          <button className="btn" onClick={() => { setForm(EMPTY_FORM); setSelectedId(null); }}>Nieuw AI-item</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4"><AiSummaryCard label="AI-items" value={stats.total} hint="Geregistreerd" /><AiSummaryCard label="Hoog/onaanvaardbaar" value={stats.high} hint="Prioriteit" /><AiSummaryCard label="DPIA open" value={stats.dpia} hint="Nog afronden" /><AiSummaryCard label="Alerts" value={stats.warnings} hint="Governance signalen" /></div>
      {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

      <div className="card p-4 space-y-4">
        <div className="font-semibold">{selectedId ? "AI-registeritem bewerken" : "Nieuw AI-registeritem"}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1"><span className="text-sm font-medium">Naam *</span><input className="w-full" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Bijv. Copilot, EduGenAI, AI in toetsing" /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Risicoklasse</span><select className="w-full" value={form.ai_risk_classification} onChange={(e) => setField("ai_risk_classification", e.target.value)}>{AI_RISK_CLASSIFICATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm font-medium">Leverancier</span><select className="w-full" value={form.supplier_id} onChange={(e) => setField("supplier_id", e.target.value)}><option value="">Niet gekoppeld</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm font-medium">Applicatie</span><select className="w-full" value={form.application_id} onChange={(e) => setField("application_id", e.target.value)}><option value="">Niet gekoppeld</option>{applications.filter((a) => !form.supplier_id || a.supplier_id === form.supplier_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm font-medium">AI-provider</span><input className="w-full" value={form.ai_model_vendor || ""} onChange={(e) => setField("ai_model_vendor", e.target.value)} placeholder="Bijv. Microsoft, OpenAI, Google" /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Model / dienst</span><input className="w-full" value={form.ai_model_name || ""} onChange={(e) => setField("ai_model_name", e.target.value)} placeholder="Bijv. GPT-4.1, Azure OpenAI, Gemini" /></label>
          <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Use case / doel</span><textarea className="w-full min-h-[90px]" value={form.ai_use_case || ""} onChange={(e) => setField("ai_use_case", e.target.value)} placeholder="Waarvoor wordt AI gebruikt, in welk proces en door welke gebruikersgroep?" /></label>
          <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Risico-onderbouwing</span><textarea className="w-full min-h-[80px]" value={form.risk_reason || ""} onChange={(e) => setField("risk_reason", e.target.value)} placeholder="Waarom deze risicoklasse? Denk aan onderwijsbeoordeling, HR, profiling, AVG of transparantieplicht." /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[ ["processes_personal_data", "Persoonsgegevens"], ["processes_special_category_data", "Bijzondere gegevens"], ["automated_decision_making", "Automatische besluitvorming"], ["human_oversight", "Menselijk toezicht"], ["trains_on_customer_data", "Training op klantdata"], ["dpia_required", "DPIA vereist"], ["dpia_completed", "DPIA afgerond"], ["dpa_present", "DPA aanwezig"], ["subprocessor_known", "Subverwerkers bekend"], ["security_documentation_present", "Security documentatie"], ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={!!form[key]} onChange={(e) => setField(key, e.target.checked)} /><span className="text-sm font-medium">{label}</span></label>)}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1"><span className="text-sm font-medium">Datalocatie</span><input className="w-full" value={form.data_location || ""} onChange={(e) => setField("data_location", e.target.value)} placeholder="EU, NL, VS, onbekend" /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Bewaartermijn</span><input className="w-full" value={form.retention_period || ""} onChange={(e) => setField("retention_period", e.target.value)} placeholder="Bijv. 30 dagen, contractduur" /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Status</span><select className="w-full" value={form.status} onChange={(e) => setField("status", e.target.value)}>{AI_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm font-medium">Eigenaar</span><input className="w-full" value={form.owner_name || ""} onChange={(e) => setField("owner_name", e.target.value)} /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Afdeling</span><input className="w-full" value={form.owner_department || ""} onChange={(e) => setField("owner_department", e.target.value)} /></label>
          <label className="space-y-1"><span className="text-sm font-medium">Volgende review</span><input type="date" className="w-full" value={form.next_review_date || ""} onChange={(e) => setField("next_review_date", e.target.value)} /></label>
          <label className="space-y-1 md:col-span-3"><span className="text-sm font-medium">Transparantiemaatregelen / notities</span><textarea className="w-full min-h-[80px]" value={form.transparency_measures || ""} onChange={(e) => setField("transparency_measures", e.target.value)} placeholder="Bijv. gebruikers informeren, AI-label, instructie, logging, disclaimer." /></label>
        </div>
        <div className="flex gap-2"><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan AI-item"}</button>{selectedId ? <button className="btn" onClick={() => { setForm(EMPTY_FORM); setSelectedId(null); }}>Annuleren</button> : null}</div>
      </div>

      <div className="card p-4"><div className="flex flex-wrap gap-3"><input className="min-w-[260px] flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoeken in AI-register…" /><select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option value="all">Alle risicoklassen</option>{AI_RISK_CLASSIFICATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div></div>

      <div className="grid gap-4">
        {loading ? <div className="card p-4 text-sm text-slate-600">AI-register laden…</div> : null}
        {!loading && filtered.length === 0 ? <Notice title="Geen AI-items gevonden">Voeg het eerste AI-registeritem toe of pas je filter aan.</Notice> : null}
        {filtered.map((row) => {
          const rowMitigations = mitigations.filter((m) => m.ai_register_id === row.id);
          return <div key={row.id} className="card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{row.name}</h2><AIRiskBadge value={row.ai_risk_classification} /><span className="badge">{aiStatusLabel(row.status)}</span></div><div className="mt-1 text-sm text-slate-600">{row.supplierName} · {row.applicationName}</div></div><div className="flex gap-2"><button className="btn" onClick={() => edit(row)}>Bewerken</button><button className="btn" onClick={() => remove(row)}>Verwijderen</button></div></div>{row.ai_use_case ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{row.ai_use_case}</p> : null}<div className="grid gap-2 md:grid-cols-3 text-sm"><div><strong>Provider:</strong> {row.ai_model_vendor || "Niet bekend"}</div><div><strong>Model:</strong> {row.ai_model_name || "Niet bekend"}</div><div><strong>Datalocatie:</strong> {row.data_location || "Niet bekend"}</div></div>{row.warnings.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="text-sm font-semibold text-amber-900">Governance alerts</div><ul className="mt-1 list-disc pl-5 text-sm text-amber-900">{row.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div> : null}<div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-semibold">Maatregelen ({rowMitigations.length})</div>{rowMitigations.length ? <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{rowMitigations.map((m) => <li key={m.id}><strong>{m.title}</strong> · {m.status} · {m.priority}</li>)}</ul> : <div className="mt-1 text-sm text-slate-600">Nog geen maatregelen vastgelegd.</div>}<div className="mt-3 grid gap-2 md:grid-cols-4"><input className="md:col-span-2" value={mitigationForm.title} onChange={(e) => setMitigationForm((p) => ({ ...p, title: e.target.value }))} placeholder="Nieuwe maatregel" /><select value={mitigationForm.mitigation_type} onChange={(e) => setMitigationForm((p) => ({ ...p, mitigation_type: e.target.value }))}>{MITIGATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select><button className="btn" onClick={() => addMitigation(row.id)}>Toevoegen</button></div></div></div>;
        })}
      </div>

      <div className="card p-4"><h2 className="font-semibold">Registratie-aanbevelingen</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{AI_RECOMMENDATIONS.map((r) => <div key={r.title} className="rounded-xl border border-slate-200 bg-white p-3"><div className="font-semibold text-slate-900">{r.title}</div><div className="mt-1 text-xs text-slate-500">Trigger: {r.trigger}</div><div className="mt-2 text-sm text-slate-700">{r.advice}</div></div>)}</div></div>
    </div>
  );
}
