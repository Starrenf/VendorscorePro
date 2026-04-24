import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import { saveWithToast } from "../lib/saveWithToast";
import { DEMO_SUPPLIERS, governanceToLight } from "../lib/governanceCockpit";
import { isDemoMode } from "../lib/demoMode";
import { supplierDomainLabel } from "../lib/supplierDomains";

export default function Suppliers() {
  const toast = useToast();
  const nav = useNavigate();
  const { session, organization, loading: appLoading, profile } = useApp();
  const client = supabase();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");

      if (appLoading) return;

      if (!session) {
        nav("/login", { replace: true });
        return;
      }

      const orgId = organization?.id || profile?.organization_id;
      if (!orgId) {
        nav("/onboarding", { replace: true });
        return;
      }

      if (!client) {
        if (!cancelled) {
          setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
          setUsingDemo(isDemoMode());
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await client
        .from("suppliers")
        .select(
          "id,name,is_active,created_at,classification,supplier_type,category,status",
        )
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        toast.error(error?.message || "Onbekende fout");
        setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
        setUsingDemo(isDemoMode());
        setLoading(false);
        return;
      }

      const list = data || [];

      if (!list.length) {
        setRows(isDemoMode() ? DEMO_SUPPLIERS : []);
        setUsingDemo(isDemoMode());
        setLoading(false);
        return;
      }

      const cleaned = list.map((row) => ({
        ...row,
        classification: row.classification || row.supplier_type || "Onbekend",
        category: row.category || "generiek",
        governancePercent: 0,
        notesCount: 0,
      }));

      if (!cancelled) {
        setRows(cleaned);
        setUsingDemo(false);
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    session,
    organization?.id,
    profile?.organization_id,
    client,
    nav,
    toast,
    appLoading,
  ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.name || "").toLowerCase().includes(s));
  }, [rows, q]);

  async function addSupplier(e) {
    e.preventDefault();
    setErr("");

    const n = name.trim();
    const orgId = organization?.id || profile?.organization_id;
    if (!n || usingDemo || !orgId || !client) return;

    const exists = rows.some(
      (r) => (r.name || "").trim().toLowerCase() === n.toLowerCase(),
    );
    if (exists) {
      setErr("Deze leverancier bestaat al binnen deze organisatie.");
      return;
    }

    let data;
    try {
      const result = await saveWithToast(
        client
          .from("suppliers")
          .insert({
            organization_id: orgId,
            name: n,
            is_active: true,
            category: "generiek",
            status: "active",
          })
          .select(
            "id,name,is_active,created_at,classification,supplier_type,category,status",
          )
          .single(),
        toast,
        {
          loading: "Leverancier toevoegen...",
          success: "Leverancier toegevoegd.",
          error: "Toevoegen mislukt.",
        },
      );
      data = result?.data;
    } catch (e) {
      setErr(e?.message || "Opslaan mislukt.");
      return;
    }

    if (!data) {
      setErr("Opslaan mislukt.");
      return;
    }

    setRows((prev) =>
      [...prev, { ...data, governancePercent: 0, notesCount: 0 }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setName("");
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Leveranciers</h1>
            <p className="text-sm text-slate-600 mt-1">
              Visueel overzicht met strategie en basisinformatie.
            </p>
          </div>
          {!usingDemo ? (
            <Link className="btn btn-primary" to="/evaluations/new">
              Nieuwe beoordeling
            </Link>
          ) : null}
        </div>

        {usingDemo ? (
          <Notice title="Demo leveranciers">
            Er zijn nog geen eigen leveranciers gevonden. Daarom tonen we
            voorbeeldleveranciers voor de demo.
          </Notice>
        ) : null}

        {err ? (
          <Notice title="Fout" tone="danger">
            {err}
          </Notice>
        ) : null}

        <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <label htmlFor="supplier-search">Zoeken</label>
            <input
              id="supplier-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full"
              placeholder="Typ om te filteren…"
            />
          </div>

          {!usingDemo ? (
            <form className="space-y-2" onSubmit={addSupplier}>
              <label htmlFor="new-supplier-name">Nieuwe leverancier</label>
              <div className="flex gap-2">
                <input
                  id="new-supplier-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                  placeholder="Naam leverancier"
                />
                <button className="btn btn-primary" type="submit">
                  Toevoegen
                </button>
              </div>
            </form>
          ) : (
            <div />
          )}
        </div>

        <div className="mt-5 grid gap-3">
          {loading ? (
            <div className="text-sm text-slate-600">Laden…</div>
          ) : null}

          {!loading && !filtered.length && !usingDemo ? (
            <div className="text-sm text-slate-500">
              Geen leveranciers gevonden.
            </div>
          ) : null}

          {filtered.map((s) => {
            const light = governanceToLight(s.governancePercent || 0);
            return (
              <div
                key={s.id}
                className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TrafficLight value={light} />
                    <div className="font-semibold truncate">{s.name}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="badge">
                      {s.classification || "Onbekend"}
                    </span>
                    <span className="badge">
                      Domein {supplierDomainLabel(s.category)}
                    </span>
                    <span className="badge">
                      Governance {s.governancePercent ?? 0}%
                    </span>
                    <span className="badge">
                      Opmerkingen {s.notesCount ?? 0}
                    </span>
                  </div>
                </div>
                {!usingDemo ? (
                  <Link className="btn" to={`/suppliers/${s.id}`}>
                    Details
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400">demo</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
