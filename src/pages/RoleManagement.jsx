import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog, AlertTriangle, Sparkles, Lock, Eye, Pencil, Trash2 } from "lucide-react";
import Notice from "../components/Notice";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";

const ROLE_TEMPLATES = [
  {
    name: "Super Admin",
    description: "Volledig beheer van Governix, inclusief instellingen, rollen en gevoelige configuratie.",
    risk: "hoog",
    badge: "Volledig beheer",
    modules: ["Alle modules", "Gebruikersbeheer", "Instellingen", "RLS/Beheer"],
  },
  {
    name: "Organisatiebeheerder",
    description: "Beheert gebruikers, organisatie-instellingen, waardelijsten en kroonjuwelen binnen de eigen organisatie.",
    risk: "hoog",
    badge: "Beheer",
    modules: ["Gebruikers", "Instellingen", "Kroonjuwelen", "Waardelijsten"],
  },
  {
    name: "Contractmanager",
    description: "Beheert leveranciers, contracten, governance, risico's en leveranciersbeoordelingen.",
    risk: "middel",
    badge: "Contract & leveranciers",
    modules: ["Leveranciers", "Contracten", "Governance", "Beoordelingen"],
  },
  {
    name: "Functioneel Beheerder",
    description: "Beheert applicatie-informatie, vult governance aan en kan leveranciers beoordelen vanuit gebruikersperspectief.",
    risk: "middel",
    badge: "Applicaties & FB",
    modules: ["Applicaties", "Governance", "Beoordelingen", "Documenten"],
  },
  {
    name: "AI Manager",
    description: "Beheert AI-register, AI-risico's, DPIA-status, AI-governance en bijbehorende beheersmaatregelen.",
    risk: "middel",
    badge: "AI-governance",
    modules: ["AI-register", "Governance", "Risico", "Subverwerkers"],
  },
  {
    name: "Security Officer",
    description: "Bekijkt en beoordeelt security, privacy, continuïteit, risico's en AI-governance.",
    risk: "middel",
    badge: "Security & privacy",
    modules: ["Governance", "Risico", "AI-register", "Subverwerkers"],
  },
  {
    name: "Inkoper",
    description: "Bekijkt en beheert leveranciers- en contractinformatie vanuit inkoop- en contracteringsperspectief.",
    risk: "laag",
    badge: "Inkoop",
    modules: ["Leveranciers", "Contracten", "Rapportages"],
  },
  {
    name: "Viewer",
    description: "Alleen-lezen toegang tot dashboards, leveranciers, applicaties, governance en rapportages.",
    risk: "laag",
    badge: "Alleen lezen",
    modules: ["Dashboard", "Leveranciers", "Applicaties", "Wiki"],
  },
];

const ROLE_ORDER = ROLE_TEMPLATES.map((role) => role.name);

function roleWeight(role) {
  const idx = ROLE_ORDER.indexOf(role);
  return idx === -1 ? 999 : idx;
}

