import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { mapWeightsForStrategy, ratingToFactor, totalScoreToStars } from "../lib/scoring";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";

const RATINGS = ["Uitstekend", "Goed", "Redelijk", "Matig", "Slecht"];

const RATING_HELP = {
  Uitstekend: "Structureel boven verwachting; aantoonbaar en proactief.",
  Goed: "Voldoet goed; enkele kleine verbeterpunten mogelijk.",
  Redelijk: "Voldoende basis, maar meerdere aandachtspunten.",
  Matig: "Onder verwachting; verbetering en opvolging nodig.",
  Slecht: "Onvoldoende; direct actie of escalatie nodig.",
};

const BLOCK_TITLES = {
  K1: "K1 - Dienstverlening & kwaliteit",
  K2: "K2 - Samenwerking & communicatie",
  K3: "K3 - Continuïteit & betrouwbaarheid",
  K4: "K4 - Governance, risico & compliance",
  K5: "K5 - Innovatie & doorontwikkeling",
};

function normalizeScoreRow(row) {
  if (!row) return row;
  const criteriaId = row.criteria_id ?? row.criteriaId ?? null;
  const rating = row.rating ?? row.score_label ?? "";
  const factor = row.factor ?? row.score_factor ?? null;
  return {
    ...row,
    criteria_id: criteriaId,
    rating,
    factor,
    score_label: (row.score_label ?? rating) || null,
    score_factor: row.score_factor ?? factor,
  };
}

function buildScorePayload({ evaluationId, organizationId, criteriaId, row, defaultPoints }) {
  const rating = row.rating || row.score_label || "";
  const points = Number(row.points ?? defaultPoints ?? 10);
  const factor = ratingToFactor(rating);
  const score = points * factor;
  return {
    evaluation_id: evaluationId,
    organization_id: organizationId,
    criteria_id: criteriaId,
    rating,
    score_label: rating,
    points,
    max_points: Number(defaultPoints ?? 10),
    factor,
    score_factor: factor,
    score,
    source: row.source || null,
    motivation: row.motivation || null,
  };
}

function ratingTone(rating) {
  switch (rating) {
    case "Uitstekend": return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "Goed": return "border-sky-300 bg-sky-50 text-sky-900";
    case "Redelijk": return "border-amber-300 bg-amber-50 text-amber-900";
    case "Matig": return "border-orange-300 bg-orange-50 text-orange-900";
    case "Slecht": return "border-rose-300 bg-rose-50 text-rose-900";
    default: return "border-slate-200 bg-white text-slate-700";
  }
}

function ScorePreview({ rating, points }) {
  const factor = rating ? ratingToFactor(rating) : 0;
  const score = rating ? Number(points ?? 10) * factor : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Automatische score</div>
      <div className="mt-1 flex items-end gap-2">
        <div className="text-2xl font-black text-slate-900">{rating ? score.toFixed(score % 1 ? 1 : 0) : "—"}</div>
        <div className="pb-1 text-slate-500">/ {Number(points ?? 10)}</div>
      </div>
      <div className="mt-1 text-xs text-slate-600">Factor: {rating ? factor : "—"}</div>
    </div>
  );
}

