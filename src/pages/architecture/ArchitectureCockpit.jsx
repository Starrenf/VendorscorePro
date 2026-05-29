import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  Layers3,
  Link2,
  Search,
  ShieldAlert,
  Tags,
  Target,
  Workflow,
  XCircle,
} from "lucide-react";
import Notice from "../../components/Notice";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import "./architecture.css";

const ORG_FALLBACK = "7ec54263-6b9b-4cb2-9b97-526d8909550d";

function uniq(list, key) {
  return [...new Map((list || []).filter(Boolean).map((item) => [item?.[key], item])).values()];
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function Tile({ id, icon: Icon, label, value, subtext, tone, active, onClick }) {
  return (
    <button type="button" onClick={() => onClick(id)} className={`arch-tile arch-${tone || "blue"} ${active ? "arch-active" : ""}`}>
      <div className="arch-tile-icon"><Icon size={22} /></div>
      <div className="arch-tile-copy">
        <div className="arch-tile-label">{label}</div>
        <div className="arch-tile-value">{value}</div>
        <div className="arch-tile-subtext">{subtext}</div>
      </div>
    </button>
  );
}

function ProgressBar({ label, value, total, tone = "blue" }) {
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

function ResultPanel({ selected, rows, onClose }) {
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [selected?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row || {}).join(" ").toLowerCase().includes(q));
  }, [rows, query]);

  if (!selected) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{selected.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{selected.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="min-w-[260px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in resultaten…" />
          </div>
          <button className="btn" onClick={onClose}>Sluiten</button>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-600">Resultaten: <strong className="text-slate-900">{filtered.length}</strong></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {selected.columns.map((column) => <th key={column.key} className="py-3 pr-4 font-semibold">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={selected.columns.length} className="py-6 text-slate-500">Geen resultaten.</td></tr>
            ) : filtered.map((row, idx) => (
              <tr key={row.id || row.mora_component_id || row.application_id || idx} className="border-b border-slate-100 align-top">
                {selected.columns.map((column) => (
                  <td key={column.key} className="py-3 pr-4 text-slate-700">
                    {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ArchitectureCockpit() {
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
  const [selectedId, setSelectedId] = useState("candidates");

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError("");
      if (!session) { nav("/login"); return; }
      if (!client) { nav("/settings"); return; }
      try {
        const [componentResult, appResult, matchResult, bivResult, domainResult, relationSummaryResult] = await Promise.all([
          client.from("mora_application_components").select("id,organization_id,mora_element_id,name,mora_type,specialization,documentation").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("applications").select("id,organization_id,name,supplier_id,domain,is_critical,status").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("v_mora_application_match_candidates").select("*").eq("organization_id", orgId).order("match_score", { ascending: false }),
          client.from("v_mora_application_components_with_biv").select("*").eq("organization_id", orgId).order("name", { ascending: true }),
          client.from("v_architecture_domain_overview").select("*").eq("organization_id", orgId).order("component_count", { ascending: false }),
          client.from("v_architecture_relation_type_summary").select("*").eq("organization_id", orgId).order("relation_count", { ascending: false }),
        ]);
        if (componentResult.error) throw componentResult.error;
        if (appResult.error) throw appResult.error;
        if (matchResult.error) throw matchResult.error;
        if (bivResult.error) throw bivResult.error;
        if (domainResult.error && domainResult.error.code !== "42P01") throw domainResult.error;
        if (relationSummaryResult.error && relationSummaryResult.error.code !== "42P01") throw relationSummaryResult.error;
        setComponents(componentResult.data || []);
        setApplications(appResult.data || []);
        setMatches(matchResult.data || []);
        setBivRows(bivResult.data || []);
        setDomains(domainResult.data || []);
        setRelationsSummary(relationSummaryResult.data || []);
      } catch (err) {
        setError(err?.message || "Architectuurdata laden mislukt. Controleer of de MORA SQL-import is uitgevoerd.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [session, client, orgId, nav]);

  const model = useMemo(() => {
    const exact = matches.filter((m) => m.match_type === "exact" || Number(m.match_score) >= 99);
    const strong = matches.filter((m) => m.match_type === "strong_candidate" && Number(m.match_score) < 99);
    const candidates = matches.filter((m) => m.match_type === "candidate");
    const weak = matches.filter((m) => m.match_type === "weak");
    const usefulMatches = matches.filter((m) => ["exact", "strong_candidate"].includes(m.match_type) || Number(m.match_score) >= 55);
    const linkedApplicationIds = new Set(usefulMatches.map((m) => m.application_id).filter(Boolean));
    const linkedMoraIds = new Set(usefulMatches.map((m) => m.mora_component_id).filter(Boolean));
    const unlinkedApps = applications.filter((a) => !linkedApplicationIds.has(a.id));
    const unlinkedMora = components.filter((c) => !linkedMoraIds.has(c.id));
    const incompleteBiv = bivRows.filter((r) => !r.beschikbaarheid || !r.integriteit || !r.vertrouwelijkheid);

    const byName = new Map();
    for (const app of applications) {
      const key = normalizeName(app.name);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) || []), app]);
    }
    const duplicateApps = [...byName.entries()].filter(([, rows]) => rows.length > 1).flatMap(([name, rows]) => rows.map((row) => ({ ...row, duplicate_key: name, duplicate_count: rows.length })));

    return { exact, strong, candidates, weak, usefulMatches, unlinkedApps, unlinkedMora, incompleteBiv, duplicateApps };
  }, [applications, components, matches, bivRows]);

  const selections = useMemo(() => ({
    linked: {
      id: "linked",
      title: "Gekoppelde applicaties",
      description: "Exacte en sterke MORA-koppelingen richting VendorScorePro applicaties.",
      rows: model.usefulMatches,
      columns: [
        { key: "mora_application_name", label: "MORA component" },
        { key: "vendorscore_application_name", label: "VendorScorePro applicatie", render: (r) => <span className="font-semibold text-blue-700">{r.vendorscore_application_name}</span> },
        { key: "match_score", label: "Score", render: (r) => <span className="badge">{r.match_score}%</span> },
        { key: "match_type", label: "Type" },
      ],
    },
    candidates: {
      id: "candidates",
      title: "Match-kandidaten te beoordelen",
      description: "Kandidaten die inhoudelijk gecontroleerd of bevestigd moeten worden.",
      rows: [...model.strong, ...model.candidates],
      columns: [
        { key: "mora_application_name", label: "MORA component" },
        { key: "vendorscore_application_name", label: "Kandidaat applicatie" },
        { key: "match_score", label: "Score", render: (r) => <span className="badge">{r.match_score}%</span> },
        { key: "match_type", label: "Actie", render: (r) => <Link to={`/architecture/matches?mora=${r.mora_component_id}`} className="text-amber-700 font-semibold hover:text-amber-900">Controleren / bevestigen</Link> },
      ],
    },
    unlinkedApps: {
      id: "unlinkedApps",
      title: "VendorScorePro applicaties zonder MORA-koppeling",
      description: "Applicaties die nog handmatig aan een architectuurcomponent gekoppeld moeten worden.",
      rows: model.unlinkedApps,
      columns: [
        { key: "name", label: "Applicatie" },
        { key: "domain", label: "Domein" },
        { key: "status", label: "Status" },
        { key: "is_critical", label: "Kritisch", render: (r) => r.is_critical ? "Ja" : "Nee" },
      ],
    },
    unlinkedMora: {
      id: "unlinkedMora",
      title: "Ongekoppelde MORA-componenten",
      description: "Architectuurcomponenten die nog niet zichtbaar gekoppeld zijn aan VendorScorePro applicaties.",
      rows: model.unlinkedMora,
      columns: [
        { key: "name", label: "MORA component" },
        { key: "mora_type", label: "MORA type" },
        { key: "specialization", label: "Specialisatie" },
      ],
    },
    duplicates: {
      id: "duplicates",
      title: "Mogelijke dubbele applicaties",
      description: "Datakwaliteit: gelijke of zeer vergelijkbare applicatienamen in VendorScorePro.",
      rows: model.duplicateApps,
      columns: [
        { key: "name", label: "Applicatie" },
        { key: "duplicate_key", label: "Normalisatie" },
        { key: "duplicate_count", label: "Aantal" },
        { key: "domain", label: "Domein" },
      ],
    },
    domains: {
      id: "domains",
      title: "Architectuurdomeinen",
      description: "Automatische domeinclassificatie van MORA-componenten zoals LMS, IAM, HR, Finance, Integratie en Security.",
      rows: domains,
      columns: [
        { key: "domain_name", label: "Domein", render: (r) => <Link className="font-semibold text-blue-700" to="/architecture/domains">{r.domain_name}</Link> },
        { key: "component_count", label: "Aantal componenten" },
        { key: "avg_confidence", label: "Gem. confidence", render: (r) => r.avg_confidence ? `${Number(r.avg_confidence).toFixed(1)}%` : "—" },
      ],
    },
    relations: {
      id: "relations",
      title: "Architectuurrelaties",
      description: "Relatietypes uit de MORA-export. Klik door naar Relaties voor de onderliggende afhankelijkheden.",
      rows: relationsSummary,
      columns: [
        { key: "relation_type", label: "Relatietype", render: (r) => <Link className="font-semibold text-blue-700" to="/architecture/relations">{r.relation_type}</Link> },
        { key: "relation_count", label: "Aantal relaties" },
      ],
    },
    biv: {
      id: "biv",
      title: "BIV incompleet",
      description: "MORA-componenten waarbij Beschikbaarheid, Integriteit of Vertrouwelijkheid nog niet volledig is vastgelegd.",
      rows: model.incompleteBiv,
      columns: [
        { key: "name", label: "MORA component" },
        { key: "beschikbaarheid", label: "B" },
        { key: "integriteit", label: "I" },
        { key: "vertrouwelijkheid", label: "V" },
      ],
    },
  }), [model, domains, relationsSummary]);

  const selected = selections[selectedId];
  const totalApps = applications.length || 0;
  const linkedApps = uniq(model.usefulMatches, "application_id").length;
  const linkedMora = uniq(model.usefulMatches, "mora_component_id").length;
  const bivComplete = Math.max(0, bivRows.length - model.incompleteBiv.length);

  return (
    <div className="space-y-6">
      <div className="arch-hero">
        <div className="arch-hero-brand">
          <div className="arch-mora-logo-wrap">
            <img src="/architecture/mora-logo.png" onError={(e) => { e.currentTarget.src = "/architecture/mora-logo-placeholder.svg"; }} alt="MORA" className="arch-mora-logo" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">MORA geïntegreerde enterprise architectuur</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">Architectuur Cockpit</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/78">
              In één oogopslag zien welke applicaties gekoppeld zijn aan MORA, welke matches nog beoordeeld moeten worden en waar datakwaliteit of BIV-informatie ontbreekt.
            </p>
          </div>
        </div>
        <div className="arch-hero-links">
          <Link to="/architecture/about" className="arch-quicklink arch-quicklink-primary"><ExternalLink className="mr-2 h-4 w-4" />Over MORA</Link>
          <Link to="/architecture/architect" className="arch-quicklink">Architect view</Link>
          <Link to="/architecture/matches" className="arch-quicklink">Matches beoordelen</Link>
          <Link to="/architecture/domains" className="arch-quicklink">Domeinen</Link>
          <Link to="/architecture/relations" className="arch-quicklink">Relaties</Link>
          <Link to="/wiki" className="arch-quicklink">Wiki</Link>
        </div>
      </div>

      {error ? <Notice title="Architectuurdata niet beschikbaar" tone="danger">{error}</Notice> : null}
      {loading ? <Notice title="Architectuurdata laden">De MORA-gegevens en matchresultaten worden opgehaald…</Notice> : null}

      <div className="arch-tile-grid">
        <Tile id="linked" icon={CheckCircle2} label="Gekoppelde applicaties" value={`${linkedApps}/${totalApps}`} subtext="VendorScorePro apps met MORA-match" tone="green" active={selectedId === "linked"} onClick={setSelectedId} />
        <Tile id="candidates" icon={Target} label="Match-kandidaten" value={model.strong.length + model.candidates.length} subtext="Te controleren/bevestigen" tone="amber" active={selectedId === "candidates"} onClick={setSelectedId} />
        <Tile id="unlinkedApps" icon={XCircle} label="Niet gekoppelde apps" value={model.unlinkedApps.length} subtext="Applicaties zonder sterke MORA-match" tone="rose" active={selectedId === "unlinkedApps"} onClick={setSelectedId} />
        <Tile id="unlinkedMora" icon={Layers3} label="Ongekoppelde MORA" value={model.unlinkedMora.length} subtext={`${components.length} componenten geïmporteerd`} tone="blue" active={selectedId === "unlinkedMora"} onClick={setSelectedId} />
        <Tile id="duplicates" icon={GitBranch} label="Dubbele applicaties" value={model.duplicateApps.length} subtext="Datakwaliteit controleren" tone="violet" active={selectedId === "duplicates"} onClick={setSelectedId} />
        <Tile id="domains" icon={Tags} label="Domeinen" value={domains.length} subtext="Automatische MORA-classificatie" tone="green" active={selectedId === "domains"} onClick={setSelectedId} />
        <Tile id="relations" icon={Workflow} label="Relaties" value={relationsSummary.reduce((sum, r) => sum + Number(r.relation_count || 0), 0)} subtext="MORA-afhankelijkheden" tone="blue" active={selectedId === "relations"} onClick={setSelectedId} />
        <Tile id="biv" icon={ShieldAlert} label="BIV incompleet" value={model.incompleteBiv.length} subtext="Beschikbaarheid/Integriteit/Vertrouwelijkheid" tone="slate" active={selectedId === "biv"} onClick={setSelectedId} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ResultPanel selected={selected} rows={selected?.rows || []} onClose={() => setSelectedId(null)} />
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Workflow className="mt-1 h-5 w-5 text-blue-700" />
              <div>
                <h2 className="font-bold text-slate-900">Voortgang architectuurkoppeling</h2>
                <p className="mt-1 text-sm text-slate-600">Direct zichtbaar waar we staan en wat nog aandacht vraagt.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <ProgressBar label="Applicaties gekoppeld" value={linkedApps} total={totalApps || 1} tone="green" />
              <ProgressBar label="MORA componenten gekoppeld" value={linkedMora} total={components.length || 1} tone="blue" />
              <ProgressBar label="BIV compleet" value={bivComplete} total={bivRows.length || 1} tone="violet" />
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Database className="mt-1 h-5 w-5 text-slate-700" />
              <div>
                <h2 className="font-bold text-slate-900">Wat moet nog gebeuren?</h2>
                <ol className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>1. Beoordeel {model.strong.length + model.candidates.length} match-kandidaten.</li>
                  <li>2. Koppel {model.unlinkedApps.length} VendorScorePro applicaties handmatig.</li>
                  <li>3. Controleer datakwaliteit: {model.duplicateApps.length} mogelijke duplicaten.</li>
                  <li>4. Vul BIV aan voor {model.incompleteBiv.length} MORA-componenten.</li>
                  <li>5. Controleer domeinclassificatie voor {domains.length} domeinen.</li>
                  <li>6. Analyseer {relationsSummary.reduce((sum, r) => sum + Number(r.relation_count || 0), 0)} MORA-relaties voor ketenimpact.</li>
                </ol>
              </div>
            </div>
          </div>
          <div className="card p-5 bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <Link2 className="mt-1 h-5 w-5 text-blue-700" />
              <div>
                <h2 className="font-bold text-blue-950">Volgende stap</h2>
                <p className="mt-1 text-sm text-blue-900/80">Maak een confirmatie-flow waarmee functioneel beheer of architectuur matches kan bevestigen, afwijzen of handmatig koppelen.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-slate-900">Documentopslag testen</h2>
        <p className="mt-1 text-sm text-slate-600">Documentupload is al aanwezig op de leverancierdetailpagina, tab <strong>Documenten</strong>. Deze gebruikt de Supabase Storage bucket <code>supplier-documents</code> en slaat metadata op in <code>supplier_documents</code>.</p>
      </div>
    </div>
  );
}
