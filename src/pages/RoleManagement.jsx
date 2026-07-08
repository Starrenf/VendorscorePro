import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog, AlertTriangle, Sparkles, Lock, Eye, Pencil, Trash2, Boxes, Settings2 } from "lucide-react";
import Notice from "../components/Notice";
import { useApp } from "../state/AppState";
import { useToast } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";

const FALLBACK_ROLES = [
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
    name: "Inkoper",
    description: "Beheert inkoopintake, integrale toetsing, aanbestedingsvoorbereiding en inkooprapportages.",
    risk: "middel",
    badge: "Inkoop",
    modules: ["Inkoop Intake", "Leveranciers", "Contracten", "Rapportages"],
  },
  {
    name: "Contractmanager",
    description: "Beheert leveranciers, contracten, governance, risico's en leveranciersbeoordelingen.",
    risk: "middel",
    badge: "Contract & leveranciers",
    modules: ["Leveranciers", "Contracten", "Governance", "Beoordelingen"],
  },
  {
    name: "Contractmanager Lijn",
    description: "Beperkte rol voor contractverantwoordelijken in de lijn. Kan eigen contracten registreren, documenten koppelen en jaarlijkse reviews afronden.",
    risk: "laag",
    badge: "Lijncontracten",
    modules: ["Contract Workspace", "Mijn contracten", "Reviews", "Leveranciers lezen"],
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
    description: "Beoordeelt informatiebeveiliging, continuïteit, risico's en security-documentatie.",
    risk: "middel",
    badge: "Security",
    modules: ["Governance", "Risico", "AI-register", "Integrale toetsing"],
  },
  {
    name: "Privacy Officer",
    description: "Beoordeelt AVG, DPIA, verwerkersovereenkomsten, subverwerkers en privacyrisico's.",
    risk: "middel",
    badge: "Privacy",
    modules: ["Governance", "Integrale toetsing", "Documenten"],
  },
  {
    name: "Architect",
    description: "Beoordeelt architectuur, koppelingen, SSO, lifecycle en aansluiting op het applicatielandschap.",
    risk: "middel",
    badge: "Architectuur",
    modules: ["Architectuur", "Applicaties", "Integrale toetsing"],
  },
  {
    name: "Viewer",
    description: "Alleen-lezen toegang tot dashboards, leveranciers, applicaties, governance en rapportages.",
    risk: "laag",
    badge: "Alleen lezen",
    modules: ["Dashboard", "Leveranciers", "Applicaties", "Wiki"],
  },
];

const FALLBACK_MODULES = [
  { module_key: "home", name: "Home", category: "Start" },
  { module_key: "dashboard", name: "Dashboard", category: "Start" },
  { module_key: "suppliers", name: "Leveranciers", category: "Werkgebieden" },
  { module_key: "contracts_workspace", name: "Contract Workspace", category: "Werkgebieden" },
  { module_key: "contracts_new", name: "Nieuw contract", category: "Werkgebieden" },
  { module_key: "applications", name: "Applicaties", category: "Werkgebieden" },
  { module_key: "assets", name: "Gebouwen & Assets", category: "Werkgebieden" },
  { module_key: "governance", name: "Governance", category: "Werkgebieden" },
  { module_key: "ai_governance", name: "AI Governance", category: "Werkgebieden" },
  { module_key: "status", name: "Statuspagina", category: "Risico & inzicht" },
  { module_key: "architecture", name: "Architectuur", category: "Risico & inzicht" },
  { module_key: "kroonjuwelen", name: "Kroonjuwelen", category: "Risico & inzicht" },
  { module_key: "wiki", name: "Wiki", category: "Risico & inzicht" },
  { module_key: "handleiding", name: "Handleiding", category: "Risico & inzicht" },
  { module_key: "settings_roles", name: "Rollenbeheer", category: "Beheer" },
  { module_key: "settings", name: "Waardelijsten", category: "Beheer" },
  { module_key: "communications", name: "Communicatie", category: "Beheer" },
  { module_key: "admin_orgs", name: "Organisaties", category: "Beheer" },
];

