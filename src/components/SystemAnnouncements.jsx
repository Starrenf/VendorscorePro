import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Wrench } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";

const TYPE_CONFIG = {
  critical: {
    label: "Storing",
    icon: AlertTriangle,
    className: "border-red-200 bg-red-50 text-red-950",
    pill: "bg-red-100 text-red-800",
  },
  maintenance: {
    label: "Onderhoud",
    icon: Wrench,
    className: "border-amber-200 bg-amber-50 text-amber-950",
    pill: "bg-amber-100 text-amber-800",
  },
  info: {
    label: "Informatie",
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-950",
    pill: "bg-blue-100 text-blue-800",
  },
  resolved: {
    label: "Opgelost",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    pill: "bg-emerald-100 text-emerald-800",
  },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function SystemAnnouncements({ compact = false }) {
  const client = supabase();
  const { session, organization, profile, loading: appLoading } = useApp();
  const orgId = organization?.id || profile?.organization_id || null;
  const currentRole = String(profile?.role || "").toLowerCase();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      if (appLoading || !session || !orgId || !client) {
        setAnnouncements([]);
        return;
      }
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const { data, error } = await client
          .from("system_announcements")
          .select("id,title,message,announcement_type,active,start_date,end_date,visible_for_role,target_module,priority,created_at")
          .eq("organization_id", orgId)
          .eq("active", true)
          .or(`start_date.is.null,start_date.lte.${now}`)
          .or(`end_date.is.null,end_date.gte.${now}`)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false });

        if (error) throw error;
        const rows = (data || []).filter((row) => {
          const target = String(row.visible_for_role || "").trim().toLowerCase();
          return !target || target === "iedereen" || target === "all" || target === currentRole;
        });
        if (!cancelled) setAnnouncements(rows);
      } catch (e) {
        if (!cancelled) {
          setAnnouncements([]);
          setError(e?.message || "Meldingen konden niet worden geladen.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [appLoading, session, orgId, client, currentRole]);

  const visibleRows = useMemo(() => (compact ? announcements.slice(0, 3) : announcements), [announcements, compact]);

  if (loading) {
    return <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">Meldingen laden…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Communicatiecentrum nog niet beschikbaar: {error}
      </div>
    );
  }

  if (!visibleRows.length) return null;

  return (
    <div className="space-y-3">
      {visibleRows.map((item) => {
        const config = TYPE_CONFIG[item.announcement_type] || TYPE_CONFIG.info;
        const Icon = config.icon;
        return (
          <div key={item.id} className={`rounded-3xl border p-4 shadow-sm ${config.className}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-white/70 p-2"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${config.pill}`}>{config.label}</span>
                  {item.target_module ? <span className="badge">{item.target_module}</span> : null}
                  {item.end_date ? <span className="text-xs opacity-75">tot {formatDate(item.end_date)}</span> : null}
                </div>
                <h2 className="mt-2 text-base font-extrabold">{item.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 opacity-90">{item.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
