import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  GitBranch,
  Layers3,
  Network,
  Search,
  ShieldAlert,
  Target,
  Workflow,
  XCircle,
} from "lucide-react";
import Notice from "../../components/Notice";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import "./architecture.css";

const ORG_FALLBACK = "7ec54263-6b9b-4cb2-9b97-526d8909550d";

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqBy(list, key) {
  return [...new Map((list || []).filter(Boolean).map((item) => [item?.[key], item])).values()];
}

function scoreTone(value) {
  if (value >= 80) return "green";
  if (value >= 55) return "amber";
  return "rose";
}

function ArchitectTile({ icon: Icon, label, value, subtext, tone = "blue", active, onClick }) {
  return (
    <button type="button" className={`arch-tile arch-${tone} ${active ? "arch-active" : ""}`} onClick={onClick}>
      <div className="arch-tile-icon"><Icon size={22} /></div>
      <div className="arch-tile-copy">
        <div className="arch-tile-label">{label}</div>
        <div className="arch-tile-value">{value}</div>
        <div className="arch-tile-subtext">{subtext}</div>
      </div>
    </button>
  );
}

function MiniProgress({ label, value, total, tone = "blue" }) {
  const pct = total ? Math.round((Number(value || 0) / Number(total || 1)) * 100) : 0;
  return (
    <div className="arch-progress-row">
      <div className="arch-progress-meta">
        <span>{label}</span>
        <strong>{pct}%</strong>
      </div>
      <div className="arch-progress-track">
        <div className={`arch-progress-fill arch-progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <div className="arch-progress-small">{value} van {total}</div>
    </div>
  );
}

function ResultTable({ title, description, rows, columns }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((row) => Object.values(row || {}).join(" ").toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="min-w-[280px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in resultaten…" />
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-600">Resultaten: <strong className="text-slate-900">{filtered.length}</strong></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {columns.map((column) => <th key={column.key} className="py-3 pr-4 font-semibold">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-6 text-slate-500">Geen resultaten.</td></tr>
            ) : filtered.map((row, idx) => (
              <tr key={row.id || row.mora_component_id || row.application_id || `${row.name}-${idx}`} className="border-b border-slate-100 align-top">
                {columns.map((column) => <td key={column.key} className="py-3 pr-4 text-slate-700">{column.render ? column.render(row) : String(row[column.key] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ArchitectView() {
  const nav = useNavigate();
  const client = supabase();
  const { session, organization } = useApp();
  const orgId = organization?.id || ORG_FALLBACK;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [components, setComponents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bivRows, setBivRows] = useState([]);
  const [domains, setDomains] = useState([]);
  const [relationsSummary, setRelationsSummary] = useState([]);
  const [relations, setRelations] = useState([]);
  const [selectedView, setSelectedView] = useState("gaps");

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError("");
      if (!session) { nav("/login"); return; }
      if (!client) { nav("/settings"); return; }
      try {
        const [componentResult, appResult, matchResult, bivResult, domainResult, relationSummaryResult, relationResult] = await Promise.all([
          client.from("mora_application_components").select("id,organization_id,mora_element_id,name,mora_type,specialization,documentation").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("applications").select("id,organization_id,name,supplier_id,domain,is_critical,status").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("v_mora_application_match_candidates").select("*").eq("organization_id", orgId).order("match_score", { ascending: false }),
          client.from("v_mora_application_components_with_biv").select("*").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("v_architecture_domain_overview").select("*").eq("organization_id", orgId).order("component_count", { ascending: false }),
          client.from("v_architecture_relation_type_summary").select("*").eq("organization_id", orgId).order("relation_count", { ascending: false }),
          client.from("architecture_relations").select("id,organization_id,relation_type,source_name,target_name,source_type,target_type,source_mora_element_id,target_mora_element_id").eq("organization_id", orgId).limit(1000),
        ]);
        if (componentResult.error) throw componentResult.error;
        if (appResult.error) throw appResult.error;
        if (matchResult.error) throw matchResult.error;
        if (bivResult.error) throw bivResult.error;
        if (domainResult.error && domainResult.error.code !== "42P01") throw domainResult.error;
        if (relationSummaryResult.error && relationSummaryResult.error.code !== "42P01") throw relationSummaryResult.error;
        if (relationResult.error && relationResult.error.code !== "42P01") throw relationResult.error;
        setComponents(componentResult.data || []);
        setApplications(appResult.data || []);
        setMatches(matchResult.data || []);
        setBivRows(bivResult.data || []);
        setDomains(domainResult.data || []);
        setRelationsSummary(relationSummaryResult.data || []);
        setRelations(relationResult.data || []);
      } catch (err) {
        setError(err?.message || "Architect view laden mislukt. Controleer of de MORA SQL-import is uitgevoerd.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [session, client, orgId, nav]);

  const model = useMemo(() => {
    const exact = matches.filter((m) => m.match_type === "exact" || Number(m.match_score) >= 99);
    const strong = matches.filter((m) => m.match_type === "strong_candidate" && Number(m.match_score) < 99);
    const candidate = matches.filter((m) => m.match_type === "candidate");
    const usefulMatches = matches.filter((m) => ["exact", "strong_candidate"].includes(m.match_type) || Number(m.match_score) >= 55);
    const linkedApplicationIds = new Set(usefulMatches.map((m) => m.application_id).filter(Boolean));
    const linkedMoraIds = new Set(usefulMatches.map((m) => m.mora_component_id).filter(Boolean));
    const unlinkedApps = applications.filter((a) => !linkedApplicationIds.has(a.id));
    const unlinkedMora = components.filter((c) => !linkedMoraIds.has(c.id));
    const incompleteBiv = bivRows.filter((r) => !r.beschikbaarheid || !r.integriteit || !r.vertrouwelijkheid);

    const nameBuckets = new Map();
    for (const app of applications) {
      const key = normalize(app.name);
      if (!key) continue;
      nameBuckets.set(key, [...(nameBuckets.get(key) || []), app]);
    }
    const duplicates = [...nameBuckets.entries()].filter(([, rows]) => rows.length > 1).flatMap(([key, rows]) => rows.map((row) => ({ ...row, duplicate_key: key, duplicate_count: rows.length })));

    const impactMap = new Map();
    for (const relation of relations) {
      for (const side of ["source", "target"]) {
        const name = relation?.[`${side}_name`];
        const type = relation?.[`${side}_type`];
        const id = relation?.[`${side}_mora_element_id`];
        if (!name || !id) continue;
        const current = impactMap.get(id) || { id, name, type, relation_count: 0, incoming: 0, outgoing: 0 };
        current.relation_count += 1;
        if (side === "source") current.outgoing += 1;
        if (side === "target") current.incoming += 1;
        impactMap.set(id, current);
      }
    }
    const highImpact = [...impactMap.values()].sort((a, b) => b.relation_count - a.relation_count).slice(0, 40);

    const governanceGaps = unlinkedMora.map((component) => {
      const biv = bivRows.find((row) => row.mora_element_id === component.mora_element_id);
      const relationCount = highImpact.find((row) => row.id === component.mora_element_id)?.relation_count || 0;
      return {
        ...component,
        relation_count: relationCount,
        beschikbaarheid: biv?.beschikbaarheid,
        integriteit: biv?.integriteit,
        vertrouwelijkheid: biv?.vertrouwelijkheid,
        gap: relationCount > 2 ? "Hoge impact, niet gekoppeld" : "Niet gekoppeld",
      };
    }).sort((a, b) => Number(b.relation_count || 0) - Number(a.relation_count || 0));

    return { exact, strong, candidate, usefulMatches, unlinkedApps, unlinkedMora, incompleteBiv, duplicates, highImpact, governanceGaps };
  }, [applications, components, matches, bivRows, relations]);

  const linkedApps = uniqBy(model.usefulMatches, "application_id").length;
  const linkedMora = uniqBy(model.usefulMatches, "mora_component_id").length;
  const relationTotal = relationsSummary.reduce((sum, row) => sum + Number(row.relation_count || 0), 0);
  const bivComplete = Math.max(0, bivRows.length - model.incompleteBiv.length);

  const resultConfig = {
    gaps: {
      title: "Governance gaps voor architectuur",
      description: "MORA-componenten die niet sterk gekoppeld zijn aan Governix, met eventuele relatie-impact.",
      rows: model.governanceGaps,
      columns: [
        { key: "name", label: "MORA component", render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
        { key: "mora_type", label: "MORA type" },
        { key: "relation_count", label: "Relaties", render: (r) => <span className={`arch-domain-badge arch-domain-${Number(r.relation_count || 0) > 2 ? "rose" : "amber"}`}>{r.relation_count || 0}</span> },
        { key: "gap", label: "Signaal" },
      ],
    },
    coverage: {
      title: "MORA-dekking en matches",
      description: "Exacte en sterke matches tussen MORA en Governix.",
      rows: model.usefulMatches,
      columns: [
        { key: "mora_application_name", label: "MORA" },
        { key: "governix_application_name", label: "Governix", render: (r) => <span className="font-semibold text-blue-700">{r.governix_application_name}</span> },
        { key: "match_score", label: "Score", render: (r) => <span className={`arch-domain-badge arch-domain-${scoreTone(Number(r.match_score || 0))}`}>{r.match_score}%</span> },
        { key: "match_type", label: "Type" },
      ],
    },
    candidates: {
      title: "Te beoordelen match-kandidaten",
      description: "Kandidaten waar architectuur/functioneel beheer een bevestiging op kan geven.",
      rows: [...model.strong, ...model.candidate],
      columns: [
        { key: "mora_application_name", label: "MORA" },
        { key: "governix_application_name", label: "Kandidaat" },
        { key: "match_score", label: "Score", render: (r) => <span className={`arch-domain-badge arch-domain-${scoreTone(Number(r.match_score || 0))}`}>{r.match_score}%</span> },
        { key: "match_type", label: "Actie", render: () => <span className="font-semibold text-amber-700">Beoordelen</span> },
      ],
    },
    impact: {
      title: "Hoogste relatie-impact",
      description: "Componenten/objecten die in veel relaties voorkomen en mogelijk ketenimpact hebben.",
      rows: model.highImpact,
      columns: [
        { key: "name", label: "Component/object", render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
        { key: "type", label: "Type" },
        { key: "relation_count", label: "Relaties", render: (r) => <span className="badge">{r.relation_count}</span> },
        { key: "incoming", label: "In" },
        { key: "outgoing", label: "Uit" },
      ],
    },
    domains: {
      title: "Domeinen en architectuurclusters",
      description: "Automatische domeinclassificatie als startpunt voor architectuursturing.",
      rows: domains,
      columns: [
        { key: "domain_name", label: "Domein", render: (r) => <Link to="/architecture/domains" className="font-semibold text-blue-700">{r.domain_name}</Link> },
        { key: "component_count", label: "Componenten" },
        { key: "avg_confidence", label: "Confidence", render: (r) => r.avg_confidence ? `${Number(r.avg_confidence).toFixed(1)}%` : "—" },
      ],
    },
    biv: {
      title: "BIV ontbreekt of is incompleet",
      description: "Componenten waarbij Beschikbaarheid, Integriteit of Vertrouwelijkheid niet volledig is gevuld.",
      rows: model.incompleteBiv,
      columns: [
        { key: "name", label: "Component" },
        { key: "beschikbaarheid", label: "B" },
        { key: "integriteit", label: "I" },
        { key: "vertrouwelijkheid", label: "V" },
      ],
    },
    dataquality: {
      title: "Datakwaliteit Governix",
      description: "Dubbele of inconsistente applicatieregistraties die opgeschoond moeten worden.",
      rows: model.duplicates,
      columns: [
        { key: "name", label: "Applicatie" },
        { key: "duplicate_key", label: "Normalisatie" },
        { key: "duplicate_count", label: "Aantal" },
        { key: "domain", label: "Domein" },
      ],
    },
  };

  const selected = resultConfig[selectedView];

  return (
    <div className="space-y-6">
      <div className="arch-hero">
        <div className="arch-hero-brand">
          <div className="arch-mora-logo-wrap">
            <img src="/architecture/mora-logo.png" onError={(e) => { e.currentTarget.src = "/architecture/mora-logo-placeholder.svg"; }} alt="MORA" className="arch-mora-logo" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">Architect view</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">MORA Architectuur Analyse</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/78">
              Voor architectuur: dekking, datakwaliteit, domeinen, relaties, ketenimpact en governance-gaps in één overzicht.
            </p>
          </div>
        </div>
        <div className="arch-hero-links">
          <Link to="/architecture" className="arch-quicklink arch-quicklink-primary"><ArrowLeft className="mr-2 h-4 w-4" />Cockpit</Link>
          <Link to="/architecture/relations" className="arch-quicklink">Relaties</Link>
          <Link to="/architecture/domains" className="arch-quicklink">Domeinen</Link>
        </div>
      </div>

      {error ? <Notice title="Architect view niet beschikbaar" tone="danger">{error}</Notice> : null}
      {loading ? <Notice title="Architectuurdata laden">De MORA-data, domeinen, matches en relaties worden opgehaald…</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <Network className="mt-1 h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dekking & datakwaliteit</h2>
              <p className="mt-1 text-sm text-slate-600">De belangrijkste signalen die een architect direct wil zien.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MiniProgress label="Governix apps met MORA" value={linkedApps} total={applications.length || 1} tone="green" />
            <MiniProgress label="MORA componenten gekoppeld" value={linkedMora} total={components.length || 1} tone="blue" />
            <MiniProgress label="BIV compleet" value={bivComplete} total={bivRows.length || 1} tone="violet" />
          </div>
        </div>

        <div className="card p-5 bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-xl font-bold text-blue-950">Architectuurvragen</h2>
              <ul className="mt-3 space-y-2 text-sm text-blue-900/85">
                <li>• Welke MORA-componenten zijn nog niet geregistreerd?</li>
                <li>• Welke componenten hebben hoge ketenimpact?</li>
                <li>• Welke domeinen missen governance of BIV?</li>
                <li>• Waar ontstaan dubbele of inconsistente applicaties?</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="arch-tile-grid">
        <ArchitectTile icon={ShieldAlert} label="Governance gaps" value={model.governanceGaps.length} subtext="Niet gekoppelde MORA-componenten" tone="rose" active={selectedView === "gaps"} onClick={() => setSelectedView("gaps")} />
        <ArchitectTile icon={CheckCircle2} label="Dekking" value={`${linkedApps}/${applications.length || 0}`} subtext="Gekoppelde Governix apps" tone="green" active={selectedView === "coverage"} onClick={() => setSelectedView("coverage")} />
        <ArchitectTile icon={Target} label="Kandidaten" value={model.strong.length + model.candidate.length} subtext="Te beoordelen matches" tone="amber" active={selectedView === "candidates"} onClick={() => setSelectedView("candidates")} />
        <ArchitectTile icon={GitBranch} label="Impact" value={model.highImpact.length} subtext="Componenten met relatie-impact" tone="blue" active={selectedView === "impact"} onClick={() => setSelectedView("impact")} />
        <ArchitectTile icon={Layers3} label="Domeinen" value={domains.length} subtext="Architectuurclusters" tone="violet" active={selectedView === "domains"} onClick={() => setSelectedView("domains")} />
        <ArchitectTile icon={XCircle} label="Datakwaliteit" value={model.duplicates.length} subtext="Duplicaten/inconsistenties" tone="slate" active={selectedView === "dataquality"} onClick={() => setSelectedView("dataquality")} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ResultTable title={selected.title} description={selected.description} rows={selected.rows} columns={selected.columns} />
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Workflow className="mt-1 h-5 w-5 text-blue-700" />
              <div>
                <h2 className="font-bold text-slate-900">Keten & relatiebeeld</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <div className="flex justify-between"><span>Relaties geïmporteerd</span><strong>{relationTotal || relations.length}</strong></div>
                  <div className="flex justify-between"><span>Relatietypes</span><strong>{relationsSummary.length}</strong></div>
                  <div className="flex justify-between"><span>Componenten</span><strong>{components.length}</strong></div>
                  <div className="flex justify-between"><span>Applicaties</span><strong>{applications.length}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Database className="mt-1 h-5 w-5 text-slate-700" />
              <div>
                <h2 className="font-bold text-slate-900">Acties voor architectuur</h2>
                <ol className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>1. Beoordeel {model.strong.length + model.candidate.length} match-kandidaten.</li>
                  <li>2. Bepaal of {model.governanceGaps.length} ongekoppelde componenten echte applicaties, technische componenten of legacy zijn.</li>
                  <li>3. Controleer domeinindeling voor {domains.length} domeinen.</li>
                  <li>4. Vul BIV aan voor {model.incompleteBiv.length} componenten.</li>
                  <li>5. Gebruik relatie-impact om kroonjuwelen scherper te bepalen.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-amber-50 border-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 text-amber-700" />
              <div>
                <h2 className="font-bold text-amber-950">Governance interpretatie</h2>
                <p className="mt-1 text-sm text-amber-900/85">Een MORA-component zonder Governix-koppeling is niet direct fout, maar wel een signaal: registreren als applicatie, markeren als technisch component, uitsluiten of koppelen.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
