import { ExternalLink, Gem, Link as LinkIcon } from "lucide-react";

function initials(title = "?") {
  return String(title || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function riskTone(risk) {
  const value = String(risk || "").toLowerCase();
  if (["high", "hoog", "red", "rood"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
  if (["medium", "middel", "amber", "orange", "oranje"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["low", "laag", "green", "groen"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function CrownJewelsTiles({ tiles = [], loading = false, error = "", compact = false }) {
  const visibleTiles = (tiles || []).filter((tile) => tile?.is_active !== false);

  return (
    <section className={`card ${compact ? "p-5" : "p-6"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <Gem size={14} /> Kroonjuwelen
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">Digitale kroonjuwelen</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Snelstart naar de kritische applicaties van Gilde. De documenten, contracten en governance blijven in Governix; de tegel opent de bijbehorende applicatie of website.
          </p>
        </div>
        <div className="text-sm text-slate-500">{visibleTiles.length} tegel(s)</div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
      {loading ? <div className="mt-4 text-sm text-slate-600">Kroonjuwelen laden…</div> : null}

      {!loading && !visibleTiles.length ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Nog geen kroonjuwelen-tegels ingericht. Voeg morgen logo's en URL's toe via de tabel <span className="font-mono">dashboard_tiles</span>.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibleTiles.map((tile) => {
          const target = tile.target_url || tile.url || "";
          const content = (
            <div className="group h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-xl font-bold text-slate-600">
                  {tile.logo_url ? <img src={tile.logo_url} alt={`${tile.title} logo`} className="h-full w-full object-contain p-2" /> : initials(tile.title)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-slate-900">{tile.title}</div>
                  {tile.description ? <div className="mt-1 line-clamp-2 text-sm text-slate-500">{tile.description}</div> : <div className="mt-1 text-sm text-slate-500">Kritische applicatie</div>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {tile.governance_score !== null && tile.governance_score !== undefined ? <span className="badge">Governance {tile.governance_score}%</span> : null}
                {tile.risk_level ? <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${riskTone(tile.risk_level)}`}>Risico {tile.risk_level}</span> : null}
                {target ? <span className="badge inline-flex items-center gap-1"><ExternalLink size={13} /> Open</span> : <span className="badge inline-flex items-center gap-1"><LinkIcon size={13} /> URL ontbreekt</span>}
              </div>
            </div>
          );

          return target ? (
            <a key={tile.id || tile.title} href={target} target="_blank" rel="noreferrer" className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-3xl">
              {content}
            </a>
          ) : (
            <div key={tile.id || tile.title} className="h-full">{content}</div>
          );
        })}
      </div>
    </section>
  );
}
