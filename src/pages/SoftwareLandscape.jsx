import { useEffect, useMemo, useState } from "react";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import { saveWithToast } from "../lib/saveWithToast";
import {
  BadgeEuro,
  BookOpen,
  Boxes,
  Archive,
  Database,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";

const SOURCE_COLUMNS = [
  { key: "application_type", label: "Domein / type applicatie (bron)", required: false },
  { key: "application_name", label: "Applicatienaam", required: true },
  { key: "description", label: "Omschrijving", multiline: true },
  { key: "manual_url", label: "Handleiding website" },
  { key: "didactic_component", label: "Didactische component" },
  { key: "main_functions", label: "Belangrijkste functies", multiline: true },
  { key: "licenses", label: "Licenties uit bronbestand" },
  { key: "key_user", label: "KeyUser" },
];

const SOFTWARE_CLASSIFICATIONS = ["Burcht", "Stad", "Land", "Schiereiland", "Nog niet geclassificeerd"];

const DEFAULT_LOOKUPS = {
  application_type: ["ICT", "Kantoorapplicatie", "Onderwijs", "Huisvesting", "Bedrijfsondersteunend", "Koppelingen", "Landschap", "Overig"],
  key_user: ["Helpdesk", "Rick Gerards", "Kim Heyen", "Frank van Grinsven", "Keny Joosten", "Onbekend"],
  software_classification: SOFTWARE_CLASSIFICATIONS,
  installation_source: ["Intune", "MECM", "Jamf", "Entra ID", "Leverancier", "Functioneel Beheer", "Handmatig", "Onbekend"],
  license_model: ["Per Gebruiker", "Per Student", "Per Medewerker", "Per Device", "Gelijktijdige Gebruikers", "Organisatiebreed", "Onbeperkt", "Geen Licentie", "Overig"],
  license_usage_source: ["DUO", "Intune", "Entra ID", "AFAS", "Eduarte", "Leverancier", "Functioneel Beheer", "Handmatig", "Anders"],
  license_unit: ["Gebruiker", "Student", "Medewerker", "Device", "FTE", "Credit", "Transactie", "Organisatie", "Installatie"],
};

function lookupOptions(lookups, category) {
  const values = lookups?.[category]?.length ? lookups[category] : DEFAULT_LOOKUPS[category] || [];
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => {
    const ai = values.indexOf(a);
    const bi = values.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    return String(a).localeCompare(String(b), "nl");
  });
}

function LookupSelect({ value, options = [], onChange, includeEmpty = true, placeholder = "Kies een waarde" }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {includeEmpty ? <option value="">{placeholder}</option> : null}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

const CLASSIFICATION_COLUMNS = [
  { key: "software_classification", label: "Softwareclassificatie" },
  { key: "installation_count", label: "Aantal installaties", type: "number" },
  { key: "installation_source", label: "Bron installatietelling", placeholder: "Intune, MECM, Jamf, handmatig…" },
  { key: "installation_last_check", label: "Laatste installatietelling", type: "date" },
  { key: "is_archived", label: "Gearchiveerd", type: "boolean" },
];

const LICENSE_COLUMNS = [
  { key: "license_required", label: "Licentieplichtig", type: "boolean" },
  { key: "license_model", label: "Licentiemodel", placeholder: "Studentenaantal, named user, device, site licence…" },
  { key: "license_quantity", label: "Afgenomen aantal", type: "number" },
  { key: "license_actual_usage", label: "Actueel gebruik", type: "number" },
  { key: "license_unit", label: "Eenheid", placeholder: "Student, medewerker, device, credit…" },
  { key: "license_reference_date", label: "Contractuele peildatum", type: "date" },
  { key: "license_adjustment_moment", label: "Bijstelmoment", placeholder: "Jaarlijks, per kwartaal, bij verlenging…" },
  { key: "license_true_up", label: "Stijging verrekenbaar", type: "boolean" },
  { key: "license_true_down", label: "Daling verrekenbaar", type: "boolean" },
  { key: "license_usage_source", label: "Bron gebruiksdata", placeholder: "DUO, Entra ID, leveranciersportal, handmatig…" },
  { key: "license_last_review", label: "Laatste controle", type: "date" },
  { key: "license_notes", label: "Licentie-opmerking", multiline: true },
];

const NOTE_COLUMNS = [{ key: "application_notes", label: "Applicatie-opmerking", multiline: true }];
const ALL_EDIT_COLUMNS = [...SOURCE_COLUMNS, ...CLASSIFICATION_COLUMNS, ...LICENSE_COLUMNS, ...NOTE_COLUMNS];

function text(value) {
  return String(value ?? "").trim();
}

function typeClass(value) {
  const v = text(value).toLowerCase();
  if (v === "burcht") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (v === "stad") return "bg-sky-100 text-sky-800 border-sky-200";
  if (v === "land" || v === "landschap") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "schiereiland") return "bg-amber-100 text-amber-800 border-amber-200";
  if (v === "ict") return "bg-slate-100 text-slate-800 border-slate-200";
  if (v === "nog niet geclassificeerd") return "bg-slate-50 text-slate-600 border-slate-200";
  if (v === "kantoorapplicatie") return "bg-purple-100 text-purple-800 border-purple-200";
  if (v === "huisvesting") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-white text-slate-700 border-slate-200";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function emptyForm() {
  return {
    application_type: "",
    application_name: "",
    description: "",
    manual_url: "",
    didactic_component: "",
    main_functions: "",
    licenses: "",
    key_user: "",
    software_classification: "Nog niet geclassificeerd",
    installation_count: "",
    installation_source: "",
    installation_last_check: "",
    is_archived: false,
    license_required: false,
    license_model: "",
    license_quantity: "",
    license_actual_usage: "",
    license_unit: "",
    license_reference_date: "",
    license_adjustment_moment: "",
    license_true_up: false,
    license_true_down: false,
    license_usage_source: "",
    license_last_review: "",
    license_notes: "",
    application_notes: "",
  };
}

