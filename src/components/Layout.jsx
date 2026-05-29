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
  ChevronDown,
  LogOut,
  UserRound,
  SlidersHorizontal,
  Info,
  FileQuestion,
  Compass,
  Settings as SettingsIcon,
  Building,
  ClipboardList,
  Network,
  Layers3,
  GitBranch,
} from "lucide-react";

function OrbLogo() {
  return (
    <div
      className="vs-orb-wrap relative h-12 w-12 shrink-0 lg:h-14 lg:w-14"
      aria-hidden="true"
    >
      <div className="vs-orb-shadow" />
      <div className="vs-orb-ring vs-orb-ring-back" />
      <div className="vs-orb-3d" />
      <div className="vs-orb-logo-shell">
        <img
          src="/logo-vendorscore-icon.png"
          alt=""
          className="vs-orb-logo-mark"
        />
      </div>
      <div className="vs-orb-ring vs-orb-ring-front" />
      <div className="vs-orb-core-glow" />
      <div className="vs-orb-highlight" />
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const pathname = location.pathname;
  const nav = useNavigate();
  const { session, organization, signOut, loading, profile } = useApp();
  const isAdmin = Boolean(profile?.role === "admin");

  const primaryMenu = useMemo(
    () => [
      { to: "/", label: "Home", icon: Home, active: pathname === "/", className: "navbtn-compact" },
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        active: pathname.startsWith("/dashboard"),
      },
      {
        to: "/architecture",
        label: "Architectuur",
        icon: Network,
        active: pathname.startsWith("/architecture"),
        className: "navbtn-wide",
      },
      {
        to: "/suppliers",
        label: "Leveranciers",
        icon: Building2,
        active: pathname.startsWith("/suppliers"),
        className: "navbtn-medium",
      },
      {
        to: "/methodiek",
        label: "Governance",
        icon: ShieldCheck,
        active: pathname.startsWith("/methodiek"),
        className: "navbtn-medium",
      },
      {
        to: "/ai-register",
        label: "AI-register",
        icon: Brain,
        active: pathname.startsWith("/ai-register"),
        className: "navbtn-wide",
      },
      {
        to: "/wiki",
        label: "Wiki",
        icon: BookOpen,
        active: pathname.startsWith("/wiki"),
        className: "navbtn-compact",
      },
    ],
    [pathname],
  );

  const secondaryMenu = useMemo(
    () => [


      {
        to: "/architecture/architect",
        label: "Architect view",
        icon: Compass,
        active: pathname.startsWith("/architecture/architect"),
      },
      {
        to: "/architecture/domains",
        label: "Domeinen",
        icon: Layers3,
        active: pathname.startsWith("/architecture/domains"),
      },
      {
        to: "/architecture/relations",
        label: "Relaties",
        icon: GitBranch,
        active: pathname.startsWith("/architecture/relations"),
      },
      {
        to: "/landschap",
        label: "Softwarelandschap",
        icon: Layers3,
        active: pathname.startsWith("/landschap"),
      },
      {
        to: "/status",
        label: "Status",
        icon: ClipboardList,
        active: pathname.startsWith("/status"),
      },
      { to: "/over", label: "Over", icon: Info, active: pathname.startsWith("/over") },
      {
        to: "/handleiding",
        label: "Handleiding",
        icon: FileQuestion,
        active: pathname.startsWith("/handleiding"),
      },
      ...(isAdmin
        ? [
            {
              to: "/admin/orgs",
              label: "Admin",
              icon: SettingsIcon,
              active: pathname.startsWith("/admin"),
            },
            {
              to: "/wiki/admin",
              label: "Wiki beheer",
              icon: BookOpen,
              active: pathname.startsWith("/wiki/admin"),
            },
          ]
        : []),
      {
        to: "/onboarding",
        label: "Onboarding",
        icon: Building,
        active: pathname.startsWith("/onboarding"),
      },
    ],
    [pathname, isAdmin],
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const [bgOffset, setBgOffset] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setBgOffset(y * 0.15);
      setIsScrolled(y > 6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setDesktopMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (!session) return;

    const path = location?.pathname || "/";

    const allowed = [
      "/login",
      "/settings",
      "/onboarding",
      "/org",
      "/join",
    ].some((p) => path === p || path.startsWith(p + "/"));

    const hasOrg = Boolean(organization?.id || profile?.organization_id);

    if (!allowed && !hasOrg) {
      nav("/onboarding", { replace: true });
      return;
    }

    if (hasOrg && path.startsWith("/onboarding")) {
      nav("/dashboard", { replace: true });
    }
  }, [
    loading,
    session,
    organization?.id,
    profile?.organization_id,
    location?.pathname,
    nav,
  ]);

  const orgLabel =
    organization?.name ||
    (profile?.organization_id
      ? "Gilde Opleidingen"
      : "Geen organisatie geselecteerd");

  return (
    <ToastProvider>
      <div className="relative min-h-screen overflow-x-hidden text-slate-900">
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: "url('/background.jpg')",
            transform: `translateY(${bgOffset}px) scale(1.03)`,
          }}
        />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(92,187,255,0.18),transparent_20%),linear-gradient(135deg,rgba(8,27,55,0.88),rgba(11,42,79,0.92)_45%,rgba(16,58,108,0.88))]" />

        <header
          className="sticky top-0 z-20 border-b border-white/10 text-white backdrop-blur-md"
          style={{
            background: isScrolled
              ? "linear-gradient(90deg, rgba(9,32,65,0.94) 0%, rgba(12,54,104,0.95) 40%, rgba(10,37,72,0.94) 100%)"
              : "linear-gradient(90deg, rgba(12,44,92,0.88) 0%, rgba(12,54,104,0.90) 48%, rgba(8,29,60,0.88) 100%)",
          }}
        >
          <div className="mx-auto grid max-w-[1800px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_auto] lg:gap-7 lg:px-8">
            <div className="flex min-w-0 items-center gap-3.5 lg:gap-4.5">
              <OrbLogo />
              <div className="min-w-0 max-w-[280px] lg:max-w-[320px]">
                <div className="text-[1.55rem] font-extrabold leading-none tracking-tight text-white lg:text-[1.7rem]">
                  VendorScore Pro
                </div>
                <div className="mt-1 hidden max-w-[260px] text-[10px] font-semibold uppercase leading-[1.2] tracking-[0.16em] text-cyan-100/78 sm:block lg:max-w-[300px]">
                  Leveranciersmanagement &amp; governance
                </div>
                <div className="mt-1.5 text-[11px] leading-tight text-white/68 lg:max-w-[300px]">
                  {organization || profile?.organization_id ? (
                    <span className="inline-flex max-w-full items-center rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-[11px] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <span className="mr-1.5 text-white/52">Organisatie</span>
                      <span className="truncate font-semibold text-white/92">
                        {orgLabel}
                      </span>
                    </span>
                  ) : (
                    "Nog niet gekoppeld aan een organisatie"
                  )}
                </div>
              </div>
            </div>

            <div className="hidden lg:flex min-w-0 items-center justify-center gap-3 xl:gap-4">
              <nav className="flex min-w-0 items-center gap-2 rounded-[2rem] border border-white/10 bg-white/[0.055] px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.16)] backdrop-blur-md xl:gap-3 xl:px-4">
                {primaryMenu.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      className={
                        "navbtn " +
                        (item.className || "") +
                        (item.active ? " navbtn-active" : "")
                      }
                      to={item.to}
                    >
                      {Icon ? <Icon className="navbtn-icon" aria-hidden="true" /> : null}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="relative">
                <button
                  type="button"
                  className={
                    "navbtn" +
                    (secondaryMenu.some((item) => item.active)
                      ? " navbtn-active"
                      : "")
                  }
                  onClick={() => setDesktopMoreOpen((v) => !v)}
                >
                  <span>Meer</span>
                  <ChevronDown className="navbtn-icon" aria-hidden="true" />
                </button>

                {desktopMoreOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-56 rounded-2xl border border-white/10 bg-[rgba(8,27,55,0.96)] p-2 shadow-2xl backdrop-blur-xl">
                    {secondaryMenu.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={
                            "flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline transition " +
                            (item.active
                              ? "bg-white text-[#0c4f9f]"
                              : "text-white/85 hover:bg-white/10 hover:text-white")
                          }
                        >
                          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2.5 justify-self-end">
              {session ? (
                <button className="navbtn navbtn-medium" onClick={signOut}>
                  <LogOut className="navbtn-icon" aria-hidden="true" />
                  <span>Uitloggen</span>
                </button>
              ) : (
                <Link
                  className={
                    "navbtn" +
                    (pathname.startsWith("/login") ? " navbtn-active" : "")
                  }
                  to="/login"
                >
                  <UserRound className="navbtn-icon" aria-hidden="true" />
                  <span>Login</span>
                </Link>
              )}
            </div>

            <button
              className="inline-flex items-center justify-center justify-self-end rounded-2xl border border-white/25 bg-white/8 p-2.5 transition hover:bg-white/12 lg:hidden"
              aria-label="Menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {mobileOpen ? (
            <div className="fixed inset-0 z-30 lg:hidden">
              <div
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
                onClick={() => setMobileOpen(false)}
              />
              <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l border-white/15 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-4 text-slate-900 shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <OrbLogo />
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold">
                        VendorScore Pro
                      </div>
                      <div className="truncate text-xs text-slate-600">
                        {orgLabel}
                      </div>
                    </div>
                  </div>
                  <button className="btn" onClick={() => setMobileOpen(false)}>
                    Sluiten
                  </button>
                </div>

                <div className="grid gap-2 py-4">
                  {[...primaryMenu, ...secondaryMenu].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 font-semibold transition no-underline " +
                          (item.active
                            ? "border-[#0c4f9f] bg-[#E8F0FB] text-[#0c4f9f] shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50")
                        }
                      >
                        {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  {isAdmin ? (
                    <Link
                      to="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold hover:bg-slate-50"
                    >
                      <SettingsIcon className="h-5 w-5" aria-hidden="true" />
                      <span>Instellingen</span>
                    </Link>
                  ) : null}
                </div>

                <div className="mt-auto border-t border-slate-200 pt-4">
                  {session ? (
                    <button
                      className="btn btn-primary w-full"
                      onClick={() => {
                        setMobileOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="mr-2 h-5 w-5" aria-hidden="true" />
                      Uitloggen
                    </button>
                  ) : (
                    <Link
                      className="btn btn-primary w-full"
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                    >
                      <UserRound className="mr-2 h-5 w-5" aria-hidden="true" />
                      Login
                    </Link>
                  )}
                  <div className="mt-3 text-xs leading-relaxed text-slate-500">
                    Nieuwe gebruikers maken eerst zelf een account aan en worden
                    daarna gekoppeld aan de juiste organisatie.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</main>

        <footer className="border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-sm text-slate-600 md:grid-cols-3 md:items-center lg:px-6">
            <div className="order-2 md:order-1">
              © {new Date().getFullYear()} VendorScore Pro
            </div>

            <div className="order-1 flex flex-col items-start gap-2 md:order-2 md:items-center">
              <div className="flex items-center gap-3">
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/methodiek">Governance</Link>
                <Link to="/onboarding">Onboarding</Link>
                <Link to="/handleiding">Handleiding</Link>
                <Link to="/wiki">Wiki</Link>
                <Link to="/architecture">Architectuur</Link>
              </div>
            </div>

            <div className="order-3 flex flex-wrap gap-4 md:justify-end">
              <a href="https://supabase.com" target="_blank" rel="noreferrer">
                Supabase
              </a>
              <a href="https://vercel.com" target="_blank" rel="noreferrer">
                Vercel
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
