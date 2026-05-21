import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../components/Notice";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { governanceToLight } from "../lib/governanceCockpit";
import { useApp } from "../state/AppState";
import { supplierDomainLabel } from "../lib/supplierDomains";
function isMissingTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}


function dedupeApplicationRows(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    const name = String(row?.name || row?.application_name || row?.title || "").trim().toLowerCase();
    const key = `${row?.supplier_id || ""}::${name}`;
    if (!name) continue;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      ...current,
      ...row,
      id: current.id || row.id,
      name: current.name || row.name || row.application_name || row.title,
      description: current.description || row.description || row.notes || current.notes || "",
      functional_owner: current.functional_owner || row.functional_owner || row.owner || row.functional_manager || "",
      is_critical: Boolean(current.is_critical || row.is_critical),
      is_active: current.is_active !== false || row.is_active !== false,
    });
  }
  return [...byKey.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
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
    return dedupeApplicationRows((modern.data || []).map((row) => normalize(row, "applications")).filter((row) => row.is_active && row.is_critical));
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
    return dedupeApplicationRows((legacy.data || []).map((row) => normalize(row, "supplier_applications")).filter((row) => row.is_active && row.is_critical));
  }

  if (String(legacy.error?.message || "").toLowerCase().includes("organization_id")) {
    const legacyWithoutOrg = await client
      .from("supplier_applications")
      .select("*")
      .order("name", { ascending: true });

    if (!legacyWithoutOrg.error) {
      return dedupeApplicationRows((legacyWithoutOrg.data || []).map((row) => normalize(row, "supplier_applications")).filter((row) => row.is_active && row.is_critical));
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

function scoreToTone(score) {
  if (score >= 75) return "green";
  if (score >= 40) return "amber";
  return "red";
}

export default function CriticalAppsPage() {
  const client = supabase();
  const { organization, profile } = useApp();
  const orgId = organization?.id || profile?.organization_id || null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!client || !orgId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const [apps, { data: suppliers, error: suppliersErr }, assignments] = await Promise.all([
          loadCriticalApplicationRows(client, orgId),
          client.from("supplier_overview_view").select("id,name,classification,supplier_type,category,status,is_active,governance_score,checked_items,total_items").eq("organization_id", orgId),
          loadFunctionalAdminRows(client, orgId),
        ]);
        if (suppliersErr) throw suppliersErr;

        const suppliersById = new Map((suppliers || []).map((s) => [s.id, s]));
        const assignMap = new Map();
        for (const item of assignments || []) {
          const key = item.application_id || `${item.supplier_id}::${String(item.application_name || '').toLowerCase()}`;
          if (!assignMap.has(key) || item.is_primary) assignMap.set(key, item);
        }

        const mapped = (apps || []).map((app) => {
          const supplier = suppliersById.get(app.supplier_id);
          const governanceScore = Number(supplier?.governance_score || 0);
          const assignment = assignMap.get(app.id) || assignMap.get(`${app.supplier_id}::${String(app.name || '').toLowerCase()}`);
          const owner = assignment?.contact_name || app.functional_owner || "Nog niet gekoppeld";
          const ownerMeta = assignment?.email || assignment?.role_title || "";
          return {
            ...app,
            supplierName: supplier?.name || "Onbekende leverancier",
            classification: supplier?.classification || supplier?.supplier_type || "Onbekend",
            domain: app.domain || supplier?.category || "generiek",
            governanceScore,
            owner,
            ownerMeta,
          };
        });

        if (!cancelled) setRows(mapped);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Kroonjuwelen konden niet worden geladen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [client, orgId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const avg = total ? Math.round(rows.reduce((sum, row) => sum + row.governanceScore, 0) / total) : 0;
    const linkedOwners = rows.filter((row) => row.owner && row.owner !== "Nog niet gekoppeld").length;
    const strategic = rows.filter((row) => ["strategisch", "strategic"].includes(String(row.classification || "").toLowerCase())).length;
    return { total, avg, linkedOwners, strategic };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(135deg,#1d4ed8_0%,#0f766e_50%,#0f172a_100%)] p-6 text-white shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-3xl">
            <div className="text-sm uppercase tracking-[0.2em] text-white/70">Kroonjuwelen</div>
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">Kritische applicaties met functioneel beheer</h1>
            <p className="mt-4 text-white/85 leading-7">Deze pagina bundelt de applicaties die extra aandacht verdienen, inclusief leverancier, governance-score en toegewezen functioneel beheer. Zo zie je in één scherm welke bedrijfskritische systemen extra sturing nodig hebben.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link className="btn bg-white text-slate-900 hover:bg-slate-100" to="/dashboard">Terug naar dashboard</Link>
            <Link className="btn border-white/30 text-white hover:bg-white/10" to="/suppliers">Leveranciers</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900">
            <div className="text-xs uppercase tracking-wide text-slate-500">Kroonjuwelen</div>
            <div className="mt-2 text-3xl font-bold">{stats.total}</div>
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900">
            <div className="text-xs uppercase tracking-wide text-slate-500">Gem. governance</div>
            <div className="mt-2 text-3xl font-bold">{stats.avg}%</div>
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900">
            <div className="text-xs uppercase tracking-wide text-slate-500">Beheer gekoppeld</div>
            <div className="mt-2 text-3xl font-bold">{stats.linkedOwners}</div>
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900">
            <div className="text-xs uppercase tracking-wide text-slate-500">Strategisch</div>
            <div className="mt-2 text-3xl font-bold">{stats.strategic}</div>
          </div>
        </div>
      </section>

      {err ? <Notice title="Kroonjuwelen" tone="danger">{err}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? <div className="card p-6 text-sm text-slate-600">Laden…</div> : null}
        {!loading && rows.length === 0 ? <div className="card p-6 text-sm text-slate-600">Nog geen kroonjuwelen gemarkeerd.</div> : null}
        {rows.map((row) => {
          const light = governanceToLight(row.governanceScore);
          const tone = scoreToTone(row.governanceScore);
          const borderTone = tone === "green" ? "border-emerald-200" : tone === "amber" ? "border-amber-200" : "border-rose-200";
          return (
            <div key={row.id} className={`card p-5 border ${borderTone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{row.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{row.supplierName}</div>
                </div>
                <TrafficLight value={light} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Governance-score</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{row.governanceScore}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Leveranciersstrategie</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{row.classification}</div>
                  <div className="mt-1 text-xs text-slate-500">Domein: {supplierDomainLabel(row.domain)}</div>
                  {["strategisch", "strategic"].includes(String(row.classification || "").toLowerCase()) ? <div className="mt-1 text-xs text-emerald-700">Strategische leverancier</div> : <div className="mt-1 text-xs text-slate-500">Nog geen strategische markering</div>}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Functioneel beheer</div>
                <div className="mt-1 font-medium text-slate-900">{row.owner}</div>
                {row.ownerMeta ? <div className="mt-1 text-sm text-slate-500">{row.ownerMeta}</div> : null}
              </div>

              {row.description ? <p className="mt-4 text-sm leading-6 text-slate-600">{row.description}</p> : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn" to={`/suppliers/${row.supplier_id}`}>Open leverancier</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
