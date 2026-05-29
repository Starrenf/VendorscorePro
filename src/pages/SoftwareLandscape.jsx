import { useEffect, useMemo, useState } from "react";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import { saveWithToast } from "../lib/saveWithToast";

const OVERHEAD_WORDS = [
  "driver",
  "plugin",
  "plug-in",
  "runtime",
  "browser",
  "utility",
  "tool",
  "viewer",
  "add-in",
  "addin",
  "extension",
  "connector",
  "agent",
  "client",
  "firmware",
  "codec",
];

const CATEGORY_OPTIONS = [
  "Onderwijsapplicatie",
  "Studentadministratie",
  "Bedrijfsvoering",
  "Finance",
  "HRM",
  "ICT-beheer",
  "Security & Privacy",
  "Samenwerking & Communicatie",
  "Rapportage & BI",
  "Integratie / Middleware",
  "Technische component",
  "Overhead / ruis",
  "Onbekend",
];

function text(v) {
  return String(v || "").trim();
}

function inferOverhead(row) {
  const haystack = [
    row.application_name,
    row.application_type,
    row.description,
    row.main_functions,
    row.suggested_category,
  ].map((v) => String(v || "").toLowerCase()).join(" ");
  return OVERHEAD_WORDS.some((word) => haystack.includes(word));
}

function inferCategory(row) {
  const haystack = [row.application_name, row.application_type, row.description, row.main_functions].map((v) => String(v || "").toLowerCase()).join(" ");
  if (inferOverhead(row)) return "Overhead / ruis";
  if (haystack.includes("student") || haystack.includes("duo") || haystack.includes("inschrijving") || haystack.includes("eduarte")) return "Studentadministratie";
  if (haystack.includes("canvas") || haystack.includes("learning") || haystack.includes("lms") || haystack.includes("onderwijs") || haystack.includes("didact")) return "Onderwijsapplicatie";
  if (haystack.includes("finance") || haystack.includes("financi") || haystack.includes("factuur")) return "Finance";
  if (haystack.includes("hr") || haystack.includes("personeel") || haystack.includes("afas")) return "HRM";
  if (haystack.includes("security") || haystack.includes("privacy") || haystack.includes("auth") || haystack.includes("mfa")) return "Security & Privacy";
  if (haystack.includes("power bi") || haystack.includes("rapport") || haystack.includes("dashboard") || haystack.includes("qlik")) return "Rapportage & BI";
  if (haystack.includes("koppeling") || haystack.includes("integratie") || haystack.includes("api")) return "Integratie / Middleware";
  return row.application_type || "Onbekend";
}

