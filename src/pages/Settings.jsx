import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Notice from "../components/Notice";
import { clearRuntimeConfig, getRuntimeConfig, setRuntimeConfig } from "../lib/runtimeConfig";
import { useApp } from "../state/AppState";
import DemoModeToggle from "../components/DemoModeToggle";
import { useToast } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";

const LOOKUP_CATEGORIES = [
  { key: "application_type", label: "Domein / Type Applicatie", help: "Functionele indeling uit het applicatie- en licentieregister." },
  { key: "key_user", label: "KeyUsers", help: "Standaardwaarden voor KeyUser in het applicatieregister." },
  { key: "software_classification", label: "Softwareclassificatie", help: "Burcht, Stad, Land en Schiereiland." },
  { key: "installation_source", label: "Installatiebron", help: "Bron van installatie- of deploymenttelling." },
  { key: "license_model", label: "Licentiemodel", help: "Hoe de applicatie wordt gelicentieerd." },
  { key: "license_usage_source", label: "Bron gebruiksdata", help: "Waar de actuele gebruiksdata vandaan komt." },
  { key: "license_unit", label: "Licentie-eenheid", help: "Eenheid waarin aantallen worden bijgehouden." },
];

const DEFAULT_LOOKUPS = {
  application_type: ["ICT", "Kantoorapplicatie", "Onderwijs", "Huisvesting", "Bedrijfsondersteunend", "Koppelingen", "Landschap", "Overig"],
  key_user: ["Helpdesk", "Rick Gerards", "Kim Heyen", "Frank van Grinsven", "Keny Joosten", "Onbekend"],
  software_classification: ["Burcht", "Stad", "Land", "Schiereiland", "Nog niet geclassificeerd"],
  installation_source: ["Intune", "MECM", "Jamf", "Entra ID", "Leverancier", "Functioneel Beheer", "Handmatig", "Onbekend"],
  license_model: ["Per Gebruiker", "Per Student", "Per Medewerker", "Per Device", "Gelijktijdige Gebruikers", "Organisatiebreed", "Onbeperkt", "Geen Licentie", "Overig"],
  license_usage_source: ["DUO", "Intune", "Entra ID", "AFAS", "Eduarte", "Leverancier", "Functioneel Beheer", "Handmatig", "Anders"],
  license_unit: ["Gebruiker", "Student", "Medewerker", "Device", "FTE", "Credit", "Transactie", "Organisatie", "Installatie"],
};

function titleCaseValue(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const keep = new Set(["ID", "API", "DUO", "MECM", "SCCM", "FTE", "AFAS", "ICT", "AVG"]);
  return trimmed
    .split(" ")
    .map((part) => {
      const clean = part.trim();
      if (!clean) return clean;
      const upper = clean.toUpperCase();
      if (keep.has(upper)) return upper;
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    })
    .join(" ");
}