export default function EvaluationDetail() {
  const toast = useToast();
  const { id } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const { session, organization } = useApp();
  const client = supabase();

  const [evaluation, setEvaluation] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState({});
  const [weights, setWeights] = useState([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [criteriaLoaded, setCriteriaLoaded] = useState(false);

  useEffect(() => {
    async function run() {
      setErr("");
      if (!session) { nav("/login"); return; }
      if (!organization) { nav("/onboarding"); return; }
      if (!client) { nav("/settings"); return; }

      let { data: ev, error: evErr } = await client
        .from("evaluations")
        .select("id,title,strategy,created_at,supplier_id,organization_id,year")
        .eq("id", id)
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (!ev && !evErr && location.state?.createdKey) {
        const key = location.state.createdKey;
        const fallback = await client
          .from("evaluations")
          .select("id,title,strategy,created_at,supplier_id,organization_id,year")
          .eq("organization_id", organization.id)
          .eq("supplier_id", key.supplier_id)
          .eq("year", key.year)
          .eq("title", key.title)
          .maybeSingle();

        ev = fallback.data || null;
        evErr = fallback.error || null;

        if (ev?.id && ev.id !== id) {
          nav(`/evaluations/${ev.id}`, { replace: true, state: { createdKey: key } });
          return;
        }
      }

      if (evErr || !ev) {
        setErr(evErr?.message || "Beoordeling niet gevonden");
        return;
      }

      let supplier = null;
      if (ev.supplier_id) {
        const { data: supplierRow } = await client
          .from("suppliers")
          .select("id,name,organization_id")
          .eq("id", ev.supplier_id)
          .eq("organization_id", organization.id)
          .maybeSingle();
        supplier = supplierRow || null;
      }

      setEvaluation({ ...ev, supplier });

      const { data: c, error: cErr } = await client
        .from("criteria")
        .select("id,section,label,description,points_max,organization_id,sort_order")
        .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });

      if (cErr) { setErr(cErr.message); return; }
      setCriteria(c || []);
      setCriteriaLoaded(true);

      const { data: s, error: sErr } = await client
        .from("evaluation_scores")
        .select("*")
        .eq("evaluation_id", id)
        .eq("organization_id", organization.id);

      if (sErr) { setErr(sErr.message); return; }
      const map = {};
      for (const raw of (s || [])) {
        const row = normalizeScoreRow(raw);
        if (row?.criteria_id) map[row.criteria_id] = row;
      }
      setScores(map);

      const { data: w, error: wErr } = await client
        .from("weight_configs")
        .select("organization_id,strategy,k_block,section,weight")
        .eq("organization_id", organization.id)
        .eq("strategy", ev.strategy);

      if (wErr) { setErr(wErr.message); return; }
      setWeights((w || []).map(row => ({ ...row, k_block: row.k_block || row.section })));
    }
    run();
  }, [id, session, organization, client, nav, location.state]);

  const weightByBlock = useMemo(() => mapWeightsForStrategy(weights, evaluation?.strategy), [weights, evaluation?.strategy]);

  const sections = useMemo(() => {
    const by = {};
    for (const c of criteria) {
      const sec = c.section || "K1";
      by[sec] = by[sec] || [];
      by[sec].push(c);
    }
    return by;
  }, [criteria]);

  useEffect(() => {
    const keys = Object.keys(sections);
    if (!keys.length) return;
    setExpanded(prev => (Object.keys(prev).length ? prev : Object.fromEntries(keys.map(k => [k, true]))));
  }, [sections]);

  const totals = useMemo(() => {
    const blocks = Object.keys(sections).sort();
    const rawWeights = blocks.map(b => weightByBlock[b] ?? 0);
    const totalRaw = rawWeights.reduce((a, n) => a + n, 0) || 1;
    const norm = Object.fromEntries(blocks.map((b, i) => [b, rawWeights[i] / totalRaw]));

    let total = 0;
    const blockScores = {};
    for (const b of blocks) {
      const cs = sections[b];
      let sum = 0, max = 0;
      for (const c of cs) {
        const row = scores[c.id];
        const rating = row?.rating || row?.score_label || "";
        const points = Number(row?.points ?? c.points_max ?? 10);
        const score = rating ? points * ratingToFactor(rating) : 0;
        sum += Number(row?.score ?? score) || 0;
        max += Number(c.points_max) || 0;
      }
      const M = max ? (sum / max) * 10 : 0;
      const O = M * (norm[b] || 0) * 10;
      total += O;
      blockScores[b] = { average: Math.round(M * 10) / 10, weighted: Math.round(O * 10) / 10 };
    }
    const stars = totalScoreToStars(total);
    return { total: Math.round(total * 10) / 10, stars, norm, blockScores };
  }, [sections, scores, weightByBlock]);

  function updateLocal(criteriaId, patch) {
    setScores(prev => ({ ...prev, [criteriaId]: { ...(prev[criteriaId] || {}), ...patch } }));
  }

  async function saveCriteria(criteriaId) {
    setErr("");
    if (!client) return;

    const c = criteria.find(x => x.id === criteriaId);
    const row = scores[criteriaId] || {};
    if (!row.rating) {
      setErr("Kies eerst een beoordeling voordat je dit criterium opslaat.");
      return;
    }

    setSaving(true);
    const payload = buildScorePayload({
      evaluationId: id,
      organizationId: organization.id,
      criteriaId,
      row,
      defaultPoints: c?.points_max ?? 10,
    });

    const { data, error } = await client
      .from("evaluation_scores")
      .upsert(payload, { onConflict: "evaluation_id,criteria_id" })
      .select("*")
      .single();

    if (error || !data) {
      setErr(error?.message || "Opslaan mislukt: geen data teruggekregen.");
    } else {
      setScores(prev => ({ ...prev, [criteriaId]: normalizeScoreRow(data) }));
      toast?.success?.("Criterium opgeslagen");
    }

    setSaving(false);
  }

  async function saveAll() {
    setErr("");
    if (!client) return;
    setSavingAll(true);

    try {
      const payloads = [];
      for (const c of criteria) {
        const row = scores[c.id] || {};
        const rating = row.rating || "";
        if (!rating) continue;
        payloads.push(buildScorePayload({
          evaluationId: id,
          organizationId: organization.id,
          criteriaId: c.id,
          row,
          defaultPoints: c.points_max ?? 10,
        }));
      }

      if (!payloads.length) {
        setErr("Kies minimaal één beoordeling voordat je opslaat.");
        return;
      }

      const { data, error } = await client
        .from("evaluation_scores")
        .upsert(payloads, { onConflict: "evaluation_id,criteria_id" })
        .select("*");

      if (error) throw error;
      const map = {};
      for (const raw of (data || [])) {
        const row = normalizeScoreRow(raw);
        if (row?.criteria_id) map[row.criteria_id] = row;
      }
      setScores(prev => ({ ...prev, ...map }));
      toast?.success?.("Beoordeling opgeslagen");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSavingAll(false);
    }
  }

  const progress = useMemo(() => {
    const total = criteria.length || 0;
    const filled = criteria.filter(c => (scores[c.id]?.rating)).length;
    const pct = total ? Math.round((filled / total) * 100) : 0;
    return { total, filled, pct };
  }, [criteria, scores]);

  if (!evaluation) {
    if (err) return <Notice title="Fout" tone="danger">{err}</Notice>;
    return <Notice title="Laden…">Even geduld.</Notice>;
  }

  return (
    <div className="space-y-4 pb-28">
      {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

      <div className="card overflow-hidden">
        <div className="p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#003A8F]">Leveranciersbeoordeling</div>
              <h1 className="page-title mt-2">{evaluation.title || "Beoordeling"}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="badge">Strategie: {evaluation.strategy}</span>
                <span className="badge">Leverancier: {evaluation.supplier?.name}</span>
                <span className="badge">Jaar: {evaluation.year ?? "n.v.t."}</span>
                <span className="badge">Voortgang: {progress.filled}/{progress.total}</span>
              </div>
            </div>
            <button className="btn" onClick={() => nav(-1)}>← Terug</button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-700">Stap 1</div>
              <div className="mt-1 font-bold text-slate-900">Kies per criterium één beoordeling</div>
              <p className="mt-1 text-sm text-slate-600">Gebruik Uitstekend, Goed, Redelijk, Matig of Slecht. De score wordt automatisch berekend.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Stap 2</div>
              <div className="mt-1 font-bold text-slate-900">Leg kort vast waarop je oordeel is gebaseerd</div>
              <p className="mt-1 text-sm text-slate-600">Vul bron en motivatie in als onderbouwing voor audit, overleg of opvolging.</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">Stap 3</div>
              <div className="mt-1 font-bold text-slate-900">Sla tussentijds of alles tegelijk op</div>
              <p className="mt-1 text-sm text-slate-600">De totaalscore, sterwaardering en gewogen blokscore volgen automatisch.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 lg:px-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Totaalscore</div>
              <div className="mt-1 text-3xl font-black text-slate-900">{totals.total}<span className="text-base font-bold text-slate-500"> / 100</span></div>
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Waardering</div>
              <div className="mt-1 text-3xl font-black text-[#003A8F]">{totals.stars}★</div>
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Ingevuld</div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#003A8F]" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className="mt-1 text-sm text-slate-600">{progress.pct}% compleet</div>
            </div>
          </div>
        </div>
      </div>

      {criteriaLoaded && !criteria.length ? (
        <Notice title="Geen criteria gevonden" tone="warning">
          Voor deze organisatie zijn nog geen beoordelingscriteria geladen. Voer eerst het meegeleverde SQL-seedscript uit in Supabase zodat K1 t/m K5 zichtbaar worden.
        </Notice>
      ) : null}

      <div className="grid gap-4">
        {Object.keys(sections).sort().map((sec) => {
          const filledInBlock = sections[sec].filter(x => scores[x.id]?.rating).length;
          return (
            <div key={sec} className="section-card">
              <button type="button" className="section-head w-full text-left" onClick={() => setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }))}>
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <h2 className="section-title">{BLOCK_TITLES[sec] || sec}</h2>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="badge">{(totals.norm[sec] * 100).toFixed(0)}% weging</span>
                      <span className="badge">{sections[sec].length} criteria</span>
                      <span className="badge">Blokscore: {totals.blockScores[sec]?.average ?? 0}/10</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="badge">{filledInBlock}/{sections[sec].length} ingevuld</span>
                  <span className="ml-1 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={"transition " + (expanded[sec] ? "rotate-180" : "")}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </button>

              {expanded[sec] ? (
                <div className="px-5 pb-5 grid gap-4">
                  {sections[sec].map((c) => {
                    const row = scores[c.id] || {};
                    const points = Number(row.points ?? c.points_max ?? 10);
                    return (
                      <div key={c.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Beoordelingscriterium</div>
                            <h3 className="mt-1 text-lg font-black text-slate-900">{c.label}</h3>
                            <p className="mt-1 max-w-3xl text-sm text-slate-600">
                              {c.description || "Beoordeel dit criterium op basis van de beschikbare dienstverlening, afspraken, rapportages, ervaringen en gesprekken met de leverancier."}
                            </p>
                          </div>
                          <ScorePreview rating={row.rating} points={points} />
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <div className="text-sm font-bold text-slate-900">Kies één beoordeling</div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                            {RATINGS.map((rating) => {
                              const active = row.rating === rating;
                              return (
                                <button
                                  type="button"
                                  key={rating}
                                  onClick={() => updateLocal(c.id, { rating })}
                                  className={`rounded-2xl border px-3 py-3 text-left transition ${active ? ratingTone(rating) + " ring-2 ring-[#003A8F]/20" : "border-slate-200 bg-white hover:border-[#003A8F]/40"}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-extrabold">{rating}</span>
                                    <span className="text-xs font-bold">× {ratingToFactor(rating)}</span>
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-slate-600">{RATING_HELP[rating]}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                          <summary className="cursor-pointer text-sm font-bold text-slate-900">Geavanceerd: punten aanpassen</summary>
                          <div className="mt-3 max-w-xs space-y-1">
                            <label>Maximale punten voor dit criterium</label>
                            <input className="w-full" type="number" step="1" min="0" value={row.points ?? c.points_max ?? 10} onChange={(e) => updateLocal(c.id, { points: e.target.value })} />
                            <p className="text-xs text-slate-500">Laat meestal op 10 staan. Alleen aanpassen als het beoordelingsmodel bewust afwijkt.</p>
                          </div>
                        </details>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="space-y-1">
                            <label>Bron of bewijsstuk</label>
                            <input className="w-full" value={row.source || ""} onChange={(e) => updateLocal(c.id, { source: e.target.value })} placeholder="Bijv. SLA-rapportage, ticketnummer, overleg, audit, leveranciersgesprek" />
                          </div>
                          <div className="space-y-1">
                            <label>Motivatie / toelichting</label>
                            <input className="w-full" value={row.motivation || ""} onChange={(e) => updateLocal(c.id, { motivation: e.target.value })} placeholder="Waarom kies je deze beoordeling?" />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                          <div className="text-sm text-slate-600">
                            {row.rating ? <>Gekozen: <b>{row.rating}</b> · Score wordt automatisch berekend.</> : "Nog niet beoordeeld."}
                          </div>
                          <button className="btn btn-primary" disabled={saving || !row.rating} onClick={() => saveCriteria(c.id)}>
                            {saving ? "Opslaan…" : "Criterium opslaan"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sticky-bar">
        <div className="sticky-bar-inner">
          <div className="sticky-bar-card">
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">
                Totaal: <span className="text-[#003A8F]">{totals.total}</span> / 100 · {totals.stars}★
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Voortgang: {progress.filled}/{progress.total} criteria ({progress.pct}%)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" disabled={savingAll} onClick={saveAll}>
                {savingAll ? "Opslaan…" : "Alles opslaan"}
              </button>
              <button className="btn" onClick={() => nav(-1)}>Terug</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