function toLandscapeItem(row, orgId) {
  const category = row.suggested_category || inferCategory(row);
  const overhead = typeof row.is_overhead === "boolean" ? row.is_overhead : inferOverhead({ ...row, suggested_category: category });
  return {
    organization_id: orgId,
    application_name: text(row.application_name),
    supplier_name: text(row.suggested_supplier_name || row.supplier_name),
    domain: category,
    owner_name: text(row.owner_name),
    functional_admin: text(row.key_user || row.functional_admin),
    is_critical: false,
    status: overhead ? "overhead" : "actief",
    source_name: row.source_file || "Applicatie Portfolio.csv",
    application_type: text(row.application_type),
    description: text(row.description),
    manual_url: text(row.manual_url),
    didactic_component: text(row.didactic_component),
    main_functions: text(row.main_functions),
    licenses: text(row.licenses),
    key_user: text(row.key_user),
    is_overhead: overhead,
    enrichment_status: "verwerkt",
    raw_payload: row,
    updated_at: new Date().toISOString(),
  };
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function SoftwareLandscape() {
  const client = supabase();
  const toast = useToast();
  const { organization, profile } = useApp();
  const orgId = organization?.id || profile?.organization_id;

  const [items, setItems] = useState([]);
  const [stagingRows, setStagingRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [moraComponents, setMoraComponents] = useState([]);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ application_name: "", application_type: "", description: "", supplier_name: "", domain: "Onbekend", functional_admin: "", is_critical: false, is_overhead: false, mora_component_id: "", architecture_relation_note: "" });
  const [q, setQ] = useState("");
  const [showOverhead, setShowOverhead] = useState(false);
  const [tab, setTab] = useState("landschap");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});

  async function load() {
    if (!client || !orgId) return;
    setLoading(true);
    setError("");

    const [itemsResult, importResult, supplierResult, moraResult] = await Promise.all([
      client.from("software_landscape_items").select("*").eq("organization_id", orgId).order("application_name", { ascending: true }),
      client.from("software_landscape_import").select("*").eq("organization_id", orgId).order("application_name", { ascending: true }),
      client.from("suppliers").select("id,name,category,classification,status").eq("organization_id", orgId).order("name", { ascending: true }),
      client.from("mora_application_components").select("id,mora_element_id,name,mora_type,specialization").eq("organization_id", orgId).order("name", { ascending: true }),
    ]);

    if (itemsResult.error) setError(itemsResult.error.message);
    setItems(itemsResult.data || []);

    if (!importResult.error) setStagingRows(importResult.data || []);
    if (!supplierResult.error) setSuppliers(supplierResult.data || []);
    if (!moraResult.error) setMoraComponents(moraResult.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [orgId]);

  const supplierNames = useMemo(() => suppliers.map((s) => s.name).filter(Boolean), [suppliers]);
  const moraOptions = useMemo(() => moraComponents.map((m) => ({ ...m, label: `${m.name}${m.mora_type ? ` · ${m.mora_type}` : ""}` })), [moraComponents]);

  function selectedMoraName(id) {
    return moraComponents.find((m) => m.id === id || m.mora_element_id === id)?.name || "";
  }

  function updateStagingLocal(id, patch) {
    setStagingRows((prev) => prev.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  async function saveStaging(row) {
    if (!client || !row?.id) return;
    const payload = {
      suggested_category: row.suggested_category || inferCategory(row),
      suggested_supplier_name: row.suggested_supplier_name || null,
      is_overhead: !!row.is_overhead,
      import_status: row.import_status || "reviewed",
      updated_at: new Date().toISOString(),
    };
    await saveWithToast(client.from("software_landscape_import").update(payload).eq("id", row.id), toast, {
      loading: "Verrijking opslaan...",
      success: "Verrijking opgeslagen.",
      error: "Verrijking opslaan mislukt.",
    });
    setMessage("Importregel verrijkt.");
    await load();
  }

  async function processStaging() {
    if (!client || !orgId || stagingRows.length === 0) return;
    const payload = stagingRows
      .filter((row) => text(row.application_name))
      .map((row) => toLandscapeItem(row, orgId));

    await saveWithToast(
      client.from("software_landscape_items").upsert(payload, { onConflict: "organization_id,application_name" }),
      toast,
      { loading: "Softwarelandschap verwerken...", success: "Softwarelandschap verwerkt.", error: "Verwerken mislukt." },
    );

    await client.from("software_landscape_import").update({ import_status: "processed", updated_at: new Date().toISOString() }).eq("organization_id", orgId);
    setMessage(`${payload.length} applicaties verwerkt naar het softwarelandschap.`);
    await load();
    setTab("landschap");
  }

  async function saveItem(row) {
    if (!client || !row?.id) return;
    const payload = {
      supplier_name: row.supplier_name || null,
      domain: row.domain || null,
      owner_name: row.owner_name || null,
      functional_admin: row.functional_admin || null,
      is_critical: !!row.is_critical,
      is_overhead: !!row.is_overhead,
      status: row.is_overhead ? "overhead" : (row.status || "actief"),
      enrichment_status: "reviewed",
      mora_component_id: row.mora_component_id || null,
      mora_component_name: row.mora_component_name || selectedMoraName(row.mora_component_id) || null,
      architecture_source: row.architecture_source || (row.mora_component_id ? "MORA / Frank v.G." : null),
      architecture_relation_status: row.mora_component_id ? (row.architecture_relation_status || "gekoppeld") : (row.architecture_relation_status || null),
      architecture_relation_note: row.architecture_relation_note || null,
      updated_at: new Date().toISOString(),
    };
    await saveWithToast(client.from("software_landscape_items").update(payload).eq("id", row.id), toast, {
      loading: "Applicatie verrijken...",
      success: "Applicatie verrijkt.",
      error: "Verrijken mislukt.",
    });
    setMessage("Softwarelandschap bijgewerkt.");
    await load();
  }



  async function addItem() {
    if (!client || !orgId || !text(newItem.application_name)) {
      setError("Vul minimaal een applicatienaam in.");
      return;
    }
    const payload = {
      organization_id: orgId,
      application_name: text(newItem.application_name),
      application_type: text(newItem.application_type),
      description: text(newItem.description),
      supplier_name: text(newItem.supplier_name),
      domain: text(newItem.domain) || "Onbekend",
      functional_admin: text(newItem.functional_admin),
      is_critical: !!newItem.is_critical,
      is_overhead: !!newItem.is_overhead,
      status: newItem.is_overhead ? "overhead" : "actief",
      source_name: "Handmatig VendorScorePro",
      mora_component_id: newItem.mora_component_id || null,
      mora_component_name: selectedMoraName(newItem.mora_component_id) || null,
      architecture_source: newItem.mora_component_id ? "MORA / Frank v.G." : null,
      architecture_relation_status: newItem.mora_component_id ? "gekoppeld" : null,
      architecture_relation_note: text(newItem.architecture_relation_note),
      enrichment_status: "handmatig",
      updated_at: new Date().toISOString(),
    };
    await saveWithToast(client.from("software_landscape_items").insert(payload), toast, {
      loading: "Applicatie toevoegen...",
      success: "Applicatie toegevoegd.",
      error: "Applicatie toevoegen mislukt.",
    });
    setNewItem({ application_name: "", application_type: "", description: "", supplier_name: "", domain: "Onbekend", functional_admin: "", is_critical: false, is_overhead: false, mora_component_id: "", architecture_relation_note: "" });
    setNewItemOpen(false);
    await load();
  }

  async function deleteItem(row) {
    if (!client || !row?.id) return;
    const ok = window.confirm(`Applicatie verwijderen uit softwarelandschap: ${row.application_name}?`);
    if (!ok) return;
    await saveWithToast(client.from("software_landscape_items").delete().eq("id", row.id), toast, {
      loading: "Applicatie verwijderen...",
      success: "Applicatie verwijderd.",
      error: "Applicatie verwijderen mislukt.",
    });
    await load();
  }

  async function createApplication(row) {
    if (!client || !orgId || !row?.supplier_name) {
      setError("Kies eerst een leverancier voor deze applicatie.");
      return;
    }
    const supplier = suppliers.find((s) => s.name === row.supplier_name);
    if (!supplier?.id) {
      setError("Leverancier is nog niet gevonden in VendorScorePro. Maak of koppel de leverancier eerst.");
      return;
    }
    const payload = {
      organization_id: orgId,
      supplier_id: supplier.id,
      name: row.application_name,
      description: row.description || row.main_functions || null,
      is_active: row.status !== "inactief" && !row.is_overhead,
      is_critical: !!row.is_critical,
      functional_owner: row.functional_admin || row.owner_name || null,
      updated_at: new Date().toISOString(),
    };
    await saveWithToast(client.from("applications").insert(payload), toast, {
      loading: "Applicatie koppelen aan leverancier...",
      success: "Applicatie gekoppeld.",
      error: "Applicatie koppelen mislukt.",
    });
    setMessage(`${row.application_name} is gekoppeld aan ${row.supplier_name}.`);
  }

  const visibleItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((row) => {
      if (!showOverhead && row.is_overhead) return false;
      if (!needle) return true;
      return [row.application_name, row.supplier_name, row.domain, row.description, row.functional_admin, row.key_user, row.mora_component_name, row.architecture_source, row.architecture_relation_note]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [items, q, showOverhead]);

  const stats = useMemo(() => {
    const total = items.length;
    const overhead = items.filter((r) => r.is_overhead).length;
    const critical = items.filter((r) => r.is_critical).length;
    const linked = items.filter((r) => r.supplier_name).length;
    const architectureLinked = items.filter((r) => r.mora_component_id || r.mora_component_name).length;
    return { total, overhead, critical, linked, architectureLinked };
  }, [items]);

  function exportCsv() {
    const headers = ["Applicatie", "Leverancier", "Domein", "Functioneel beheer", "Kritisch", "Overhead", "Status"];
    const lines = [headers.join(";")].concat(visibleItems.map((row) => [
      row.application_name,
      row.supplier_name,
      row.domain,
      row.functional_admin,
      row.is_critical ? "Ja" : "Nee",
      row.is_overhead ? "Ja" : "Nee",
      row.status,
    ].map(csvEscape).join(";")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendorscorepro-softwarelandschap.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-[#0f5a95] to-[#0b315d] p-8 text-white shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/80">Softwarelandschap</div>
        <h1 className="mt-3 text-3xl font-extrabold">Applicaties verrijken, koppelen en overhead filteren</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-cyan-50/90">
          Gebruik het Gilde applicatielandschap als referentiebron. Verrijk applicaties met leverancier, domein, functioneel beheer, kroonjuweelstatus en overheadfiltering zonder brondocumenten buiten Teams/SharePoint op te slaan.
        </p>
      </section>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="Status" tone="success">{message}</Notice> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Applicaties</div><div className="mt-1 text-3xl font-bold">{stats.total}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Leverancier gekoppeld</div><div className="mt-1 text-3xl font-bold">{stats.linked}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">MORA/architectuur gekoppeld</div><div className="mt-1 text-3xl font-bold">{stats.architectureLinked}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Kroonjuweel</div><div className="mt-1 text-3xl font-bold">{stats.critical}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Overhead gefilterd</div><div className="mt-1 text-3xl font-bold">{stats.overhead}</div></div>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button className={`btn ${tab === "landschap" ? "btn-primary" : ""}`} onClick={() => setTab("landschap")}>Softwarelandschap</button>
          <button className={`btn ${tab === "import" ? "btn-primary" : ""}`} onClick={() => setTab("import")}>Import verrijken ({stagingRows.length})</button>
          <button className="btn btn-primary" onClick={() => setNewItemOpen((v) => !v)}>+ Nieuwe applicatie</button>
          <button className="btn" onClick={load}>Vernieuwen</button>
          <button className="btn" onClick={exportCsv}>CSV export</button>
        </div>
      </section>


      <datalist id="supplier-names">{supplierNames.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id="mora-components">{moraOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</datalist>

      {newItemOpen ? (
        <section className="card p-5 space-y-4 border-2 border-blue-100">
          <div>
            <h2 className="text-lg font-semibold">Nieuwe applicatie toevoegen</h2>
            <p className="text-sm text-slate-600 mt-1">Voeg handmatig een applicatie toe aan het Gilde softwarelandschap en koppel deze direct aan leverancier en MORA/Frank v.G.-architectuurcomponent.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">Applicatienaam<input value={newItem.application_name} onChange={(e) => setNewItem({ ...newItem, application_name: e.target.value })} placeholder="Bijv. Eduarte" /></label>
            <label className="text-sm font-medium">Type<input value={newItem.application_type} onChange={(e) => setNewItem({ ...newItem, application_type: e.target.value })} placeholder="Bijv. Onderwijsapplicatie" /></label>
            <label className="text-sm font-medium">Leverancier<input list="supplier-names" value={newItem.supplier_name} onChange={(e) => setNewItem({ ...newItem, supplier_name: e.target.value })} placeholder="Kies/typ leverancier" /></label>
            <label className="text-sm font-medium">Domein<select value={newItem.domain} onChange={(e) => setNewItem({ ...newItem, domain: e.target.value })}>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="text-sm font-medium">Functioneel beheer<input value={newItem.functional_admin} onChange={(e) => setNewItem({ ...newItem, functional_admin: e.target.value })} placeholder="Naam/beheerteam" /></label>
            <label className="text-sm font-medium">MORA / Frank v.G.-component<select value={newItem.mora_component_id} onChange={(e) => setNewItem({ ...newItem, mora_component_id: e.target.value })}><option value="">Niet gekoppeld</option>{moraOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          </div>
          <label className="text-sm font-medium block">Omschrijving<textarea rows="3" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Korte omschrijving / functies" /></label>
          <label className="text-sm font-medium block">Relatienotitie<textarea rows="2" value={newItem.architecture_relation_note} onChange={(e) => setNewItem({ ...newItem, architecture_relation_note: e.target.value })} placeholder="Waarom hoort deze bij dit architectuurcomponent?" /></label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={newItem.is_critical} onChange={(e) => setNewItem({ ...newItem, is_critical: e.target.checked })} /> Kroonjuweel</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={newItem.is_overhead} onChange={(e) => setNewItem({ ...newItem, is_overhead: e.target.checked })} /> Overhead / ruis</label>
          </div>
          <div className="flex gap-2"><button className="btn btn-primary" onClick={addItem}>Opslaan</button><button className="btn" onClick={() => setNewItemOpen(false)}>Annuleren</button></div>
        </section>
      ) : null}

      {tab === "import" ? (
        <section className="card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Importregels verrijken</h2>
              <p className="text-sm text-slate-600 mt-1">Controleer categorie, leverancier en overhead voordat je de regels verwerkt naar het softwarelandschap.</p>
            </div>
            <button className="btn btn-primary" onClick={processStaging} disabled={!stagingRows.length}>Alle importregels verwerken</button>
          </div>
          {loading ? <div className="text-sm text-slate-600">Laden…</div> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-4">Applicatie</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Categorie</th><th className="py-2 pr-4">Leverancier</th><th className="py-2 pr-4">Overhead</th><th className="py-2 pr-4">Actie</th></tr></thead>
              <tbody>
                {stagingRows.map((row) => {
                  const category = row.suggested_category || inferCategory(row);
                  const overhead = row.is_overhead ?? inferOverhead({ ...row, suggested_category: category });
                  return (
                    <tr key={row.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-4 min-w-[220px]"><div className="font-semibold">{row.application_name}</div><div className="text-xs text-slate-500 line-clamp-2">{row.description}</div></td>
                      <td className="py-2 pr-4">{row.application_type || "-"}</td>
                      <td className="py-2 pr-4 min-w-[190px]"><select className="w-full" value={category} onChange={(e) => updateStagingLocal(row.id, { suggested_category: e.target.value })}>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                      <td className="py-2 pr-4 min-w-[210px]"><input list="supplier-names" value={row.suggested_supplier_name || ""} onChange={(e) => updateStagingLocal(row.id, { suggested_supplier_name: e.target.value })} placeholder="Kies/typ leverancier" /></td>
                      <td className="py-2 pr-4"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!overhead} onChange={(e) => updateStagingLocal(row.id, { is_overhead: e.target.checked })} /> Ja</label></td>
                      <td className="py-2 pr-4"><button className="btn" onClick={() => saveStaging({ ...row, suggested_category: category, is_overhead: overhead })}>Opslaan</button></td>
                    </tr>
                  );
                })}
                {!stagingRows.length ? <tr><td className="py-4 text-slate-500" colSpan="6">Geen importregels gevonden. Voer eerst het SQL-importscript uit.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Geregistreerd landschap</h2>
              <p className="text-sm text-slate-600 mt-1">Verrijk applicaties en koppel ze desgewenst aan leveranciers in VendorScorePro.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={showOverhead} onChange={(e) => setShowOverhead(e.target.checked)} /> Toon overhead</label>
              <input className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek applicatie, leverancier, domein…" />
            </div>
          </div>
          {loading ? <div className="mt-4 text-sm text-slate-600">Laden…</div> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-4">Applicatie</th><th className="py-2 pr-4">Leverancier</th><th className="py-2 pr-4">Domein</th><th className="py-2 pr-4">Functioneel beheer</th><th className="py-2 pr-4">MORA/Frank v.G.</th><th className="py-2 pr-4">Kroonjuweel</th><th className="py-2 pr-4">Overhead</th><th className="py-2 pr-4">Acties</th></tr></thead>
              <tbody>
                {visibleItems.map((row) => {
                  const edit = selected[row.id] || row;
                  const open = !!selected[row.id];
                  return (
                    <tr key={row.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-4 min-w-[230px]"><div className="font-semibold">{row.application_name}</div><div className="text-xs text-slate-500 line-clamp-2">{row.description || row.main_functions}</div></td>
                      <td className="py-2 pr-4 min-w-[210px]">{open ? <input list="supplier-names" value={edit.supplier_name || ""} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, supplier_name: e.target.value } }))} /> : (row.supplier_name || "-")}</td>
                      <td className="py-2 pr-4 min-w-[190px]">{open ? <select value={edit.domain || ""} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, domain: e.target.value } }))}>{CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select> : (row.domain || "-")}</td>
                      <td className="py-2 pr-4 min-w-[170px]">{open ? <input value={edit.functional_admin || ""} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, functional_admin: e.target.value } }))} /> : (row.functional_admin || row.key_user || "-")}</td>
                      <td className="py-2 pr-4 min-w-[240px]">{open ? <div className="space-y-2"><select value={edit.mora_component_id || ""} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, mora_component_id: e.target.value, mora_component_name: selectedMoraName(e.target.value) } }))}><option value="">Niet gekoppeld</option>{moraOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select><input value={edit.architecture_relation_note || ""} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, architecture_relation_note: e.target.value } }))} placeholder="Relatienotitie" /></div> : (row.mora_component_name || row.architecture_source || "-")}</td>
                      <td className="py-2 pr-4">{open ? <input type="checkbox" checked={!!edit.is_critical} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, is_critical: e.target.checked } }))} /> : (row.is_critical ? "Ja" : "Nee")}</td>
                      <td className="py-2 pr-4">{open ? <input type="checkbox" checked={!!edit.is_overhead} onChange={(e) => setSelected((p) => ({ ...p, [row.id]: { ...edit, is_overhead: e.target.checked } }))} /> : (row.is_overhead ? "Ja" : "Nee")}</td>
                      <td className="py-2 pr-4 min-w-[250px]"><div className="flex flex-wrap gap-2">{open ? <><button className="btn btn-primary" onClick={() => saveItem(edit)}>Opslaan</button><button className="btn" onClick={() => setSelected((p) => { const n = { ...p }; delete n[row.id]; return n; })}>Annuleren</button></> : <button className="btn" onClick={() => setSelected((p) => ({ ...p, [row.id]: row }))}>Verrijken</button>}<button className="btn" onClick={() => createApplication(row)}>Koppel aan leverancier</button><button className="btn" onClick={() => deleteItem(row)}>Verwijderen</button></div></td>
                    </tr>
                  );
                })}
                {!visibleItems.length ? <tr><td className="py-4 text-slate-500" colSpan="8">Nog geen applicaties gevonden.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
