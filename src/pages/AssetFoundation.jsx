import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";

export default function AssetFoundation() {
  const { session, organization, profile, loading: appLoading } = useApp();
  const nav = useNavigate();
  const client = supabase();
  const orgId = organization?.id || profile?.organization_id;
  const [buildings, setBuildings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [workPackages, setWorkPackages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("alle");

  async function load() {
    if (appLoading) return;
    if (!session) { nav("/login", { replace: true }); return; }
    if (!orgId) { nav("/onboarding", { replace: true }); return; }
    if (!client) return;

    setLoading(true);
    setError("");
    const [bRes, aRes, wRes] = await Promise.all([
      client.from("buildings").select("*").eq("organization_id", orgId).order("name"),
      client.from("assets").select("*, buildings(name)").eq("organization_id", orgId).order("name"),
      client.from("supplier_work_packages").select("*").eq("organization_id", orgId),
    ]);

    const firstError = bRes.error || aRes.error || wRes.error;
    if (firstError) {
      setError(firstError.message);
      setBuildings([]); setAssets([]); setWorkPackages([]);
      setLoading(false);
      return;
    }
    setBuildings(bRes.data || []);
    setAssets(aRes.data || []);
    setWorkPackages(wRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [session, orgId, appLoading]);

  const filteredAssets = useMemo(() => assets.filter((a) => domain === "alle" || (a.asset_type || "Onbekend") === domain), [assets, domain]);
  const assetTypes = useMemo(() => ["alle", ...Array.from(new Set(assets.map((a) => a.asset_type || "Onbekend"))).sort()], [assets]);
  const highCritical = assets.filter((a) => (a.criticality || "").toLowerCase() === "hoog").length;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Gebouwen & Assets</h1>
            <p className="text-sm text-slate-600 mt-1">
              Eerste fundament voor vastgoed, installaties, onderhoud, garanties, MJOP en facilitaire contracten.
            </p>
          </div>
          <button className="btn" onClick={load}>Vernieuwen</button>
        </div>
        {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      </div>

      <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
        <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">Gebouwen</div><div className="text-2xl font-extrabold mt-1">{buildings.length}</div></div>
        <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">Assets/installaties</div><div className="text-2xl font-extrabold mt-1">{assets.length}</div></div>
        <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">Kritiek hoog</div><div className="text-2xl font-extrabold mt-1">{highCritical}</div></div>
        <div className="card p-4"><div className="text-xs uppercase font-semibold text-slate-500">Work packages</div><div className="text-2xl font-extrabold mt-1">{workPackages.length}</div></div>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Gebouwen</h2>
          {loading ? <div className="mt-3 text-sm text-slate-600">Laden…</div> : null}
          <div className="mt-3 space-y-2">
            {buildings.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3">
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-slate-600 mt-1">{b.address || "Adres onbekend"} · {b.city || ""}</div>
                <div className="text-xs text-slate-500 mt-1">{b.building_type || "Gebouw"} · {b.status || "Actief"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Assets & installaties</h2>
              <p className="text-sm text-slate-600 mt-1">Voor nu tonen we de eerste vastgelegde assets. CRUD volgt in een volgende build.</p>
            </div>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {assetTypes.map((x) => <option key={x} value={x}>{x === "alle" ? "Alle types" : x}</option>)}
            </select>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">Asset</th><th className="p-3 text-left">Gebouw</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Kritikaliteit</th></tr></thead>
              <tbody>
                {filteredAssets.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{a.name}</td><td className="p-3">{a.buildings?.name || "—"}</td><td className="p-3">{a.asset_type || "—"}</td><td className="p-3"><span className="badge">{a.criticality || "—"}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Volgende stap</h2>
        <p className="text-sm text-slate-600 mt-1">
          In de volgende build kunnen we bewerken/toevoegen activeren voor gebouwen, assets, garanties, onderhoudsplannen en MJOP. BINX en onderaannemers blijven gekoppeld vanuit het leveranciersdossier.
        </p>
        <div className="mt-3"><Link className="btn" to="/suppliers">Naar leveranciers</Link></div>
      </div>
    </div>
  );
}