export default function Settings() {
  const toast = useToast();
  const client = supabase();
  const { hardResetClient, profile, organization } = useApp();
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const [url, setUrl] = useState(cfg.url);
  const [anonKey, setAnonKey] = useState(cfg.anonKey);
  const [activeCategory, setActiveCategory] = useState("software_classification");
  const [lookupRows, setLookupRows] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [newValue, setNewValue] = useState("");
  const [tileRows, setTileRows] = useState([]);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError, setTileError] = useState("");
  const [newTile, setNewTile] = useState({
    title: "",
    description: "",
    logo_url: "",
    target_url: "",
    sort_order: 99,
    is_kroonjuweel: true,
    is_active: true,
    tile_type: "application",
  });

  const isProd = import.meta.env.PROD;
  const isAdmin = profile?.role === "admin";
  const orgId = organization?.id || profile?.organization_id || null;

  function save() {
    setRuntimeConfig({ url: url.trim(), anonKey: anonKey.trim() });
    toast.success("Configuratie opgeslagen.");
    hardResetClient();
  }

  function clear() {
    clearRuntimeConfig();
    toast.info("Lokale configuratie gewist.");
    hardResetClient();
  }

  async function loadLookupValues() {
    if (!client) return;
    setLookupLoading(true);
    setLookupError("");
    const result = await client
      .from("lookup_values")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("value", { ascending: true });

    if (result.error) {
      setLookupRows([]);
      setLookupError(result.error.message);
    } else {
      setLookupRows(result.data || []);
    }
    setLookupLoading(false);
  }

  useEffect(() => {
    loadLookupValues();
    loadDashboardTiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function seedDefaults() {
    if (!client || !orgId) return;
    const rows = Object.entries(DEFAULT_LOOKUPS).flatMap(([category, values]) =>
      values.map((value, index) => ({
        organization_id: orgId,
        category,
        value,
        sort_order: index + 1,
        is_active: true,
      })),
    );
    const result = await client.from("lookup_values").upsert(rows, { onConflict: "organization_id,category,value" });
    if (result.error) {
      toast.error(`Standaardwaarden laden mislukt: ${result.error.message}`);
    } else {
      toast.success("Standaardwaardelijsten geladen.");
      await loadLookupValues();
    }
  }

  async function addLookupValue() {
    const value = titleCaseValue(newValue);
    if (!client || !orgId || !value) return;
    const result = await client.from("lookup_values").insert({
      organization_id: orgId,
      category: activeCategory,
      value,
      sort_order: activeRows.length + 1,
      is_active: true,
    });
    if (result.error) {
      toast.error(`Toevoegen mislukt: ${result.error.message}`);
    } else {
      toast.success("Waarde toegevoegd.");
      setNewValue("");
      await loadLookupValues();
    }
  }

  async function updateLookupValue(row, patch) {
    if (!client || !row?.id) return;
    const cleanPatch = { ...patch };
    if (typeof cleanPatch.value === "string") cleanPatch.value = titleCaseValue(cleanPatch.value);
    const result = await client.from("lookup_values").update(cleanPatch).eq("id", row.id);
    if (result.error) {
      toast.error(`Bijwerken mislukt: ${result.error.message}`);
    } else {
      await loadLookupValues();
    }
  }

  async function loadDashboardTiles() {
    if (!client || !orgId) return;
    setTileLoading(true);
    setTileError("");
    const result = await client
      .from("dashboard_tiles")
      .select("id,organization_id,title,description,logo_url,target_url,tile_type,is_kroonjuweel,is_active,sort_order,governance_score,risk_level")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (result.error) {
      setTileRows([]);
      setTileError(result.error.message);
    } else {
      setTileRows(result.data || []);
    }
    setTileLoading(false);
  }

  function updateTileDraft(id, patch) {
    setTileRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function saveDashboardTile(row) {
    if (!client || !row?.id) return;
    const payload = {
      title: String(row.title || "").trim(),
      description: row.description || null,
      logo_url: row.logo_url || null,
      target_url: row.target_url || null,
      tile_type: row.tile_type || "application",
      sort_order: Number(row.sort_order || 0),
      is_kroonjuweel: row.is_kroonjuweel !== false,
      is_active: row.is_active !== false,
      governance_score: row.governance_score === "" || row.governance_score === null || row.governance_score === undefined ? null : Number(row.governance_score),
      risk_level: row.risk_level || null,
      updated_at: new Date().toISOString(),
    };

    if (!payload.title) {
      toast.error("Titel is verplicht.");
      return;
    }

    const result = await client.from("dashboard_tiles").update(payload).eq("id", row.id);
    if (result.error) {
      toast.error(`Tegel opslaan mislukt: ${result.error.message}`);
    } else {
      toast.success("Kroonjuweel-tegel opgeslagen.");
      await loadDashboardTiles();
    }
  }

  async function addDashboardTile() {
    if (!client || !orgId) return;
    const title = String(newTile.title || "").trim();
    if (!title) {
      toast.error("Titel is verplicht.");
      return;
    }
    const payload = {
      organization_id: orgId,
      title,
      description: newTile.description || null,
      logo_url: newTile.logo_url || null,
      target_url: newTile.target_url || null,
      tile_type: newTile.tile_type || "application",
      sort_order: Number(newTile.sort_order || 99),
      is_kroonjuweel: newTile.is_kroonjuweel !== false,
      is_active: newTile.is_active !== false,
    };
    const result = await client.from("dashboard_tiles").insert(payload);
    if (result.error) {
      toast.error(`Tegel toevoegen mislukt: ${result.error.message}`);
    } else {
      toast.success("Kroonjuweel-tegel toegevoegd.");
      setNewTile({ title: "", description: "", logo_url: "", target_url: "", sort_order: 99, is_kroonjuweel: true, is_active: true, tile_type: "application" });
      await loadDashboardTiles();
    }
  }

  async function deleteDashboardTile(row) {
    if (!client || !row?.id) return;
    const ok = window.confirm(`Tegel "${row.title}" verwijderen?`);
    if (!ok) return;
    const result = await client.from("dashboard_tiles").delete().eq("id", row.id);
    if (result.error) {
      toast.error(`Tegel verwijderen mislukt: ${result.error.message}`);
    } else {
      toast.success("Kroonjuweel-tegel verwijderd.");
      await loadDashboardTiles();
    }
  }

  const activeRows = useMemo(
    () => lookupRows.filter((row) => row.category === activeCategory),
    [lookupRows, activeCategory],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Instellingen</h1>
            <p className="mt-1 text-sm text-slate-700">
              Beheer lokale configuratie, centrale waardelijsten, kroonjuwelen en toegangsbeheer. Waardelijsten zorgen voor consistente schrijfwijze en betrouwbare rapportages.
            </p>
          </div>
          {isAdmin ? <div className="flex flex-wrap gap-2"><Link className="btn btn-primary" to="/settings/roles">Rollenbeheer openen</Link><Link className="btn" to="/settings/communications">Communicatiecentrum</Link></div> : null}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Configuratie</h2>
        <p className="mt-1 text-sm text-slate-700">
          In <span className="font-semibold">productie</span> hoort Supabase-config via <span className="font-mono">VITE_SUPABASE_URL</span> en <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> te komen.
        </p>

        {isProd ? (
          <div className="mt-4">
            <Notice title="Productie staat op env-only">
              Deze pagina is in productie read-only. Zet de variabelen in Vercel en redeploy.
              <div className="mt-2 text-sm">Huidige status: <span className="badge">{cfg.source}</span></div>
            </Notice>
            <div className="mt-4 grid gap-3 opacity-60">
              <div className="space-y-1">
                <label htmlFor="settings-url">Supabase URL</label>
                <input id="settings-url" className="w-full" value={url} readOnly />
              </div>
              <div className="space-y-1">
                <label htmlFor="settings-anon-key">Supabase anon key</label>
                <textarea id="settings-anon-key" className="min-h-[120px] w-full" value={anonKey} readOnly />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="space-y-1">
              <label htmlFor="settings-url">Supabase URL</label>
              <input id="settings-url" className="w-full" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-anon-key">Supabase anon key</label>
              <textarea id="settings-anon-key" className="min-h-[120px] w-full" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOi..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={save}>Opslaan & reload</button>
              <button className="btn" onClick={clear}>Wissen</button>
            </div>
            <div className="text-sm text-slate-700">Huidige bron: <span className="badge">{cfg.source}</span></div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Waardelijsten</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
              Gebruik waardelijsten voor dropdowns zoals Softwareclassificatie, Installatiebron en Licentiemodel. Waarden worden consequent met hoofdletters getoond, bijvoorbeeld <strong>Burcht</strong>, <strong>Stad</strong> en <strong>Intune</strong>.
            </p>
          </div>
          <button className="btn" onClick={loadLookupValues}>Vernieuwen</button>
        </div>

        {!isAdmin ? (
          <Notice title="Alleen admins kunnen waardelijsten wijzigen">
            Je kunt de waardelijsten bekijken. Toevoegen of wijzigen kan alleen met een adminprofiel.
          </Notice>
        ) : null}

        {lookupError ? (
          <Notice title="Waardelijsten nog niet beschikbaar">
            {lookupError}. Voer de SQL-migratie van deze build uit en laad daarna de standaardwaarden.
          </Notice>
        ) : null}

        <div className="mt-4 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {LOOKUP_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${activeCategory === cat.key ? "border-blue-200 bg-blue-50 text-blue-950" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                <span>
                  <span className="block font-bold">{cat.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{cat.help}</span>
                </span>
                <span className="badge">{lookupRows.filter((r) => r.category === cat.key && r.is_active).length}</span>
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Actieve waardelijst</div>
                <h3 className="text-xl font-extrabold">{LOOKUP_CATEGORIES.find((c) => c.key === activeCategory)?.label}</h3>
              </div>
              {isAdmin ? <button className="btn" onClick={seedDefaults}>Standaardwaarden laden</button> : null}
            </div>

            <div className="mt-4 space-y-2">
              {lookupLoading ? <div className="text-sm text-slate-600">Laden…</div> : null}
              {activeRows.length === 0 && !lookupLoading ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">Geen waarden gevonden. Laad de standaardwaarden of voeg een nieuwe waarde toe.</div> : null}
              {activeRows.map((row) => (
                <div key={row.id} className={`grid gap-2 rounded-2xl border bg-white p-3 md:grid-cols-[minmax(0,1fr)_90px_120px] ${row.is_active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
                  <input value={row.value || ""} disabled={!isAdmin} onChange={(e) => updateLookupValue(row, { value: e.target.value })} />
                  <input type="number" value={row.sort_order ?? 0} disabled={!isAdmin} onChange={(e) => updateLookupValue(row, { sort_order: Number(e.target.value || 0) })} />
                  <select value={row.is_active ? "true" : "false"} disabled={!isAdmin} onChange={(e) => updateLookupValue(row, { is_active: e.target.value === "true" })}>
                    <option value="true">Actief</option>
                    <option value="false">Inactief</option>
                  </select>
                </div>
              ))}
            </div>

            {isAdmin ? (
              <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-blue-100 bg-white p-3">
                <input className="min-w-[260px] flex-1" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Nieuwe waarde" />
                <button className="btn btn-primary" onClick={addLookupValue}>Toevoegen</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Kroonjuwelen beheren</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
              Beheer de tegels op de openingspagina. Logo's staan voorlopig in <span className="font-mono">public/logos/leveranciers/</span>; gebruik het exacte pad, bijvoorbeeld <span className="font-mono">/logos/leveranciers/TOPDESK.png</span>.
            </p>
          </div>
          <button className="btn" onClick={loadDashboardTiles}>Vernieuwen</button>
        </div>

        {!isAdmin ? (
          <Notice title="Alleen admins kunnen kroonjuwelen wijzigen">
            Je kunt de tegels bekijken. Toevoegen, wijzigen of verwijderen kan alleen met een adminprofiel.
          </Notice>
        ) : null}

        {tileError ? (
          <Notice title="Kroonjuwelenbeheer nog niet beschikbaar">
            {tileError}. Controleer of de SQL-migratie voor <span className="font-mono">dashboard_tiles</span> is uitgevoerd en of RLS toegang geeft.
          </Notice>
        ) : null}

        <div className="mt-4 space-y-3">
          {tileLoading ? <div className="text-sm text-slate-600">Tegels laden…</div> : null}
          {!tileLoading && tileRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Nog geen tegels gevonden. Voeg hieronder een eerste tegel toe.
            </div>
          ) : null}

          {tileRows.map((tile) => (
            <div key={tile.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 xl:grid-cols-[110px_minmax(0,1fr)]">
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3">
                  {tile.logo_url ? (
                    <img src={tile.logo_url} alt={`${tile.title} logo`} className="h-20 w-20 object-contain" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-500">Geen logo</div>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <label>Titel</label>
                    <input disabled={!isAdmin} value={tile.title || ""} onChange={(e) => updateTileDraft(tile.id, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label>Doel-URL</label>
                    <input disabled={!isAdmin} value={tile.target_url || ""} onChange={(e) => updateTileDraft(tile.id, { target_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <label>Logo-pad</label>
                    <input disabled={!isAdmin} value={tile.logo_url || ""} onChange={(e) => updateTileDraft(tile.id, { logo_url: e.target.value })} placeholder="/logos/leveranciers/NAAM.png" />
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <label>Omschrijving</label>
                    <textarea disabled={!isAdmin} className="min-h-[76px]" value={tile.description || ""} onChange={(e) => updateTileDraft(tile.id, { description: e.target.value })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:col-span-2">
                    <div className="space-y-1">
                      <label>Volgorde</label>
                      <input type="number" disabled={!isAdmin} value={tile.sort_order ?? 0} onChange={(e) => updateTileDraft(tile.id, { sort_order: Number(e.target.value || 0) })} />
                    </div>
                    <div className="space-y-1">
                      <label>Kroonjuweel</label>
                      <select disabled={!isAdmin} value={tile.is_kroonjuweel ? "true" : "false"} onChange={(e) => updateTileDraft(tile.id, { is_kroonjuweel: e.target.value === "true" })}>
                        <option value="true">Ja</option>
                        <option value="false">Nee</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>Status</label>
                      <select disabled={!isAdmin} value={tile.is_active ? "true" : "false"} onChange={(e) => updateTileDraft(tile.id, { is_active: e.target.value === "true" })}>
                        <option value="true">Actief</option>
                        <option value="false">Inactief</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>Type</label>
                      <select disabled={!isAdmin} value={tile.tile_type || "application"} onChange={(e) => updateTileDraft(tile.id, { tile_type: e.target.value })}>
                        <option value="application">Applicatie</option>
                        <option value="supplier">Leverancier</option>
                        <option value="internal">Intern</option>
                        <option value="external">Extern</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:col-span-2">
                    {tile.target_url ? <a className="btn" href={tile.target_url} target="_blank" rel="noreferrer">Open URL</a> : null}
                    {isAdmin ? <button className="btn btn-primary" onClick={() => saveDashboardTile(tile)}>Opslaan</button> : null}
                    {isAdmin ? <button className="btn" onClick={() => deleteDashboardTile(tile)}>Verwijderen</button> : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-950">Nieuwe kroonjuweel-tegel</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <input value={newTile.title} onChange={(e) => setNewTile((v) => ({ ...v, title: e.target.value }))} placeholder="Titel, bijv. Xedule" />
              <input value={newTile.target_url} onChange={(e) => setNewTile((v) => ({ ...v, target_url: e.target.value }))} placeholder="Doel-URL" />
              <input className="lg:col-span-2" value={newTile.logo_url} onChange={(e) => setNewTile((v) => ({ ...v, logo_url: e.target.value }))} placeholder="Logo-pad, bijv. /logos/leveranciers/XEDULE.png" />
              <textarea className="lg:col-span-2 min-h-[76px]" value={newTile.description} onChange={(e) => setNewTile((v) => ({ ...v, description: e.target.value }))} placeholder="Korte omschrijving" />
              <input type="number" value={newTile.sort_order} onChange={(e) => setNewTile((v) => ({ ...v, sort_order: Number(e.target.value || 0) }))} placeholder="Volgorde" />
              <select value={newTile.tile_type} onChange={(e) => setNewTile((v) => ({ ...v, tile_type: e.target.value }))}>
                <option value="application">Applicatie</option>
                <option value="supplier">Leverancier</option>
                <option value="internal">Intern</option>
                <option value="external">Extern</option>
              </select>
            </div>
            <button className="btn btn-primary mt-3" onClick={addDashboardTile}>Tegel toevoegen</button>
          </div>
        ) : null}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Voorbeelddata</h2>
        <p className="mt-1 text-sm text-slate-700">Gebruik tijdelijke voorbeelddata alleen wanneer er nog geen echte leveranciersdata beschikbaar is. Zet dit uit voor productiegebruik.</p>
        <div className="mt-4 flex flex-wrap gap-2"><DemoModeToggle /></div>
      </div>

      <Notice title="Vercel checklist">
        <ol className="ml-5 list-decimal space-y-1">
          <li>Vercel → Project → Settings → Environment Variables</li>
          <li>Zet <span className="font-mono">VITE_SUPABASE_URL</span> en <span className="font-mono">VITE_SUPABASE_ANON_KEY</span></li>
          <li>Redeploy of “Redeploy latest”</li>
        </ol>
      </Notice>
    </div>
  );
}