const ROLE_ORDER = FALLBACK_ROLES.map((role) => role.name);
const QUICK_TEMPLATE_NAMES = ["Viewer", "Contractmanager Lijn", "Inkoper", "Contractmanager", "Functioneel Beheerder", "AI Manager", "Security Officer", "Privacy Officer", "Architect", "Super Admin"];

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
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${cls}`}>{risk || "laag"}</span>;
}

function normalizeRoleName(value) {
  return String(value || "").trim();
}

function moduleLabel(module) {
  return module?.name || module?.module_key || "Module";
}

export default function RoleManagement() {
  const client = supabase();
  const toast = useToast();
  const { profile, organization, isSuperAdmin } = useApp();
  const orgId = organization?.id || profile?.organization_id || null;
  const isAdmin = Boolean(isSuperAdmin || profile?.role === "admin" || profile?.role === "Super Admin");

  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  const [assignments, setAssignments] = useState([]);
  const [modules, setModules] = useState(FALLBACK_MODULES);
  const [modulePermissions, setModulePermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Viewer");
  const [selectedRoleForModules, setSelectedRoleForModules] = useState("Contractmanager Lijn");
  const [showOnlyWithoutRole, setShowOnlyWithoutRole] = useState(false);

  async function loadAll() {
    if (!client || !orgId) return;
    setLoading(true);
    setError("");

    const [membershipResult, roleResult, assignmentResult, moduleResult, permissionResult] = await Promise.all([
      client
        .from("org_memberships")
        .select("id,user_id,organization_id,role,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true }),
      client.from("roles").select("name,description,risk,badge").order("name", { ascending: true }),
      client.from("user_roles").select("id,profile_id,role_name,created_at").order("created_at", { ascending: true }),
      client.from("governix_modules").select("module_key,name,description,category,route,is_active,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
      client.from("role_module_permissions").select("role_name,module_key,can_view,can_create,can_edit,can_delete,can_approve,can_admin"),
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
          .select("id,full_name,display_name,role,wiki_role,created_at,updated_at")
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
          full_name: p.display_name || p.full_name || null,
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

    const fallbackByName = new Map(FALLBACK_ROLES.map((role) => [role.name, role]));
    if (!roleResult.error && Array.isArray(roleResult.data) && roleResult.data.length > 0) {
      const merged = roleResult.data.map((role) => ({
        ...(fallbackByName.get(role.name) || {
          name: role.name,
          risk: role.risk || "laag",
          badge: role.badge || "Rol",
          modules: [],
        }),
        description: role.description || fallbackByName.get(role.name)?.description || "Geen omschrijving vastgelegd.",
        risk: role.risk || fallbackByName.get(role.name)?.risk || "laag",
        badge: role.badge || fallbackByName.get(role.name)?.badge || "Rol",
      }));
      setRoles(merged.sort((a, b) => roleWeight(a.name) - roleWeight(b.name) || a.name.localeCompare(b.name, "nl")));
      if (!merged.some((role) => role.name === selectedRole)) setSelectedRole(merged[0]?.name || "Viewer");
    } else {
      setRoles(FALLBACK_ROLES);
    }

    if (assignmentResult.error) {
      setError((prev) => prev || assignmentResult.error.message);
      setAssignments([]);
    } else {
      setAssignments(assignmentResult.data || []);
    }

    if (!moduleResult.error && Array.isArray(moduleResult.data) && moduleResult.data.length > 0) {
      setModules(moduleResult.data);
    } else {
      setModules(FALLBACK_MODULES);
      if (moduleResult.error) setError((prev) => prev || `Modules nog niet beschikbaar: ${moduleResult.error.message}`);
    }

    if (!permissionResult.error) {
      setModulePermissions(permissionResult.data || []);
    } else {
      setModulePermissions([]);
      setError((prev) => prev || `Modulepermissies nog niet beschikbaar: ${permissionResult.error.message}`);
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

  const permissionsByRole = useMemo(() => {
    const map = new Map();
    for (const permission of modulePermissions) {
      const key = permission.role_name;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key).set(permission.module_key, permission);
    }
    return map;
  }, [modulePermissions]);

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
  const selectedModulePermissions = permissionsByRole.get(selectedRoleForModules) || new Map();

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
      "Super Admin": ["Super Admin", "Contractmanager"],
      "Organisatiebeheerder": ["Organisatiebeheerder"],
      "Inkoper": ["Inkoper"],
      "Contractmanager": ["Contractmanager"],
      "Contractmanager Lijn": ["Contractmanager Lijn"],
      "Functioneel Beheerder": ["Functioneel Beheerder"],
      "AI Manager": ["AI Manager"],
      "Security Officer": ["Security Officer"],
      "Privacy Officer": ["Privacy Officer"],
      "Architect": ["Architect"],
      "Viewer": ["Viewer"],
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

  async function toggleModule(roleName, moduleKey, checked) {
    if (!client || !roleName || !moduleKey) return;
    const existing = permissionsByRole.get(roleName)?.get(moduleKey);

    if (checked) {
      const result = await client.from("role_module_permissions").upsert(
        {
          role_name: roleName,
          module_key: moduleKey,
          can_view: true,
        },
        { onConflict: "role_name,module_key" },
      );
      if (result.error) toast.error(`Module toevoegen mislukt: ${result.error.message}`);
      else toast.success("Module gekoppeld aan rol.");
    } else if (existing) {
      const result = await client
        .from("role_module_permissions")
        .delete()
        .eq("role_name", roleName)
        .eq("module_key", moduleKey);
      if (result.error) toast.error(`Module verwijderen mislukt: ${result.error.message}`);
      else toast.success("Module verwijderd van rol.");
    }

    await loadAll();
  }

  const stats = useMemo(() => {
    const total = profiles.length;
    const withRole = profilesWithRoles.filter((p) => (p.assignmentRows || []).length > 0).length;
    const superAdmins = assignments.filter((a) => a.role_name === "Super Admin").length;
    return { total, withRole, withoutRole: Math.max(total - withRole, 0), superAdmins, roles: roles.length, modules: modules.length };
  }, [profiles, profilesWithRoles, assignments, roles, modules]);

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Rollenbeheer</h1>
          <Notice title="Alleen beschikbaar voor admins">
            Rollenbeheer is alleen zichtbaar voor organisatiebeheerders of Super Admins.
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
            <div className="badge mb-3">v4.1 Modular RBAC Foundation</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Rollenbeheer</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              Beheer rollen, gebruikers en moduletoegang centraal. Het menu en toekomstige workflows kijken naar dezelfde modulepermissies.
            </p>
          </div>
          <button className="btn" onClick={loadAll}>Vernieuwen</button>
        </div>
      </div>

      {error ? (
        <Notice title="Rollenbeheer gedeeltelijk beschikbaar">
          {error}. Draai de migratie <span className="font-mono">v4.1.0_modular_rbac_foundation.sql</span> om rollen, modules en permissies volledig te activeren.
        </Notice>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
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
          <div className="flex items-center gap-2 text-slate-500"><Boxes size={18} /> Rollen</div>
          <div className="mt-2 text-3xl font-black">{stats.roles}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-500"><Settings2 size={18} /> Modules</div>
          <div className="mt-2 text-3xl font-black">{stats.modules}</div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Slim toewijzen</h2>
            <p className="mt-1 text-sm text-slate-700">Kies een gebruiker en wijs één rol toe. De dropdown komt voortaan uit de rollentabel.</p>
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
            {QUICK_TEMPLATE_NAMES.filter((name) => roles.some((role) => role.name === name)).map((template) => (
              <button key={template} className="btn btn-sm" onClick={() => assignTemplate(selectedProfile.id, template)}>{template}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Rollenbibliotheek</h2>
          <p className="mt-1 text-sm text-slate-700">Standaardrollen met moduleprofiel. Modules zijn voortaan configureerbaar.</p>
          <div className="mt-4 space-y-3">
            {roles.map((role) => (
              <button key={role.name} type="button" onClick={() => setSelectedRoleForModules(role.name)} className={`w-full rounded-2xl border p-3 text-left ${selectedRoleForModules === role.name ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
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
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Modules per rol</h2>
                <p className="mt-1 text-sm text-slate-700">Koppel modules aan de geselecteerde rol. Het zijmenu gebruikt deze rechten direct na opnieuw inloggen/verversen.</p>
              </div>
              <select value={selectedRoleForModules} onChange={(e) => setSelectedRoleForModules(e.target.value)} className="max-w-xs">
                {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
              </select>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {modules.map((module) => {
                const permission = selectedModulePermissions.get(module.module_key);
                const checked = Boolean(permission?.can_view);
                return (
                  <label key={module.module_key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <input type="checkbox" checked={checked} onChange={(e) => toggleModule(selectedRoleForModules, module.module_key, e.target.checked)} />
                    <span>
                      <span className="font-bold">{moduleLabel(module)}</span>
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{module.category || "Module"}</span>
                      <span className="mt-1 block text-xs text-slate-500">{module.description || module.route || module.module_key}</span>
                    </span>
                  </label>
                );
              })}
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
                      {roles.slice(0, 8).map((role) => (
                        <button key={role.name} className="btn btn-sm" disabled={rows.some((row) => row.role_name === role.name)} onClick={() => addRole(item.id, role.name)}>{role.name}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Security-roadmap</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Eye className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">Module-filtering actief</div>
            <p className="mt-1 text-sm text-slate-600">Het menu kijkt naar rol-modulepermissies.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Pencil className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">Actierechten</div>
            <p className="mt-1 text-sm text-slate-600">Volgende stap: knoppen en acties blokkeren op create/edit/approve.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Trash2 className="mb-2 text-slate-500" size={20} />
            <div className="font-bold">RLS hardening</div>
            <p className="mt-1 text-sm text-slate-600">Daarna dwingt de database dezelfde rechten af.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
