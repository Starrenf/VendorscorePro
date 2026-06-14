import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Notice from "../components/Notice";
import CrownJewelsTiles from "../components/CrownJewelsTiles";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { getRuntimeConfig } from "../lib/runtimeConfig";
import { useApp } from "../state/AppState";
import { DEMO_SUPPLIERS, governanceToLight, summarizeCockpit } from "../lib/governanceCockpit";
import { isDemoMode } from "../lib/demoMode";

export default function Home() {
  const { session, organization, profile, loading: appLoading } = useApp();
  const cfg = getRuntimeConfig();
  const client = supabase();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);
  const [tiles, setTiles] = useState([]);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [tilesError, setTilesError] = useState("");

  const orgId = organization?.id || profile?.organization_id || null;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setErr("");
      if (appLoading) return;
      if (!session || !orgId || !client) {
        if (isDemoMode()) {
          setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
          setUsingDemo(isDemoMode());
        } else {
          setRows([]);
          setUsingDemo(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await client
          .from("supplier_overview_view")
          .select("id,name,classification,supplier_type,governance_score,checked_items,total_items,notes_count")
          .eq("organization_id", orgId)
          .order("name", { ascending: true });
        if (error) throw error;

        const list = data || [];
        if (!list.length) {
          if (!cancelled) {
            setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
            setUsingDemo(isDemoMode());
          }
          return;
        }

        const entries = list.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          classification: supplier.classification || supplier.supplier_type || "Onbekend",
          contractStatus: "Actief",
          governancePercent: Number(supplier.governance_score || 0),
          notesCount: Number(supplier.notes_count || 0),
          checksDone: Number(supplier.checked_items || 0),
          checksTotal: Number(supplier.total_items || 0),
        }));

        if (!cancelled) {
          setRows(entries);
          setUsingDemo(false);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Dashboard kon niet worden geladen");
          setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
          setUsingDemo(isDemoMode());
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


  useEffect(() => {
    let cancelled = false;
    async function loadTiles() {
      setTilesError("");
      if (appLoading || !session || !orgId || !client) {
        setTiles([]);
        return;
      }
      setTilesLoading(true);
      try {
        const { data, error } = await client
          .from("dashboard_tiles")
          .select("id,title,description,logo_url,target_url,is_kroonjuweel,is_active,sort_order,governance_score,risk_level")
          .eq("organization_id", orgId)
          .eq("is_kroonjuweel", true)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true });

        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (error.code === "42P01" || error.code === "PGRST205" || msg.includes("does not exist") || msg.includes("could not find the table")) {
            if (!cancelled) {
              setTiles([]);
              setTilesError("De tabel dashboard_tiles is nog niet aangemaakt. Voer de SQL-migratie van v0.9.68 uit.");
            }
            return;
          }
          throw error;
        }

        if (!cancelled) setTiles(data || []);
      } catch (e) {
        if (!cancelled) {
          setTiles([]);
          setTilesError(e?.message || "Kroonjuwelen-tegels konden niet worden geladen.");
        }
      } finally {
        if (!cancelled) setTilesLoading(false);
      }
    }
    loadTiles();
    return () => { cancelled = true; };
  }, [session, orgId, client, appLoading]);

  const stats = useMemo(() => summarizeCockpit(rows), [rows]);
  const topRows = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/10 p-6 md:p-8 backdrop-blur-sm text-white shadow-2xl">
        <div className="text-sm uppercase tracking-[0.2em] text-white/70">Governance cockpit</div>
        <h1 className="mt-3 text-3xl md:text-5xl font-bold">Leverancierssturing in één oogopslag</h1>
        <p className="mt-4 max-w-3xl text-white/85 leading-7">
          VendorScore Pro brengt governance, leveranciersstrategie en opvolging samen in een visueel dashboard dat in dertig seconden te begrijpen is.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/95 text-slate-900 p-5 shadow-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">Leveranciers</div>
            <div className="mt-2 text-4xl font-bold">{stats.suppliers}</div>
          </div>
          <div className="rounded-2xl bg-white/95 text-slate-900 p-5 shadow-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">Governance compleet</div>
            <div className="mt-2 text-4xl font-bold">{stats.governanceComplete}%</div>
          </div>
          <div className="rounded-2xl bg-white/95 text-slate-900 p-5 shadow-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">Open acties</div>
            <div className="mt-2 text-4xl font-bold">{stats.openActions}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!session ? <Link className="btn btn-primary" to="/login">Inloggen</Link> : null}
          <Link className="btn" to="/dashboard">Dashboard</Link>
          <Link className="btn" to="/suppliers">Leveranciers</Link>
          <Link className="btn" to="/status">Statuspagina</Link>
          <Link className="btn" to="/methodiek">Governance</Link>
          <Link className="btn" to="/kroonjuwelen">Kroonjuwelen</Link>
        </div>
      </div>

      <CrownJewelsTiles tiles={tiles} loading={tilesLoading} error={tilesError} />

      {usingDemo ? (
        <Notice title="Voorbeelddata actief">
          Er zijn nog geen leveranciers gevonden voor deze organisatie. De cockpit toont tijdelijke voorbeelddata.
        </Notice>
      ) : null}

      {err ? <Notice title="Dashboard" tone="danger">{err}</Notice> : null}

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Leveranciersoverzicht met traffic lights</h2>
            <p className="text-sm text-slate-600 mt-1">Snel inzicht in strategie, governance-volwassenheid en prioriteit.</p>
          </div>
          <div className="text-sm text-slate-500">Config bron: <span className="badge">{cfg.source}</span></div>
        </div>

        {loading ? <div className="mt-4 text-sm text-slate-600">Laden…</div> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-3 pr-4">Leverancier</th>
                <th className="text-left py-3 pr-4">Strategie</th>
                <th className="text-left py-3 pr-4">Governance</th>
                <th className="text-left py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((row) => {
                const light = governanceToLight(row.governancePercent);
                const content = (
                  <>
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 pr-4">{row.classification}</td>
                    <td className="py-3 pr-4">{row.governancePercent}%</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2"><TrafficLight value={light} /><span>{row.governancePercent > 75 ? "Groen" : row.governancePercent >= 50 ? "Oranje" : "Rood"}</span></div>
                    </td>
                  </>
                );

                return usingDemo ? (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition">{content}</tr>
                ) : (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer" onClick={() => (window.location.href = `/suppliers/${row.id}`)}>{content}</tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