function RiskBadge({ risk }) {
  const cls =
    risk === "hoog"
      ? "border-red-200 bg-red-50 text-red-700"
      : risk === "middel"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${cls}`}>{risk}</span>;
}

function normalizeRoleName(value) {
  return String(value || "").trim();
}

export default function RoleManagement() {
  const client = supabase();
  const toast = useToast();
  const { profile, organization } = useApp();
  const orgId = organization?.id || profile?.organization_id || null;
  const isAdmin = profile?.role === "admin" || profile?.role === "Super Admin";

  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState(ROLE_TEMPLATES);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Viewer");
  const [showOnlyWithoutRole, setShowOnlyWithoutRole] = useState(false);

  async function loadAll() {
    if (!client || !orgId) return;
    setLoading(true);
    setError("");

    const [membershipResult, roleResult, assignmentResult] = await Promise.all([
      client
        .from("org_memberships")
        .select("id,user_id,organization_id,role,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true }),
      client.from("roles").select("name,description").order("name", { ascending: true }),
      client.from("user_roles").select("id,profile_id,role_name,created_at").order("created_at", { ascending: true }),
    ]);

    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setProfiles([]);
    } else {
      const memberships = membershipResult.data || [];
      const userIds = [...new Set(memberships.map((row) => row.user_id).filter(Boolean))];
      let profileRows = [];

      if (userIds.length > 0) {
        const profileLookup = await client
          .from("profiles")
          .select("id,full_name,role,wiki_role,created_at,updated_at")
          .in("id", userIds);

        if (profileLookup.error) {
          setError(profileLookup.error.message);
        } else {
          profileRows = profileLookup.data || [];
        }
      }

      const profileById = new Map(profileRows.map((row) => [row.id, row]));
      const mergedProfiles = memberships.map((membership) => {
        const p = profileById.get(membership.user_id) || {};
        return {
          id: membership.user_id,
          organization_id: membership.organization_id,
          full_name: p.full_name || null,
          role: p.role || null,
          wiki_role: p.wiki_role || null,
          membership_role: membership.role || null,
          membership_id: membership.id,
          membership_created_at: membership.created_at,
          created_at: p.created_at || membership.created_at,
          updated_at: p.updated_at || null,
        };
      });

      setProfiles(mergedProfiles.sort((a, b) => String(a.full_name || a.id).localeCompare(String(b.full_name || b.id), "nl")));
    }

    if (!roleResult.error && Array.isArray(roleResult.data) && roleResult.data.length > 0) {
      const byName = new Map(ROLE_TEMPLATES.map((role) => [role.name, role]));
      const merged = roleResult.data.map((role) => ({
        ...(byName.get(role.name) || {
          name: role.name,
          risk: "laag",
          badge: "Rol",
          modules: [],
        }),
        description: role.description || byName.get(role.name)?.description || "Geen omschrijving vastgelegd.",
      }));
      setRoles(merged.sort((a, b) => roleWeight(a.name) - roleWeight(b.name)));
    } else {
      setRoles(ROLE_TEMPLATES);
    }

    if (assignmentResult.error) {
      setError((prev) => prev || assignmentResult.error.message);
      setAssignments([]);
    } else {
      setAssignments(assignmentResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const assignmentsByProfile = useMemo(() => {
    const map = new Map();
    for (const assignment of assignments) {
      if (!map.has(assignment.profile_id)) map.set(assignment.profile_id, []);
      map.get(assignment.profile_id).push(assignment);
    }
    return map;
  }, [assignments]);

  const profilesWithRoles = useMemo(() => {
    return profiles.map((item) => {
      const rows = assignmentsByProfile.get(item.id) || [];
      const roleNames = rows.map((row) => row.role_name).filter(Boolean).sort((a, b) => roleWeight(a) - roleWeight(b));
      const fallbackRole = item.role ? [item.role === "admin" ? "Super Admin" : item.role] : [];
      return {
        ...item,
        roleNames: roleNames.length ? roleNames : fallbackRole,
        assignmentRows: rows,
      };
    });
  }, [profiles, assignmentsByProfile]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profilesWithRoles.filter((item) => {
      const haystack = [item.full_name, item.id, item.role, item.membership_role, item.wiki_role, ...(item.roleNames || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (showOnlyWithoutRole && (item.assignmentRows || []).length > 0) return false;
      return true;
    });
  }, [profilesWithRoles, search, showOnlyWithoutRole]);

  const selectedProfile = profiles.find((item) => item.id === selectedProfileId) || null;
  const selectedExistingRoles = new Set((assignmentsByProfile.get(selectedProfileId) || []).map((row) => row.role_name));

  async function addRole(profileId = selectedProfileId, roleName = selectedRole) {
    const cleanRole = normalizeRoleName(roleName);
    if (!client || !profileId || !cleanRole) return;
    const template = roles.find((role) => role.name === cleanRole);
    if (template?.risk === "hoog") {
      const ok = window.confirm(`Je kent de risicovolle rol "${cleanRole}" toe. Weet je dit zeker?`);
      if (!ok) return;
    }

    const result = await client.from("user_roles").insert({ profile_id: profileId, role_name: cleanRole });
    if (result.error) {
      if (String(result.error.message || "").toLowerCase().includes("duplicate")) {
        toast.info("Deze gebruiker heeft deze rol al.");
      } else {
        toast.error(`Rol toekennen mislukt: ${result.error.message}`);
      }
    } else {
      toast.success("Rol toegekend.");
      await loadAll();
    }
  }

  async function removeRole(assignment) {
    if (!client || !assignment?.id) return;
    const roleName = assignment.role_name || "deze rol";
    const ok = roleName === "Super Admin" ? window.confirm("Je verwijdert Super Admin. Weet je dit zeker?") : true;
    if (!ok) return;
    const result = await client.from("user_roles").delete().eq("id", assignment.id);
    if (result.error) {
      toast.error(`Rol verwijderen mislukt: ${result.error.message}`);
    } else {
      toast.success("Rol verwijderd.");
      await loadAll();
    }
  }

  async function assignTemplate(profileId, templateName) {
    const templateRoles = {
      "Contractmanager": ["Contractmanager"],
      "Functioneel Beheerder": ["Functioneel Beheerder"],
      "AI Manager": ["AI Manager"],
      "Security Officer": ["Security Officer"],
      "Viewer": ["Viewer"],
      "Super Admin": ["Super Admin", "Contractmanager"],
    }[templateName] || [templateName];

    for (const roleName of templateRoles) {
      const exists = (assignmentsByProfile.get(profileId) || []).some((row) => row.role_name === roleName);
      if (!exists) {
        const result = await client.from("user_roles").insert({ profile_id: profileId, role_name: roleName });
        if (result.error && !String(result.error.message || "").toLowerCase().includes("duplicate")) {
          toast.error(`Roltemplate mislukt: ${result.error.message}`);
          await loadAll();
          return;
        }
      }
    }
    toast.success("Roltemplate toegepast.");
    await loadAll();
  }

  const stats = useMemo(() => {
    const total = profiles.length;
    const withRole = profilesWithRoles.filter((p) => (p.assignmentRows || []).length > 0).length;
    const superAdmins = assignments.filter((a) => a.role_name === "Super Admin").length;
    const viewers = assignments.filter((a) => a.role_name === "Viewer").length;
    return { total, withRole, withoutRole: Math.max(total - withRole, 0), superAdmins, viewers };
  }, [profiles, profilesWithRoles, assignments]);

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Rollenbeheer</h1>
          <Notice title="Alleen beschikbaar voor admins">
            Rollenbeheer is alleen zichtbaar voor organisatiebeheerders of Super Admins. Hiermee voorkomen we dat gebruikers zichzelf of anderen extra rechten kunnen geven.
          </Notice>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="badge mb-3">v0.9.71 RBAC Foundation</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Rollenbeheer</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              Beheer wie welke rol krijgt binnen Governix. Deze release legt het fundament voor echte rolgebaseerde toegang. Menu-filtering en RLS-koppeling volgen gefaseerd, zodat we veilig kunnen testen zonder bestaande modules te breken.
            </p>
          </div>
          <button className="btn" onClick={loadAll}>Vernieuwen</button>
        </div>
      </div>

      {error ? (
        <Notice title="Rollenbeheer nog niet volledig beschikbaar">
          {error}. Controleer of de SQL-migratie voor <span className="font-mono">roles</span>, <span className="font-mono">user_roles</span> en permissies is uitgevoerd.
        </Notice>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><UserCog size={18} /> Gebruikers</div>
          <div className="mt-2 text-3xl font-black">{stats.total}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><ShieldCheck size={18} /> Met rol</div>
          <div className="mt-2 text-3xl font-black">{stats.withRole}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><AlertTriangle size={18} /> Zonder rol</div>
          <div className="mt-2 text-3xl font-black">{stats.withoutRole}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Lock size={18} /> Super Admin</div>
          <div className="mt-2 text-3xl font-black">{stats.superAdmins}</div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Slim toewijzen</h2>
            <p className="mt-1 text-sm text-slate-700">Kies een gebruiker en wijs één rol toe. Gebruik roltemplates voor veelgebruikte profielen.</p>
          </div>
          <div className="badge"><Sparkles size={14} /> Role templates</div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
          <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
            <option value="">Selecteer gebruiker</option>
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>{item.full_name || `Gebruiker ${item.id.slice(0, 8)}`}</option>
            ))}
          </select>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!selectedProfileId || selectedExistingRoles.has(selectedRole)} onClick={() => addRole()}>Rol toevoegen</button>
        </div>
        {selectedProfile ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-slate-600">Templates voor {selectedProfile.full_name || selectedProfile.id.slice(0, 8)}:</span>
            {["Viewer", "Functioneel Beheerder", "Contractmanager", "AI Manager", "Security Officer", "Super Admin"].map((template) => (
              <button key={template} className="btn btn-sm" onClick={() => assignTemplate(selectedProfile.id, template)}>{template}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Rollenbibliotheek</h2>
          <p className="mt-1 text-sm text-slate-700">Gebruik deze standaardrollen als startpunt. Later koppelen we hier modulepermissies en RLS-policies aan.</p>
          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <div key={role.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{role.name}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">{role.description}</div>
                  </div>
                  <RiskBadge risk={role.risk || "laag"} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(role.modules || []).slice(0, 4).map((mod) => <span key={mod} className="badge">{mod}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Gebruikers en rollen</h2>
              <p className="mt-1 text-sm text-slate-700">Zoek gebruikers, bekijk bestaande rollen en verwijder rollen waar nodig.</p>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={showOnlyWithoutRole} onChange={(e) => setShowOnlyWithoutRole(e.target.checked)} /> Alleen zonder rol
            </label>
          </div>
          <div className="mt-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op naam, rol of ID" className="w-full" />
          </div>

          <div className="mt-4 space-y-3">
            {loading ? <div className="text-sm text-slate-600">Rollen laden…</div> : null}
            {!loading && filteredProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Geen gebruikers gevonden.</div>
            ) : null}
            {filteredProfiles.map((item) => {
              const rows = item.assignmentRows || [];
              return (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold">{item.full_name || "Naam nog niet ingevuld"}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{item.id}</div>
                      {item.membership_role ? <div className="mt-2 text-xs text-slate-500">Organisatierol: <span className="badge">{item.membership_role}</span></div> : null}
                      {item.role ? <div className="mt-2 text-xs text-slate-500">Legacy profile role: <span className="badge">{item.role}</span></div> : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rows.length === 0 ? <span className="badge border-amber-200 bg-amber-50 text-amber-700">Geen RBAC-rol</span> : null}
                      {rows.map((row) => (
                        <span key={row.id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-900">
                          {row.role_name}
                          <button title="Rol verwijderen" onClick={() => removeRole(row)} className="ml-1 rounded-full px-1 hover:bg-blue-100">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Viewer", "Functioneel Beheerder", "Contractmanager", "AI Manager"].map((roleName) => (
                      <button key={roleName} className="btn btn-sm" onClick={() => addRole(item.id, roleName)}>{roleName}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Volgende security-stap</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Eye className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">v0.9.72 Menu-filtering</div>
            <p className="mt-1 text-sm text-slate-600">Menu's en acties tonen op basis van rollen.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Pencil className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">v0.9.73 Actierechten</div>
            <p className="mt-1 text-sm text-slate-600">Opslaan, wijzigen en verwijderen blokkeren in de frontend.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Trash2 className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">v0.9.74 RLS hardening</div>
            <p className="mt-1 text-sm text-slate-600">Database dwingt rechten af, ook buiten de frontend om.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
