import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";

const initialForm = {
  contract_title: "",
  supplier_id: "",
  service_name: "",
  contract_manager_profile_id: "",
  contract_owner_profile_id: "",
  organizational_unit: "",
  start_date: "",
  end_date: "",
  notice_period_months: 3,
  auto_renewal: false,
  renewal_period_months: "",
  annual_amount: "",
  total_contract_value: "",
  cost_center: "",
  indexation: false,
  review_date: "",
  decision_due_date: "",
  status: "concept",
};

function addMonths(dateValue, months) {
  if (!dateValue) return "";
  const d = new Date(`${dateValue}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function subtractMonths(dateValue, months) {
  return addMonths(dateValue, -months);
}

export default function ContractRegistrationWizard() {
  const nav = useNavigate();
  const toast = useToast();
  const client = supabase();
  const { session, organization, profile, loading: appLoading } = useApp();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [suppliers, setSuppliers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const orgId = organization?.id || profile?.organization_id;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (appLoading) return;
      if (!session) {
        nav("/login", { replace: true });
        return;
      }
      if (!orgId) {
        nav("/onboarding", { replace: true });
        return;
      }
      if (!client) return;

      const { data: supplierRows } = await client
        .from("supplier_master_view")
        .select("id, visible_name, name, is_active, is_merged")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .or("is_merged.is.null,is_merged.eq.false")
        .order("visible_name", { ascending: true });

      const { data: profileRows } = await client
        .from("profiles")
        .select("id, display_name, full_name, first_name, last_name, role, is_contract_manager, contract_workspace_enabled")
        .eq("organization_id", orgId)
        .order("display_name", { ascending: true });

      if (cancelled) return;
      setSuppliers(supplierRows || []);
      setProfiles(profileRows || []);
    }

    load();
    return () => { cancelled = true; };
  }, [appLoading, session, orgId, client, nav]);

  const contractManagers = useMemo(() => {
    return profiles.filter((p) => p.is_contract_manager || p.contract_workspace_enabled || p.role === "admin");
  }, [profiles]);

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "end_date") {
        if (!next.review_date) next.review_date = subtractMonths(value, 12);
        if (!next.decision_due_date) next.decision_due_date = subtractMonths(value, 6);
      }
      return next;
    });
  }

  function validateStep(targetStep = step) {
    if (targetStep === 1) {
      if (!form.contract_title.trim()) return "Contractnaam is verplicht.";
      if (!form.supplier_id) return "Leverancier is verplicht.";
      if (!form.contract_manager_profile_id) return "Contractmanager lijn is verplicht.";
    }
    if (targetStep === 2) {
      if (!form.start_date) return "Startdatum is verplicht.";
      if (!form.end_date) return "Einddatum is verplicht.";
      if (new Date(form.end_date) <= new Date(form.start_date)) return "Einddatum moet na startdatum liggen.";
    }
    return "";
  }

  function next() {
    const message = validateStep();
    if (message) {
      setErr(message);
      return;
    }
    setErr("");
    setStep((s) => Math.min(4, s + 1));
  }

  async function save() {
    const step1 = validateStep(1);
    const step2 = validateStep(2);
    const message = step1 || step2;
    if (message) {
      setErr(message);
      return;
    }
    if (!client || !orgId) return;

    setSaving(true);
    setErr("");

    const payload = {
      organization_id: orgId,
      supplier_id: form.supplier_id || null,
      contract_title: form.contract_title.trim(),
      service_name: form.service_name || null,
      contract_manager_profile_id: form.contract_manager_profile_id || null,
      contract_owner_profile_id: form.contract_owner_profile_id || null,
      organizational_unit: form.organizational_unit || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notice_period_months: Number(form.notice_period_months || 0),
      auto_renewal: Boolean(form.auto_renewal),
      renewal_period_months: form.renewal_period_months ? Number(form.renewal_period_months) : null,
      annual_amount: form.annual_amount ? Number(form.annual_amount) : 0,
      total_contract_value: form.total_contract_value ? Number(form.total_contract_value) : 0,
      cost_center: form.cost_center || null,
      indexation: Boolean(form.indexation),
      review_date: form.review_date || null,
      decision_due_date: form.decision_due_date || null,
      status: form.status,
      created_by: profile?.id || null,
      updated_by: profile?.id || null,
    };

    const { error } = await client.from("contract_basic_registrations").insert(payload);
    setSaving(false);

    if (error) {
      setErr(error.message);
      toast.error("Contract opslaan mislukt.");
      return;
    }

    toast.success("Contract basisregistratie opgeslagen.");
    nav("/contracts/workspace");
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Nieuw contract registreren</h1>
        <p className="mt-1 text-sm text-slate-600">Basisregistratie voor contractmanagers in de lijn. Documentupload volgt later.</p>

        {err ? <Notice title="Controle nodig" tone="danger">{err}</Notice> : null}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            [1, "Basis"],
            [2, "Looptijd"],
            [3, "Financieel"],
            [4, "Review"],
          ].map(([n, label]) => (
            <span key={n} className={"badge " + (step === n ? "bg-blue-50 text-blue-700 border-blue-200" : "")}>Stap {n}: {label}</span>
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label>Contractnaam *</label>
              <input className="w-full" value={form.contract_title} onChange={(e) => update("contract_title", e.target.value)} placeholder="Bijv. Licentie Canvas LMS" />
            </div>
            <div>
              <label>Leverancier *</label>
              <select className="w-full" value={form.supplier_id} onChange={(e) => update("supplier_id", e.target.value)}>
                <option value="">Kies leverancier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.visible_name || s.name}</option>)}
              </select>
            </div>
            <div>
              <label>Applicatie / dienst</label>
              <input className="w-full" value={form.service_name} onChange={(e) => update("service_name", e.target.value)} placeholder="Bijv. LMS, toetsplatform, dienstverlening" />
            </div>
            <div>
              <label>Contractmanager lijn *</label>
              <select className="w-full" value={form.contract_manager_profile_id} onChange={(e) => update("contract_manager_profile_id", e.target.value)}>
                <option value="">Kies contractmanager</option>
                {contractManagers.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label>Contracteigenaar / budgethouder</label>
              <select className="w-full" value={form.contract_owner_profile_id} onChange={(e) => update("contract_owner_profile_id", e.target.value)}>
                <option value="">Kies eigenaar</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label>Organisatieonderdeel</label>
              <input className="w-full" value={form.organizational_unit} onChange={(e) => update("organizational_unit", e.target.value)} />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label>Startdatum *</label>
              <input type="date" className="w-full" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div>
              <label>Einddatum *</label>
              <input type="date" className="w-full" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
            <div>
              <label>Opzegtermijn in maanden</label>
              <input type="number" className="w-full" value={form.notice_period_months} onChange={(e) => update("notice_period_months", e.target.value)} />
            </div>
            <div>
              <label>Verlengingsperiode in maanden</label>
              <input type="number" className="w-full" value={form.renewal_period_months} onChange={(e) => update("renewal_period_months", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" checked={form.auto_renewal} onChange={(e) => update("auto_renewal", e.target.checked)} />
              Stilzwijgende verlenging
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label>Jaarbedrag</label>
              <input type="number" className="w-full" value={form.annual_amount} onChange={(e) => update("annual_amount", e.target.value)} />
            </div>
            <div>
              <label>Totale contractwaarde</label>
              <input type="number" className="w-full" value={form.total_contract_value} onChange={(e) => update("total_contract_value", e.target.value)} />
            </div>
            <div>
              <label>Kostenplaats</label>
              <input className="w-full" value={form.cost_center} onChange={(e) => update("cost_center", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" checked={form.indexation} onChange={(e) => update("indexation", e.target.checked)} />
              Indexatie van toepassing
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label>Jaarlijkse reviewdatum</label>
              <input type="date" className="w-full" value={form.review_date} onChange={(e) => update("review_date", e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Leeg laten = automatisch 12 maanden vóór einddatum.</p>
            </div>
            <div>
              <label>Besluitmoment</label>
              <input type="date" className="w-full" value={form.decision_due_date} onChange={(e) => update("decision_due_date", e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Leeg laten = automatisch 6 maanden vóór einddatum.</p>
            </div>
            <div>
              <label>Status</label>
              <select className="w-full" value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="concept">Concept</option>
                <option value="active">Actief</option>
                <option value="review_required">Review nodig</option>
              </select>
            </div>
            <Notice title="Samenvatting">
              Na opslaan verschijnt dit contract in de Contract Workspace. Governix bewaakt de reviewdatum en het besluitmoment.
            </Notice>
          </div>
        ) : null}

        <div className="mt-6 flex justify-between">
          <button className="btn" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>Vorige</button>
          {step < 4 ? <button className="btn btn-primary" onClick={next}>Volgende</button> : <button className="btn btn-primary" disabled={saving} onClick={save}>Contract opslaan</button>}
        </div>
      </div>
    </div>
  );
}
