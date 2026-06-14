import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Filter,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Notice from "../../components/Notice";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import "./architecture.css";

const ORG_FALLBACK = "7ec54263-6b9b-4cb2-9b97-526d8909550d";

function normalizeStatus(status) {
  return status || "open";
}

function statusLabel(status) {
  switch (status) {
    case "confirmed": return "Bevestigd";
    case "rejected": return "Afgewezen";
    case "manual": return "Handmatig";
    case "technical": return "Technisch";
    case "excluded": return "Uitgesloten";
    default: return "Te beoordelen";
  }
}

function statusClass(status) {
  switch (status) {
    case "confirmed": return "match-status-confirmed";
    case "rejected": return "match-status-rejected";
    case "manual": return "match-status-manual";
    case "technical": return "match-status-technical";
    case "excluded": return "match-status-excluded";
    default: return "match-status-open";
  }
}

function MatchStatusBadge({ status }) {
  return <span className={`match-status ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function scoreExplanation(score, type) {
  const value = Number(score || 0);
  if (type === "exact" || value >= 90) return "Zeer sterke match: naam komt exact of vrijwel exact overeen.";
  if (value >= 60) return "Sterke kandidaat: naam lijkt sterk overeen te komen, maar architect moet bevestigen.";
  if (value >= 40) return "Matige kandidaat: er is gedeeltelijke overeenkomst, controleer domein en relaties.";
  return "Zwakke kandidaat: alleen controleren als domein, keten of context dit ondersteunt.";
}

function relationLabel(rel, moraName) {
  const source = rel.source_name || "Onbekend";
  const target = rel.target_name || "Onbekend";
  const type = rel.relation_type || "relatie";
  if ((source || "").toLowerCase() === (moraName || "").toLowerCase()) return `${type}: ${source} → ${target}`;
  if ((target || "").toLowerCase() === (moraName || "").toLowerCase()) return `${type}: ${source} → ${target}`;
  return `${type}: ${source} → ${target}`;
}

export default function ArchitectureMatchReview() {
  const nav = useNavigate();
  const client = supabase();
  const { session, organization } = useApp();
  const orgId = organization?.id || ORG_FALLBACK;

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [savedMatches, setSavedMatches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [domains, setDomains] = useState([]);
  const [relations, setRelations] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [manualTarget, setManualTarget] = useState({});

  async function loadData() {
    setLoading(true);
    setError("");
    setMessage("");
    if (!session) { nav("/login"); return; }
    if (!client) { nav("/settings"); return; }

    try {
      const [candidateResult, matchResult, appResult, domainResult, relationResult] = await Promise.all([
        client
          .from("v_mora_application_match_candidates")
          .select("*")
          .eq("organization_id", orgId)
          .order("match_score", { ascending: false }),
        client
          .from("mora_application_component_matches")
          .select("*")
          .eq("organization_id", orgId),
        client
          .from("applications")
          .select("id,name,domain,status,is_critical")
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
        client
          .from("architecture_domains")
          .select("component_id,domain_name,confidence_score,classification_source")
          .eq("organization_id", orgId),
        client
          .from("architecture_relations")
          .select("source_mora_element_id,target_mora_element_id,source_name,target_name,relation_type,source_type,target_type")
          .eq("organization_id", orgId),
      ]);

      if (candidateResult.error) throw candidateResult.error;
      if (matchResult.error) throw matchResult.error;
      if (appResult.error) throw appResult.error;
      if (domainResult.error) console.warn("Architectuurdomeinen konden niet worden geladen", domainResult.error);
      if (relationResult.error) console.warn("Architectuurrelaties konden niet worden geladen", relationResult.error);

      setCandidates(candidateResult.data || []);
      setSavedMatches(matchResult.data || []);
      setApplications(appResult.data || []);
      setDomains(domainResult.data || []);
      setRelations(relationResult.data || []);
    } catch (err) {
      setError(err?.message || "Matchgegevens laden mislukt. Controleer of de v0.9.36 SQL is uitgevoerd.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [session, client, orgId]);

  const savedByPair = useMemo(() => {
    const map = new Map();
    for (const item of savedMatches) {
      map.set(`${item.mora_component_id}:${item.application_id}`, item);
    }
    return map;
  }, [savedMatches]);

  const appById = useMemo(() => {
    const map = new Map();
    for (const app of applications) map.set(app.id, app);
    return map;
  }, [applications]);

  const domainsByComponent = useMemo(() => {
    const map = new Map();
    for (const domain of domains) {
      const list = map.get(domain.component_id) || [];
      list.push(domain);
      map.set(domain.component_id, list);
    }
    return map;
  }, [domains]);

  const relationsByElementId = useMemo(() => {
    const map = new Map();
    for (const rel of relations) {
      for (const key of [rel.source_mora_element_id, rel.target_mora_element_id]) {
        if (!key) continue;
        const list = map.get(key) || [];
        list.push(rel);
        map.set(key, list);
      }
    }
    return map;
  }, [relations]);

  const rows = useMemo(() => {
    const list = candidates.map((candidate) => {
      const saved = savedByPair.get(`${candidate.mora_component_id}:${candidate.application_id}`);
      return {
        ...candidate,
        review_id: saved?.id || null,
        match_status: normalizeStatus(saved?.match_status),
        reviewed_at: saved?.reviewed_at || null,
        notes: saved?.notes || "",
      };
    });

    const q = query.trim().toLowerCase();
    return list.filter((row) => {
      const statusOk = filter === "all" || row.match_status === filter || (filter === "open" && row.match_status === "open");
      const queryOk = !q || [row.mora_application_name, row.vendorscore_application_name, row.match_type, row.match_status]
        .join(" ")
        .toLowerCase()
        .includes(q);
      return statusOk && queryOk;
    });
  }, [candidates, savedByPair, query, filter]);

  const totals = useMemo(() => {
    const merged = candidates.map((candidate) => {
      const saved = savedByPair.get(`${candidate.mora_component_id}:${candidate.application_id}`);
      return normalizeStatus(saved?.match_status);
    });
    return {
      open: merged.filter((s) => s === "open").length,
      confirmed: merged.filter((s) => s === "confirmed").length,
      rejected: merged.filter((s) => s === "rejected").length,
      manual: merged.filter((s) => s === "manual").length,
      technical: merged.filter((s) => s === "technical").length,
      excluded: merged.filter((s) => s === "excluded").length,
    };
  }, [candidates, savedByPair]);

  async function upsertMatch(row, status, applicationId = row.application_id) {
    setSavingId(`${row.mora_component_id}:${row.application_id}:${status}`);
    setError("");
    setMessage("");

    try {
      const userResult = await client.auth.getUser();
      const userId = userResult?.data?.user?.id || null;
      const payload = {
        organization_id: orgId,
        mora_component_id: row.mora_component_id,
        application_id: applicationId,
        match_score: Number(row.match_score || 0),
        match_status: status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: status === "manual"
          ? `Handmatig gekoppeld vanuit reviewflow. Originele kandidaat: ${row.vendorscore_application_name || "onbekend"}.`
          : null,
      };

      const { error: upsertError } = await client
        .from("mora_application_component_matches")
        .upsert(payload, { onConflict: "organization_id,mora_component_id,application_id" });

      if (upsertError) throw upsertError;
      setMessage(`Match ${statusLabel(status).toLowerCase()} opgeslagen.`);
      await loadData();
    } catch (err) {
      setError(err?.message || "Opslaan van matchstatus mislukt.");
    } finally {
      setSavingId("");
    }
  }

  function selectedManualApp(row) {
    return manualTarget[row.mora_component_id] || row.application_id || "";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/architecture" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100 hover:text-white">
            <ArrowLeft size={16} /> Terug naar Architectuur Cockpit
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">MORA Match Review</h1>
          <p className="mt-2 max-w-3xl text-sm text-blue-100/85">
            Controleer, bevestig of wijs voorgestelde koppelingen tussen MORA-componenten en VendorScorePro-applicaties af.
            Deze workflow is bedoeld voor architectuur en functioneel beheer.
          </p>
        </div>
        <button className="btn" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} /> Ververs
        </button>
      </div>

      {error ? <Notice title="Match review fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="Opgeslagen">{message}</Notice> : null}
      {loading ? <Notice title="Matches laden">De match-kandidaten en bestaande beoordelingen worden opgehaald…</Notice> : null}

      <div className="match-review-stats">
        <button className={`match-review-stat ${filter === "open" ? "active" : ""}`} onClick={() => setFilter("open")}><strong>{totals.open}</strong><span>Te beoordelen</span></button>
        <button className={`match-review-stat ${filter === "confirmed" ? "active" : ""}`} onClick={() => setFilter("confirmed")}><strong>{totals.confirmed}</strong><span>Bevestigd</span></button>
        <button className={`match-review-stat ${filter === "rejected" ? "active" : ""}`} onClick={() => setFilter("rejected")}><strong>{totals.rejected}</strong><span>Afgewezen</span></button>
        <button className={`match-review-stat ${filter === "manual" ? "active" : ""}`} onClick={() => setFilter("manual")}><strong>{totals.manual}</strong><span>Handmatig</span></button>
        <button className={`match-review-stat ${filter === "technical" ? "active" : ""}`} onClick={() => setFilter("technical")}><strong>{totals.technical}</strong><span>Technisch</span></button>
        <button className={`match-review-stat ${filter === "excluded" ? "active" : ""}`} onClick={() => setFilter("excluded")}><strong>{totals.excluded}</strong><span>Uitgesloten</span></button>
        <button className={`match-review-stat ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}><strong>{candidates.length}</strong><span>Alle</span></button>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter size={18} />
            <span className="font-semibold">Resultaten: {rows.length}</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="min-w-[320px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek MORA of applicatie…" />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">Geen match-kandidaten binnen deze filter.</div>
          ) : rows.map((row) => {
            const busy = savingId.startsWith(`${row.mora_component_id}:${row.application_id}`);
            return (
              <div key={`${row.mora_component_id}-${row.application_id}`} className="match-review-card">
                <div className="match-review-main">
                  <div>
                    <div className="match-review-label">MORA component</div>
                    <div className="match-review-name">{row.mora_application_name || "—"}</div>
                    <div className="match-review-id">{row.mora_element_id}</div>
                  </div>
                  <div className="match-review-link"><Link2 size={22} /></div>
                  <div>
                    <div className="match-review-label">VendorScorePro applicatie</div>
                    <div className="match-review-name">{row.vendorscore_application_name || "—"}</div>
                    <div className="match-review-id">Score {row.match_score}% · {row.match_type}</div>
                  </div>
                  <div className="match-review-status-wrap">
                    <MatchStatusBadge status={row.match_status} />
                  </div>
                </div>

                <div className="match-explainability">
                  <div className="match-explainability-head">
                    <div>
                      <strong>Waarom voorgesteld?</strong>
                      <p>{scoreExplanation(row.match_score, row.match_type)}</p>
                    </div>
                    <span className={`match-confidence ${Number(row.match_score || 0) >= 60 ? "high" : Number(row.match_score || 0) >= 40 ? "medium" : "low"}`}>
                      {Number(row.match_score || 0).toFixed(1)}% confidence
                    </span>
                  </div>

                  <div className="match-explainability-grid">
                    <div className="match-factor">
                      <span>Naamvergelijking</span>
                      <strong>{row.mora_application_name || "—"} ↔ {row.vendorscore_application_name || "—"}</strong>
                      <small>Matchtype: {row.match_type || "candidate"}</small>
                    </div>

                    <div className="match-factor">
                      <span>Domein / context</span>
                      <strong>
                        {(domainsByComponent.get(row.mora_component_id) || []).map((d) => d.domain_name).join(", ") || "MORA-domein onbekend"}
                      </strong>
                      <small>VendorScore domein: {appById.get(row.application_id)?.domain || "niet ingevuld"}</small>
                    </div>

                    <div className="match-factor">
                      <span>Relaties in architectuurmodel</span>
                      <strong>{(relationsByElementId.get(row.mora_element_id) || []).length} relatie(s)</strong>
                      <small>Laat zien of het component onderdeel is van een keten.</small>
                    </div>

                    <div className="match-factor">
                      <span>Beoordelingsadvies</span>
                      <strong>{Number(row.match_score || 0) >= 60 ? "Waarschijnlijk correct" : Number(row.match_score || 0) >= 40 ? "Handmatig controleren" : "Alleen bevestigen met extra bewijs"}</strong>
                      <small>Architect bepaalt definitieve status.</small>
                    </div>
                  </div>

                  {(relationsByElementId.get(row.mora_element_id) || []).length ? (
                    <div className="match-relations-preview">
                      <span>Voorbeeldrelaties</span>
                      {(relationsByElementId.get(row.mora_element_id) || []).slice(0, 4).map((rel, idx) => (
                        <div key={`${row.mora_component_id}-rel-${idx}`}>{relationLabel(rel, row.mora_application_name)}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="match-relations-preview muted">
                      <span>Geen directe MORA-relaties gevonden voor dit component.</span>
                    </div>
                  )}
                </div>

                <div className="match-review-actions">
                  <button className="btn btn-primary" disabled={busy} onClick={() => upsertMatch(row, "confirmed")}><CheckCircle2 size={16} /> Bevestigen</button>
                  <button className="btn" disabled={busy} onClick={() => upsertMatch(row, "rejected")}><XCircle size={16} /> Afwijzen</button>
                  <button className="btn" disabled={busy} onClick={() => upsertMatch(row, "technical")}><ShieldCheck size={16} /> Technisch component</button>
                  <button className="btn" disabled={busy} onClick={() => upsertMatch(row, "excluded")}>Uitsluiten</button>
                  <div className="match-review-manual">
                    <select value={selectedManualApp(row)} onChange={(e) => setManualTarget((prev) => ({ ...prev, [row.mora_component_id]: e.target.value }))}>
                      {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
                    </select>
                    <button className="btn" disabled={busy || !selectedManualApp(row)} onClick={() => upsertMatch(row, "manual", selectedManualApp(row))}>Handmatig koppelen</button>
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
