import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase as getSupabase, resetSupabaseClient } from "../lib/supabase";
import { getRuntimeConfig } from "../lib/runtimeConfig";

const AppCtx = createContext(null);

function normalizeRole(role) {
  return String(role || "").trim();
}

function roleIsAdmin(role) {
  const value = normalizeRole(role).toLowerCase();
  return ["admin", "super admin", "organisatiebeheerder"].includes(value);
}

function permissionsToSet(rows = []) {
  return new Set((rows || []).filter((row) => row?.can_view !== false).map((row) => row.module_key).filter(Boolean));
}

function fallbackModulesForRoles(roles = [], legacyRole = "") {
  const normalized = new Set([...(roles || []), legacyRole].map((role) => normalizeRole(role).toLowerCase()).filter(Boolean));
  const allModules = [
    "home",
    "dashboard",
    "suppliers",
    "contracts_workspace",
    "contracts_new",
    "applications",
    "assets",
    "facility_workspace",
    "warranties",
    "governance",
    "ai_governance",
    "status",
    "architecture",
    "kroonjuwelen",
    "wiki",
    "handleiding",
    "settings_roles",
    "settings",
    "communications",
    "admin_orgs",
    "onboarding",
  ];

  if ([...normalized].some(roleIsAdmin)) return new Set(allModules);

  const modules = new Set(["home", "dashboard", "wiki", "handleiding"]);

  if (normalized.has("viewer") || normalized.has("member")) {
    ["suppliers", "applications", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("contractmanager lijn")) {
    ["contracts_workspace", "contracts_new", "suppliers", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("contractmanager")) {
    ["suppliers", "contracts_workspace", "contracts_new", "governance", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("inkoper")) {
    ["suppliers", "contracts_workspace", "contracts_new", "governance", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("functioneel beheerder")) {
    ["applications", "suppliers", "governance", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("ai manager")) {
    ["ai_governance", "suppliers", "governance", "status"].forEach((module) => modules.add(module));
  }
  if (normalized.has("security officer") || normalized.has("privacy officer") || normalized.has("architect")) {
    ["governance", "ai_governance", "architecture", "applications", "status"].forEach((module) => modules.add(module));
  }

  return modules;
}

export function AppStateProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [modulePermissions, setModulePermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const sb = getSupabase();

  function clearAuthAndState(reason) {
    try {
      window?.localStorage?.removeItem("VENDORSPRO_ORG_ID");
      window?.localStorage?.removeItem("governix-auth");
    } catch {
      // ignore
    }

    try {
      resetSupabaseClient();
    } catch {
      // ignore
    }

    setSession(null);
    setProfile(null);
    setOrganization(null);
    setUserRoles([]);
    setModulePermissions([]);

    try {
      const path = window?.location?.pathname || "";
      if (!path.startsWith("/login")) {
        window.location.href = `/login?reason=${encodeURIComponent(reason || "session")}`;
      }
    } catch {
      // ignore
    }
  }

  async function loadProfile(client, userId) {
    if (!client || !userId) return null;
    const { data, error } = await client
      .from("profiles")
      .select("id, organization_id, role, full_name, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Failed to load profile", error);
      return null;
    }
    return data || null;
  }

  async function loadRolesAndModules(client, userId, legacyRole) {
    if (!client || !userId) {
      setUserRoles([]);
      setModulePermissions([]);
      return;
    }

    let roles = [];
    const roleResult = await client
      .from("user_roles")
      .select("role_name")
      .eq("profile_id", userId);

    if (!roleResult.error) {
      roles = (roleResult.data || []).map((row) => row.role_name).filter(Boolean);
    }

    if (legacyRole && !roles.includes(legacyRole)) roles.push(legacyRole);
    if (legacyRole === "admin" && !roles.includes("Super Admin")) roles.push("Super Admin");

    let permissionRows = [];
    const permissionResult = await client
      .from("v_user_module_permissions")
      .select("module_key, can_view, can_create, can_edit, can_delete, can_approve, can_admin")
      .eq("profile_id", userId);

    if (!permissionResult.error) {
      permissionRows = permissionResult.data || [];
    } else {
      const fallback = fallbackModulesForRoles(roles, legacyRole);
      permissionRows = [...fallback].map((module_key) => ({
        module_key,
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_approve: false,
        can_admin: false,
      }));
    }

    setUserRoles([...new Set(roles.filter(Boolean))]);
    setModulePermissions(permissionRows);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const cfg = getRuntimeConfig();
      if (!cfg.url || !cfg.anonKey) {
        setSession(null);
        setProfile(null);
        setOrganization(null);
        setUserRoles([]);
        setModulePermissions([]);
        setLoading(false);
        return;
      }

      const client = getSupabase();
      if (!client) {
        setLoading(false);
        return;
      }

      const { data, error: sessionErr } = await client.auth.getSession();
      if (sessionErr) {
        clearAuthAndState(sessionErr?.message || "refresh_token");
        setLoading(false);
        return;
      }
      if (cancelled) return;

      setSession(data.session ?? null);

      const { data: listener } = client.auth.onAuthStateChange((event, s) => {
        try {
          if (event === "TOKEN_REFRESH_FAILED") {
            clearAuthAndState("token_refresh_failed");
            return;
          }

          if (event === "SIGNED_OUT") {
            setProfile(null);
            setOrganization(null);
            setUserRoles([]);
            setModulePermissions([]);
            window.localStorage.removeItem("VENDORSPRO_ORG_ID");
          }

          setSession(s);

          if (s?.user?.id) {
            loadProfile(client, s.user.id).then((p) => {
              if (!cancelled) {
                setProfile(p);
                loadRolesAndModules(client, s.user.id, p?.role);
              }
            });
          } else {
            setProfile(null);
            setUserRoles([]);
            setModulePermissions([]);
          }
        } catch (e) {
          clearAuthAndState(e?.message || "auth_listener");
        }
      });

      if (data.session) {
        const prof = await loadProfile(client, data.session.user.id);
        if (!cancelled) setProfile(prof);

        let orgId = prof?.organization_id || null;
        let legacyRole = prof?.role || null;

        if (!orgId) {
          const { data: membership } = await client
            .from("org_memberships")
            .select("organization_id, role")
            .eq("user_id", data.session.user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (membership?.organization_id) {
            orgId = membership.organization_id;
            legacyRole = legacyRole || membership.role || "member";
            if (!cancelled) {
              setProfile((prev) => ({
                ...(prev || { id: data.session.user.id }),
                organization_id: membership.organization_id,
                role: legacyRole,
                full_name: prev?.full_name || null,
                display_name: prev?.display_name || prev?.full_name || null,
              }));
            }
          }
        }

        await loadRolesAndModules(client, data.session.user.id, legacyRole);

        if (orgId) {
          const { data: org, error: orgErr } = await client
            .from("organizations")
            .select("id,name,slug")
            .eq("id", orgId)
            .maybeSingle();

          if (!orgErr && org) {
            setOrganization(org);
            window.localStorage.setItem("VENDORSPRO_ORG_ID", org.id);
          } else {
            window.localStorage.removeItem("VENDORSPRO_ORG_ID");
            setOrganization(null);
          }
        } else {
          window.localStorage.removeItem("VENDORSPRO_ORG_ID");
          setOrganization(null);
        }
      }

      setLoading(false);
      return () => listener?.subscription?.unsubscribe();
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [sb?.auth]);

  function setOrg(org) {
    setOrganization(org);
    if (org?.id) window.localStorage.setItem("VENDORSPRO_ORG_ID", org.id);
    else window.localStorage.removeItem("VENDORSPRO_ORG_ID");
  }

  async function signOut() {
    const client = getSupabase();
    if (!client) return;
    await client.auth.signOut();
    setOrg(null);
  }

  function hardResetClient() {
    resetSupabaseClient();
    window.location.reload();
  }

  const moduleAccess = useMemo(() => permissionsToSet(modulePermissions), [modulePermissions]);
  const rolesNormalized = useMemo(() => new Set(userRoles.map((role) => normalizeRole(role).toLowerCase())), [userRoles]);
  const isSuperAdmin = [...rolesNormalized].some(roleIsAdmin) || profile?.role === "admin";

  function hasRole(roleName) {
    return rolesNormalized.has(normalizeRole(roleName).toLowerCase());
  }

  function canAccessModule(moduleKey) {
    if (!moduleKey) return true;
    if (isSuperAdmin) return true;
    return moduleAccess.has(moduleKey);
  }

  function getModulePermission(moduleKey) {
    if (isSuperAdmin) {
      return {
        module_key: moduleKey,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_approve: true,
        can_admin: true,
      };
    }
    return modulePermissions.find((permission) => permission.module_key === moduleKey) || null;
  }

  const value = useMemo(
    () => ({
      session,
      profile,
      organization,
      userRoles,
      modulePermissions,
      canAccessModule,
      getModulePermission,
      hasRole,
      isSuperAdmin,
      setOrg,
      loading,
      signOut,
      hardResetClient,
    }),
    [session, profile, organization, userRoles, modulePermissions, isSuperAdmin, loading]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used within AppStateProvider");
  return v;
}