function fieldValue(row, key) {
  const value = row?.[key];
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  return value ?? "";
}

function normalizeBool(value) {
  return value === true || value === "true" || value === "Ja" || value === "ja";
}

function numberOrNull(value) {
  return text(value) ? Number(value) : null;
}

function renderEditorField(value, col, onChange) {
  if (col.type === "boolean") {
    return (
      <select value={normalizeBool(value) ? "true" : "false"} onChange={(e) => onChange(e.target.value === "true")}>
        <option value="false">Nee</option>
        <option value="true">Ja</option>
      </select>
    );
  }
  if (col.multiline) {
    return <textarea rows="4" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input type={col.type || "text"} placeholder={col.placeholder || ""} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
}

function InfoTile({ label, value, icon: Icon, tone = "slate", wide = false }) {
  const tones = {
    slate: "bg-slate-50 text-slate-900 border-slate-100",
    blue: "bg-blue-50 text-blue-950 border-blue-100",
    green: "bg-emerald-50 text-emerald-950 border-emerald-100",
    amber: "bg-amber-50 text-amber-950 border-amber-100",
    rose: "bg-rose-50 text-rose-950 border-rose-100",
    violet: "bg-violet-50 text-violet-950 border-violet-100",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate} ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wide opacity-65">{label}</div>
        {Icon ? <Icon size={18} className="opacity-70" aria-hidden="true" /> : null}
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">{text(value) || "-"}</div>
    </div>
  );
}

function ReadRow({ label, value, children }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-5 last:border-0">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="min-w-0 whitespace-pre-wrap text-sm leading-6 text-slate-800">{children ?? (text(value) || "-")}</div>
    </div>
  );
}


function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
      {Icon ? <div className="rounded-2xl bg-blue-50 p-2 text-blue-700 shadow-sm"><Icon size={18} aria-hidden="true" /></div> : null}
      <div>
        <h3 className="vsp-section-title">{title}</h3>
        {subtitle ? <p className="vsp-section-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function EditField({ label, children, required = false, hint, wide = false }) {
  return (
    <label className={`vsp-edit-field ${wide ? "vsp-edit-field-wide" : ""}`}>
      <span className="vsp-edit-label">
        {label}{required ? " *" : ""}
      </span>
      {children}
      {hint ? <span className="vsp-edit-hint">{hint}</span> : null}
    </label>
  );
}

function CompactStatusCard({ label, value, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-white text-slate-800 border-slate-200",
    blue: "bg-blue-50 text-blue-950 border-blue-100",
    green: "bg-emerald-50 text-emerald-950 border-emerald-100",
    amber: "bg-amber-50 text-amber-950 border-amber-100",
    violet: "bg-violet-50 text-violet-950 border-violet-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide opacity-70">
        <span>{label}</span>
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      </div>
      <div className="mt-1 truncate text-sm font-extrabold">{text(value) || "-"}</div>
    </div>
  );
}

