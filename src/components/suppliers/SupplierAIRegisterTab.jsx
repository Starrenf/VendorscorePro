import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../Notice";
import AIRiskBadge from "../ai/AIRiskBadge";
import { supabase } from "../../lib/supabase";
import { AI_RECOMMENDATIONS, buildAiWarnings } from "../../lib/aiRegister";

export default function SupplierAIRegisterTab({ supplier, organization }) {
  const client = supabase();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!client || !supplier?.id || !organization?.id) return;
      setLoading(true);
      setErr("");
      const { data, error } = await client
        .from("ai_register")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [client, supplier?.id, organization?.id]);

  const stats = useMemo(() => {
    const warnings = rows.reduce((n, row) => n + buildAiWarnings(row).length, 0);
    return {
      total: rows.length,
      high: rows.filter((r) => ["high", "unacceptable"].includes(r.ai_risk_classification)).length,
      openDpia: rows.filter((r) => r.dpia_required && !r.dpia_completed).length,
      warnings,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">AI-beoordeling & register</h2>
          <p className="mt-1 text-sm text-slate-600">
            Overzicht van AI-toepassingen voor deze leverancier, inclusief EU AI Act-risicoklasse en governance-alerts.
          </p>
        </div>
        <Link className="btn btn-primary" to="/ai-register">Open centraal AI-register</Link>
      </div>

      {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">AI-items</div><div className="mt-2 text-3xl font-bold">{stats.total}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">Hoog risico</div><div className="mt-2 text-3xl font-bold">{stats.high}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">DPIA open</div><div className="mt-2 text-3xl font-bold">{stats.openDpia}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-slate-500">Alerts</div><div className="mt-2 text-3xl font-bold">{stats.warnings}</div></div>
      </div>

      {loading ? <div className="text-sm text-slate-600">AI-register laden…</div> : null}
      {!loading && rows.length === 0 ? (
        <Notice title="Nog geen AI-items">
          Voor deze leverancier zijn nog geen AI-toepassingen vastgelegd. Gebruik het centrale AI-register om een item te koppelen.
        </Notice>
      ) : null}

      <div className="grid gap-3">
        {rows.map((row) => {
          const warnings = buildAiWarnings(row);
          return (
            <div key={row.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{row.name}</div>
                    <AIRiskBadge value={row.ai_risk_classification} />
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {row.ai_model_vendor || "Provider onbekend"} · {row.ai_model_name || "Model onbekend"}
                  </div>
                </div>
                <Link className="btn" to="/ai-register">Bewerken</Link>
              </div>
              {row.ai_use_case ? <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.ai_use_case}</div> : null}
              {warnings.length ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-semibold text-amber-900">Governance alerts</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <h3 className="font-semibold">Aanbevelingen voor AI-beoordeling</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {AI_RECOMMENDATIONS.slice(0, 4).map((r) => (
            <div key={r.title} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="font-semibold text-slate-900">{r.title}</div>
              <div className="mt-2 text-sm text-slate-700">{r.advice}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
