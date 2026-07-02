import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  const target = new Date(`${dateValue}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function statusLabel(status) {
  switch (status) {
    case "active": return "Actief";
    case "review_required": return "Review nodig";
    case "ended": return "Beëindigd";
    case "concept":
    default: return "Concept";
  }
}

function urgency(contract) {
  const reviewDays = daysUntil(contract.review_date);
  const decisionDays = daysUntil(contract.decision_due_date);
  const endDays = daysUntil(contract.end_date);
  if (reviewDays !== null && reviewDays <= 0) return { label: "Review achterstallig", tone: "danger" };
  if (decisionDays !== null && decisionDays <= 30) return { label: "Besluit nodig", tone: "danger" };
  if (endDays !== null && endDays <= 180) return { label: "Loopt af", tone: "warning" };
  if (reviewDays !== null && reviewDays <= 30) return { label: "Review binnenkort", tone: "warning" };
  return { label: "In orde", tone: "ok" };
}

function badgeClass(tone) {
  if (tone === "danger") return "badge bg-red-50 text-red-700 border-red-200";
  if (tone === "warning") return "badge bg-amber-50 text-amber-700 border-amber-200";
  return "badge bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function ContractWorkspace() {
  const nav = useNavigate();
  const toast = useToast();
  const client = supabase();
  const { session, organization, profile, loading: appLoading } = useApp();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  const orgId = organization?.id || profile?.organization_id;
  const firstName = profile?.first_name || profile?.display_name?.split(" ")?.[0] || profile?.full_name?.split(" ")?.[0] || "";

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

      setLoading(true);
      setErr("");

      const isLimitedContractManager = Boolean(profile?.is_contract_manager || profile?.contract_workspace_enabled) && profile?.role !== "admin";

      let query = client
        .from("v_contractmanager_contracts")
        .select("*")
        .eq("organization_id", orgId)
        .order("review_date", { ascending: true, nullsFirst: false });

      if (isLimitedContractManager && profile?.id) {
        query = query.eq("contract_manager_profile_id", profile.id);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        toast.error("Contracten laden mislukt.");
        setContracts([]);
      } else {
        setContracts(data || []);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [appLoading, session, orgId, client, nav, toast, profile?.id, profile?.role, profile?.is_contract_manager, profile?.contract_workspace_enabled]);

  const stats = useMemo(() => {
    const reviewOpen = contracts.filter((c) => daysUntil(c.review_date) !== null && daysUntil(c.review_date) <= 30).length;
    const ending = contracts.filter((c) => daysUntil(c.end_date) !== null && daysUntil(c.end_date) <= 180).length;
    const decision = contracts.filter((c) => daysUntil(c.decision_due_date) !== null && daysUntil(c.decision_due_date) <= 60).length;
    return { total: contracts.length, reviewOpen, ending, decision };
  }, [contracts]);

  const filtered = useMemo(() => {
    if (filter === "review") return contracts.filter((c) => daysUntil(c.review_date) !== null && daysUntil(c.review_date) <= 30);
    if (filter === "ending") return contracts.filter((c) => daysUntil(c.end_date) !== null && daysUntil(c.end_date) <= 180);
    if (filter === "decision") return contracts.filter((c) => daysUntil(c.decision_due_date) !== null && daysUntil(c.decision_due_date) <= 60);
    return contracts;
  }, [contracts, filter]);

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Contract Workspace</h1>
            <p className="mt-1 text-sm text-slate-600">
              {firstName ? `Welkom ${firstName}. ` : ""}Hier registreer en bewaak je contracten waarvoor jij verantwoordelijk bent.
            </p>
          </div>
          <Link className="btn btn-primary" to="/contracts/new">Nieuw contract registreren</Link>
        </div>

        {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <button className="card p-4 text-left" onClick={() => setFilter("all")}>
            <div className="text-sm text-slate-500">Mijn contracten</div>
            <div className="mt-1 text-2xl font-bold">{stats.total}</div>
          </button>
          <button className="card p-4 text-left" onClick={() => setFilter("review")}>
            <div className="text-sm text-slate-500">Reviews open</div>
            <div className="mt-1 text-2xl font-bold">{stats.reviewOpen}</div>
          </button>
          <button className="card p-4 text-left" onClick={() => setFilter("ending")}>
            <div className="text-sm text-slate-500">Loopt af binnen 180 dagen</div>
            <div className="mt-1 text-2xl font-bold">{stats.ending}</div>
          </button>
          <button className="card p-4 text-left" onClick={() => setFilter("decision")}>
            <div className="text-sm text-slate-500">Besluitmoment nabij</div>
            <div className="mt-1 text-2xl font-bold">{stats.decision}</div>
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Contracten</h2>
            <p className="text-sm text-slate-500">Basisregistraties met review- en besluitmomenten.</p>
          </div>
          {filter !== "all" ? <button className="btn" onClick={() => setFilter("all")}>Filter wissen</button> : null}
        </div>

        <div className="mt-4 grid gap-3">
          {loading ? <div className="text-sm text-slate-500">Laden…</div> : null}
          {!loading && !filtered.length ? <div className="text-sm text-slate-500">Geen contracten gevonden.</div> : null}
          {filtered.map((contract) => {
            const u = urgency(contract);
            return (
              <div key={contract.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{contract.contract_title}</div>
                      <span className={badgeClass(u.tone)}>{u.label}</span>
                      <span className="badge">{statusLabel(contract.status)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {contract.supplier_name || "Leverancier onbekend"}{contract.service_name ? ` · ${contract.service_name}` : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="badge">Einde: {contract.end_date || "-"}</span>
                      <span className="badge">Review: {contract.review_date || "-"}</span>
                      <span className="badge">Besluit: {contract.decision_due_date || "-"}</span>
                      <span className="badge">Waarde: € {Number(contract.total_contract_value || 0).toLocaleString("nl-NL")}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
