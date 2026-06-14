import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, GitBranch, Network, Search, Workflow } from "lucide-react";
import Notice from "../../components/Notice";
import { supabase } from "../../lib/supabase";
import { useApp } from "../../state/AppState";
import "./architecture.css";

const ORG_FALLBACK = "7ec54263-6b9b-4cb2-9b97-526d8909550d";

const RELATION_LABELS = {
  CompositionRelationship: {
    label: "Bestaat uit",
    explanation: "De bron is opgebouwd uit, of maakt onderdeel uit van, het doel.",
  },
  SpecializationRelationship: {
    label: "Specialisatie van",
    explanation: "De bron is een specifieke variant of specialisatie van het doel.",
  },
  ServingRelationship: {
    label: "Levert dienst aan",
    explanation: "De bron ondersteunt of levert functionaliteit aan het doel.",
  },
  TriggeringRelationship: {
    label: "Triggert",
    explanation: "De bron start of activeert het doelproces of component.",
  },
  RealizationRelationship: {
    label: "Realiseert",
    explanation: "De bron realiseert of implementeert het doel.",
  },
  AssociationRelationship: {
    label: "Gerelateerd aan",
    explanation: "Er bestaat een algemene relatie tussen bron en doel.",
  },
  AccessRelationship: {
    label: "Heeft toegang tot",
    explanation: "De bron gebruikt, leest of schrijft informatie van het doel.",
  },
  FlowRelationship: {
    label: "Gegevensstroom",
    explanation: "Er stroomt informatie, data of een object van bron naar doel.",
  },
  AggregationRelationship: {
    label: "Onderdeel van",
    explanation: "De bron is onderdeel van een groter geheel, zonder sterke afhankelijkheid.",
  },
  InfluenceRelationship: {
    label: "Beïnvloedt",
    explanation: "De bron heeft invloed op het doel.",
  },
  AssignmentRelationship: {
    label: "Toegewezen aan",
    explanation: "De bron is toegewezen aan of verantwoordelijk voor het doel.",
  },
};

function relationInfo(type) {
  return RELATION_LABELS[type] || {
    label: type || "Onbekende relatie",
    explanation: "Technisch relatietype uit de MORA/ArchiMate-export.",
  };
}

function relationTone(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("serving")) return "blue";
  if (t.includes("flow") || t.includes("trigger")) return "amber";
  if (t.includes("access")) return "violet";
  if (t.includes("composition") || t.includes("aggregation")) return "green";
  return "slate";
}

async function fetchRelations(client, orgId, selectedType, query) {
  const q = query.trim();
  let request = client
    .from("v_architecture_relations_resolved")
    .select("*")
    .eq("organization_id", orgId)
    .order("source_name", { ascending: true })
    .limit(500);

  if (selectedType) request = request.eq("relation_type", selectedType);

  if (q) {
    const safe = q.replaceAll("%", "").replaceAll(",", " ");
    request = request.or(`source_name.ilike.%${safe}%,target_name.ilike.%${safe}%,relation_type.ilike.%${safe}%,source_type.ilike.%${safe}%,target_type.ilike.%${safe}%`);
  }

  const result = await request;
  if (!result.error) return result;

  // Fallback voor databases waar alleen architecture_relations beschikbaar is.
  let fallback = client
    .from("architecture_relations")
    .select("*")
    .eq("organization_id", orgId)
    .order("source_name", { ascending: true })
    .limit(500);

  if (selectedType) fallback = fallback.eq("relation_type", selectedType);
  if (q) {
    const safe = q.replaceAll("%", "").replaceAll(",", " ");
    fallback = fallback.or(`source_name.ilike.%${safe}%,target_name.ilike.%${safe}%,relation_type.ilike.%${safe}%,source_type.ilike.%${safe}%,target_type.ilike.%${safe}%`);
  }

  return fallback;
}

