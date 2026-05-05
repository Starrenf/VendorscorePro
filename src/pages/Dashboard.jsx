import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { loadGovernance } from "../lib/governanceStore";
import { DEMO_SUPPLIERS, governanceToLight } from "../lib/governanceCockpit";
import { isDemoMode } from "../lib/demoMode";
import { supplierDomainLabel } from "../lib/supplierDomains";
function isMissingTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

async function loadCriticalApplicationRows(client, orgId) {
  const normalize = (row, source) => ({
    ...row,
    source_table: source,
    id: row.id,
    organization_id: row.organization_id || orgId,
    supplier_id: row.supplier_id,
    name: row.name || row.application_name || row.title || "Naam onbekend",
    description: row.description || row.notes || "",
    functional_owner: row.functional_owner || row.owner || row.functional_manager || "",
    domain: row.domain || row.domein || row.category || row.application_domain || "",
    is_active: row.is_active !== false && String(row.status || "active").toLowerCase() !== "inactive",
    is_critical: row.is_critical === undefined || row.is_critical === null ? true : !!row.is_critical,
  });

  const modern = await client
    .from("applications")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (!modern.error) {
    return (modern.data || []).map((row) => normalize(row, "applications")).filter((row) => row.is_active && row.is_critical);
  }

  if (!isMissingTableError(modern.error)) {
    throw modern.error;
  }

  const legacy = await client
    .from("supplier_applications")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (!legacy.error) {
    return (legacy.data || []).map((row) => normalize(row, "supplier_applications")).filter((row) => row.is_active && row.is_critical);
  }

  if (String(legacy.error?.message || "").toLowerCase().includes("organization_id")) {
    const legacyWithoutOrg = await client
      .from("supplier_applications")
      .select("*")
      .order("name", { ascending: true });

    if (!legacyWithoutOrg.error) {
      return (legacyWithoutOrg.data || []).map((row) => normalize(row, "supplier_applications")).filter((row) => row.is_active && row.is_critical);
    }

    throw legacyWithoutOrg.error;
  }

  throw legacy.error;
}

async function loadFunctionalAdminRows(client, orgId) {
  const result = await client
    .from("functional_admin_assignments")
    .select("*")
    .eq("organization_id", orgId);

  if (result.error) {
    if (isMissingTableError(result.error)) return [];
    throw result.error;
  }

  return result.data || [];
}

