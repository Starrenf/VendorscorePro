import { useEffect, useMemo, useState } from "react";
import Notice from "../Notice";
import { supabase } from "../../lib/supabase";

function emptyApp(organizationId, supplierId) {
  return {
    id: null,
    organization_id: organizationId,
    supplier_id: supplierId,
    name: "",
    description: "",
    is_active: true,
  };
}

function emptyAssignment(organizationId, supplierId, applicationId = null) {
  return {
    id: null,
    organization_id: organizationId,
    supplier_id: supplierId,
    application_id: applicationId,
    application_name: "",
    contact_name: "",
    phone: "",
    email: "",
    role_title: "Functioneel beheerder",
    notes: "",
    start_date: "",
    is_primary: false,
  };
}

function sortAssignments(rows) {
  return [...rows].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    const appA = (a.application_name || "").toLowerCase();
    const appB = (b.application_name || "").toLowerCase();
    if (appA !== appB) return appA.localeCompare(appB);
    return (a.contact_name || "").localeCompare(b.contact_name || "");
  });
}

export default function SupplierApplicationsTab({ supplier, organization }) {
  const client = supabase();
  const [applications, setApplications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [appEditorOpen, setAppEditorOpen] = useState(false);
  const [newApp, setNewApp] = useState(() => emptyApp(organization?.id, supplier?.id));

  async function loadApplications() {
    if (!client || !organization?.id || !supplier?.id) return;
    setAppsLoading(true);
    setError("");
    const { data, error } = await client
      .from("applications")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("supplier_id", supplier.id)
      .order("name", { ascending: true });
    if (error) {
      console.warn("applications load failed", error);
      setError((prev) => prev || "Tabel 'applications' ontbreekt nog of is nog niet toegankelijk. De basis van de tab werkt al; voer thuis de SQL-migratie uit om applicaties op te slaan.");
      setApplications([]);
    } else {
      setApplications(data || []);
    }
    setAppsLoading(false);
  }

  async function loadAssignments() {
    if (!client || !organization?.id || !supplier?.id) return;
    setAssignmentsLoading(true);
    setError("");
    const { data, error } = await client
      .from("functional_admin_assignments")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("supplier_id", supplier.id)
      .order("application_name", { ascending: true })
      .order("contact_name", { ascending: true });
    if (error) {
      console.warn("functional_admin_assignments load failed", error);
      setError((prev) => prev || "Tabel 'functional_admin_assignments' ontbreekt nog of is nog niet toegankelijk. Voer thuis de SQL-migratie uit om functioneel beheer op te slaan.");
      setAssignments([]);
    } else {
      setAssignments(sortAssignments(data || []));
    }
    setAssignmentsLoading(false);
  }

  useEffect(() => {
    loadApplications();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, supplier?.id]);

  function setAssignmentField(idx, key, value) {
    setAssignments((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  function addAssignment() {
    setAssignments((prev) => [
      emptyAssignment(organization?.id, supplier?.id, null),
      ...prev,
    ]);
  }

  function removeAssignment(row) {
    if (!row?.id) {
      setAssignments((prev) => prev.filter((x) => x !== row));
      return;
    }
    const ok = window.confirm(`Beheerrecord voor \"${row.contact_name || row.application_name || "deze regel"}\" verwijderen?`);
    if (!ok) return;
    client
      .from("functional_admin_assignments")
      .delete()
      .eq("id", row.id)
      .then(({ error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        setMessage("Beheerrecord verwijderd.");
        loadAssignments();
      });
  }

  async function saveAssignment(row) {
    setError("");
    setMessage("");
    if (!client) return;
    if (!row.application_name?.trim()) {
      setError("Applicatienaam is verplicht.");
      return;
    }
    if (!row.contact_name?.trim()) {
      setError("Naam van de functioneel beheerder is verplicht.");
      return;
    }

    const payload = {
      organization_id: organization.id,
      supplier_id: supplier.id,
      application_id: row.application_id || null,
      application_name: row.application_name.trim(),
      contact_name: row.contact_name.trim(),
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      role_title: row.role_title?.trim() || "Functioneel beheerder",
      notes: row.notes?.trim() || null,
      start_date: row.start_date || null,
      is_primary: !!row.is_primary,
      updated_at: new Date().toISOString(),
    };

    const query = row.id
      ? client.from("functional_admin_assignments").update(payload).eq("id", row.id)
      : client.from("functional_admin_assignments").insert(payload);

    const { error } = await query;
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Functioneel beheer opgeslagen.");
    await loadAssignments();
  }

  async function saveApplication() {
    setError("");
    setMessage("");
    if (!client) return;
    if (!newApp.name?.trim()) {
      setError("Applicatienaam is verplicht.");
      return;
    }

    const payload = {
      organization_id: organization.id,
      supplier_id: supplier.id,
      name: newApp.name.trim(),
      description: newApp.description?.trim() || null,
      is_active: newApp.is_active !== false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from("applications").insert(payload);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Applicatie opgeslagen.");
    setAppEditorOpen(false);
    setNewApp(emptyApp(organization?.id, supplier?.id));
    await loadApplications();
  }

  const applicationNames = useMemo(() => {
    const names = new Set();
    applications.forEach((a) => a?.name && names.add(a.name));
    assignments.forEach((a) => a?.application_name && names.add(a.application_name));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [applications, assignments]);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Applicaties &amp; functioneel beheer</h2>
          <p className="text-sm text-slate-600 mt-1">
            Leg vast voor welke applicaties deze leverancier functioneel beheer ondersteunt en wie binnen Gilde daarvoor het aanspreekpunt is.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => { setAppEditorOpen((v) => !v); setNewApp(emptyApp(organization?.id, supplier?.id)); }}>
            {appEditorOpen ? "Sluit applicatieformulier" : "+ Applicatie"}
          </button>
          <button className="btn btn-primary" onClick={addAssignment}>+ Functioneel beheer</button>
        </div>
      </div>

      {error ? <Notice title="Let op" tone="warning">{error}</Notice> : null}
      {message ? <Notice title="" tone="success">{message}</Notice> : null}

      {appEditorOpen ? (
        <div className="card p-4">
          <div className="font-semibold">Nieuwe applicatie</div>
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Applicatienaam *</label>
              <input className="w-full mt-1" value={newApp.name} onChange={(e) => setNewApp((p) => ({ ...p, name: e.target.value }))} placeholder="Bijv. Eduarte" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select className="w-full mt-1" value={newApp.is_active ? "actief" : "inactief"} onChange={(e) => setNewApp((p) => ({ ...p, is_active: e.target.value === "actief" }))}>
                <option value="actief">Actief</option>
                <option value="inactief">Inactief</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Omschrijving</label>
              <textarea className="w-full mt-1 min-h-[90px]" value={newApp.description} onChange={(e) => setNewApp((p) => ({ ...p, description: e.target.value }))} placeholder="Bijv. SIS, LMS of koppeling binnen het leveranciersdomein…" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={saveApplication}>Opslaan applicatie</button>
          </div>
        </div>
      ) : null}

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold">Applicaties</div>
          <span className="badge">{applications.length} vastgelegd</span>
        </div>
        {appsLoading ? <div className="mt-3 text-sm text-slate-600">Applicaties laden…</div> : null}
        {!appsLoading && applications.length === 0 ? (
          <Notice title="Nog geen applicaties">Voeg thuis applicaties toe zodra de tabel beschikbaar is. Je kunt functioneel beheer nu al voorbereiden met de applicatienaam.</Notice>
        ) : null}
        {applications.length > 0 ? (
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{app.name}</div>
                  <span className="badge">{app.is_active === false ? "inactief" : "actief"}</span>
                </div>
                {app.description ? <div className="mt-2 text-sm text-slate-600">{app.description}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold">Functioneel beheer</div>
          <span className="badge">{assignments.length} records</span>
        </div>
        {assignmentsLoading ? <div className="mt-3 text-sm text-slate-600">Functioneel beheer laden…</div> : null}
        {!assignmentsLoading && assignments.length === 0 ? (
          <Notice title="Nog geen functioneel beheer">Voeg één of meer functioneel beheerders toe voor applicaties van deze leverancier.</Notice>
        ) : null}

        <div className="mt-3 space-y-4">
          {assignments.map((row, idx) => (
            <div key={row.id || `new-assignment-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="font-semibold">{row.contact_name || row.application_name || `Beheerrecord ${idx + 1}`}</div>
                <button className="btn" onClick={() => removeAssignment(row)}>Verwijderen</button>
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Applicatie *</label>
                  <input
                    list={`application-options-${idx}`}
                    className="w-full mt-1"
                    value={row.application_name || ""}
                    onChange={(e) => setAssignmentField(idx, "application_name", e.target.value)}
                    placeholder="Bijv. Eduarte"
                  />
                  <datalist id={`application-options-${idx}`}>
                    {applicationNames.map((name) => <option key={name} value={name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Naam functioneel beheerder *</label>
                  <input className="w-full mt-1" value={row.contact_name || ""} onChange={(e) => setAssignmentField(idx, "contact_name", e.target.value)} placeholder="Bijv. Michel Lahaye" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Telefoon</label>
                  <input className="w-full mt-1" value={row.phone || ""} onChange={(e) => setAssignmentField(idx, "phone", e.target.value)} placeholder="+31 …" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">E-mail</label>
                  <input className="w-full mt-1" value={row.email || ""} onChange={(e) => setAssignmentField(idx, "email", e.target.value)} placeholder="naam@gildeopleidingen.nl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Rol</label>
                  <input className="w-full mt-1" value={row.role_title || ""} onChange={(e) => setAssignmentField(idx, "role_title", e.target.value)} placeholder="Functioneel beheerder" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Startdatum</label>
                  <input type="date" className="w-full mt-1" value={row.start_date || ""} onChange={(e) => setAssignmentField(idx, "start_date", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Notities</label>
                  <textarea className="w-full mt-1 min-h-[90px]" value={row.notes || ""} onChange={(e) => setAssignmentField(idx, "notes", e.target.value)} placeholder="Bijv. start 16 maart 2026, key-user, achtervang, bijzonderheden…" />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!row.is_primary} onChange={(e) => setAssignmentField(idx, "is_primary", e.target.checked)} />
                  Primair aanspreekpunt
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => saveAssignment(row)}>Opslaan</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
