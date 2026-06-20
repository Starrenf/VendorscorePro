import { useEffect, useMemo, useState } from "react";
import Notice from "../Notice";
import { supabase } from "../../lib/supabase";

export default function SupplierWorkPackagesTab({ supplier, organization }) {
  const client = supabase();
  const [rows, setRows] = useState([]);
  const [supplierMap, setSupplierMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [domainFilter, setDomainFilter] = useState("alle");

  async function load() {
    if (!client || !supplier?.id || !organization?.id) return;
    setLoading(true);
    setError("");

    const { data, error } = await client
      .from("supplier_work_packages")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("main_supplier_id", supplier.id)
      .order("domain", { ascending: true })
      .order("category", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = data || [];
    setRows(list);

    const ids = Array.from(new Set(list.map((x) => x.subcontractor_supplier_id).filter(Boolean)));
    if (ids.length) {
      const { data: suppliers } = await client
        .from("suppliers")
        .select("id,name,supplier_type,domain,category,enrichment_status,kvk_number,city,website")
        .in("id", ids);
      const map = {};
      (suppliers || []).forEach((s) => { map[s.id] = s; });
      setSupplierMap(map);
    } else {
      setSupplierMap({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [client, supplier?.id, organization?.id]);

  const domains = useMemo(() => ["alle", ...Array.from(new Set(rows.map((r) => r.domain || "Onbekend"))).sort()], [rows]);
  const filtered = useMemo(() => rows.filter((r) => domainFilter === "alle" || (r.domain || "Onbekend") === domainFilter), [rows, domainFilter]);
  const splitCount = rows.filter((r) => r.split_candidate).length;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Onderaannemers & work packages</h2>
          <p className="text-sm text-slate-600 mt-1">
            Overzicht van onderaannemers, scopepakketten en mogelijke afsplitsingen onder deze hoofdaannemer.
          </p>
        </div>
        <button className="btn" type="button" onClick={load}>Vernieuwen</button>
      </div>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {loading ? <div className="text-sm text-slate-600">Work packages laden…</div> : null}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Onderaannemers</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-950">{rows.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Afsplitskandidaten</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-950">{splitCount}</div>
        </div>
        <div className="card p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase" htmlFor="wp-domain">Discipline</label>
          <select id="wp-domain" className="mt-2 w-full" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            {domains.map((d) => <option key={d} value={d}>{d === "alle" ? "Alle disciplines" : d}</option>)}
          </select>
        </div>
      </div>

      {!loading && !filtered.length ? (
        <Notice title="Geen work packages">
          Er zijn nog geen onderaannemers of work packages gekoppeld aan deze leverancier.
        </Notice>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Onderaannemer</th>
              <th className="text-left p-3">Discipline</th>
              <th className="text-left p-3">Categorie / scope</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Datakwaliteit</th>
              <th className="text-left p-3">Plaats</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const sub = supplierMap[row.subcontractor_supplier_id] || {};
              return (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold text-slate-900">{sub.name || "Onbekende onderaannemer"}</td>
                  <td className="p-3">{row.domain || sub.domain || "—"}</td>
                  <td className="p-3">
                    <div>{row.work_package_name || row.category || sub.category || "—"}</div>
                    {row.notes ? <div className="mt-1 text-xs text-slate-500">{row.notes}</div> : null}
                  </td>
                  <td className="p-3"><span className="badge">{row.status || "Te beoordelen"}</span></td>
                  <td className="p-3"><span className="badge">{sub.enrichment_status || "Onbekend"}</span></td>
                  <td className="p-3">{sub.city || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