function LicenseEditFields({ data, onChange, lookups }) {
  const licenseRequired = normalizeBool(data?.license_required);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <EditField label="Licentieplichtig">
          {renderEditorField(data.license_required, LICENSE_COLUMNS[0], (value) => onChange("license_required", value))}
        </EditField>
        <EditField label="Licentiemodel">
          <LookupSelect value={data.license_model} options={lookupOptions(lookups, "license_model")} onChange={(value) => onChange("license_model", value)} />
        </EditField>
      </div>
      {!licenseRequired ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <div className="font-bold text-slate-900">Geen actieve licentieadministratie nodig</div>
          <p className="mt-1">Zet <strong>Licentieplichtig</strong> op Ja zodra aantallen, gebruik, peildata of verrekenafspraken relevant zijn.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EditField label="Afgenomen aantal">{renderEditorField(data.license_quantity, LICENSE_COLUMNS[2], (value) => onChange("license_quantity", value))}</EditField>
          <EditField label="Actueel gebruik">{renderEditorField(data.license_actual_usage, LICENSE_COLUMNS[3], (value) => onChange("license_actual_usage", value))}</EditField>
          <EditField label="Eenheid"><LookupSelect value={data.license_unit} options={lookupOptions(lookups, "license_unit")} onChange={(value) => onChange("license_unit", value)} /></EditField>
          <EditField label="Contractuele peildatum">{renderEditorField(data.license_reference_date, LICENSE_COLUMNS[5], (value) => onChange("license_reference_date", value))}</EditField>
          <EditField label="Bijstelmoment">{renderEditorField(data.license_adjustment_moment, LICENSE_COLUMNS[6], (value) => onChange("license_adjustment_moment", value))}</EditField>
          <EditField label="Bron gebruiksdata"><LookupSelect value={data.license_usage_source} options={lookupOptions(lookups, "license_usage_source")} onChange={(value) => onChange("license_usage_source", value)} /></EditField>
          <EditField label="Stijging verrekenbaar">{renderEditorField(data.license_true_up, LICENSE_COLUMNS[7], (value) => onChange("license_true_up", value))}</EditField>
          <EditField label="Daling verrekenbaar">{renderEditorField(data.license_true_down, LICENSE_COLUMNS[8], (value) => onChange("license_true_down", value))}</EditField>
          <EditField label="Laatste controle">{renderEditorField(data.license_last_review, LICENSE_COLUMNS[10], (value) => onChange("license_last_review", value))}</EditField>
          <EditField label="Licentie-opmerking" wide>{renderEditorField(data.license_notes, LICENSE_COLUMNS[11], (value) => onChange("license_notes", value))}</EditField>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#0c4f9f] text-white shadow" : "bg-white text-slate-700 hover:bg-slate-50"}`}
      onClick={onClick}
    >
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export default function SoftwareLandscape() {
  const client = supabase();
  const toast = useToast();
  const { organization, profile } = useApp();
  const orgId = organization?.id || profile?.organization_id;

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("Alle types");
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newRow, setNewRow] = useState(emptyForm());
  const [lookups, setLookups] = useState(DEFAULT_LOOKUPS);

  async function loadLookups() {
    if (!client || !orgId) return;
    const result = await client
      .from("lookup_values")
      .select("category,value,is_active,sort_order")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("value", { ascending: true });

    if (result.error) {
      setLookups(DEFAULT_LOOKUPS);
      return;
    }

    const grouped = { ...DEFAULT_LOOKUPS };
    for (const row of result.data || []) {
      if (!grouped[row.category]) grouped[row.category] = [];
      if (row.value && !grouped[row.category].includes(row.value)) grouped[row.category].push(row.value);
    }
    setLookups(grouped);
  }

  async function load({ keepSelection = true } = {}) {
    if (!client || !orgId) return;
    setLoading(true);
    setError("");
    const result = await client
      .from("software_landscape_import")
      .select("*")
      .eq("organization_id", orgId)
      .order("application_type", { ascending: true })
      .order("application_name", { ascending: true });

    if (result.error) {
      setError(result.error.message);
      setRows([]);
    } else {
      const list = result.data || [];
      setRows(list);
      if (!keepSelection || !selectedId || !list.some((r) => r.id === selectedId)) {
        setSelectedId(list[0]?.id || null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLookups();
    load({ keepSelection: false });
  }, [orgId]);

  const typeCounts = useMemo(() => {
    return rows.reduce((acc, row) => {
      const key = text(row.application_type) || "Leeg";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  const typeOptions = useMemo(() => Object.keys(typeCounts).sort((a, b) => a.localeCompare(b, "nl")), [typeCounts]);

  const typeSuggestions = useMemo(() => {
    const base = ["Burcht", "Stad", "Schiereiland", "ICT", "Landschap", "Kantoorapplicatie", "Huisvesting", "Bedrijfsondersteunend", "Koppelingen"];
    return Array.from(new Set([...base, ...typeOptions])).sort((a, b) => a.localeCompare(b, "nl"));
  }, [typeOptions]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "Alle types" && (text(row.application_type) || "Leeg") !== typeFilter) return false;
      if (!needle) return true;
      return ALL_EDIT_COLUMNS.some((col) => String(row[col.key] || "").toLowerCase().includes(needle));
    });
  }, [rows, q, typeFilter]);

  const selected = useMemo(() => {
    if (!rows.length) return null;
    return rows.find((r) => r.id === selectedId) || filteredRows[0] || rows[0];
  }, [rows, filteredRows, selectedId]);

  const stats = useMemo(() => {
    const withLicenseModel = rows.filter((r) => text(r.license_model) || text(r.licenses)).length;
    const withNotes = rows.filter((r) => text(r.application_notes)).length;
    return {
      total: rows.length,
      filtered: filteredRows.length,
      typeFilled: rows.filter((r) => text(r.application_type)).length,
      classFilled: rows.filter((r) => text(r.software_classification) && text(r.software_classification) !== "Nog niet geclassificeerd").length,
      installationFilled: rows.filter((r) => r.installation_count !== null && r.installation_count !== undefined && String(r.installation_count) !== "").length,
      archived: rows.filter((r) => !!r.is_archived).length,
      withManual: rows.filter((r) => text(r.manual_url)).length,
      withKeyUser: rows.filter((r) => text(r.key_user)).length,
      licenseRequired: rows.filter((r) => !!r.license_required).length,
      withLicenseModel,
      licenseReviewed: rows.filter((r) => text(r.license_last_review)).length,
      withNotes,
      quality: rows.length ? Math.round(((rows.filter((r) => text(r.application_type)).length + rows.filter((r) => text(r.application_name)).length + withLicenseModel + withNotes) / (rows.length * 4)) * 100) : 0,
    };
  }, [rows, filteredRows]);

  function buildPayload(row, isNew = false) {
    return {
      ...(isNew ? { organization_id: orgId } : {}),
      application_type: text(row.application_type) || null,
      application_name: text(row.application_name),
      description: text(row.description) || null,
      manual_url: text(row.manual_url) || null,
      didactic_component: text(row.didactic_component) || null,
      main_functions: text(row.main_functions) || null,
      licenses: text(row.licenses) || null,
      key_user: text(row.key_user) || null,
      software_classification: text(row.software_classification) || null,
      installation_count: numberOrNull(row.installation_count),
      installation_source: text(row.installation_source) || null,
      installation_last_check: text(row.installation_last_check) || null,
      is_archived: !!row.is_archived,
      license_required: !!row.license_required,
      license_model: text(row.license_model) || null,
      license_quantity: numberOrNull(row.license_quantity),
      license_actual_usage: numberOrNull(row.license_actual_usage),
      license_unit: text(row.license_unit) || null,
      license_reference_date: text(row.license_reference_date) || null,
      license_adjustment_moment: text(row.license_adjustment_moment) || null,
      license_true_up: !!row.license_true_up,
      license_true_down: !!row.license_true_down,
      license_usage_source: text(row.license_usage_source) || null,
      license_last_review: text(row.license_last_review) || null,
      license_notes: text(row.license_notes) || null,
      application_notes: text(row.application_notes) || null,
      import_status: isNew ? "manual" : row.import_status || "edited",
      source_file: isNew ? "Handmatig toegevoegd in VendorScorePro" : row.source_file,
      updated_at: new Date().toISOString(),
    };
  }

  function startEdit(row) {
    setEditing({ ...emptyForm(), ...row });
    setDetailTab("edit");
    setSelectedId(row.id);
  }

  function cancelEdit() {
    setEditing(null);
    setDetailTab("overview");
  }

  function updateEdit(key, value) {
    setEditing((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function saveRow(row) {
    if (!client || !row?.id) return;
    if (!text(row.application_name)) {
      setError("Applicatienaam is verplicht.");
      return;
    }
    await saveWithToast(client.from("software_landscape_import").update(buildPayload(row)).eq("id", row.id), toast, {
      loading: "Applicatie opslaan...",
      success: "Applicatie opgeslagen.",
      error: "Opslaan mislukt.",
    });
    setEditing(null);
    setMessage("Applicatie bijgewerkt.");
    await load({ keepSelection: true });
    setDetailTab("overview");
  }

  async function addRow() {
    if (!client || !orgId) return;
    if (!text(newRow.application_name)) {
      setError("Vul minimaal een applicatienaam in.");
      return;
    }
    const result = await saveWithToast(client.from("software_landscape_import").insert(buildPayload(newRow, true)).select("id").single(), toast, {
      loading: "Applicatie toevoegen...",
      success: "Applicatie toegevoegd.",
      error: "Toevoegen mislukt.",
    });
    setNewRow(emptyForm());
    setNewOpen(false);
    setMessage("Nieuwe applicatie toegevoegd aan het bronregister.");
    await load({ keepSelection: true });
    if (result?.data?.id) setSelectedId(result.data.id);
  }

  async function deleteRow(row) {
    if (!client || !row?.id) return;
    const ok = window.confirm(`Applicatie verwijderen uit het bronregister: ${row.application_name}?`);
    if (!ok) return;
    await saveWithToast(client.from("software_landscape_import").delete().eq("id", row.id), toast, {
      loading: "Applicatie verwijderen...",
      success: "Applicatie verwijderd.",
      error: "Verwijderen mislukt.",
    });
    setMessage("Applicatie verwijderd uit het bronregister.");
    setSelectedId(null);
    await load({ keepSelection: false });
  }

  function exportCsv() {
    const headers = ALL_EDIT_COLUMNS.map((c) => c.label);
    const lines = [headers.join(";")].concat(filteredRows.map((row) => ALL_EDIT_COLUMNS.map((col) => csvEscape(fieldValue(row, col.key))).join(";")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendorscorepro-applicatieregister.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const unusedLicenses = selected && Number(selected.license_quantity || 0) && Number(selected.license_actual_usage || 0)
    ? Number(selected.license_quantity || 0) - Number(selected.license_actual_usage || 0)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-[#0f5a95] via-[#0b4d88] to-[#0b315d] p-7 text-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-5xl">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/80">Applicatie- & Licentieregister</div>
            <h1 className="mt-3 text-3xl font-extrabold lg:text-4xl">Applicatie- en licentiebeheer</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-cyan-50/90">
              Beheer applicaties, softwareclassificatie, licenties en installatietellingen. Leveranciers, architectuurrelaties en governance blijven aparte hoofdstukken en worden later bewust gekoppeld.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/90 backdrop-blur">
            <div className="font-bold">Werkprincipe</div>
            <div className="mt-1">Registreren → Valideren → Verrijken → Analyseren</div>
          </div>
        </div>
      </section>

      {error ? <Notice title="Fout" tone="danger">{error}</Notice> : null}
      {message ? <Notice title="Status" tone="success">{message}</Notice> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <InfoTile label="Applicaties" value={stats.total} icon={Database} tone="blue" />
        <InfoTile label="Gefilterd" value={stats.filtered} icon={Search} />
        <InfoTile label="Types gevuld" value={stats.typeFilled} icon={LayoutGrid} tone="green" />
        <InfoTile label="Classificatie" value={stats.classFilled} icon={ShieldCheck} tone="violet" />
        <InfoTile label="Installatietelling" value={stats.installationFilled} icon={Boxes} />
        <InfoTile label="KeyUsers" value={stats.withKeyUser} icon={ShieldCheck} tone="violet" />
        <InfoTile label="Licentieplichtig" value={stats.licenseRequired} icon={BadgeEuro} tone="amber" />
        <InfoTile label="Licentiecontrole" value={stats.licenseReviewed} icon={FileText} />
        <InfoTile label="Datakwaliteit" value={`${stats.quality}%`} icon={Sparkles} tone="green" />
      </section>

      <section className="vsp-master-detail">
        <aside className="vsp-master-list">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Applicatie- & licentieregister</h2>
                <p className="text-sm text-slate-600">Zelfstandige bron: applicaties, licenties en installaties.</p>
              </div>
              <button className="btn btn-primary" onClick={() => setNewOpen((v) => !v)}><Plus size={16} /> Nieuw</button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <Search size={17} className="text-slate-400" aria-hidden="true" />
              <input className="border-0 bg-transparent p-0 focus:ring-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek applicatie, type, key-user…" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option>Alle types</option>
                {typeOptions.map((type) => <option key={type}>{type}</option>)}
              </select>
              <div className="flex gap-2">
                <button className="btn flex-1" onClick={() => load({ keepSelection: true })}><RefreshCcw size={16} /> Vernieuwen</button>
                <button className="btn flex-1" onClick={exportCsv}><Download size={16} /> Export</button>
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-420px)] min-h-[420px] overflow-y-auto p-2 presentation-mode:max-h-[calc(100vh-330px)]">
            {loading ? <div className="p-4 text-sm text-slate-600">Laden…</div> : null}
            {filteredRows.map((row) => {
              const active = selected?.id === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`mb-2 w-full rounded-2xl border p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60 ${active ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-100 bg-white"}`}
                  onClick={() => {
                    setSelectedId(row.id);
                    setEditing(null);
                    if (detailTab === "edit") setDetailTab("overview");
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{row.application_name || "Naam ontbreekt"}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{row.key_user || "Geen key-user vastgelegd"}</div>
                    </div>
                    {row.software_classification ? <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${typeClass(row.software_classification)}`}>{row.software_classification}</span> : row.application_type ? <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${typeClass(row.application_type)}`}>{row.application_type}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                    {row.is_archived ? <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700">Archief</span> : null}
                    {row.license_required ? <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">Licentie</span> : null}
                    {row.installation_count ? <span className="rounded-full bg-indigo-100 px-2 py-1 font-semibold text-indigo-800">{row.installation_count} installaties</span> : null}
                    {row.manual_url ? <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-800">Handleiding</span> : null}
                    {row.application_notes ? <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">Notitie</span> : null}
                  </div>
                </button>
              );
            })}
            {!filteredRows.length ? <div className="p-4 text-sm text-slate-500">Geen applicaties gevonden.</div> : null}
          </div>
        </aside>

        <section className="vsp-detail-panel">
          {!selected ? (
            <div className="flex h-full min-h-[520px] items-center justify-center p-10 text-center">
              <div>
                <Database className="mx-auto h-12 w-12 text-slate-300" />
                <h2 className="mt-3 text-xl font-bold text-slate-900">Geen applicatie geselecteerd</h2>
                <p className="mt-1 text-sm text-slate-600">Selecteer links een applicatie of voeg een nieuw record toe.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="vsp-panel-head">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-extrabold text-slate-900">{selected.application_name}</h2>
                      {selected.application_type ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">Domein: {selected.application_type}</span> : null}
                      {selected.software_classification ? <span className={`rounded-full border px-3 py-1 text-xs font-bold ${typeClass(selected.software_classification)}`}>Classificatie: {selected.software_classification}</span> : null}
                    </div>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{selected.description || "Geen omschrijving in de bronimport."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn" onClick={() => startEdit(selected)}><PencilLine size={16} /> Bewerken</button>
                    <button className="btn" onClick={() => deleteRow(selected)}><Trash2 size={16} /> Verwijderen</button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <TabButton active={detailTab === "overview"} onClick={() => setDetailTab("overview")} icon={Eye}>Overzicht</TabButton>
                  <TabButton active={detailTab === "source"} onClick={() => setDetailTab("source")} icon={Database}>Brongegevens</TabButton>
                  <TabButton active={detailTab === "license"} onClick={() => setDetailTab("license")} icon={BadgeEuro}>Licenties</TabButton>
                  <TabButton active={detailTab === "installations"} onClick={() => setDetailTab("installations")} icon={Boxes}>Installaties</TabButton>
                  <TabButton active={detailTab === "notes"} onClick={() => setDetailTab("notes")} icon={StickyNote}>Notities</TabButton>
                  <TabButton active={detailTab === "edit"} onClick={() => startEdit(selected)} icon={PencilLine}>Bewerken</TabButton>
                </div>
              </div>

              <div className="p-5">
                {detailTab === "overview" ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoTile label="Domein / type" value={selected.application_type} icon={LayoutGrid} tone="blue" />
                      <InfoTile label="Softwareclassificatie" value={selected.software_classification || "Nog niet geclassificeerd"} icon={ShieldCheck} tone="violet" />
                      <InfoTile label="KeyUser" value={selected.key_user} icon={ShieldCheck} tone="green" />
                      <InfoTile label="Licentiemodel" value={selected.license_model || selected.licenses} icon={BadgeEuro} tone="amber" />
                      <InfoTile label="Installaties" value={selected.installation_count || "Niet geteld"} icon={Boxes} />
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <h3 className="font-bold text-slate-900">Zelfstandige waarde van deze bron</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Deze data komt uit het applicatielandschap en wordt bewust niet automatisch vermengd met leveranciers, contracten of governance. Eerst corrigeren we de bron; daarna kunnen we gecontroleerd verrijken.</p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-blue-950">
                        <h3 className="font-bold">Analyse volgt later</h3>
                        <p className="mt-2 text-sm leading-6">Relaties met leveranciers, kroonjuwelen, contracten en documenten worden later in een aparte verrijkingslaag gelegd. Zo blijft het totaalbeeld rustig en uitlegbaar.</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {detailTab === "source" ? (
                  <div className="rounded-2xl border border-slate-100 bg-white px-5">
                    {SOURCE_COLUMNS.map((col) => (
                      <ReadRow key={col.key} label={col.label} value={selected[col.key]}>
                        {col.key === "application_type" && selected[col.key] ? <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${typeClass(selected[col.key])}`}>{selected[col.key]}</span> : null}
                        {col.key === "manual_url" && selected[col.key] ? <a className="text-blue-700 underline" href={selected[col.key]} target="_blank" rel="noreferrer">{selected[col.key]}</a> : null}
                        {!["application_type", "manual_url"].includes(col.key) ? (selected[col.key] || "-") : null}
                      </ReadRow>
                    ))}
                  </div>
                ) : null}



                {detailTab === "installations" ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoTile label="Aantal installaties" value={selected.installation_count || "Niet geteld"} icon={Boxes} tone="blue" />
                      <InfoTile label="Bron telling" value={selected.installation_source || "Niet vastgelegd"} icon={Database} />
                      <InfoTile label="Laatste telling" value={selected.installation_last_check || "Niet gecontroleerd"} icon={FileText} />
                      <InfoTile label="Status" value={selected.is_archived ? "Gearchiveerd" : "Actief"} icon={Archive} tone={selected.is_archived ? "slate" : "green"} />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white px-5">
                      <ReadRow label="Softwareclassificatie" value={selected.software_classification} />
                      <ReadRow label="Aantal installaties" value={selected.installation_count} />
                      <ReadRow label="Bron installatietelling" value={selected.installation_source} />
                      <ReadRow label="Laatste installatietelling" value={selected.installation_last_check} />
                      <ReadRow label="Archiefstatus" value={selected.is_archived ? "Gearchiveerd" : "Actief"} />
                    </div>
                  </div>
                ) : null}

                {detailTab === "license" ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoTile label="Licentieplichtig" value={selected.license_required ? "Ja" : "Nee"} icon={BadgeEuro} tone={selected.license_required ? "amber" : "slate"} />
                      <InfoTile label="Aantal / gebruik" value={`${selected.license_quantity || "-"} / ${selected.license_actual_usage || "-"} ${selected.license_unit || ""}`} icon={FileText} />
                      <InfoTile label="True-up / true-down" value={`Stijging: ${selected.license_true_up ? "Ja" : "Nee"}\nDaling: ${selected.license_true_down ? "Ja" : "Nee"}`} icon={ShieldCheck} tone="green" />
                      <InfoTile label="Vrij/onbenut" value={unusedLicenses === null ? "-" : unusedLicenses} icon={Sparkles} tone={unusedLicenses !== null && unusedLicenses < 0 ? "rose" : "blue"} />
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white px-5">
                      <ReadRow label="Licentiemodel" value={selected.license_model || selected.licenses} />
                      <ReadRow label="Contractuele peildatum" value={selected.license_reference_date} />
                      <ReadRow label="Bijstelmoment" value={selected.license_adjustment_moment} />
                      <ReadRow label="Bron gebruiksdata" value={selected.license_usage_source} />
                      <ReadRow label="Laatste controle" value={selected.license_last_review} />
                      <ReadRow label="Licentie-opmerking" value={selected.license_notes} />
                    </div>
                  </div>
                ) : null}

                {detailTab === "notes" ? (
                  <div className="rounded-2xl border border-slate-100 bg-white p-5">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Applicatie-opmerking</div>
                    <div className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-800">{selected.application_notes || "Geen opmerking vastgelegd."}</div>
                  </div>
                ) : null}

                {detailTab === "edit" && editing ? (
                  <div className="space-y-5">
                    <div className="vsp-sticky-save">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Bewerkmodus</div>
                        <div className="mt-1 font-extrabold">{editing.application_name || "Nieuwe applicatie"}</div>
                        <div className="text-sm text-blue-800/80">Wijzigingen blijven binnen het zelfstandige applicatieregister.</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-primary" onClick={() => saveRow(editing)}>Opslaan</button>
                        <button className="btn" onClick={cancelEdit}><X size={16} /> Annuleren</button>
                      </div>
                    </div>

                    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-5">
                        <section className="vsp-section">
                          <SectionHeader title="Brongegevens" subtitle="De oorspronkelijke applicatiegegevens uit het softwarelandschap. Houd deze laag schoon en herkenbaar." icon={Database} />
                          <div className="vsp-edit-grid">
                            <EditField label="Domein / type applicatie (bron)" required={false}>
                              <LookupSelect value={editing.application_type || ""} options={lookupOptions(lookups, "application_type")} onChange={(value) => updateEdit("application_type", value)} placeholder="Kies domein/type" />
                            </EditField>
                            <EditField label="Softwareclassificatie">
                              <LookupSelect value={editing.software_classification || "Nog niet geclassificeerd"} options={lookupOptions(lookups, "software_classification")} includeEmpty={false} onChange={(value) => updateEdit("software_classification", value)} />
                            </EditField>
                            <EditField label="Applicatienaam" required>
                              {renderEditorField(editing.application_name, SOURCE_COLUMNS[1], (value) => updateEdit("application_name", value))}
                            </EditField>
                            <EditField label="Omschrijving" wide>
                              {renderEditorField(editing.description, SOURCE_COLUMNS[2], (value) => updateEdit("description", value))}
                            </EditField>
                            <EditField label="Handleiding website">
                              {renderEditorField(editing.manual_url, SOURCE_COLUMNS[3], (value) => updateEdit("manual_url", value))}
                            </EditField>
                            <EditField label="Didactische component">
                              {renderEditorField(editing.didactic_component, SOURCE_COLUMNS[4], (value) => updateEdit("didactic_component", value))}
                            </EditField>
                            <EditField label="Belangrijkste functies" wide>
                              {renderEditorField(editing.main_functions, SOURCE_COLUMNS[5], (value) => updateEdit("main_functions", value))}
                            </EditField>
                            <EditField label="Licenties uit bronbestand">
                              {renderEditorField(editing.licenses, SOURCE_COLUMNS[6], (value) => updateEdit("licenses", value))}
                            </EditField>
                            <EditField label="KeyUser">
                              <LookupSelect value={editing.key_user || ""} options={lookupOptions(lookups, "key_user")} onChange={(value) => updateEdit("key_user", value)} placeholder="Kies KeyUser" />
                            </EditField>
                          </div>
                        </section>

                        <section className="vsp-section">
                          <SectionHeader title="Licenties" subtitle="Vul alleen licentiegegevens in wanneer dit voor contract-, budget- of compliancebewaking relevant is." icon={BadgeEuro} />
                          <LicenseEditFields data={editing} onChange={updateEdit} lookups={lookups} />
                        </section>

                        <section className="vsp-section">
                          <SectionHeader title="Installaties" subtitle="Leg vast hoeveel installaties of deployments bekend zijn en uit welke bron de telling komt." icon={Boxes} />
                          <div className="vsp-edit-grid">
                            <EditField label="Aantal installaties">{renderEditorField(editing.installation_count, CLASSIFICATION_COLUMNS[1], (value) => updateEdit("installation_count", value))}</EditField>
                            <EditField label="Bron installatietelling"><LookupSelect value={editing.installation_source} options={lookupOptions(lookups, "installation_source")} onChange={(value) => updateEdit("installation_source", value)} /></EditField>
                            <EditField label="Laatste installatietelling">{renderEditorField(editing.installation_last_check, CLASSIFICATION_COLUMNS[3], (value) => updateEdit("installation_last_check", value))}</EditField>
                            <EditField label="Archiveren">{renderEditorField(editing.is_archived, CLASSIFICATION_COLUMNS[4], (value) => updateEdit("is_archived", value))}</EditField>
                          </div>
                        </section>

                        <section className="vsp-section">
                          <SectionHeader title="Notities" subtitle="Gebruik dit veld voor context, aandachtspunten of afspraken rond deze applicatie." icon={StickyNote} />
                          <EditField label="Applicatie-opmerking">
                            {renderEditorField(editing.application_notes, NOTE_COLUMNS[0], (value) => updateEdit("application_notes", value))}
                          </EditField>
                        </section>
                      </div>

                      <aside className="vsp-status-rail">
                        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Status & samenvatting</div>
                          <div className="mt-3 grid gap-3">
                            <CompactStatusCard label="Domein/type" value={editing.application_type} icon={LayoutGrid} tone="blue" />
                            <CompactStatusCard label="Classificatie" value={editing.software_classification} icon={ShieldCheck} tone="violet" />
                            <CompactStatusCard label="KeyUser" value={editing.key_user} icon={ShieldCheck} tone="violet" />
                            <CompactStatusCard label="Licentie" value={normalizeBool(editing.license_required) ? "Licentieplichtig" : "Niet licentieplichtig"} icon={BadgeEuro} tone={normalizeBool(editing.license_required) ? "amber" : "slate"} />
                            <CompactStatusCard label="Installaties" value={editing.installation_count || "Niet geteld"} icon={Boxes} tone="green" />
                          </div>
                        </div>
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                          <div className="font-extrabold">Rust door scheiding</div>
                          <p className="mt-1">Brondata, licenties en notities staan apart. Verrijking met leveranciers, contracten en governance volgt bewust in aparte lagen.</p>
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </section>

      <datalist id="software-type-suggestions">
        {typeSuggestions.map((type) => <option key={type} value={type} />)}
      </datalist>

      {newOpen ? (
        <section className="card border-2 border-blue-100 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Nieuwe applicatie toevoegen</h2>
              <p className="mt-1 text-sm text-slate-600">Dit record wordt alleen toegevoegd aan het applicatieregister. Er ontstaat nog geen automatische koppeling met leveranciers, contracten of governance.</p>
            </div>
            <button className="btn" onClick={() => setNewOpen(false)}><X size={16} /> Sluiten</button>
          </div>
          <div className="mt-4 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="vsp-section">
                <SectionHeader title="Brongegevens" subtitle="Leg eerst de basis van de applicatie vast. Verrijking volgt later." icon={Database} />
                <div className="vsp-edit-grid">
                  <EditField label="Domein / type applicatie (bron)"><LookupSelect value={newRow.application_type || ""} options={lookupOptions(lookups, "application_type")} onChange={(value) => setNewRow({ ...newRow, application_type: value })} placeholder="Kies domein/type" /></EditField>
                  <EditField label="Softwareclassificatie"><LookupSelect value={newRow.software_classification || "Nog niet geclassificeerd"} options={lookupOptions(lookups, "software_classification")} includeEmpty={false} onChange={(value) => setNewRow({ ...newRow, software_classification: value })} /></EditField>
                  <EditField label="Applicatienaam" required>{renderEditorField(newRow.application_name, SOURCE_COLUMNS[1], (value) => setNewRow({ ...newRow, application_name: value }))}</EditField>
                  <EditField label="Omschrijving" wide>{renderEditorField(newRow.description, SOURCE_COLUMNS[2], (value) => setNewRow({ ...newRow, description: value }))}</EditField>
                  <EditField label="Handleiding website">{renderEditorField(newRow.manual_url, SOURCE_COLUMNS[3], (value) => setNewRow({ ...newRow, manual_url: value }))}</EditField>
                  <EditField label="Didactische component">{renderEditorField(newRow.didactic_component, SOURCE_COLUMNS[4], (value) => setNewRow({ ...newRow, didactic_component: value }))}</EditField>
                  <EditField label="Belangrijkste functies" wide>{renderEditorField(newRow.main_functions, SOURCE_COLUMNS[5], (value) => setNewRow({ ...newRow, main_functions: value }))}</EditField>
                  <EditField label="Licenties uit bronbestand">{renderEditorField(newRow.licenses, SOURCE_COLUMNS[6], (value) => setNewRow({ ...newRow, licenses: value }))}</EditField>
                  <EditField label="KeyUser"><LookupSelect value={newRow.key_user || ""} options={lookupOptions(lookups, "key_user")} onChange={(value) => setNewRow({ ...newRow, key_user: value })} placeholder="Kies KeyUser" /></EditField>
                </div>
              </section>
              <section className="vsp-section">
                <SectionHeader title="Licenties" subtitle="Optioneel: alleen invullen als licentiebeheer relevant is." icon={BadgeEuro} />
                <LicenseEditFields data={newRow} onChange={(key, value) => setNewRow({ ...newRow, [key]: value })} lookups={lookups} />
              </section>
              <section className="vsp-section">
                <SectionHeader title="Installaties" subtitle="Optioneel: technische telling van installaties of deployments." icon={Boxes} />
                <div className="vsp-edit-grid">
                  <EditField label="Aantal installaties">{renderEditorField(newRow.installation_count, CLASSIFICATION_COLUMNS[1], (value) => setNewRow({ ...newRow, installation_count: value }))}</EditField>
                  <EditField label="Bron installatietelling"><LookupSelect value={newRow.installation_source} options={lookupOptions(lookups, "installation_source")} onChange={(value) => setNewRow({ ...newRow, installation_source: value })} /></EditField>
                  <EditField label="Laatste installatietelling">{renderEditorField(newRow.installation_last_check, CLASSIFICATION_COLUMNS[3], (value) => setNewRow({ ...newRow, installation_last_check: value }))}</EditField>
                </div>
              </section>
              <section className="vsp-section">
                <SectionHeader title="Notities" subtitle="Vrije context bij deze applicatie." icon={StickyNote} />
                <EditField label="Applicatie-opmerking">{renderEditorField(newRow.application_notes, NOTE_COLUMNS[0], (value) => setNewRow({ ...newRow, application_notes: value }))}</EditField>
              </section>
            </div>
            <aside className="vsp-status-rail">
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Nieuw record</div>
                <div className="mt-3 grid gap-3">
                  <CompactStatusCard label="Applicatie" value={newRow.application_name || "Nog geen naam"} icon={Database} tone="blue" />
                  <CompactStatusCard label="Domein/type" value={newRow.application_type || "Nog niet gevuld"} icon={LayoutGrid} />
                  <CompactStatusCard label="Classificatie" value={newRow.software_classification || "Nog niet geclassificeerd"} icon={ShieldCheck} tone="violet" />
                  <CompactStatusCard label="Licentie" value={normalizeBool(newRow.license_required) ? "Licentieplichtig" : "Niet licentieplichtig"} icon={BadgeEuro} tone={normalizeBool(newRow.license_required) ? "amber" : "slate"} />
                </div>
              </div>
            </aside>
          </div>
          <div className="mt-4 flex gap-2"><button className="btn btn-primary" onClick={addRow}>Opslaan</button><button className="btn" onClick={() => setNewOpen(false)}>Annuleren</button></div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold">Registerlaag</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Dit scherm is bedoeld voor bronregistratie: softwarelandschap, licentiegegevens en opmerkingen. De bron blijft zelfstandig waardevol en wordt niet automatisch gecombineerd.</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold">Verrijkingslaag</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Latere verrijking gebeurt bewust: leveranciers, contracten, governance, kroonjuwelen en documenten worden apart gekoppeld, zodat schermen overzichtelijk en uitlegbaar blijven.</p>
        </div>
      </section>
    </div>
  );
}
