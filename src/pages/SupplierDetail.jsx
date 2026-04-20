import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Notice from "../components/Notice";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { normalizeKvk } from "../lib/kvk";
import { normalizeClassification } from "../lib/normalizeClassification";
import { useToast } from "../components/ToastProvider";
import {
  GOVERNANCE_CATEGORIES,
  isItemApplicable,
} from "../lib/governanceItems";
import {
  computeGovernanceStats,
  loadGovernance,
  setGovernanceNote,
  toggleGovernanceItem,
} from "../lib/governanceStore";
import SupplierRiskTab from "../components/suppliers/SupplierRiskTab";
import SupplierPerformanceTab from "../components/suppliers/SupplierPerformanceTab";
import SupplierManagementChecklistTab from "../components/suppliers/SupplierManagementChecklistTab";
import SupplierContractsTab from "../components/suppliers/SupplierContractsTab";
import SupplierApplicationsTab from "../components/suppliers/SupplierApplicationsTab";
import SupplierSubprocessorsTab from "../components/suppliers/SupplierSubprocessorsTab";
import SupplierDocumentsTab from "../components/suppliers/SupplierDocumentsTab";
import SupplierMeetingsTab from "../components/suppliers/SupplierMeetingsTab";
import SupplierActionsTab from "../components/suppliers/SupplierActionsTab";
import {
  SUPPLIER_DOMAIN_OPTIONS,
  supplierDomainLabel,
} from "../lib/supplierDomains";

function pctToLight(pct) {
  if (pct >= 80) return "green";
  if (pct >= 40) return "amber";
  return "red";
}

