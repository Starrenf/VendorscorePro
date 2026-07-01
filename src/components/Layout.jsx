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
  AlertTriangle,
  BarChart3,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

function GovernixLogo({ compact = false }) {
  return (
    <Link to="/" className="gx-brand no-underline">
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
      className={"gx-nav-item no-underline " + (item.active ? "gx-nav-item-active" : "")}
      title={collapsed ? item.label : undefined}
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
  const { session, organization, signOut, loading, profile } = useApp();
  const isAdmin = Boolean(profile?.role === "admin");
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
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";

  const menuGroups = useMemo(() => {
    const item = (to, label, icon) => ({ to, label, icon, active: pathname === to || pathname.startsWith(`${to}/`) });
    return [
      {
        label: "Start",
        items: [
          item("/", "Home", Home),
          item("/dashboard", "Dashboard", LayoutDashboard),
        ],
      },
      {
        label: "Werkgebieden",
        items: [
          item("/suppliers", "Leveranciers", Users),
          item("/landschap", "Applicaties", Layers3),
          item("/assets", "Gebouwen & Assets", Building),
          item("/methodiek", "Governance", ShieldCheck),
          item("/ai-register", "AI Governance", Brain),
        ],
      },
      {
        label: "Risico & inzicht",
        items: [
          item("/status", "Statuspagina", ClipboardList),
          item("/architecture", "Architectuur", BarChart3),
          item("/kroonjuwelen", "Kroonjuwelen", ShieldCheck),
          item("/wiki", "Wiki", BookOpen),
          item("/handleiding", "Handleiding", FileQuestion),
        ],
      },
      {
        label: "Beheer",
        items: [
          ...(isAdmin
            ? [
                item("/suppliers/masterdata", "Leveranciers MDM", Wrench),
                item("/settings/communications", "Communicatie", Megaphone),
                item("/settings/roles", "Rollenbeheer", UserCog),
                item("/settings", "Waardelijsten", SlidersHorizontal),
                item("/admin/orgs", "Organisaties", SettingsIcon),
                item("/wiki/admin", "Wiki beheer", BookOpen),
              ]
            : []),
          item("/onboarding", "Onboarding", Building2),
        ],
      },
    ].filter((group) => group.items.length > 0);
  }, [pathname, isAdmin]);

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
      <aside className={"gx-sidebar " + (collapsed ? "gx-sidebar-collapsed" : "") + (mobileOpen ? " gx-sidebar-mobile-open" : "") }>
        <div className="gx-sidebar-top">
          <GovernixLogo compact={collapsed} />
          <button className="gx-icon-button hidden lg:inline-flex" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Menu uitklappen" : "Menu inklappen"}>
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="gx-nav">
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
          <div className="gx-quick-actions">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/55">Snel acties</div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">+</span>
            </div>
            <Link to="/settings/communications" className="gx-quick-link no-underline"><Megaphone className="h-4 w-4" /> Nieuwe melding</Link>
            <Link to="/suppliers" className="gx-quick-link no-underline"><Building2 className="h-4 w-4" /> Leverancier</Link>
            <Link to="/assets" className="gx-quick-link no-underline"><Box className="h-4 w-4" /> Asset bekijken</Link>
          </div>
        ) : null}

        <div className="gx-sidebar-footer">
          {!collapsed ? (
            <div className="gx-user-mini">
              <div className="gx-avatar">{initials}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-white">{displayName}</div>
                <div className="truncate text-xs text-white/60">{profile?.role === "admin" ? "Beheerder" : "Gebruiker"}</div>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 text-white/50" />
            </div>
          ) : (
            <div className="gx-avatar mx-auto">{initials}</div>
          )}
          {!collapsed ? <div className="gx-version">v2.0.0 Enterprise UX</div> : null}
        </div>
      </aside>

      {mobileOpen ? <div className="gx-mobile-backdrop" onClick={() => setMobileOpen(false)} /> : null}

      <div className="gx-main-wrap">
        <header className="gx-topbar">
          <button className="gx-icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu openen">
            <PanelLeftOpen className="h-5 w-5" />
          </button>

          <div className="gx-search">
            <Search className="h-5 w-5 text-slate-400" />
            <input aria-label="Zoeken" placeholder="Zoek in Governix..." />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button className="gx-top-icon" title="Meldingen"><Bell className="h-5 w-5" /><span className="gx-notification-dot">5</span></button>
            <button className="gx-top-icon hidden sm:inline-flex" title="Berichten"><MessageSquare className="h-5 w-5" /></button>
            <button className="gx-top-icon hidden sm:inline-flex" title="Help"><HelpCircle className="h-5 w-5" /></button>
            <button className={"gx-top-icon hidden sm:inline-flex " + (presentationMode ? "ring-2 ring-blue-400" : "")} title="Presentatiemodus" onClick={() => setPresentationMode((v) => !v)}><MonitorUp className="h-5 w-5" /></button>
            <div className="hidden min-w-0 items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm md:flex">
              <div className="gx-avatar gx-avatar-light">{initials}</div>
              <div className="min-w-0 pr-2">
                <div className="truncate text-sm font-bold text-slate-900">{displayName}</div>
                <div className="truncate text-xs text-slate-500">{orgLabel}</div>
              </div>
            </div>
            <button type="button" className="gx-top-icon" onClick={signOut} title="Uitloggen"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="gx-main">{children}</main>
      </div>
    </div>
  );

  return <ToastProvider>{shell}</ToastProvider>;
}
