import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Filter, Layers3, Search, Tags } from "lucide-react";
import Notice from "../../components/Notice";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import "./architecture.css";

const ORG_FALLBACK = "7ec54263-6b9b-4cb2-9b97-526d8909550d";

function pct(value, total) {
  return total ? Math.round((Number(value || 0) / Number(total || 1)) * 100) : 0;
}

function domainTone(domain) {
  const d = String(domain || "").toLowerCase();
  if (d.includes("iam") || d.includes("identiteit")) return "violet";
  if (d.includes("security")) return "rose";
  if (d.includes("lms") || d.includes("leer")) return "blue";
  if (d.includes("integratie") || d.includes("middleware")) return "amber";
  if (d.includes("finance") || d.includes("hr")) return "green";
  return "slate";
}

function DomainCard({ row, active, onClick, total }) {
  const tone = domainTone(row.domain_name);
  const percentage = pct(row.component_count, total);
  return (
    <button type="button" onClick={() => onClick(row.domain_name)} className={`arch-domain-card arch-domain-${tone} ${active ? "arch-domain-active" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Domein</div>
          <div className="mt-1 text-lg font-black">{row.domain_name || "Onbekend"}</div>
        </div>
        <div className="arch-domain-count">{row.component_count || 0}</div>
      </div>
      <div className="mt-4 arch-progress-track bg-white/55">
        <div className={`arch-progress-fill arch-progress-${tone === "rose" ? "violet" : tone === "amber" ? "blue" : tone === "green" ? "green" : "blue"}`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-2 text-xs opacity-75">{percentage}% van geclassificeerde componenten</div>
    </button>
  );
}

export default function ArchitectureDomains() {
  const nav = useNavigate();
  const client = supabase();
  const { session, organization } = useApp();
  const orgId = organization?.id || ORG_FALLBACK;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domains, setDomains] = useState([]);
  const [components, setComponents] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError("");
      if (!session) { nav("/login"); return; }
      if (!client) { nav("/settings"); return; }
      try {
        const [domainResult, componentResult] = await Promise.all([
          client.from("v_architecture_domain_overview").select("*").eq("organization_id", orgId).order("component_count", { ascending: false }),
          client.from("v_architecture_components_with_domain").select("*").eq("organization_id", orgId).order("domain_name", { ascending: true }).order("name", { ascending: true }),
        ]);
        if (domainResult.error) throw domainResult.error;
        if (componentResult.error) throw componentResult.error;
        setDomains(domainResult.data || []);
        setComponents(componentResult.data || []);
        setSelectedDomain((domainResult.data || [])[0]?.domain_name || "");
      } catch (err) {
        setError(err?.message || "Domeindata laden mislukt. Draai eerst de v0.9.30 MORA Deep Import SQL.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [client, session, orgId, nav]);

  const totalClassified = useMemo(() => domains.reduce((sum, row) => sum + Number(row.component_count || 0), 0), [domains]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return components.filter((row) => {
      const matchesDomain = !selectedDomain || row.domain_name === selectedDomain;
      const matchesQuery = !q || Object.values(row || {}).join(" ").toLowerCase().includes(q);
      return matchesDomain && matchesQuery;
    });
  }, [components, selectedDomain, query]);

  return (
    <div className="space-y-6">
      <div className="arch-hero">
        <div className="arch-hero-brand">
          <div className="arch-mora-logo-wrap">
            <img src="/architecture/mora-logo.png" onError={(e) => { e.currentTarget.src = "/architecture/mora-logo-placeholder.svg"; }} alt="MORA" className="arch-mora-logo" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">MORA domeinclassificatie</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">Architectuurdomeinen</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/78">Applicatiecomponenten gegroepeerd naar domein, zodat je sneller ziet waar governance, beheer en risico aandacht vragen.</p>
          </div>
        </div>
        <Link to="/architecture" className="btn bg-white text-[#0c4f9f] hover:bg-white/90"><ArrowLeft className="mr-2 h-4 w-4" />Cockpit</Link>
      </div>

      {error ? <Notice title="Domeindata niet beschikbaar" tone="danger">{error}</Notice> : null}
      {loading ? <Notice title="Domeinen laden">De MORA-domeinen en componenten worden opgehaald…</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {domains.map((row) => <DomainCard key={row.domain_name} row={row} active={selectedDomain === row.domain_name} onClick={setSelectedDomain} total={totalClassified || 1} />)}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Tags className="mt-1 h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedDomain || "Alle domeinen"}</h2>
              <p className="mt-1 text-sm text-slate-600">Klik op een domeintegel om direct de onderliggende MORA-componenten te bekijken.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="min-w-[280px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek component, BIV of type…" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="badge"><Database className="mr-1 h-3.5 w-3.5" />{filtered.length} componenten</span>
          <span className="badge"><Filter className="mr-1 h-3.5 w-3.5" />{domains.length} domeinen</span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-3 pr-4 font-semibold">Component</th>
                <th className="py-3 pr-4 font-semibold">Domein</th>
                <th className="py-3 pr-4 font-semibold">MORA type</th>
                <th className="py-3 pr-4 font-semibold">BIV</th>
                <th className="py-3 pr-4 font-semibold">Bron</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5" className="py-6 text-slate-500">Geen componenten gevonden.</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.name || "—"}</td>
                  <td className="py-3 pr-4"><span className={`arch-domain-badge arch-domain-${domainTone(row.domain_name)}`}>{row.domain_name || "Onbekend"}</span></td>
                  <td className="py-3 pr-4 text-slate-700">{row.mora_type || row.specialization || "—"}</td>
                  <td className="py-3 pr-4 text-slate-700">B: {row.beschikbaarheid || "—"} · I: {row.integriteit || "—"} · V: {row.vertrouwelijkheid || "—"}</td>
                  <td className="py-3 pr-4 text-slate-500">{row.classification_source || "auto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
