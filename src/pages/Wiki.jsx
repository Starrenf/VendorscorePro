import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Notice from "../components/Notice";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";

function formatDate(value) {
  if (!value) return "Onbekend";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Onbekend";
  }
}

function renderContent(text) {
  const lines = String(text || "").split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-3" />;
    if (trimmed.startsWith("### ")) {
      return <h3 key={idx} className="mt-5 text-lg font-bold text-[#003A8F]">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith("## ")) {
      return <h2 key={idx} className="mt-6 text-2xl font-extrabold text-[#003A8F]">{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith("# ")) {
      return <h1 key={idx} className="mt-6 text-3xl font-extrabold text-[#003A8F]">{trimmed.slice(2)}</h1>;
    }
    if (trimmed.startsWith("- ")) {
      return <li key={idx} className="ml-6 list-disc text-slate-700">{trimmed.slice(2)}</li>;
    }
    return <p key={idx} className="text-slate-700 leading-relaxed">{line}</p>;
  });
}

export default function Wiki() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { session, organization, profile, loading: appLoading } = useApp();
  const client = supabase();

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (appLoading) return;
      if (!session) {
        nav("/login", { replace: true });
        return;
      }
      const orgId = organization?.id || profile?.organization_id;
      if (!orgId) {
        nav("/onboarding", { replace: true });
        return;
      }
      if (!client) {
        setErr("Supabase configuratie ontbreekt.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr("");

      const [{ data: articleData, error: articleError }, { data: categoryData }] = await Promise.all([
        client
          .from("wiki_articles")
          .select("*")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
        client
          .from("wiki_categories")
          .select("*")
          .eq("organization_id", orgId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;
      if (articleError) {
        setErr(articleError.message);
        setArticles([]);
        setLoading(false);
        return;
      }

      const published = (articleData || []).filter((a) => {
        const status = String(a.status || "").toLowerCase();
        return a.is_published === true || status === "published";
      });

      const derivedCategories = Array.from(
        new Set(published.map((a) => a.category).filter(Boolean)),
      ).map((name) => ({ id: name, name, slug: String(name).toLowerCase() }));

      setArticles(published);
      setCategories(categoryData?.length ? categoryData : derivedCategories);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [appLoading, session, organization?.id, profile?.organization_id, client, nav]);

  const activeArticle = useMemo(() => {
    if (!slug) return null;
    return articles.find((a) => a.slug === slug || a.id === slug) || null;
  }, [articles, slug]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return articles.filter((a) => {
      if (category && (a.category || "") !== category) return false;
      if (!needle) return true;
      const haystack = [a.title, a.summary, a.content, a.category, ...(a.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [articles, q, category]);

  if (slug) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link className="text-sm font-semibold text-cyan-100 no-underline hover:text-white" to="/wiki">
          ← Terug naar wiki
        </Link>
        {loading ? <div className="card p-6">Laden...</div> : null}
        {err ? <Notice title="Wiki" tone="danger">{err}</Notice> : null}
        {!loading && !activeArticle ? (
          <Notice title="Niet gevonden" tone="warning">Dit wiki-artikel kon niet worden gevonden.</Notice>
        ) : null}
        {activeArticle ? (
          <article className="card p-7 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="badge border-indigo-100 bg-indigo-50 text-indigo-700">
                {activeArticle.category || "Geen categorie"}
              </span>
              <span className="badge border-emerald-100 bg-emerald-50 text-emerald-700">
                {activeArticle.status || (activeArticle.is_published ? "published" : "draft")}
              </span>
            </div>
            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-slate-950">
              {activeArticle.title}
            </h1>
            {activeArticle.summary ? (
              <p className="mt-4 text-lg text-slate-600">{activeArticle.summary}</p>
            ) : null}
            <div className="mt-2 text-xs text-slate-400">
              Laatst bijgewerkt: {formatDate(activeArticle.updated_at)}
            </div>
            <div className="prose mt-8 max-w-none space-y-2">
              {renderContent(activeArticle.content || activeArticle.summary || "")}
            </div>
            {activeArticle.tags?.length ? (
              <div className="mt-8 flex flex-wrap gap-2">
                {activeArticle.tags.map((tag) => (
                  <span key={tag} className="badge">#{tag}</span>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="rounded-3xl bg-gradient-to-br from-[#0f6075] to-[#1f7086] p-8 text-white shadow-xl md:p-10">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-100/80">
          VendorScorePro Wiki
        </div>
        <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
          Kennisbank voor contractmanagement, governance en functioneel beheer
        </h1>
        <p className="mt-5 max-w-4xl text-sm font-medium text-cyan-50 md:text-base">
          Vind bewaartermijnen, AVG-aandachtspunten, templates, leveranciersafspraken, lessons learned en praktische contractmanagement-kennis op één plek.
        </p>
      </section>

      {err ? <Notice title="Wiki" tone="danger">{err}</Notice> : null}

      <section className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek in de wiki, bewaartermijnen, AVG, SLA, exit..."
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Alle categorieën</option>
          {categories.map((c) => (
            <option key={c.id || c.slug || c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <Link className="btn btn-primary" to="/wiki/admin">Wiki beheer</Link>
      </section>

      <section className="space-y-4">
        <div className="text-sm font-semibold text-cyan-50/90">Alle artikelen</div>
        {loading ? <div className="card p-6">Laden...</div> : null}
        {!loading && !filtered.length ? (
          <div className="card p-6 text-slate-600">Nog geen artikelen gevonden.</div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to={`/wiki/${a.slug || a.id}`}
              className="card p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="badge border-indigo-100 bg-indigo-50 text-indigo-700">
                  {a.category || "Geen categorie"}
                </span>
                <span className="badge border-emerald-100 bg-emerald-50 text-emerald-700">
                  {a.status || (a.is_published ? "published" : "draft")}
                </span>
              </div>
              <h2 className="mt-5 font-bold text-slate-950">{a.title}</h2>
              {a.summary ? <p className="mt-2 text-sm text-slate-600">{a.summary}</p> : null}
              {a.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {a.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="badge">#{tag}</span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