export default function ArchitectureRelations() {
  const nav = useNavigate();
  const client = supabase();
  const { session, organization } = useApp();
  const orgId = organization?.id || ORG_FALLBACK;
  const [loading, setLoading] = useState(true);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [error, setError] = useState("");
  const [relations, setRelations] = useState([]);
  const [summary, setSummary] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError("");
      if (!session) { nav("/login"); return; }
      if (!client) { nav("/settings"); return; }
      try {
        const sumResult = await client
          .from("v_architecture_relation_type_summary")
          .select("*")
          .eq("organization_id", orgId)
          .order("relation_count", { ascending: false });

        if (sumResult.error) throw sumResult.error;
        const rows = sumResult.data || [];
        setSummary(rows);
        setSelectedType(rows[0]?.relation_type || "");
      } catch (err) {
        setError(err?.message || "Relatiedata laden mislukt. Draai eerst de v0.9.30 MORA Deep Import SQL.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [client, session, orgId, nav]);

  useEffect(() => {
    async function loadDetails() {
      if (!client || !session || !selectedType) return;
      setRelationsLoading(true);
      setError("");
      try {
        const result = await fetchRelations(client, orgId, selectedType, query);
        if (result.error) throw result.error;
        setRelations(result.data || []);
      } catch (err) {
        setError(err?.message || "Onderliggende relaties laden mislukt.");
        setRelations([]);
      } finally {
        setRelationsLoading(false);
      }
    }

    const timer = setTimeout(loadDetails, 250);
    return () => clearTimeout(timer);
  }, [client, session, orgId, selectedType, query]);

  const selectedSummary = useMemo(() => summary.find((row) => row.relation_type === selectedType), [summary, selectedType]);
  const selectedInfo = relationInfo(selectedType);

  return (
    <div className="space-y-6">
      <div className="arch-hero">
        <div className="arch-hero-brand">
          <div className="arch-mora-logo-wrap">
            <img src="/architecture/mora-logo.png" onError={(e) => { e.currentTarget.src = "/architecture/mora-logo-placeholder.svg"; }} alt="MORA" className="arch-mora-logo" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">MORA relaties en afhankelijkheden</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">Architectuurrelaties</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/78">Bekijk welke componenten met elkaar verbonden zijn. Hiermee wordt ketenimpact en afhankelijkheid zichtbaar.</p>
          </div>
        </div>
        <Link to="/architecture" className="btn bg-white text-[#0c4f9f] hover:bg-white/90"><ArrowLeft className="mr-2 h-4 w-4" />Cockpit</Link>
      </div>

      {error ? <Notice title="Relatiedata niet beschikbaar" tone="danger">{error}</Notice> : null}
      {loading ? <Notice title="Relaties laden">De MORA-relaties worden opgehaald…</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((row) => {
          const info = relationInfo(row.relation_type);
          return (
            <button key={row.relation_type} type="button" onClick={() => setSelectedType(row.relation_type)} className={`arch-domain-card arch-domain-${relationTone(row.relation_type)} ${selectedType === row.relation_type ? "arch-domain-active" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Relatietype</div>
                  <div className="mt-1 text-lg font-black">{info.label}</div>
                  <div className="mt-1 text-[11px] font-semibold opacity-60">{row.relation_type}</div>
                </div>
                <div className="arch-domain-count">{row.relation_count}</div>
              </div>
              <div className="mt-3 text-xs opacity-75">{info.explanation}</div>
            </button>
          );
        })}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Network className="mt-1 h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedInfo.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedInfo.explanation}</p>
              <p className="mt-1 text-xs text-slate-500">Technisch type: <span className="font-semibold">{selectedType || "Alle relaties"}</span></p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="min-w-[280px] pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek bron, doel of type…" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="badge"><GitBranch className="mr-1 h-3.5 w-3.5" />{relations.length} geladen relaties</span>
          <span className="badge"><Workflow className="mr-1 h-3.5 w-3.5" />{selectedSummary?.relation_count || 0} totaal in dit type</span>
          <span className="badge">{summary.length} relatietypes</span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-3 pr-4 font-semibold">Bron</th>
                <th className="py-3 pr-4 font-semibold">Betekenis</th>
                <th className="py-3 pr-4 font-semibold">Doel</th>
                <th className="py-3 pr-4 font-semibold">Bron type</th>
                <th className="py-3 pr-4 font-semibold">Doel type</th>
              </tr>
            </thead>
            <tbody>
              {relationsLoading ? (
                <tr><td colSpan="5" className="py-6 text-slate-500">Relaties laden…</td></tr>
              ) : relations.length === 0 ? (
                <tr><td colSpan="5" className="py-6 text-slate-500">Geen relaties gevonden voor dit type of deze zoekopdracht.</td></tr>
              ) : relations.map((row) => {
                const info = relationInfo(row.relation_type);
                return (
                  <tr key={row.id || `${row.source_mora_element_id}-${row.target_mora_element_id}-${row.relation_type}`} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{row.source_name || row.source_mora_element_id || "—"}</div>
                      <div className="mt-1 max-w-[260px] truncate text-xs text-slate-400">{row.source_mora_element_id}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`arch-domain-badge arch-domain-${relationTone(row.relation_type)}`}>{info.label}</span>
                      <div className="mt-1 text-xs text-slate-500">{row.relation_type}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{row.target_name || row.target_mora_element_id || "—"}</div>
                      <div className="mt-1 max-w-[260px] truncate text-xs text-slate-400">{row.target_mora_element_id}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{row.source_type || "—"}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.target_type || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
