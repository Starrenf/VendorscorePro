import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { ToastProvider } from "./ToastProvider";
import { useApp } from "../state/AppState";
import {
  Home,
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Brain,
  BookOpen,
  LogOut,
  UserRound,
  UserCog,
  SlidersHorizontal,
  FileQuestion,
  Settings as SettingsIcon,
  Building,
  ClipboardList,
  Layers3,
  MonitorUp,
  Megaphone,
  Search,
  Bell,
  HelpCircle,
  MessageSquare,
  Users,
  FileText,
  Box,
  Wrench,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

function GovernixLogo({ compact = false }) {
  return (
    <Link
      to="/dashboard"
      className="gx-brand no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"
      aria-label="Governix dashboard"
    >
      <img src="/governix-icon.svg" alt="" className="gx-brand-icon" />
      {!compact ? (
        <div className="min-w-0">
          <div className="gx-brand-title">Governix</div>
          <div className="gx-brand-subtitle">Integrated Governance Platform</div>
        </div>
      ) : null}
    </Link>
  );
}

function NavItem({ item, collapsed, onClick }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={
        "gx-nav-item no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70 " +
        (item.active ? "gx-nav-item-active" : "")
      }
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={item.active ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const pathname = location.pathname;
  const nav = useNavigate();
  const {
    session,
    organization,
    signOut,
    loading,
    profile,
    userRoles = [],
    canAccessModule = () => true,
    isSuperAdmin = false,
  } = useApp();
  const isAdmin = Boolean(isSuperAdmin || profile?.role === "admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [presentationMode, setPresentationMode] = useState(() => {
    try {
      return window.localStorage.getItem("GOVERNIX_PRESENTATION_MODE") === "true";
    } catch {
      return false;
    }
  });

  const orgLabel = organization?.display_name || organization?.name || (profile?.organization_id ? "Gilde Opleidingen" : "Geen organisatie");
  const displayName = profile?.display_name || profile?.full_name || session?.user?.email?.split("@")[0] || "Gebruiker";
  const primaryRole = isAdmin ? "Beheerder" : userRoles?.[0] || profile?.role || "Gebruiker";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";

  const menuGroups = useMemo(() => {
    const item = (to, label, icon, moduleKey, adminOnly = false) => ({
      to,
      label,
      icon,
      moduleKey,
      adminOnly,
      active: pathname === to || (to !== "/" && pathname.startsWith(`${to}/`)),
    });

    const groups = [
      {
        label: "Start",
        items: [
          item("/dashboard", "Dashboard", LayoutDashboard, "dashboard"),
          item("/", "Startpagina", Home, "home"),
        ],
      },
      {
        label: "Beheren",
        items: [
          item("/suppliers", "Leveranciers", Users, "suppliers"),
          item("/contracts/workspace", "Contracten", FileText, "contracts_workspace"),
          item("/landschap", "Applicaties", Layers3, "applications"),
          item("/assets", "Gebouwen & assets", Building, "assets"),
          item("/ai-register", "AI-register", Brain, "ai_governance"),
        ],
      },
      {
        label: "Controleren",
        items: [
          item("/status", "Aandacht & status", ClipboardList, "status"),
          item("/methodiek", "Governance", ShieldCheck, "governance"),
          item("/kroonjuwelen", "Kroonjuwelen", ShieldCheck, "kroonjuwelen"),
          item("/architecture", "Architectuur", BarChart3, "architecture"),
        ],
      },
      {
        label: "Analyseren",
        items: [
          item("/insights", "Inzichten & rapportages", Sparkles, "insights"),
        ],
      },
      {
        label: "Kennis & hulp",
        items: [
          item("/wiki", "Wiki", BookOpen, "wiki"),
          item("/handleiding", "Handleiding", FileQuestion, "handleiding"),
          item("/over", "Over Governix", HelpCircle, "about"),
        ],
      },
      {
        label: "Beheer",
        items: [
          item("/settings/communications", "Communicatie", Megaphone, "communications", true),
          item("/settings/roles", "Rollen & rechten", UserCog, "settings_roles", true),
          item("/settings", "Waardelijsten", SlidersHorizontal, "settings", true),
          item("/admin/orgs", "Organisaties", SettingsIcon, "admin_orgs", true),
          item("/wiki/admin", "Wiki-beheer", BookOpen, "wiki_admin", true),
          item("/onboarding", "Onboarding", Building2, "onboarding"),
        ],
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((navItem) => {
          if (navItem.adminOnly && !isAdmin) return false;
          return canAccessModule(navItem.moduleKey);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [pathname, isAdmin, canAccessModule]);

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    const path = location?.pathname || "/";
    const allowed = ["/login", "/settings", "/onboarding", "/org", "/join"].some((p) => path === p || path.startsWith(p + "/"));
    const hasOrg = Boolean(organization?.id || profile?.organization_id);
    if (!allowed && !hasOrg) {
      nav("/onboarding", { replace: true });
      return;
    }
    if (hasOrg && path.startsWith("/onboarding")) {
      nav("/dashboard", { replace: true });
    }
  }, [loading, session, organization?.id, profile?.organization_id, location?.pathname, nav]);

  useEffect(() => {
    try {
      window.localStorage.setItem("GOVERNIX_PRESENTATION_MODE", presentationMode ? "true" : "false");
    } catch {
      // ignore storage errors
    }
    document.documentElement.classList.toggle("presentation-mode", presentationMode);
    return () => document.documentElement.classList.remove("presentation-mode");
  }, [presentationMode]);

  const shell = (
    <div className="gx-shell">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-white px-4 py-3 font-bold text-slate-950 shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        Ga naar hoofdinhoud
      </a>

      <aside
        id="governix-sidebar"
        className={"gx-sidebar " + (collapsed ? "gx-sidebar-collapsed" : "") + (mobileOpen ? " gx-sidebar-mobile-open" : "")}
        aria-label="Hoofdnavigatie"
      >
        <div className="gx-sidebar-top">
          <GovernixLogo compact={collapsed} />
          <button
            type="button"
            className="gx-icon-button hidden lg:inline-flex focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Menu uitklappen" : "Menu inklappen"}
            aria-label={collapsed ? "Navigatiemenu uitklappen" : "Navigatiemenu inklappen"}
            aria-expanded={!collapsed}
            aria-controls="governix-navigation"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        <nav id="governix-navigation" className="gx-nav" aria-label="Governix onderdelen">
          {menuGroups.map((group) => (
            <div key={group.label} className="gx-nav-group">
              {!collapsed ? <div className="gx-nav-group-label">{group.label}</div> : null}
              <div className="space-y-1">
                {group.items.map((navItem) => (
                  <NavItem key={navItem.to} item={navItem} collapsed={collapsed} onClick={() => setMobileOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed ? (
          <section className="gx-quick-actions" aria-labelledby="quick-actions-heading">
            <div className="flex items-center justify-between">
              <div id="quick-actions-heading" className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">Snelle acties</div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80" aria-hidden="true">+</span>
            </div>
            {canAccessModule("contracts_new") ? <Link to="/contracts/new" className="gx-quick-link no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"><FileText className="h-4 w-4" aria-hidden="true" /> Nieuw contract</Link> : null}
            {canAccessModule("suppliers") ? <Link to="/suppliers" className="gx-quick-link no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"><Building2 className="h-4 w-4" aria-hidden="true" /> Leverancier beheren</Link> : null}
            {canAccessModule("assets") ? <Link to="/assets" className="gx-quick-link no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"><Box className="h-4 w-4" aria-hidden="true" /> Asset bekijken</Link> : null}
            {canAccessModule("settings_roles") ? <Link to="/settings/roles" className="gx-quick-link no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70"><Wrench className="h-4 w-4" aria-hidden="true" /> Rollen beheren</Link> : null}
          </section>
        ) : null}

        <div className="gx-sidebar-footer">
          {!collapsed ? (
            <div className="gx-user-mini" aria-label={`${displayName}, ${primaryRole}`}>
              <div className="gx-avatar" aria-hidden="true">{initials}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-white">{displayName}</div>
                <div className="truncate text-xs text-white/70">{primaryRole}</div>
              </div>
            </div>
          ) : (
            <div className="gx-avatar mx-auto" title={`${displayName} — ${primaryRole}`}>{initials}</div>
          )}
          {!collapsed ? <div className="gx-version">v4.1 Modular RBAC</div> : null}
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="gx-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Navigatiemenu sluiten"
        />
      ) : null}

      <div className="gx-main-wrap">
        <header className="gx-topbar" aria-label="Applicatiebalk">
          <button
            type="button"
            className="gx-icon-button lg:hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            onClick={() => setMobileOpen(true)}
            aria-label="Navigatiemenu openen"
            aria-expanded={mobileOpen}
            aria-controls="governix-sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="gx-search" role="search">
            <Search className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <input aria-label="Zoeken in Governix" placeholder="Zoek in Governix..." />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button type="button" className="gx-top-icon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300" aria-label="Meldingen, 5 ongelezen">
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="gx-notification-dot" aria-hidden="true">5</span>
            </button>
            <button type="button" className="gx-top-icon hidden sm:inline-flex focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300" aria-label="Berichten">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link to="/handleiding" className="gx-top-icon hidden sm:inline-flex no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300" aria-label="Help en handleiding">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={"gx-top-icon hidden sm:inline-flex focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 " + (presentationMode ? "ring-2 ring-blue-500" : "")}
              aria-label={presentationMode ? "Presentatiemodus uitschakelen" : "Presentatiemodus inschakelen"}
              aria-pressed={presentationMode}
              onClick={() => setPresentationMode((v) => !v)}
            >
              <MonitorUp className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="hidden min-w-0 items-center gap-3 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm md:flex" aria-label={`Ingelogd als ${displayName} bij ${orgLabel}`}>
              <div className="gx-avatar gx-avatar-light" aria-hidden="true">{initials}</div>
              <div className="min-w-0 pr-2">
                <div className="truncate text-sm font-bold text-slate-900">{displayName}</div>
                <div className="truncate text-xs text-slate-600">{orgLabel}</div>
              </div>
            </div>
            {session ? (
              <button type="button" className="gx-top-icon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300" onClick={signOut} aria-label="Uitloggen">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : (
              <Link className="gx-login-link no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300" to="/login"><UserRound className="h-4 w-4" aria-hidden="true" /> Login</Link>
            )}
          </div>
        </header>

        <main id="main-content" className="gx-content" tabIndex="-1">{children}</main>

        <footer className="gx-footer">
          <span>© {new Date().getFullYear()} Governix</span>
          <span>Integrated Governance, Contract & Asset Management Platform</span>
        </footer>
      </div>
    </div>
  );

  return <ToastProvider>{shell}</ToastProvider>;
}
