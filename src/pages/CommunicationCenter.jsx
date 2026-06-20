import { useEffect, useMemo, useState } from "react";
import Notice from "../components/Notice";
import { useToast } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";
import { AlertTriangle, CheckCircle2, Info, Megaphone, Wrench } from "lucide-react";

const TYPES = [
  { value: "info", label: "Informatie", icon: Info },
  { value: "maintenance", label: "Gepland onderhoud", icon: Wrench },
  { value: "critical", label: "Kritieke storing", icon: AlertTriangle },
  { value: "resolved", label: "Opgelost", icon: CheckCircle2 },
];

const ROLE_OPTIONS = ["", "Viewer", "Functioneel Beheerder", "Contractmanager", "AI Manager", "Security Officer", "Inkoper", "Organisatiebeheerder", "Super Admin"];

function emptyDraft(orgId) {
  return {
    organization_id: orgId || "",
    title: "",
    message: "",
    announcement_type: "info",
    active: true,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: "",
    visible_for_role: "",
    target_module: "home",
    priority: 1,
  };
}

function toLocalInput(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalInput(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

export default function CommunicationCenter() {
  const toast = useToast();
  const client = supabase();
  const { session, organization, profile, loading: appLoading } = useApp();
  const orgId = organization?.id || profile?.organization_id || null;
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(orgId));
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setDraft((old) => ({ ...old, organization_id: orgId || old.organization_id }));
  }, [orgId]);

  async function loadRows() {
    if (!client || !orgId || appLoading) return;
    setLoading(true);
    setError("");
    const { data, error } = await client
      .from("system_announcements")
      .select("*")
      .eq("organization_id", orgId)
      .order("active", { ascending: false })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      setRows([]);
      setError(error.message);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, orgId, appLoading]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.active).length,
    critical: rows.filter((r) => r.announcement_type === "critical" && r.active).length,
    maintenance: rows.filter((r) => r.announcement_type === "maintenance" && r.active).length,
  }), [rows]);

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({
      organization_id: row.organization_id || orgId,
      title: row.title || "",
      message: row.message || "",
      announcement_type: row.announcement_type || "info",
      active: row.active !== false,
      start_date: toLocalInput(row.start_date),
      end_date: toLocalInput(row.end_date),
      visible_for_role: row.visible_for_role || "",
      target_module: row.target_module || "home",
      priority: row.priority ?? 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(emptyDraft(orgId));
  }

  async function save() {
    if (!client || !orgId) return;
    if (!isAdmin) {
      toast.error("Alleen admins kunnen mededelingen beheren.");
      return;
    }
    const payload = {
      organization_id: orgId,
      title: String(draft.title || "").trim(),
      message: String(draft.message || "").trim(),
      announcement_type: draft.announcement_type || "info",
      active: draft.active !== false,
      start_date: fromLocalInput(draft.start_date) || new Date().toISOString(),
      end_date: fromLocalInput(draft.end_date),
      visible_for_role: draft.visible_for_role || null,
      target_module: draft.target_module || "home",
      priority: Number(draft.priority || 1),
      updated_at: new Date().toISOString(),
    };
    if (!payload.title || !payload.message) {
      toast.error("Titel en bericht zijn verplicht.");
      return;
    }

    const result = editingId
      ? await client.from("system_announcements").update(payload).eq("id", editingId)
      : await client.from("system_announcements").insert({ ...payload, created_by: session?.user?.id || null });

    if (result.error) {
      toast.error(`Opslaan mislukt: ${result.error.message}`);
    } else {
      toast.success(editingId ? "Mededeling bijgewerkt." : "Mededeling gepubliceerd.");
      resetDraft();
      await loadRows();
    }
  }

  async function remove(row) {
    if (!client || !row?.id) return;
    if (!window.confirm(`Mededeling "${row.title}" verwijderen?`)) return;
    const { error } = await client.from("system_announcements").delete().eq("id", row.id);
    if (error) toast.error(`Verwijderen mislukt: ${error.message}`);
    else {
      toast.success("Mededeling verwijderd.");
      await loadRows();
    }
  }

  async function toggleActive(row) {
    const { error } = await client.from("system_announcements").update({ active: !row.active, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) toast.error(`Bijwerken mislukt: ${error.message}`);
    else await loadRows();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.18em] text-blue-700">Communicatiecentrum</div>
            <h1 className="mt-1 text-2xl font-extrabold">Home-meldingen, storingen en onderhoud</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Beheer banners voor de Homepagina. Gebruik dit voor storingen, gepland onderhoud, releaseberichten en belangrijke mededelingen voor specifieke rollen.
            </p>
          </div>
          <button className="btn" onClick={loadRows}>Vernieuwen</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Totaal</div><div className="mt-1 text-3xl font-bold">{stats.total}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Actief</div><div className="mt-1 text-3xl font-bold">{stats.active}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Storingen</div><div className="mt-1 text-3xl font-bold text-red-700">{stats.critical}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-slate-500">Onderhoud</div><div className="mt-1 text-3xl font-bold text-amber-700">{stats.maintenance}</div></div>
      </div>

      {!isAdmin ? <Notice title="Alleen admins kunnen publiceren">Je kunt mededelingen bekijken, maar niet wijzigen.</Notice> : null}
      {error ? <Notice title="Communicatiecentrum nog niet beschikbaar" tone="danger">{error}. Controleer of de SQL-migratie v0.9.73 is uitgevoerd.</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="card p-5">
          <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-bold">{editingId ? "Mededeling bewerken" : "Nieuwe mededeling"}</h2></div>
          <div className="mt-4 space-y-3">
            <div className="space-y-1"><label>Titel</label><input disabled={!isAdmin} className="w-full" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Bijv. Gepland onderhoud" /></div>
            <div className="space-y-1"><label>Bericht</label><textarea disabled={!isAdmin} className="min-h-[130px] w-full" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} placeholder="Beschrijf kort wat gebruikers moeten weten." /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><label>Type</label><select disabled={!isAdmin} className="w-full" value={draft.announcement_type} onChange={(e) => setDraft({ ...draft, announcement_type: e.target.value })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div className="space-y-1"><label>Prioriteit</label><input disabled={!isAdmin} type="number" className="w-full" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><label>Start</label><input disabled={!isAdmin} type="datetime-local" className="w-full" value={draft.start_date || ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></div>
              <div className="space-y-1"><label>Einde</label><input disabled={!isAdmin} type="datetime-local" className="w-full" value={draft.end_date || ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><label>Doelmodule</label><input disabled={!isAdmin} className="w-full" value={draft.target_module || ""} onChange={(e) => setDraft({ ...draft, target_module: e.target.value })} placeholder="home, ai_register, contracten" /></div>
              <div className="space-y-1"><label>Zichtbaar voor rol</label><select disabled={!isAdmin} className="w-full" value={draft.visible_for_role || ""} onChange={(e) => setDraft({ ...draft, visible_for_role: e.target.value })}>{ROLE_OPTIONS.map((role) => <option key={role || "all"} value={role}>{role || "Iedereen"}</option>)}</select></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input disabled={!isAdmin} type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Actief publiceren</label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!isAdmin} onClick={save}>{editingId ? "Wijzigingen opslaan" : "Publiceren"}</button>
              <button className="btn" onClick={resetDraft}>Leegmaken</button>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-bold">Mededelingen</h2>
          {loading ? <div className="mt-4 text-sm text-slate-600">Meldingen laden…</div> : null}
          {!loading && rows.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Nog geen mededelingen gevonden.</div> : null}
          <div className="mt-4 space-y-3">
            {rows.map((row) => {
              const type = TYPES.find((t) => t.value === row.announcement_type) || TYPES[0];
              const Icon = type.icon;
              return (
                <div key={row.id} className={`rounded-2xl border p-4 ${row.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Icon className="h-4 w-4" /><span className="badge">{type.label}</span>{row.visible_for_role ? <span className="badge">{row.visible_for_role}</span> : <span className="badge">Iedereen</span>}{!row.active ? <span className="badge">Inactief</span> : null}</div>
                      <h3 className="mt-2 font-bold">{row.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{row.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button className="btn" onClick={() => startEdit(row)}>Bewerken</button>
                      <button className="btn" disabled={!isAdmin} onClick={() => toggleActive(row)}>{row.active ? "Pauzeren" : "Activeren"}</button>
                      <button className="btn" disabled={!isAdmin} onClick={() => remove(row)}>Verwijderen</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
