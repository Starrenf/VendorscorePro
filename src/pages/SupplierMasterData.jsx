import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";

function normalizeCandidateName(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|software|solutions|group|holding)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function displaySupplierName(supplier) {
  return supplier?.display_name || supplier?.visible_name || supplier?.name || "Naam onbekend";
}

export default function SupplierMasterData() {
  const nav = useNavigate();
  const toast = useToast();
  const { session, organization, loading: appLoading, profile } = useApp();
  const client = supabase();

  const [suppliers, setSuppliers] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [duplicateId, setDuplicateId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [aliasText, setAliasText] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const orgId = organization?.id || profile?.organization_id;

  async function load() {
    setErr("");
    if (appLoading) return;
    if (!session) {
      nav("/login", { replace: true });
      return;
    }
    if (!orgId) {
      nav("/onboarding", { replace: true });
      return;
    }
    if (!client) return;

    setLoading(true);

    const { data, error } = await client
      .from("active_suppliers_view")
      .select("id,organization_id,name,display_name,visible_name,legal_name,normalized_name,is_active,created_at,updated_at,domain,category,supplier_type,status")
      .eq("organization_id", orgId)
      .order("visible_name", { ascending: true });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const { data: aliasRows, error: aliasError } = await client
      .from("supplier_aliases")
      .select("id,supplier_id,alias,normalized_alias,created_at")
      .eq("organization_id", orgId)
      .order("alias", { ascending: true });

    if (aliasError) {
      setErr(aliasError.message);
      setLoading(false);
      return;
    }

    setSuppliers(data || []);
    setAliases(aliasRows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, orgId, appLoading]);

  const selected = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedId) || null,
    [suppliers, selectedId],
  );

  const duplicate = useMemo(
    () => suppliers.find((supplier) => supplier.id === duplicateId) || null,
    [suppliers, duplicateId],
  );

  const aliasesBySupplier = useMemo(() => {
    const result = {};
    aliases.forEach((alias) => {
      result[alias.supplier_id] = result[alias.supplier_id] || [];
      result[alias.supplier_id].push(alias);
    });
    return result;
  }, [aliases]);

  const candidateGroups = useMemo(() => {
    const buckets = {};
    suppliers.forEach((supplier) => {
      const key = normalizeCandidateName(
        [supplier.display_name, supplier.legal_name, supplier.name].filter(Boolean).join(" "),
      );
      if (!key) return;
      buckets[key] = buckets[key] || [];
      buckets[key].push(supplier);
    });
    return Object.entries(buckets)
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key, "nl"));
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const search = q.trim().toLowerCase();
    if (!search) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.display_name, supplier.visible_name, supplier.legal_name, supplier.domain, supplier.supplier_type]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [q, suppliers]);

  function chooseSupplier(supplier) {
    setSelectedId(supplier.id);
    setDisplayName(supplier.display_name || supplier.visible_name || supplier.name || "");
    setLegalName(supplier.legal_name || "");
    setAliasText("");
  }

  async function saveNames(e) {
    e.preventDefault();
    if (!selected || !client) return;
    setSaving(true);
    setErr("");

    const { error } = await client
      .from("suppliers")
      .update({
        display_name: displayName.trim() || selected.name,
        legal_name: legalName.trim() || null,
      })
      .eq("id", selected.id)
      .eq("organization_id", orgId);

    setSaving(false);
    if (error) {
      setErr(error.message);
      toast.error("Naamkeuze opslaan mislukt.");
      return;
    }
    toast.success("Naamkeuze opgeslagen.");
    await load();
  }

  async function addAlias(e) {
    e.preventDefault();
    if (!selected || !aliasText.trim() || !client) return;
    setSaving(true);
    setErr("");

    const { error } = await client
      .from("supplier_aliases")
      .upsert(
        [{ organization_id: orgId, supplier_id: selected.id, alias: aliasText.trim() }],
        { onConflict: "organization_id,normalized_alias", ignoreDuplicates: true },
      );

    setSaving(false);
    if (error) {
      setErr(error.message);
      toast.error("Alias toevoegen mislukt.");
      return;
    }
    setAliasText("");
    toast.success("Alias toegevoegd.");
    await load();
  }

  async function mergeDuplicate() {
    if (!selected || !duplicate || selected.id === duplicate.id || !client) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je '${duplicate.name}' wilt samenvoegen naar '${displaySupplierName(selected)}'?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setErr("");

    const { data, error } = await client.rpc("merge_suppliers", {
      p_organization_id: orgId,
      p_duplicate_supplier_id: duplicate.id,
      p_master_supplier_id: selected.id,
      p_reason: "Samengevoegd via leveranciers masterdata beheer",
    });

    setSaving(false);
    if (error) {
      setErr(error.message);
      toast.error("Samenvoegen mislukt.");
      return;
    }

    setDuplicateId("");
    toast.success(`Leverancier veilig samengevoegd${data?.updated_references ? `; ${data.updated_references} verwijzingen bijgewerkt` : ""}.`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Leveranciers masterdata</h1>
            <p className="mt-1 text-sm text-slate-600">
              Bepaal welke leveranciersnaam zichtbaar is, leg juridische namen en aliassen vast en voeg dubbele leveranciers veilig samen.
            </p>
          </div>
          <Link className="btn" to="/suppliers">Terug naar overzicht</Link>
        </div>

        {err ? <Notice title="Fout" tone="danger">{err}</Notice> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Actieve leveranciers</h2>
                <p className="text-sm text-slate-500">Bron: active_suppliers_view. Alleen deze leveranciers mogen in overzichten verschijnen.</p>
              </div>
              <input className="min-w-[240px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek leverancier…" />
            </div>

            <div className="mt-4 max-h-[620px] space-y-2 overflow-auto pr-1">
              {loading ? <div className="text-sm text-slate-500">Laden…</div> : null}
              {!loading && filteredSuppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  type="button"
                  onClick={() => chooseSupplier(supplier)}
                  className={"w-full rounded-2xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 " + (selectedId === supplier.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{displaySupplierName(supplier)}</div>
                    <span className="badge">{supplier.supplier_type || "Leverancier"}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Bronnaam: {supplier.name || "-"}{supplier.legal_name ? ` · Juridisch: ${supplier.legal_name}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Naamkeuze</h2>
              {!selected ? (
                <p className="mt-2 text-sm text-slate-500">Selecteer links een leverancier.</p>
              ) : (
                <form className="mt-4 space-y-3" onSubmit={saveNames}>
                  <div>
                    <label htmlFor="display-name">Getoonde naam</label>
                    <input id="display-name" className="mt-1 w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    <p className="mt-1 text-xs text-slate-500">Deze naam wordt zichtbaar in Governix-overzichten.</p>
                  </div>
                  <div>
                    <label htmlFor="legal-name">Juridische naam</label>
                    <input id="legal-name" className="mt-1 w-full" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Bijv. AFAS Software B.V." />
                  </div>
                  <button className="btn btn-primary" disabled={saving} type="submit">Naamkeuze opslaan</button>
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Aliassen</h2>
              {!selected ? null : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {(aliasesBySupplier[selected.id] || []).length ? (
                      aliasesBySupplier[selected.id].map((alias) => <span key={alias.id} className="badge">{alias.alias}</span>)
                    ) : (
                      <span className="text-slate-500">Nog geen aliassen vastgelegd.</span>
                    )}
                  </div>
                  <form className="mt-3 flex gap-2" onSubmit={addAlias}>
                    <input className="w-full" value={aliasText} onChange={(e) => setAliasText(e.target.value)} placeholder="Nieuwe alias" />
                    <button className="btn" disabled={saving} type="submit">Toevoegen</button>
                  </form>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Samenvoegen</h2>
              <p className="mt-1 text-sm text-slate-500">Kies eerst de masterleverancier. Kies daarna de dubbele leverancier die moet verdwijnen uit het overzicht.</p>
              {selected ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    Master: <strong>{displaySupplierName(selected)}</strong>
                  </div>
                  <select className="w-full" value={duplicateId} onChange={(e) => setDuplicateId(e.target.value)}>
                    <option value="">Kies dubbele leverancier…</option>
                    {suppliers.filter((supplier) => supplier.id !== selected.id).map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{displaySupplierName(supplier)} — bron: {supplier.name}</option>
                    ))}
                  </select>
                  {duplicate ? (
                    <Notice title="Preview samenvoeging">
                      {duplicate.name} wordt inactief gemaakt en verwijst daarna naar {displaySupplierName(selected)}. De databasefunctie zet alle bekende supplier_id-verwijzingen om naar de master.
                    </Notice>
                  ) : null}
                  <button className="btn btn-primary" disabled={saving || !duplicateId} type="button" onClick={mergeDuplicate}>Veilig samenvoegen</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Mogelijke dubbelen</h2>
        <p className="mt-1 text-sm text-slate-500">Deze suggesties zijn indicatief. Jij bepaalt welke naam de master wordt.</p>
        <div className="mt-4 grid gap-3">
          {candidateGroups.length ? candidateGroups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Suggestiegroep: {group.key}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.items.map((supplier) => (
                  <button key={supplier.id} type="button" className="badge bg-white" onClick={() => chooseSupplier(supplier)}>{displaySupplierName(supplier)}</button>
                ))}
              </div>
            </div>
          )) : <div className="text-sm text-slate-500">Geen automatische suggesties gevonden.</div>}
        </div>
      </div>
    </div>
  );
}