function StrategyBadge({ value }) {
  const s = (value || "").toLowerCase();
  const map = {
    "strategische leverancier": "bg-red-50 text-red-700 border-red-200",
    strategisch: "bg-red-50 text-red-700 border-red-200",
    knelpunt: "bg-amber-50 text-amber-800 border-amber-200",
    hefboom: "bg-sky-50 text-sky-800 border-sky-200",
    routine: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  const cls = map[s] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border " +
        cls
      }
    >
      {value || "—"}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-16 mx-auto max-w-3xl px-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
            <div className="font-semibold">{title}</div>
            <button className="btn" onClick={onClose}>
              Sluiten
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function cleanUpdate(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function formatSbError(e) {
  if (!e) return "Onbekende fout";
  if (typeof e === "string") return e;
  const parts = [];
  if (e.message) parts.push(e.message);
  if (e.details) parts.push(e.details);
  if (e.hint) parts.push(e.hint);
  if (e.code) parts.push(`(${e.code})`);
  return parts.filter(Boolean).join(" ");
}

export default function SupplierDetail() {
  const toast = useToast();
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { session, organization, profile, loading: appLoading } = useApp();
  const client = supabase();

  const [tab, setTab] = useState("gegevens");
  const [showClassHelp, setShowClassHelp] = useState(false);

  const [supplier, setSupplier] = useState(null);
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [governance, setGovernance] = useState({ checks: {}, notes: {} });
  const [govLoading, setGovLoading] = useState(false);
  const [govErr, setGovErr] = useState("");
  const [contacts, setContacts] = useState([]);
  const [deletedContactIds, setDeletedContactIds] = useState([]);
  const [evals, setEvals] = useState([]);
  const [err, setErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [draft, setDraft] = useState({
    name: "",
    kvk_number: "",
    classification: "",
    creditor_number: "",
    category: "generiek",
    notes: "",
  });

  const orgId = organization?.id || profile?.organization_id || null;

  const selectTab = (key) => {
    setTab(key);
    try {
      window?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setSaveMsg("");

      if (appLoading) return;

      if (!session) {
        nav("/login", { replace: true });
        return;
      }

      if (!orgId) {
        nav("/onboarding", { replace: true });
        return;
      }

      if (!client) {
        nav("/settings", { replace: true });
        return;
      }

      const { data: s, error: sErr } = await client
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (cancelled) return;

      if (sErr) {
        setErr(sErr.message);
        toast.error(sErr.message);
        return;
      }

      if (!s) {
        const msg = "Leverancier niet gevonden binnen deze organisatie.";
        setErr(msg);
        toast.error(msg);
        return;
      }

      setSupplier(s);

      setDraft({
        name: s.name ?? "",
        kvk_number: s.kvk_number ?? "",
        classification: s.classification ?? "",
        creditor_number: s.creditor_number ?? "",
        category: s.category ?? "generiek",
        notes: s.notes ?? "",
      });

      setProgressLoading(true);
      const { data: pRow, error: pErr } = await client
        .from("supplier_progress")
        .select("*")
        .eq("supplier_id", id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!cancelled) {
        if (pErr) {
          console.warn("supplier_progress load failed", pErr);
          setProgress(null);
        } else {
          setProgress(pRow || null);
        }
        setProgressLoading(false);
      }

      const { data: c, error: cErr } = await client
        .from("supplier_contacts")
        .select("id,full_name,role_title,email,phone,is_primary,created_at")
        .eq("supplier_id", id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (!cancelled) {
        if (cErr) {
          console.warn("supplier_contacts load failed", cErr);
        }
        setContacts(
          (c || []).map((x) => ({
            id: x.id,
            name: x.full_name || "",
            role: x.role_title || "",
            email: x.email || "",
            phone: x.phone || "",
            is_primary: !!x.is_primary,
          })),
        );
        setDeletedContactIds([]);
      }

      const { data: e, error: eErr } = await client
        .from("evaluations")
        .select("id,title,strategy,created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (eErr) {
          console.warn("evaluations load failed", eErr);
        }
        setEvals(e || []);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [id, session, orgId, client, nav, toast, appLoading]);

  useEffect(() => {
    let alive = true;

    async function runGov() {
      if (!client || !orgId || !id) return;

      setGovErr("");
      const showSpinner = tab === "governance";
      if (showSpinner) setGovLoading(true);

      try {
        const map = await loadGovernance({
          client,
          organizationId: orgId,
          supplierId: id,
        });
        if (!alive) return;
        setGovernance(map || { checks: {}, notes: {} });
      } catch (e) {
        if (!alive) return;
        setGovErr(e?.message || String(e));
      } finally {
        if (alive && showSpinner) setGovLoading(false);
      }
    }

    runGov();
    return () => {
      alive = false;
    };
  }, [client, orgId, id, tab]);

  const lastEval = useMemo(() => (evals?.length ? evals[0] : null), [evals]);
  const activePill = supplier?.is_active === false ? "inactief" : "actief";
  const govStats = useMemo(
    () => computeGovernanceStats(governance?.checks),
    [governance],
  );

  const criticalGov = useMemo(() => {
    const c = governance?.checks || {};
    const n = governance?.notes || {};
    return {
      sla: !!c["contract.sla_approved"],
      dab: !!c["contract.dab_present"],
      dpa: !!c["contract.dpa_signed"],
      meetings: !!c["ops.meetings_planned"],
      registryRegistered: !!c["contract.nttl_registered"],
      notesCount: Object.values(n || {}).filter(
        (v) => String(v || "").trim().length > 0,
      ).length,
    };
  }, [governance]);

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateContact(idx, patch) {
    setContacts((arr) => {
      const next = [...arr];
      next[idx] = { ...(next[idx] || {}), ...patch };
      return next;
    });
  }

  function addContact() {
    setContacts((arr) => [
      ...arr,
      { id: null, name: "", role: "", email: "", phone: "", is_primary: false },
    ]);
  }

  function removeContact(idx) {
    setContacts((arr) => {
      const next = [...arr];
      const removed = next[idx];
      if (removed?.id) setDeletedContactIds((ids) => [...ids, removed.id]);
      next.splice(idx, 1);
      return next;
    });
  }

  const onToggleGov = async (itemKey, next) => {
    const nextState = {
      checks: { ...(governance?.checks || {}), [itemKey]: !!next },
      notes: { ...(governance?.notes || {}) },
    };
    setGovernance(nextState);
    try {
      await toggleGovernanceItem({
        client,
        organizationId: orgId,
        supplierId: id,
        key: itemKey,
        value: !!next,
      });
    } catch (e) {
      console.warn("toggleGovernanceItem failed", e);
    }
  };

  const onNoteGov = async (itemKey, note) => {
    const nextState = {
      checks: { ...(governance?.checks || {}) },
      notes: { ...(governance?.notes || {}), [itemKey]: note },
    };
    setGovernance(nextState);
    try {
      await setGovernanceNote({
        client,
        organizationId: orgId,
        supplierId: id,
        key: itemKey,
        note,
      });
    } catch (e) {
      console.warn("setGovernanceNote failed", e);
    }
  };

  const exportGovernanceCsv = () => {
    const rows = [];
    rows.push(["Categorie", "Item", "Status", "Opmerking"].join(";"));
    GOVERNANCE_CATEGORIES.forEach((cat) => {
      cat.items.forEach((it) => {
        const applicable =
          it.type === "meta" ? true : isItemApplicable(it, governance?.checks);
        if (!applicable) return;
        const status = governance?.checks?.[it.key] ? "OK" : "Open";
        const note = governance?.notes?.[it.key] || "";
        rows.push(
          [cat.label, it.label, status, note]
            .map((s) => `"${String(s).replaceAll('"', '""')}"`)
            .join(";"),
        );
      });
    });
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (supplier?.name || "leverancier")
      .replaceAll(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replaceAll(" ", "_");
    a.href = url;
    a.download = `governance_${safeName}_${govStats.percent}pct.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  async function saveProgress() {
    try {
      const { error } = await client.from("supplier_progress").upsert(
        {
          organization_id: orgId,
          supplier_id: id,
          inventory_complete: progress?.inventory_complete || false,
          contract_received: progress?.contract_received || false,
          last_meeting_at: progress?.last_meeting_at || null,
          notes: progress?.notes || null,
        },
        { onConflict: "organization_id,supplier_id" },
      );
      if (error) throw error;
      toast.success("Voortgang opgeslagen");
    } catch (err) {
      toast.error("Fout bij opslaan: " + err.message);
    }
  }

  async function save() {
    setErr("");
    setSaveMsg("");

    if (!orgId) {
      setErr("Je account is nog niet gekoppeld aan een organisatie.");
      return;
    }

    if (!client) {
      setErr("Supabase is nog niet geconfigureerd.");
      return;
    }

    const n = (draft.name || "").trim();
    const kvk = normalizeKvk(draft.kvk_number);

    if (!n) {
      setErr("Naam organisatie is verplicht.");
      return;
    }

    if (!kvk) {
      setErr("KVK-nummer is verplicht.");
      return;
    }

    if (kvk.length !== 8) {
      setErr("KVK-nummer moet uit precies 8 cijfers bestaan.");
      return;
    }

    setSaving(true);

    try {
      const payload = cleanUpdate({
        name: n,
        kvk_number: kvk,
        classification: normalizeClassification(
          (draft.classification || "").trim() || null,
        ),
        creditor_number: (draft.creditor_number || "").trim() || null,
        category: (draft.category || "generiek").trim() || "generiek",
        notes: (draft.notes || "").trim() || null,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await client
        .from("suppliers")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select("*")
        .maybeSingle();

      if (error) throw new Error(formatSbError(error));
      if (!data)
        throw new Error("Opslaan mislukt: geen leverancier teruggekregen.");

      setSupplier(data);
      setDraft({
        name: data.name ?? "",
        kvk_number: data.kvk_number ?? "",
        classification: data.classification ?? "",
        creditor_number: data.creditor_number ?? "",
        category: data.category ?? "generiek",
        notes: data.notes ?? "",
      });

      const uniqueDelete = Array.from(new Set(deletedContactIds || []));
      if (uniqueDelete.length) {
        const { error: delErr } = await client
          .from("supplier_contacts")
          .delete()
          .in("id", uniqueDelete);
        if (delErr) throw delErr;
      }

      const cleaned = (contacts || [])
        .map((c) => ({
          id: c.id || null,
          name: (c.name || "").trim(),
          role: (c.role || "").trim(),
          email: (c.email || "").trim(),
          phone: (c.phone || "").trim(),
          is_primary: !!c.is_primary,
        }))
        .filter((c) => c.name);

      let hasPrimary = false;
      const normalized = cleaned.map((c) => {
        const next = { ...c, is_primary: c.is_primary && !hasPrimary };
        if (next.is_primary) hasPrimary = true;
        return next;
      });

      const existing = normalized.filter((c) => c.id);
      if (existing.length) {
        const rows = existing.map((c) => ({
          id: c.id,
          organization_id: orgId,
          supplier_id: id,
          full_name: c.name,
          role_title: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          is_primary: c.is_primary,
        }));
        const { error: upErr } = await client
          .from("supplier_contacts")
          .upsert(rows, { onConflict: "id" });
        if (upErr) throw upErr;
      }

      const toInsert = normalized.filter((c) => !c.id);
      if (toInsert.length) {
        const rows = toInsert.map((c) => ({
          organization_id: orgId,
          supplier_id: id,
          full_name: c.name,
          role_title: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          is_primary: c.is_primary,
        }));
        const { error: insErr } = await client
          .from("supplier_contacts")
          .insert(rows);
        if (insErr) throw insErr;
      }

      const { data: c2, error: c2Err } = await client
        .from("supplier_contacts")
        .select("id,full_name,role_title,email,phone,is_primary,created_at")
        .eq("supplier_id", id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (c2Err) throw c2Err;

      setContacts(
        (c2 || []).map((x) => ({
          id: x.id,
          name: x.full_name || "",
          role: x.role_title || "",
          email: x.email || "",
          phone: x.phone || "",
          is_primary: !!x.is_primary,
        })),
      );
      setDeletedContactIds([]);
      setSaveMsg("De leverancier is bijgewerkt.");
    } catch (e) {
      setErr(formatSbError(e));
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { key: "gegevens", label: "Gegevens" },
    { key: "contactpersonen", label: "Contactpersonen" },
    { key: "applications", label: "Applicaties & beheer" },
    { key: "subprocessors", label: "Subverwerkers & AI" },
    { key: "risk", label: "Risico" },
    { key: "performance", label: "Prestaties" },
    { key: "management_checklist", label: "Beheersstatus" },
    { key: "governance", label: "Governance" },
    { key: "contracten", label: "Contracten" },
    { key: "documenten", label: "Documenten" },
    { key: "overleggen", label: "Overleggen" },
    { key: "acties", label: "Acties" },
  ];

  if (appLoading) {
    return (
      <div className="space-y-4">
        <div className="card p-6">
          <div className="text-sm text-slate-600">Leverancier laden…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        <Link className="underline" to="/suppliers">
          Leveranciers
        </Link>{" "}
        <span className="text-slate-400">›</span> {supplier?.name || "…"}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold truncate">
                {supplier?.name ?? "Leverancier"}
              </h1>
              <span className="badge">{activePill}</span>
              {draft?.classification ? (
                <StrategyBadge value={draft.classification} />
              ) : null}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-700">
                Domein: {supplierDomainLabel(draft?.category)}
              </span>
              {lastEval?.strategy ? (
                <StrategyBadge value={lastEval.strategy} />
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="badge">beoordelingen: {evals.length}</span>
              {supplier?.created_at ? (
                <span className="badge">
                  aangemaakt:{" "}
                  {new Date(supplier.created_at).toLocaleDateString("nl-NL")}
                </span>
              ) : null}
              <span className="badge">
                org: {organization?.name || "Gilde Opleidingen"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setInfoOpen(true)}>
              ℹ️ Uitleg classificatie
            </button>
            <Link className="btn" to="/methodiek">
              Governance
            </Link>
            <Link className="btn btn-primary" to="/evaluations/new">
              Nieuwe beoordeling
            </Link>
          </div>
        </div>

        <div className="p-5 border-b border-slate-200">
          <div className="card glass-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Voortgang
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Overzicht van inventarisatie, contract en overleg.
                </p>
              </div>
              <span className="badge">
                {progressLoading ? "laden…" : "actueel"}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/60 p-3">
                <div className="text-xs font-semibold text-slate-500">
                  Inventarisatie
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {progress?.inventory_complete ? "Compleet ✅" : "Open"}
                </div>
              </div>
              <div className="rounded-xl bg-white/60 p-3">
                <div className="text-xs font-semibold text-slate-500">
                  Contract ontvangen
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {progress?.contract_received ? "Ja ✅" : "Nee"}
                </div>
              </div>
              <div className="rounded-xl bg-white/60 p-3">
                <div className="text-xs font-semibold text-slate-500">
                  Overleg
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {progress?.last_meeting_at
                    ? new Date(progress.last_meeting_at).toLocaleDateString()
                    : "Nog niet"}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white/50 p-3 border border-slate-200/70">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-semibold text-slate-500">
                  Status overzicht
                </div>
                <div className="text-xs text-slate-600">
                  Checklist:{" "}
                  <span className="font-semibold text-slate-800">
                    {govStats.checked}/{govStats.total}
                  </span>
                  {govStats.total ? (
                    <span className="text-slate-500">
                      {" "}
                      ({govStats.percent}%)
                    </span>
                  ) : null}
                  {criticalGov.notesCount ? (
                    <span className="text-slate-500">
                      {" "}
                      • opmerkingen: {criticalGov.notesCount}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`badge ${criticalGov.sla ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                >
                  SLA: {criticalGov.sla ? "akkoord" : "open"}
                </span>
                <span
                  className={`badge ${criticalGov.dab ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                >
                  DAB: {criticalGov.dab ? "akkoord" : "open"}
                </span>
                <span
                  className={`badge ${criticalGov.dpa ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                >
                  Verwerkersov.: {criticalGov.dpa ? "aanwezig" : "n.v.t./open"}
                </span>
                <span
                  className={`badge ${criticalGov.meetings ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                >
                  Overleggen: {criticalGov.meetings ? "gepland" : "niet"}
                </span>
                <span
                  className={`badge ${criticalGov.registryRegistered ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                >
                  Registratie:{" "}
                  {criticalGov.registryRegistered ? "vastgelegd" : "open"}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2">
              <label className="flex items-start gap-2 rounded-xl bg-white/60 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!progress?.inventory_complete}
                  onChange={(e) =>
                    setProgress((p) => ({
                      ...(p || {}),
                      inventory_complete: e.target.checked,
                    }))
                  }
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Inventarisatie afgerond
                  </div>
                  <div className="text-xs text-slate-600">
                    Scope, modules, aantallen, owners vastgelegd.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2 rounded-xl bg-white/60 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!progress?.contract_received}
                  onChange={(e) =>
                    setProgress((p) => ({
                      ...(p || {}),
                      contract_received: e.target.checked,
                    }))
                  }
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Contract/SLA ontvangen
                  </div>
                  <div className="text-xs text-slate-600">
                    Contractset compleet.
                  </div>
                </div>
              </label>

              <div className="rounded-xl bg-white/60 p-3">
                <div className="text-sm font-semibold text-slate-900">
                  Laatste overleg
                </div>
                <div className="text-xs text-slate-600">
                  Datum van laatste of eerstvolgende overleg.
                </div>
                <input
                  type="date"
                  className="input mt-2"
                  value={(progress?.last_meeting_at || "").slice(0, 10)}
                  onChange={(e) =>
                    setProgress((p) => ({
                      ...(p || {}),
                      last_meeting_at: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white/60 p-3 text-sm text-slate-700">
              <div className="text-xs font-semibold text-slate-500">
                Notities
              </div>
              <textarea
                className="input mt-2 min-h-[90px]"
                placeholder="Bijv. status, acties, blokkades, afspraken…"
                value={progress?.notes || ""}
                onChange={(e) =>
                  setProgress((p) => ({ ...(p || {}), notes: e.target.value }))
                }
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={saveProgress}>
                  Opslaan
                </button>
                <button className="btn" onClick={() => selectTab("governance")}>
                  Naar checklists
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[240px_1fr]">
          <aside className="bg-slate-900 text-white/90 p-4">
            <div className="text-xs uppercase tracking-wider text-white/60 mb-3">
              Menu
            </div>
            <nav className="space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => selectTab(t.key)}
                  className={
                    "w-full text-left px-3 py-2 rounded-lg transition " +
                    (tab === t.key ? "bg-white/15" : "hover:bg-white/10")
                  }
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="p-5">
            {err ? (
              <Notice title="Fout" tone="danger">
                {err}
              </Notice>
            ) : null}
            {saveMsg ? (
              <Notice title="" tone="success">
                {saveMsg}
              </Notice>
            ) : null}

            {tab === "gegevens" ? (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold">Gegevens</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Basisgegevens van de leverancier.
                </p>

                <div className="mt-4 space-y-4">
                  <Field label="Naam Organisatie" required>
                    <input
                      value={draft.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full"
                      placeholder="Bijv. Topicus"
                    />
                  </Field>

                  <Field
                    label="KVK-nummer"
                    required
                    hint="Alleen cijfers (8 cijfers)."
                  >
                    <input
                      value={draft.kvk_number}
                      onChange={(e) =>
                        setField(
                          "kvk_number",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      className="w-full"
                      placeholder="Bijv. 74338269"
                    />
                  </Field>

                  <Field
                    label={
                      <span className="inline-flex items-center gap-2">
                        Classificatie{" "}
                        <button
                          className="btn"
                          type="button"
                          onClick={() => setInfoOpen(true)}
                        >
                          ℹ️
                        </button>
                      </span>
                    }
                  >
                    <select
                      value={draft.classification}
                      onChange={(e) =>
                        setField("classification", e.target.value)
                      }
                      className="w-full"
                    >
                      <option value="">— kies —</option>
                      <option value="Strategisch">
                        Strategische leverancier
                      </option>
                      <option value="Knelpunt">Knelpunt leverancier</option>
                      <option value="Hefboom">Hefboom leverancier</option>
                      <option value="Routine">Routine leverancier</option>
                    </select>
                  </Field>

                  <Field label="Crediteurnummer">
                    <input
                      value={draft.creditor_number}
                      onChange={(e) =>
                        setField("creditor_number", e.target.value)
                      }
                      className="w-full"
                    />
                  </Field>

                  <Field label="Domein">
                    <select
                      value={draft.category || "generiek"}
                      onChange={(e) => setField("category", e.target.value)}
                      className="w-full"
                    >
                      {SUPPLIER_DOMAIN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Opmerkingen">
                    <textarea
                      value={draft.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      className="w-full min-h-[120px]"
                    />
                  </Field>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={save}
                      disabled={saving}
                    >
                      {saving ? "Opslaan…" : "Opslaan"}
                    </button>
                    <Link className="btn" to="/suppliers">
                      Terug
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "applications" ? (
              <SupplierApplicationsTab supplier={supplier} organization={organization} />
            ) : null}

            {tab === "subprocessors" ? (
              <SupplierSubprocessorsTab supplier={supplier} />
            ) : null}

            {tab === "contactpersonen" ? (
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Contactpersonen</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Beheer contactpersonen van deze leverancier.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={addContact}>
                    + Contactpersoon
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(contacts || []).length === 0 ? (
                    <Notice title="Nog geen contactpersonen">
                      Klik op “+ Contactpersoon” om er één toe te voegen.
                    </Notice>
                  ) : null}

                  {(contacts || []).map((c, idx) => (
                    <div key={idx} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold">
                          Contactpersoon {idx + 1}
                        </div>
                        <button
                          className="btn"
                          onClick={() => removeContact(idx)}
                        >
                          Verwijderen
                        </button>
                      </div>

                      <div className="mt-3 grid md:grid-cols-2 gap-3">
                        <Field label="Naam" required>
                          <input
                            value={c.name || ""}
                            onChange={(e) =>
                              updateContact(idx, { name: e.target.value })
                            }
                            className="w-full"
                          />
                        </Field>

                        <Field label="Rol / functie">
                          <input
                            value={c.role || ""}
                            onChange={(e) =>
                              updateContact(idx, { role: e.target.value })
                            }
                            className="w-full"
                          />
                        </Field>

                        <Field label="E-mail">
                          <input
                            value={c.email || ""}
                            onChange={(e) =>
                              updateContact(idx, { email: e.target.value })
                            }
                            className="w-full"
                          />
                        </Field>

                        <Field label="Telefoon">
                          <input
                            value={c.phone || ""}
                            onChange={(e) =>
                              updateContact(idx, { phone: e.target.value })
                            }
                            className="w-full"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={save}
                      disabled={saving}
                    >
                      {saving ? "Opslaan…" : "Opslaan"}
                    </button>
                    <Link className="btn" to="/suppliers">
                      Terug
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "risk" ? (
              <SupplierRiskTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
            {tab === "performance" ? (
              <SupplierPerformanceTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
            {tab === "management_checklist" ? (
              <SupplierManagementChecklistTab
                supplier={{
                  ...supplier,
                  category: draft?.category || supplier?.category,
                }}
              />
            ) : null}
            {tab === "governance" ? (
              <div className="max-w-4xl">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold">Governance</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Governance-checklist per leverancier.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn" onClick={exportGovernanceCsv}>
                      Export (CSV)
                    </button>
                  </div>
                </div>

                <div className="mt-4 card p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-semibold">Governance maturity</div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <TrafficLight value={pctToLight(govStats.percent)} />
                      <span>
                        {govStats.checked}/{govStats.total} compleet
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${govStats.percent}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {govStats.percent}%
                  </div>
                </div>

                {govErr ? (
                  <div className="mt-4">
                    <Notice title="Let op" tone="warning">
                      Governance-status kon niet volledig geladen worden.
                    </Notice>
                  </div>
                ) : null}

                {govLoading ? (
                  <div className="mt-4 text-sm text-slate-600">
                    Governance laden…
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {GOVERNANCE_CATEGORIES.map((cat) => (
                      <div key={cat.id} className="card p-4">
                        <div className="font-semibold">{cat.label}</div>
                        <div className="mt-3 grid md:grid-cols-2 gap-2">
                          {cat.items.map((it) => {
                            const applicable =
                              it.type === "meta"
                                ? true
                                : isItemApplicable(it, governance?.checks);
                            if (!applicable) return null;
                            const checked = !!governance?.checks?.[it.key];
                            const note = governance?.notes?.[it.key] || "";

                            return (
                              <div
                                key={it.key}
                                className={
                                  "p-3 rounded-xl border " +
                                  (checked
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : "border-slate-200 bg-white")
                                }
                              >
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={checked}
                                    onChange={(e) =>
                                      onToggleGov(it.key, e.target.checked)
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-slate-900">
                                      {it.label}
                                    </div>
                                    {it.note ? (
                                      <div className="text-xs text-slate-600 mt-0.5">
                                        {it.note}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>

                                <div className="mt-2">
                                  <input
                                    className="input w-full"
                                    placeholder="Opmerking (optioneel)"
                                    value={note}
                                    onChange={(e) =>
                                      onNoteGov(it.key, e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "contracten" ? (
              <SupplierContractsTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
            {tab === "documenten" ? (
              <SupplierDocumentsTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
            {tab === "overleggen" ? (
              <SupplierMeetingsTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
            {tab === "acties" ? (
              <SupplierActionsTab
                supplier={supplier}
                organization={organization}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Beoordelingen</h2>
          <Link className="btn" to="/evaluations/new">
            + Nieuwe beoordeling
          </Link>
        </div>

        <div className="mt-3 grid gap-3">
          {evals.length === 0 ? (
            <Notice title="Nog geen beoordelingen">
              Maak de eerste beoordeling aan.
            </Notice>
          ) : null}

          {evals.map((e) => (
            <Link
              key={e.id}
              className="card p-4 hover:bg-slate-50 no-underline transition border border-slate-200 hover:border-slate-300"
              to={`/evaluations/${e.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold">{e.title || "Beoordeling"}</div>
                <div className="text-sm text-slate-600">
                  {new Date(e.created_at).toLocaleString("nl-NL")}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-sm text-slate-600">
                <span className="badge">status: concept</span>
                <StrategyBadge value={e.strategy || "—"} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Modal
        open={infoOpen}
        title="Classificatie (Kraljic) – korte uitleg"
        onClose={() => setInfoOpen(false)}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p className="text-slate-600">
            Classificatie helpt om de juiste focus te kiezen in
            leveranciersmanagement.
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">Strategische leverancier</div>
                <StrategyBadge value="Strategisch" />
              </div>
              <p className="mt-2 text-slate-600">Hoog belang & hoog risico.</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">Knelpunt leverancier</div>
                <StrategyBadge value="Knelpunt" />
              </div>
              <p className="mt-2 text-slate-600">Hoog risico.</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">Hefboom leverancier</div>
                <StrategyBadge value="Hefboom" />
              </div>
              <p className="mt-2 text-slate-600">Hoge impact, laag risico.</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold">Routine leverancier</div>
                <StrategyBadge value="Routine" />
              </div>
              <p className="mt-2 text-slate-600">Laag belang & laag risico.</p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              className="btn btn-primary"
              to="/methodiek"
              onClick={() => setInfoOpen(false)}
            >
              Lees de volledige methodiek
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}