function MetricCard({ label, value, subtext, tone = "slate", active = false, onClick }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 shadow-sm text-left transition hover:shadow-md ${tones[tone] || tones.slate} ${active ? "ring-2 ring-slate-900/15" : ""}`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {subtext ? <div className="mt-1 text-sm opacity-80">{subtext}</div> : null}
    </button>
  );
}

function BarRow({ label, value, total, tone = "bg-slate-500" }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="text-slate-500">{value} · {pct}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ManagementHeader({ kpis, onSelect, activeMetric }) {
  const trendTone = kpis.trend >= 0 ? "bg-blue-500/95" : "bg-slate-700/95";
  const trendPrefix = kpis.trend >= 0 ? "+" : "";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <button type="button" onClick={() => onSelect("healthy")} className={`rounded-3xl border p-5 text-white shadow-xl text-left ${activeMetric === "healthy" ? "ring-2 ring-white/70" : ""} border-emerald-200 bg-emerald-500/95`}>
        <div className="text-sm uppercase tracking-wide text-white/80">Binnen norm</div>
        <div className="mt-2 text-4xl font-bold">{kpis.healthyPercent}%</div>
        <div className="mt-1 text-sm text-white/85">Leveranciers met governance-status groen</div>
      </button>

      <button type="button" onClick={() => onSelect("risk")} className={`rounded-3xl border p-5 text-white shadow-xl text-left ${activeMetric === "risk" ? "ring-2 ring-white/70" : ""} border-rose-200 bg-rose-500/95`}>
        <div className="text-sm uppercase tracking-wide text-white/80">Risico leveranciers</div>
        <div className="mt-2 text-4xl font-bold">{kpis.risk}</div>
        <div className="mt-1 text-sm text-white/85">Rode leveranciers die direct aandacht vragen</div>
      </button>

      <div className={`rounded-3xl border border-white/10 p-5 text-white shadow-xl ${trendTone}`}>
        <div className="text-sm uppercase tracking-wide text-white/80">Trend</div>
        <div className="mt-2 text-4xl font-bold">{trendPrefix}{kpis.trend}%</div>
        <div className="mt-1 text-sm text-white/85">Vergelijking actuele beoordelingsdekking t.o.v. vorig jaar</div>
      </div>
    </div>
  );
}

function ProgressRing({ percent }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="relative h-36 w-36 shrink-0 rounded-full bg-[conic-gradient(#2563eb_calc(var(--pct)*1%),#e2e8f0_0)]" style={{ "--pct": safe }}>
      <div className="absolute inset-3 rounded-full bg-white shadow-inner" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <div className="text-3xl font-bold text-slate-900">{safe}%</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Dekking</div>
        </div>
      </div>
    </div>
  );
}

function MetricResultsPanel({ metric, rows, onClose }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [metric?.title]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.name,
        row.classification,
        row.domain,
        row.aiType,
        row.subprocessorCount,
        row.countryList,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [rows, query]);

  if (!metric) return null;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{metric.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{metric.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="min-w-[220px]"
            placeholder="Zoek in resultaten…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={onClose}>Sluiten</button>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-600">Resultaten: <span className="font-semibold text-slate-900">{filteredRows.length}</span></div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-3 pr-4 text-left">Leverancier</th>
              <th className="py-3 pr-4 text-left">Classificatie</th>
              <th className="py-3 pr-4 text-left">Domein</th>
              <th className="py-3 pr-4 text-left">Governance</th>
              <th className="py-3 pr-4 text-left">Status</th>
              <th className="py-3 pr-4 text-left">AI/Subverwerkers</th>
              <th className="py-3 text-left">Actie</th>
            </tr>
          </thead>
          <tbody>
            {!filteredRows.length ? (
              <tr>
                <td className="py-4 text-slate-600" colSpan={7}>Geen resultaten gevonden.</td>
              </tr>
            ) : filteredRows.map((row) => {
              const light = governanceToLight(row.governancePercent || 0);
              return (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{row.name}</td>
                  <td className="py-3 pr-4">{row.classification || "Onbekend"}</td>
                  <td className="py-3 pr-4">{supplierDomainLabel(row.domain || "generiek")}</td>
                  <td className="py-3 pr-4">{row.governancePercent || 0}%</td>
                  <td className="py-3 pr-4"><TrafficLight value={light} /></td>
                  <td className="py-3 pr-4">
                    {row.subprocessorCount ? (
                      <span className="inline-flex flex-col gap-1">
                        <span>{row.subprocessorCount} subverwerker(s)</span>
                        {row.aiSupplier ? <span className="text-violet-700">AI: {row.aiType || "ja"}</span> : null}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3"><Link className="btn" to={`/suppliers/${row.id}`}>Open detail</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { session, organization, profile, loading: appLoading } = useApp();
  const client = supabase();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);
  const [rows, setRows] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [activeMetric, setActiveMetric] = useState(null);
  const [criticalApps, setCriticalApps] = useState([]);

  const orgId = organization?.id || profile?.organization_id || null;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setLoading(true);

      try {
        if (appLoading) return;

        if (!session || !orgId || !client) {
          const demo = isDemoMode() ? DEMO_SUPPLIERS : [];
          if (!cancelled) {
            setRows(demo.map((row) => ({ ...row, latestEvaluation: null, domain: row.domain || row.category || "generiek", riskScore: row.riskScore || 0, notesCount: row.notesCount || 0, checksDone: row.checksDone || 0, checksTotal: row.checksTotal || 0, latestPerformance: null, subprocessorCount: 0, aiSupplier: false, aiType: null, countryList: "" })));
            setEvaluations([]);
            setUsingDemo(isDemoMode());
          }
          return;
        }

        const { data: suppliers, error: supplierErr } = await client
          .from("suppliers")
          .select("id,name,classification,supplier_type,created_at,category,status,is_active")

          .eq("organization_id", orgId)
          .eq("is_active", true)
          .neq("status", "inactive")
          .order("name", { ascending: true });
        if (supplierErr) throw supplierErr;

        const { data: evals, error: evalErr } = await client
          .from("evaluations")
          .select("id,supplier_id,title,year,strategy,created_at,organization_id")

          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });
        if (evalErr) throw evalErr;

        const { data: risks } = await client
          .from("supplier_risk_profiles")
          .select("supplier_id,overall_risk_score");

        const { data: perfRows } = await client
          .from("supplier_performance_reviews")
          .select("supplier_id,total_score,review_date,period_label,created_at")

          .eq("organization_id", orgId)
          .order("review_date", { ascending: false });
        const [apps, assignments] = await Promise.all([
          loadCriticalApplicationRows(client, orgId),
          loadFunctionalAdminRows(client, orgId),
        ]);

        let subprocessors = [];
        try {
          const { data } = await client
            .from("subprocessors")
            .select("supplier_id,uses_ai,ai_type,country,risk_level")

            .eq("organization_id", orgId);
          subprocessors = data || [];
        } catch {
          subprocessors = [];
        }

        const riskBySupplier = new Map((risks || []).map((row) => [row.supplier_id, Number(row.overall_risk_score) || 0]));
        const perfBySupplier = new Map();
        for (const perf of perfRows || []) {
          if (!perfBySupplier.has(perf.supplier_id)) perfBySupplier.set(perf.supplier_id, perf);
        }

        const criticalAppsBySupplier = new Map();
        const assignmentByKey = new Map();
        for (const item of assignments || []) {
          const key = item.application_id || `${item.supplier_id}::${String(item.application_name || "").toLowerCase()}`;
          if (!assignmentByKey.has(key) || item.is_primary) assignmentByKey.set(key, item);
        }
        for (const app of apps || []) {
          const ownerRecord = assignmentByKey.get(app.id) || assignmentByKey.get(`${app.supplier_id}::${String(app.name || "").toLowerCase()}`);
          const ownerName = ownerRecord?.contact_name || app.functional_owner || "Nog niet gekoppeld";
          const ownerMeta = ownerRecord?.email || ownerRecord?.role_title || "";
          const entry = {
            id: app.id,
            supplierId: app.supplier_id,
            name: app.name,
            description: app.description || "",
            ownerName,
            ownerMeta,
            isCritical: !!app.is_critical,
          };
          const list = criticalAppsBySupplier.get(app.supplier_id) || [];
          list.push(entry);
          criticalAppsBySupplier.set(app.supplier_id, list);
        }

        const evalsBySupplier = new Map();
        for (const ev of evals || []) {
          if (!evalsBySupplier.has(ev.supplier_id)) evalsBySupplier.set(ev.supplier_id, ev);
        }

        const subprocessorMeta = new Map();
        for (const sp of subprocessors || []) {
          const curr = subprocessorMeta.get(sp.supplier_id) || { count: 0, ai: false, aiType: null, countries: new Set(), highRisk: false };
          curr.count += 1;
          curr.ai = curr.ai || !!sp.uses_ai;
          if (!curr.aiType && sp.ai_type) curr.aiType = sp.ai_type;
          if (sp.country) curr.countries.add(sp.country);
          curr.highRisk = curr.highRisk || String(sp.risk_level || "").toLowerCase() === "high";
          subprocessorMeta.set(sp.supplier_id, curr);
        }

        const list = await Promise.all(
          (suppliers || []).map(async (supplier) => {
            let governancePercent = 0;
            let notesCount = 0;
            let checksDone = 0;
            let checksTotal = 0;
            try {
              const governance = await loadGovernance({ client, organizationId: orgId, supplierId: supplier.id });
              const checks = governance?.checks || {};
              const notes = governance?.notes || {};
              const keys = Object.keys(checks);
              checksDone = keys.filter((key) => !!checks[key]).length;
              checksTotal = keys.length;
              governancePercent = checksTotal ? Math.round((checksDone / checksTotal) * 100) : 0;
              notesCount = Object.values(notes).filter((value) => String(value || "").trim().length > 0).length;
            } catch {
              // keep defaults
            }

            const sub = subprocessorMeta.get(supplier.id);
            return {
              id: supplier.id,
              name: supplier.name,
              classification: supplier.classification || supplier.supplier_type || "Onbekend",
              domain: (criticalAppsBySupplier.get(supplier.id) || []).find((app) => app.domain)?.domain || supplier.category || "generiek",
              governancePercent,
              riskScore: riskBySupplier.get(supplier.id) || 0,
              latestPerformance: perfBySupplier.get(supplier.id) || null,
              notesCount,
              checksDone,
              checksTotal,
              latestEvaluation: evalsBySupplier.get(supplier.id) || null,
              subprocessorCount: sub?.count || 0,
              aiSupplier: !!sub?.ai,
              aiType: sub?.aiType || null,
              countryList: sub?.countries ? Array.from(sub.countries).join(", ") : "",
              hasHighRiskSubprocessor: !!sub?.highRisk,
              criticalApps: criticalAppsBySupplier.get(supplier.id) || [],
              strategicByCriticalApp: (criticalAppsBySupplier.get(supplier.id) || []).length > 0,
            };
          })
        );

        if (!cancelled) {
          setRows(list);
          setCriticalApps((apps || []).map((app) => {
            const ownerRecord = assignmentByKey.get(app.id) || assignmentByKey.get(`${app.supplier_id}::${String(app.name || "").toLowerCase()}`);
            const ownerName = ownerRecord?.contact_name || app.functional_owner || "Nog niet gekoppeld";
            const ownerMeta = ownerRecord?.email || ownerRecord?.role_title || "";
            const supplier = (suppliers || []).find((s) => s.id === app.supplier_id);
            const governanceBase = list.find((row) => row.id === app.supplier_id);
            return {
              id: app.id,
              name: app.name,
              supplierId: app.supplier_id,
              supplierName: supplier?.name || "Onbekend",
              classification: supplier?.classification || supplier?.supplier_type || "Onbekend",
              domain: app.domain || supplier?.category || "generiek",
              governancePercent: governanceBase?.governancePercent || 0,
              ownerName,
              ownerMeta,
            };
          }));
          setEvaluations(evals || []);
          setUsingDemo(false);
        }
      } catch (e) {
        if (!cancelled) {
          const demo = isDemoMode() ? DEMO_SUPPLIERS : [];
          setRows(demo.map((row) => ({ ...row, latestEvaluation: null, domain: row.domain || row.category || "generiek", riskScore: row.riskScore || 0, notesCount: row.notesCount || 0, checksDone: row.checksDone || 0, checksTotal: row.checksTotal || 0, latestPerformance: null, subprocessorCount: 0, aiSupplier: false, aiType: null, countryList: "" })));
          setCriticalApps([]);
          setEvaluations([]);
          setUsingDemo(isDemoMode());
          setErr(e?.message || "Dashboard kon niet worden geladen");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [session, orgId, client, appLoading]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const summary = useMemo(() => {
    const suppliers = rows.length;
    const avgGovernance = suppliers ? Math.round(rows.reduce((sum, row) => sum + (Number(row.governancePercent) || 0), 0) / suppliers) : 0;
    const green = rows.filter((row) => governanceToLight(row.governancePercent) === "green").length;
    const amber = rows.filter((row) => governanceToLight(row.governancePercent) === "amber").length;
    const red = rows.filter((row) => governanceToLight(row.governancePercent) === "red").length;
    const evaluatedThisYear = rows.filter((row) => Number(row.latestEvaluation?.year) === currentYear).length;
    const openActions = rows.reduce((sum, row) => sum + (Number(row.notesCount) || 0), 0);
    const healthyPercent = suppliers ? Math.round((green / suppliers) * 100) : 0;
    const avgRisk = suppliers ? (Math.round((rows.reduce((sum, row) => sum + (Number(row.riskScore) || 0), 0) / suppliers) * 10) / 10) : 0;
    const perfRows = rows.filter((row) => Number(row.latestPerformance?.total_score) > 0);
    const avgPerformance = perfRows.length ? Math.round(perfRows.reduce((sum, row) => sum + Number(row.latestPerformance?.total_score || 0), 0) / perfRows.length) : 0;
    const prevCount = evaluations.filter((ev) => Number(ev.year) === previousYear).length;
    const thisCount = evaluations.filter((ev) => Number(ev.year) === currentYear).length;
    const trend = prevCount ? Math.round(((thisCount - prevCount) / prevCount) * 100) : (thisCount ? 100 : 0);
    const coveragePercent = suppliers ? Math.round((evaluatedThisYear / suppliers) * 100) : 0;
    const aiSuppliers = rows.filter((row) => row.aiSupplier || row.subprocessorCount > 0).length;
    const criticalAppsCount = criticalApps.length;
    const criticalSuppliers = rows.filter((row) => row.strategicByCriticalApp).length;
    const criticalCoverage = criticalAppsCount ? Math.round(criticalApps.reduce((sum, app) => sum + (Number(app.governancePercent) || 0), 0) / criticalAppsCount) : 0;
    return { suppliers, avgGovernance, green, amber, red, evaluatedThisYear, openActions, healthyPercent, avgRisk, avgPerformance, trend, coveragePercent, aiSuppliers, criticalAppsCount, criticalSuppliers, criticalCoverage };
  }, [rows, evaluations, currentYear, previousYear]);

  const priorities = useMemo(() => {
    return [...rows]
      .sort((a, b) => {
        const lightA = governanceToLight(a.governancePercent);
        const lightB = governanceToLight(b.governancePercent);
        const weight = { red: 3, amber: 2, green: 1 };
        if (weight[lightA] !== weight[lightB]) return weight[lightB] - weight[lightA];
        if ((b.riskScore || 0) !== (a.riskScore || 0)) return (b.riskScore || 0) - (a.riskScore || 0);
        return (b.notesCount || 0) - (a.notesCount || 0);
      })
      .slice(0, 5);
  }, [rows]);

  const domainStats = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const label = supplierDomainLabel(row.domain);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const classificationStats = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const label = row.classification || "Onbekend";
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const recentEvaluations = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row.name]));
    return evaluations.slice(0, 6).map((ev) => ({ ...ev, supplierName: byId.get(ev.supplier_id) || "Onbekend" }));
  }, [evaluations, rows]);

  const metricConfig = useMemo(() => ({
    suppliers: {
      title: "Alle leveranciers",
      description: "Volledige lijst van leveranciers binnen deze organisatie.",
      rows: rows,
    },
    healthy: {
      title: "Binnen norm",
      description: "Leveranciers met governance-status groen.",
      rows: rows.filter((row) => governanceToLight(row.governancePercent) === "green"),
    },
    risk: {
      title: "Risico leveranciers",
      description: "Leveranciers met rode governance-status, verhoogde risicoscore of een high-risk subverwerker.",
      rows: rows.filter((row) => governanceToLight(row.governancePercent) === "red" || Number(row.riskScore || 0) >= 2.5 || row.hasHighRiskSubprocessor),
    },
    evaluated: {
      title: `Beoordeeld in ${currentYear}`,
      description: "Leveranciers met een actuele beoordeling in dit jaar.",
      rows: rows.filter((row) => Number(row.latestEvaluation?.year) === currentYear),
    },
    actions: {
      title: "Open acties",
      description: "Leveranciers met open opmerkingen en opvolging.",
      rows: rows.filter((row) => Number(row.notesCount || 0) > 0),
    },
    ai: {
      title: "Leveranciers met AI / subverwerkers",
      description: "Leveranciers waarbij subverwerkers zijn vastgelegd of AI wordt gebruikt.",
      rows: rows.filter((row) => row.aiSupplier || row.subprocessorCount > 0),
    },
    strategic: {
      title: "Strategische leveranciers met kroonjuwelen",
      description: "Leveranciers die één of meer kritische applicaties onder zich hebben.",
      rows: rows.filter((row) => row.strategicByCriticalApp),
    },
  }), [rows, currentYear]);

  const activeMetricData = activeMetric ? metricConfig[activeMetric] : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(135deg,#0b3a74_0%,#0f4f9f_50%,#2563eb_100%)] p-6 text-white shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-3xl">
            <div className="text-sm uppercase tracking-[0.2em] text-white/70">Dashboard 2.0</div>
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">Leverancierssturing in één oogopslag</h1>
            <p className="mt-4 text-white/85 leading-7">VendorScore Pro brengt governance, leveranciersstrategie en opvolging samen in een visueel dashboard dat direct door te klikken is naar de onderliggende set.</p>
          </div>
          <div className="flex gap-3">
            <Link className="btn bg-white text-slate-900 hover:bg-slate-100" to="/suppliers">Leveranciers</Link>
            <Link className="btn border-white/30 text-white hover:bg-white/10" to="/status">Status</Link>
          </div>
        </div>
      </section>

      {usingDemo ? (
        <Notice title="Demo data actief">
          Er zijn nog geen leveranciers gevonden voor deze organisatie. Daarom toont dit dashboard voorbeelddata.
        </Notice>
      ) : null}

      {err ? <Notice title="Dashboard" tone="danger">{err}</Notice> : null}

      <ManagementHeader kpis={{ healthyPercent: summary.healthyPercent, risk: summary.red, trend: summary.trend }} onSelect={setActiveMetric} activeMetric={activeMetric} />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <MetricCard label="Leveranciers" value={summary.suppliers} subtext="Totaal in deze organisatie" tone="slate" active={activeMetric === "suppliers"} onClick={() => setActiveMetric("suppliers")} />
        <MetricCard label="Gem. governance" value={`${summary.avgGovernance}%`} subtext="Checklistvolwassenheid" tone="blue" active={activeMetric === "healthy"} onClick={() => setActiveMetric("healthy")} />
        <MetricCard label="Gem. risico" value={summary.avgRisk || "0.0"} subtext="Gemiddelde risicoscore (1–3)" tone="amber" active={activeMetric === "risk"} onClick={() => setActiveMetric("risk")} />
        <MetricCard label="AI / subverwerkers" value={summary.aiSuppliers} subtext="Leveranciers met aanvullende verwerking" tone="violet" active={activeMetric === "ai"} onClick={() => setActiveMetric("ai")} />
        <MetricCard label="Kroonjuwelen" value={summary.criticalAppsCount} subtext={`${summary.criticalSuppliers} leverancier(s) geraakt`} tone="violet" active={activeMetric === "strategic"} onClick={() => setActiveMetric("strategic")} />
        <MetricCard label={`Beoordeeld in ${currentYear}`} value={summary.evaluatedThisYear} subtext="Leveranciers met actuele beoordeling" tone="green" active={activeMetric === "evaluated"} onClick={() => setActiveMetric("evaluated")} />
        <MetricCard label="Open acties" value={summary.openActions} subtext="Op basis van notities en opvolging" tone="amber" active={activeMetric === "actions"} onClick={() => setActiveMetric("actions")} />
      </div>

      <MetricResultsPanel metric={activeMetricData} rows={activeMetricData?.rows || []} onClose={() => setActiveMetric(null)} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Prioriteitenlijst</h2>
              <p className="mt-1 text-sm text-slate-600">De leveranciers met de meeste risico’s of de laagste governance-score.</p>
            </div>
            <Link className="btn" to="/suppliers">Alles bekijken</Link>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? <div className="text-sm text-slate-600">Dashboard laden…</div> : null}
            {!loading && !priorities.length ? <div className="text-sm text-slate-600">Nog geen leveranciers gevonden.</div> : null}
            {priorities.map((row) => {
              const light = governanceToLight(row.governancePercent);
              return (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500"><span>{row.classification}</span><span>·</span><span>{supplierDomainLabel(row.domain)}</span></div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-700"><TrafficLight value={light} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Governance</span>
                      <span>{row.governancePercent}% · {row.checksDone}/{row.checksTotal || 0} checks</span>
                    </div>
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${light === "green" ? "bg-emerald-500" : light === "amber" ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${row.governancePercent}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                    <div>Laatste beoordeling: <span className="font-medium text-slate-700">{row.latestEvaluation?.title || row.latestEvaluation?.year || "nog niet beoordeeld"}</span></div>
                    <div>Prestatie: <span className="font-medium text-slate-700">{row.latestPerformance?.total_score ? `${row.latestPerformance.total_score}/100` : "nog geen meting"}</span></div>
                    <div>Risico: <span className="font-medium text-slate-700">{row.riskScore ? row.riskScore : "nog niet ingevuld"}</span></div>
                    <div>Domein: <span className="font-medium text-slate-700">{supplierDomainLabel(row.domain)}</span></div>
                    <div>Subverwerkers: <span className="font-medium text-slate-700">{row.subprocessorCount || 0}</span></div>
                    <div>AI: <span className="font-medium text-slate-700">{row.aiSupplier ? (row.aiType || "ja") : "nee"}</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    {usingDemo ? null : <Link className="btn" to={`/suppliers/${row.id}`}>Open leverancier</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold">Beoordelingsdekking</h2>
            <p className="mt-1 text-sm text-slate-600">Hoeveel leveranciers al een actuele beoordeling hebben in {currentYear}.</p>
            <div className="mt-5 flex items-center gap-6">
              <ProgressRing percent={summary.coveragePercent} />
              <div className="space-y-3 text-sm text-slate-700">
                <div><span className="font-semibold text-slate-900">Actueel beoordeeld:</span> {summary.evaluatedThisYear} van {summary.suppliers}</div>
                <div><span className="font-semibold text-slate-900">Gem. governance:</span> {summary.avgGovernance}%</div>
                <div><span className="font-semibold text-slate-900">Open acties:</span> {summary.openActions}</div>
                <div><span className="font-semibold text-slate-900">AI / subverwerkers:</span> {summary.aiSuppliers}</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold">Traffic lights</h2>
            <p className="mt-1 text-sm text-slate-600">Verdeling van leveranciers op basis van governance-volwassenheid.</p>
            <div className="mt-4 space-y-4">
              <BarRow label="Groen" value={summary.green} total={summary.suppliers} tone="bg-emerald-500" />
              <BarRow label="Oranje" value={summary.amber} total={summary.suppliers} tone="bg-amber-500" />
              <BarRow label="Rood" value={summary.red} total={summary.suppliers} tone="bg-rose-500" />
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold">Domeinverdeling</h2>
            <p className="mt-1 text-sm text-slate-600">Aantal leveranciers per gekozen werkdomein.</p>
            <div className="mt-4 space-y-4">
              {domainStats.length ? domainStats.map(([label, value]) => (
                <BarRow key={label} label={label} value={value} total={summary.suppliers} tone="bg-indigo-500" />
              )) : <div className="text-sm text-slate-600">Nog geen domeinen gekozen.</div>}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold">Verdeling Kraljic-categorieën</h2>
            <p className="mt-1 text-sm text-slate-600">Aantal leveranciers per leveranciersstrategie.</p>
            <div className="mt-4 space-y-4">
              {classificationStats.length ? classificationStats.map(([label, value]) => (
                <BarRow key={label} label={label} value={value} total={summary.suppliers} tone="bg-blue-500" />
              )) : <div className="text-sm text-slate-600">Nog geen leveranciers aanwezig.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Kroonjuwelen & functioneel beheer</h2>
              <p className="mt-1 text-sm text-slate-600">Kritische applicaties met gekoppelde leverancier, governance-score en functioneel beheer.</p>
            </div>
            <Link className="btn" to="/kroonjuwelen">Volledig overzicht</Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 text-left">Applicatie</th>
                  <th className="py-3 pr-4 text-left">Leverancier</th>
                  <th className="py-3 pr-4 text-left">Governance</th>
                  <th className="py-3 pr-4 text-left">Functioneel beheer</th>
                  <th className="py-3 text-left">Actie</th>
                </tr>
              </thead>
              <tbody>
                {!criticalApps.length ? (
                  <tr><td className="py-4 text-slate-600" colSpan={5}>Nog geen kroonjuwelen gemarkeerd.</td></tr>
                ) : criticalApps.slice(0, 8).map((app) => (
                  <tr key={app.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{app.name}</td>
                    <td className="py-3 pr-4">{app.supplierName}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <TrafficLight value={governanceToLight(app.governancePercent)} />
                        <span>{app.governancePercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-800">{app.ownerName}</div>
                      {app.ownerMeta ? <div className="text-xs text-slate-500">{app.ownerMeta}</div> : null}
                    </td>
                    <td className="py-3"><Link className="btn" to={`/suppliers/${app.supplierId}`}>Open leverancier</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold">Strategische focus</h2>
          <p className="mt-1 text-sm text-slate-600">Kroonjuwelen zijn vaak gekoppeld aan de leveranciers die extra bestuurlijke aandacht vragen.</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4">
              <div className="text-xs uppercase tracking-wide text-violet-700">Kritische applicaties</div>
              <div className="mt-2 text-3xl font-bold text-violet-950">{summary.criticalAppsCount}</div>
            </div>
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
              <div className="text-xs uppercase tracking-wide text-blue-700">Leveranciers geraakt</div>
              <div className="mt-2 text-3xl font-bold text-blue-950">{summary.criticalSuppliers}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">Gem. governance kroonjuwelen</div>
              <div className="mt-2 text-3xl font-bold text-emerald-950">{summary.criticalCoverage}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Recente beoordelingen</h2>
              <p className="mt-1 text-sm text-slate-600">De meest recent vastgelegde reviews binnen jouw organisatie.</p>
            </div>
            <button className="btn" onClick={() => nav("/suppliers")}>Nieuwe beoordeling</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 text-left">Leverancier</th>
                  <th className="py-3 pr-4 text-left">Titel</th>
                  <th className="py-3 pr-4 text-left">Jaar</th>
                  <th className="py-3 text-left">Datum</th>
                </tr>
              </thead>
              <tbody>
                {!recentEvaluations.length ? (
                  <tr><td className="py-4 text-slate-600" colSpan={4}>Nog geen beoordelingen gevonden.</td></tr>
                ) : recentEvaluations.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{ev.supplierName}</td>
                    <td className="py-3 pr-4">{ev.title || "Beoordeling"}</td>
                    <td className="py-3 pr-4">{ev.year || "—"}</td>
                    <td className="py-3">{ev.created_at ? new Date(ev.created_at).toLocaleDateString("nl-NL") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Actuele managementsignalen</h2>
              <p className="mt-1 text-sm text-slate-600">Gebruik de tegels bovenaan om direct de onderliggende leverancierset te openen.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="font-semibold">Klikbare KPI-tegels</div>
              <div className="mt-1 text-slate-600">Elke tegel opent nu een resultatenpaneel met de leveranciers die achter de KPI zitten.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="font-semibold">AI & subverwerkers zichtbaar</div>
              <div className="mt-1 text-slate-600">De tegel “AI / subverwerkers” helpt je direct leveranciers met aanvullende verwerkingsrisico’s te vinden.</div>
            </div>
            <Link to="/kroonjuwelen" className="rounded-2xl border border-slate-200 p-4 bg-slate-50 block hover:bg-slate-100 transition">
              <div className="font-semibold">Kroonjuwelen cockpit</div>
              <div className="mt-1 text-slate-600">{summary.criticalAppsCount} kritische applicaties gekoppeld aan {summary.criticalSuppliers} leveranciers. Gemiddelde governance-score: {summary.criticalCoverage}%.</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
