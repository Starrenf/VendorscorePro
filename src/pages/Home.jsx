import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Megaphone,
  ShieldCheck,
  Users,
  Wrench,
  Box,
  Lock,
  BarChart3,
  BookOpen,
  ArrowRight,
  Activity,
  FileWarning,
  CalendarClock,
} from "lucide-react";
import Notice from "../components/Notice";
import SystemAnnouncements from "../components/SystemAnnouncements";
import TrafficLight from "../components/TrafficLight";
import { supabase } from "../lib/supabase";
import { getRuntimeConfig } from "../lib/runtimeConfig";
import { useApp } from "../state/AppState";
import { DEMO_SUPPLIERS, governanceToLight, summarizeCockpit } from "../lib/governanceCockpit";
import { isDemoMode } from "../lib/demoMode";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function getFirstName(profile, session) {
  const full = profile?.display_name || profile?.full_name || session?.user?.email?.split("@")[0] || "Frank";
  return full.split(" ")[0] || full;
}

function KpiCard({ icon: Icon, value, title, subtitle, tone = "blue" }) {
  const tones = {
    blue: "gx-kpi-icon-blue",
    green: "gx-kpi-icon-green",
    purple: "gx-kpi-icon-purple",
    orange: "gx-kpi-icon-orange",
    teal: "gx-kpi-icon-teal",
    red: "gx-kpi-icon-red",
  };
  return (
    <div className="gx-kpi-card">
      <div className={"gx-kpi-icon " + (tones[tone] || tones.blue)}><Icon className="h-6 w-6" /></div>
      <div>
        <div className="text-3xl font-black tracking-tight text-slate-950">{value}</div>
        <div className="mt-1 text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-xs font-medium text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}

function ModuleCard({ to, icon: Icon, title, text, tone = "blue" }) {
  return (
    <Link to={to} className="gx-module-card no-underline">
      <div className={`gx-module-icon gx-module-${tone}`}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <ArrowRight className="ml-auto h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
    </Link>
  );
}

function ActivityRow({ icon: Icon, title, time, tone = "blue" }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`gx-activity-icon gx-module-${tone}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800">{title}</div>
      </div>
      <div className="text-xs text-slate-500">{time}</div>
    </div>
  );
}

export default function Home() {
  const { session, organization, profile, loading: appLoading } = useApp();
  const cfg = getRuntimeConfig();
  const client = supabase();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [usingDemo, setUsingDemo] = useState(false);

  const orgId = organization?.id || profile?.organization_id || null;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setErr("");
      if (appLoading) return;
      if (!session || !orgId || !client) {
        if (isDemoMode()) {
          setRows(DEMO_SUPPLIERS);
          setUsingDemo(true);
        } else {
          setRows([]);
          setUsingDemo(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await client
          .from("supplier_overview_view")
          .select("id,name,classification,governance_score,governance_score_percent,score_percent,status_label,status_color,domain")
          .eq("organization_id", orgId)
          .order("name", { ascending: true });
        if (error) throw error;
        const mapped = (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          classification: row.classification || "Nog niet ingedeeld",
          governancePercent: Number(row.score_percent ?? row.governance_score_percent ?? row.governance_score ?? 0),
          domain: row.domain || "Onbekend",
        }));
        if (!cancelled) {
          setRows(mapped);
          setUsingDemo(false);
        }
      } catch (e) {
        if (isDemoMode()) {
          if (!cancelled) {
            setRows(DEMO_SUPPLIERS);
            setUsingDemo(true);
          }
        } else if (!cancelled) {
          setRows([]);
          setErr(e?.message || "Dashboardgegevens konden niet worden geladen.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [session, orgId, client, appLoading]);

  const stats = useMemo(() => summarizeCockpit(rows), [rows]);
  const weakGovernance = useMemo(() => rows.filter((r) => r.governancePercent < 60).length, [rows]);
  const strongGovernance = useMemo(() => rows.filter((r) => r.governancePercent >= 80).length, [rows]);
  const topRows = useMemo(() => rows.slice().sort((a, b) => a.governancePercent - b.governancePercent).slice(0, 4), [rows]);

  const disciplineCounts = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.domain || "Overig", (map.get(r.domain || "Overig") || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  const firstName = getFirstName(profile, session);
  const orgName = organization?.display_name || organization?.name || "Gilde Opleidingen";

  return (
    <div className="gx-page space-y-6">
      <section className="gx-hero">
        <div>
          <div className="gx-eyebrow">Governix Control Center</div>
          <h1>{getGreeting()}, {firstName} <span aria-hidden="true">👋</span></h1>
          <p>Hier is wat er vandaag speelt binnen {orgName}. Eén plek voor contracten, leveranciers, assets, risico’s, communicatie en governance.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/settings/communications" className="gx-button gx-button-primary no-underline"><Megaphone className="h-4 w-4" /> Nieuwe melding</Link>
            <Link to="/suppliers" className="gx-button no-underline"><Users className="h-4 w-4" /> Leveranciers</Link>
            <Link to="/handleiding" className="gx-button no-underline"><FileText className="h-4 w-4" /> Handleiding</Link>
          </div>
        </div>
        <div className="gx-hero-brand">
          <img src="/governix-logo.svg" alt="Governix" />
          <p>Grip op leveranciers, contracten, assets en compliance.</p>
          <div className="gx-hero-illustration">
            <ShieldCheck className="h-16 w-16 text-teal-500" />
            <div>
              <div className="text-sm font-bold text-slate-700">Platformstatus</div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Alles operationeel</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={CalendarClock} value="3" title="Contracten verlopen" subtitle="Binnen 30 dagen" tone="blue" />
        <KpiCard icon={Wrench} value="1" title="Storingen open" subtitle="Aandacht nodig" tone="green" />
        <KpiCard icon={Users} value={stats.suppliers || rows.length} title="Leveranciers" subtitle="In governancecockpit" tone="purple" />
        <KpiCard icon={ShieldCheck} value={strongGovernance} title="Op orde" subtitle="Governance ≥ 80%" tone="orange" />
        <KpiCard icon={FileWarning} value={weakGovernance} title="Aandacht nodig" subtitle="Governance < 60%" tone="teal" />
      </section>

      <SystemAnnouncements compact />

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="gx-panel">
          <div className="gx-panel-header">
            <div>
              <h2>Platform overzicht</h2>
              <p>Kies direct het werkgebied waar je mee aan de slag wilt.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ModuleCard to="/suppliers" icon={Users} title="Leveranciers" text="Beheer leveranciers en prestaties" tone="blue" />
            <ModuleCard to="/dashboard" icon={FileText} title="Contracten" text="Contracten en verplichtingen" tone="blue" />
            <ModuleCard to="/assets" icon={Building2} title="Gebouwen" text="Vastgoed en locaties" tone="blue" />
            <ModuleCard to="/assets" icon={Box} title="Assets" text="Installaties en bedrijfsmiddelen" tone="teal" />
            <ModuleCard to="/assets" icon={Wrench} title="Onderhoud" text="Werkorders en onderhoudsplanning" tone="green" />
            <ModuleCard to="/ai-register" icon={Bot} title="AI Governance" text="AI-register en risicobeheer" tone="teal" />
            <ModuleCard to="/methodiek" icon={ShieldCheck} title="Governance" text="Beoordeling en controls" tone="blue" />
            <ModuleCard to="/status" icon={Lock} title="Security & Privacy" text="Informatiebeveiliging en AVG" tone="purple" />
            <ModuleCard to="/wiki" icon={BookOpen} title="Wiki" text="Kennisbank en documentatie" tone="orange" />
          </div>
        </div>

        <div className="gx-panel">
          <div className="gx-panel-header">
            <div>
              <h2>Recente activiteiten</h2>
              <p>Laatste belangrijke gebeurtenissen.</p>
            </div>
            <Link to="/status" className="text-sm font-bold text-blue-600 no-underline hover:underline">Bekijk alles</Link>
          </div>
          <div className="divide-y divide-slate-100">
            <ActivityRow icon={FileText} title="Contract KONE – Onderhoud liften verlengd" time="2 uur" tone="blue" />
            <ActivityRow icon={Users} title="Nieuwe leverancier toegevoegd: Synguard" time="4 uur" tone="purple" />
            <ActivityRow icon={ShieldCheck} title="Audit ISO 27001 gepland" time="1 dag" tone="teal" />
            <ActivityRow icon={Wrench} title="Werkorder #4521 afgerond" time="2 dagen" tone="green" />
            <ActivityRow icon={Bot} title="AI-toepassing ‘ChatGPT EDU’ beoordeeld" time="2 dagen" tone="blue" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.65fr]">
        <div className="gx-panel overflow-hidden">
          <div className="gx-panel-header">
            <div>
              <h2>Binnenkort verstrijkende contracten</h2>
              <p>Voorbeeldweergave voor de contractradar.</p>
            </div>
            <Link to="/dashboard" className="text-sm font-bold text-blue-600 no-underline hover:underline">Bekijk alle contracten</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="gx-table">
              <thead>
                <tr>
                  <th>Contractnaam</th>
                  <th>Leverancier</th>
                  <th>Einddatum</th>
                  <th>Dagen resterend</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Onderhoud liften – Gilde locaties</td><td>KONE B.V.</td><td>15-06-2025</td><td className="text-red-600 font-bold">12 dagen</td><td><span className="gx-status gx-status-red">Verloopt binnenkort</span></td></tr>
                <tr><td>Beveiligingsdiensten</td><td>Chubb Fire & Security B.V.</td><td>30-06-2025</td><td>27 dagen</td><td><span className="gx-status gx-status-red">Verloopt binnenkort</span></td></tr>
                <tr><td>Schoonmaakdiensten</td><td>CSU Services B.V.</td><td>05-07-2025</td><td>32 dagen</td><td><span className="gx-status gx-status-green">OK</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="gx-panel">
          <div className="gx-panel-header">
            <div>
              <h2>Leveranciers per discipline</h2>
              <p>Verdeling op basis van geregistreerde domeinen.</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="gx-donut"><span>{rows.length || 182}<small>Totaal</small></span></div>
            <div className="min-w-0 flex-1 space-y-3">
              {(disciplineCounts.length ? disciplineCounts : [["ICT", 62], ["Vastgoed & Gebouwen", 48], ["Facilitaire Diensten", 38], ["Onderwijs", 22]]).map(([name, count], i) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <span className={`gx-dot gx-dot-${(i % 5) + 1}`} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{name}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.65fr]">
        <div className="gx-panel">
          <div className="gx-panel-header">
            <div>
              <h2>Governance prioriteiten</h2>
              <p>Leveranciers met de laagste governance-score staan bovenaan.</p>
            </div>
            <span className="gx-status gx-status-blue">Bron: {cfg.source}</span>
          </div>
          {loading ? <div className="p-4 text-sm text-slate-600">Laden…</div> : null}
          <div className="overflow-x-auto">
            <table className="gx-table">
              <thead><tr><th>Leverancier</th><th>Strategie</th><th>Governance</th><th>Status</th></tr></thead>
              <tbody>
                {topRows.map((row) => {
                  const light = governanceToLight(row.governancePercent);
                  return (
                    <tr key={row.id} onClick={() => !usingDemo && (window.location.href = `/suppliers/${row.id}`)} className="cursor-pointer">
                      <td className="font-bold">{row.name}</td>
                      <td>{row.classification}</td>
                      <td>{row.governancePercent}%</td>
                      <td><div className="flex items-center gap-2"><TrafficLight value={light} /><span>{row.governancePercent > 75 ? "Groen" : row.governancePercent >= 50 ? "Oranje" : "Rood"}</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gx-panel">
          <div className="gx-panel-header">
            <div>
              <h2>Systeemstatus</h2>
              <p>Applicatiecomponenten.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Alles operationeel</span>
          </div>
          <div className="space-y-3 text-sm">
            {["Applicatie", "Database", "Bestandsopslag", "Integraties", "Back-ups"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-700">{item}</span>
                <span className="inline-flex items-center gap-2 font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Operationeel</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {usingDemo ? <Notice title="Voorbeelddata actief">Er zijn nog geen leveranciers gevonden voor deze organisatie. De cockpit toont tijdelijke voorbeelddata.</Notice> : null}
      {err ? <Notice title="Dashboard" tone="danger">{err}</Notice> : null}
    </div>
  );
}
