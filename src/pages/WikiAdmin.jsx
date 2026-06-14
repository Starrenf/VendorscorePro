import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Notice from "../components/Notice";
import { useToast } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";
import { useApp } from "../state/AppState";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

function textToTags(text) {
  return String(text || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const emptyArticle = {
  id: null,
  title: "",
  slug: "",
  category: "",
  summary: "",
  content: "",
  tagsText: "",
  status: "draft",
  is_published: false,
};

const emptyCategory = {
  id: null,
  name: "",
  slug: "",
  color: "blue",
  icon: "",
  sort_order: 100,
};

export default function WikiAdmin() {
  const toast = useToast();
  const nav = useNavigate();
  const { session, organization, profile, loading: appLoading } = useApp();
  const client = supabase();

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [articleForm, setArticleForm] = useState(emptyArticle);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [tab, setTab] = useState("articles");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [importFiles, setImportFiles] = useState([]);
  const [importCategory, setImportCategory] = useState("");
  const [importTagsText, setImportTagsText] = useState("wiki, kennisbank");
  const [importStatus, setImportStatus] = useState("published");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  const orgId = organization?.id || profile?.organization_id;

  async function loadAll() {
    if (!client || !orgId) return;
    setLoading(true);
    setErr("");

    const [articleResult, categoryResult] = await Promise.all([
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

    if (articleResult.error) {
      setErr(articleResult.error.message);
      toast.error(articleResult.error.message, "Wiki laden mislukt");
    } else {
      setArticles(articleResult.data || []);
    }

    if (categoryResult.error) {
      setErr((prev) => prev || categoryResult.error.message);
      toast.error(categoryResult.error.message, "Categorieën laden mislukt");
    } else {
      setCategories(categoryResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (appLoading) return;
    if (!session) {
      nav("/login", { replace: true });
      return;
    }
    if (!orgId) {
      nav("/onboarding", { replace: true });
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLoading, session, orgId, client, nav]);

  const filteredArticles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter((a) =>
      [a.title, a.slug, a.category, a.summary, a.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [articles, q]);

  function startNewArticle() {
    setArticleForm(emptyArticle);
    setTab("articles");
  }

  function editArticle(article) {
    setArticleForm({
      id: article.id,
      title: article.title || "",
      slug: article.slug || slugify(article.title),
      category: article.category || "",
      summary: article.summary || "",
      content: article.content || "",
      tagsText: tagsToText(article.tags),
      status: article.status || (article.is_published ? "published" : "draft"),
      is_published: Boolean(article.is_published || article.status === "published"),
    });
    setTab("articles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveArticle(e) {
    e.preventDefault();
    if (!client || !orgId) return;

    const title = articleForm.title.trim();
    if (!title) {
      toast.error("Titel is verplicht.");
      return;
    }

    const status = articleForm.status || "draft";
    const isPublished = status === "published" || articleForm.is_published === true;
    const payload = {
      organization_id: orgId,
      title,
      slug: articleForm.slug?.trim() || slugify(title),
      category: articleForm.category || null,
      summary: articleForm.summary || null,
      content: articleForm.content || null,
      tags: textToTags(articleForm.tagsText),
      status: isPublished ? "published" : status,
      is_published: isPublished,
      updated_by: session?.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    if (!articleForm.id) {
      payload.created_by = session?.user?.id || null;
    }

    setSaving(true);
    const query = articleForm.id
      ? client.from("wiki_articles").update(payload).eq("id", articleForm.id).select("*").single()
      : client.from("wiki_articles").insert(payload).select("*").single();

    const { data, error } = await query;
    setSaving(false);

    if (error) {
      toast.error(error.message, "Opslaan mislukt");
      return;
    }

    toast.success("Artikel opgeslagen.");
    setArticleForm({
      ...emptyArticle,
      id: data.id,
      title: data.title || "",
      slug: data.slug || "",
      category: data.category || "",
      summary: data.summary || "",
      content: data.content || "",
      tagsText: tagsToText(data.tags),
      status: data.status || "draft",
      is_published: Boolean(data.is_published),
    });
    await loadAll();
  }

  async function deleteArticle(article) {
    if (!client || !article?.id) return;
    const ok = window.confirm(`Artikel verwijderen: ${article.title}?`);
    if (!ok) return;
    const { error } = await client.from("wiki_articles").delete().eq("id", article.id);
    if (error) {
      toast.error(error.message, "Verwijderen mislukt");
      return;
    }
    toast.success("Artikel verwijderd.");
    if (articleForm.id === article.id) setArticleForm(emptyArticle);
    await loadAll();
  }

  function editCategory(category) {
    setCategoryForm({
      id: category.id,
      name: category.name || "",
      slug: category.slug || slugify(category.name),
      color: category.color || "blue",
      icon: category.icon || "",
      sort_order: Number(category.sort_order ?? 100),
    });
    setTab("categories");
  }

  async function saveCategory(e) {
    e.preventDefault();
    if (!client || !orgId) return;

    const name = categoryForm.name.trim();
    if (!name) {
      toast.error("Categorienaam is verplicht.");
      return;
    }

    const payload = {
      organization_id: orgId,
      name,
      slug: categoryForm.slug?.trim() || slugify(name),
      color: categoryForm.color || "blue",
      icon: categoryForm.icon || null,
      sort_order: Number(categoryForm.sort_order || 100),
    };

    setSaving(true);
    const oldName = categories.find((c) => c.id === categoryForm.id)?.name;
    const query = categoryForm.id
      ? client.from("wiki_categories").update(payload).eq("id", categoryForm.id).select("*").single()
      : client.from("wiki_categories").insert(payload).select("*").single();

    const { data, error } = await query;
    if (!error && oldName && oldName !== name) {
      await client
        .from("wiki_articles")
        .update({ category: name, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("category", oldName);
    }
    setSaving(false);

    if (error) {
      toast.error(error.message, "Categorie opslaan mislukt");
      return;
    }

    toast.success("Categorie opgeslagen.");
    setCategoryForm({
      id: data.id,
      name: data.name || "",
      slug: data.slug || "",
      color: data.color || "blue",
      icon: data.icon || "",
      sort_order: Number(data.sort_order ?? 100),
    });
    await loadAll();
  }

  async function deleteCategory(category) {
    if (!client || !category?.id) return;
    const count = articles.filter((a) => a.category === category.name).length;
    const ok = window.confirm(
      count
        ? `Categorie verwijderen en ${count} artikel(en) op 'Geen categorie' zetten?`
        : `Categorie verwijderen: ${category.name}?`,
    );
    if (!ok) return;

    if (count) {
      await client
        .from("wiki_articles")
        .update({ category: null, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("category", category.name);
    }

    const { error } = await client.from("wiki_categories").delete().eq("id", category.id);
    if (error) {
      toast.error(error.message, "Categorie verwijderen mislukt");
      return;
    }
    toast.success("Categorie verwijderd.");
    if (categoryForm.id === category.id) setCategoryForm(emptyCategory);
    await loadAll();
  }


  function parseMarkdownArticle(fileName, markdown) {
    const raw = String(markdown || "").replace(/\r\n/g, "\n").trim();
    const lines = raw.split("\n");
    const firstHeading = lines.find((line) => line.trim().startsWith("# "));
    const fallbackTitle = fileName
      .replace(/\.md$/i, "")
      .replace(/^\d+[_-]?/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    const title = firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : fallbackTitle;
    const summary = lines
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("```"));

    return {
      title: title || fallbackTitle || "Nieuw wiki-artikel",
      slug: slugify(title || fallbackTitle || fileName),
      summary: summary || null,
      content: raw,
    };
  }

  async function importMarkdownFiles(e) {
    e.preventDefault();
    if (!client || !orgId) return;
    if (!importFiles.length) {
      toast.error("Kies eerst één of meerdere .md bestanden.");
      return;
    }

    setImporting(true);
    setImportResult("");

    const rows = [];
    for (const file of importFiles) {
      if (!file.name.toLowerCase().endsWith(".md")) continue;
      const markdown = await file.text();
      const parsed = parseMarkdownArticle(file.name, markdown);
      rows.push({
        organization_id: orgId,
        title: parsed.title,
        slug: parsed.slug,
        category: importCategory || null,
        summary: parsed.summary,
        content: parsed.content,
        tags: textToTags(importTagsText),
        status: importStatus,
        is_published: importStatus === "published",
        created_by: session?.user?.id || null,
        updated_by: session?.user?.id || null,
        updated_at: new Date().toISOString(),
      });
    }

    if (!rows.length) {
      setImporting(false);
      toast.error("Geen geldige .md bestanden gevonden.");
      return;
    }

    const { data, error } = await client
      .from("wiki_articles")
      .upsert(rows, { onConflict: "organization_id,slug" })
      .select("id,title");

    setImporting(false);

    if (error) {
      toast.error(error.message, "Markdown import mislukt");
      return;
    }

    const importedCount = data?.length || rows.length;
    setImportResult(`${importedCount} artikel(en) geïmporteerd naar de Wiki.`);
    toast.success(`${importedCount} artikel(en) geïmporteerd.`);
    setImportFiles([]);
    await loadAll();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/wiki" className="text-sm font-semibold text-cyan-100 no-underline hover:text-white">
            ← Terug naar wiki
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Wiki beheer</h1>
          <p className="mt-1 text-sm text-cyan-50/85">
            Maak artikelen aan, beheer categorieën en publiceer kennis voor contractmanagement en governance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setTab("categories")}>Categorieën</button>
          <button className="btn" onClick={() => setTab("import")}>Markdown import</button>
          <button className="btn btn-primary" onClick={startNewArticle}>Nieuw artikel</button>
        </div>
      </div>

      {err ? <Notice title="Wiki beheer" tone="danger">{err}</Notice> : null}

      <div className="flex gap-2">
        <button className={"btn " + (tab === "articles" ? "btn-primary" : "")} onClick={() => setTab("articles")}>Artikelen</button>
        <button className={"btn " + (tab === "categories" ? "btn-primary" : "")} onClick={() => setTab("categories")}>Categorieën</button>
        <button className={"btn " + (tab === "import" ? "btn-primary" : "")} onClick={() => setTab("import")}>Markdown import</button>
      </div>

      {tab === "articles" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Artikel editor</h2>
                <p className="text-sm text-slate-600">Gebruik eenvoudige Markdown-koppen met #, ## en lijsten met -.</p>
              </div>
              {articleForm.id ? <span className="badge">Bewerken</span> : <span className="badge">Nieuw</span>}
            </div>
            <form onSubmit={saveArticle} className="mt-5 grid gap-4">
              <label className="grid gap-1">
                Titel
                <input
                  value={articleForm.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setArticleForm((prev) => ({
                      ...prev,
                      title,
                      slug: prev.slug || slugify(title),
                    }));
                  }}
                  placeholder="Bijv. Bewaartermijnen contractdocumentatie"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  Slug
                  <input
                    value={articleForm.slug}
                    onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                    placeholder="bewaartermijnen-contractdocumentatie"
                  />
                </label>
                <label className="grid gap-1">
                  Status
                  <select
                    value={articleForm.status}
                    onChange={(e) => setArticleForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                      is_published: e.target.value === "published",
                    }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1">
                Categorie
                <select
                  value={articleForm.category}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Geen categorie</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                Samenvatting
                <textarea
                  value={articleForm.summary}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, summary: e.target.value }))}
                  rows={2}
                  placeholder="Korte omschrijving voor de overzichtskaart..."
                />
              </label>
              <label className="grid gap-1">
                Content
                <textarea
                  value={articleForm.content}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={14}
                  placeholder="# Titel\n\n## Onderwerp\n- Punt 1\n- Punt 2"
                />
              </label>
              <label className="grid gap-1">
                Tags, gescheiden door komma's
                <input
                  value={articleForm.tagsText}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, tagsText: e.target.value }))}
                  placeholder="AVG, Contracten, Governance"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" className="btn" onClick={() => setArticleForm(emptyArticle)}>Leegmaken</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Opslaan..." : "Artikel opslaan"}
                </button>
              </div>
            </form>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Artikelen</h2>
              <span className="badge">{articles.length}</span>
            </div>
            <input
              className="mt-4 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek artikel..."
            />
            <div className="mt-4 max-h-[720px] space-y-3 overflow-auto pr-1">
              {loading ? <div className="text-sm text-slate-500">Laden...</div> : null}
              {filteredArticles.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{a.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {a.category || "Geen categorie"} · {a.status || (a.is_published ? "published" : "draft")}
                      </div>
                    </div>
                    <span className="badge">{a.slug}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn" onClick={() => editArticle(a)}>Bewerken</button>
                    <Link className="btn" to={`/wiki/${a.slug || a.id}`}>Openen</Link>
                    <button className="btn btn-danger" onClick={() => deleteArticle(a)}>Verwijderen</button>
                  </div>
                </div>
              ))}
              {!loading && !filteredArticles.length ? <div className="text-sm text-slate-500">Geen artikelen gevonden.</div> : null}
            </div>
          </section>
        </div>
      ) : tab === "import" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Markdown import</h2>
                <p className="text-sm text-slate-600">
                  Importeer één of meerdere .md bestanden direct als Wiki-artikel in Supabase.
                </p>
              </div>
              <span className="badge">.md → wiki_articles</span>
            </div>

            <form onSubmit={importMarkdownFiles} className="mt-5 grid gap-4">
              <label className="grid gap-1">
                Markdown bestanden
                <input
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  multiple
                  onChange={(e) => setImportFiles(Array.from(e.target.files || []))}
                />
              </label>

              <label className="grid gap-1">
                Categorie
                <select value={importCategory} onChange={(e) => setImportCategory(e.target.value)}>
                  <option value="">Geen categorie</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  Status
                  <select value={importStatus} onChange={(e) => setImportStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  Tags
                  <input
                    value={importTagsText}
                    onChange={(e) => setImportTagsText(e.target.value)}
                    placeholder="wiki, contractmanagement, governance"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">Importregels</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>De eerste <code># titel</code> wordt gebruikt als artikeltitel.</li>
                  <li>De eerste normale tekstregel wordt gebruikt als samenvatting.</li>
                  <li>Bestanden met dezelfde slug worden bijgewerkt.</li>
                  <li>De volledige markdown wordt opgeslagen in <code>wiki_articles.content</code>.</li>
                </ul>
              </div>

              {importFiles.length ? (
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                  <div className="text-sm font-bold text-cyan-900">Geselecteerde bestanden</div>
                  <div className="mt-2 space-y-1 text-sm text-cyan-800">
                    {importFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`}>📄 {file.name}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {importResult ? <Notice title="Import voltooid" tone="success">{importResult}</Notice> : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setImportFiles([]);
                    setImportResult("");
                  }}
                >
                  Selectie wissen
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing || !importFiles.length}>
                  {importing ? "Importeren..." : "Markdown importeren"}
                </button>
              </div>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">Waarom importeren naar Supabase?</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="font-bold text-slate-900">Centrale kennisbank</div>
                <p className="mt-1">Artikelen zijn direct beschikbaar voor alle gebruikers binnen dezelfde organisatie.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="font-bold text-slate-900">Zoekbaar & beheerbaar</div>
                <p className="mt-1">De content wordt meegenomen in de bestaande Wiki-zoekfunctie, categorieën en tags.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="font-bold text-slate-900">Rechten via RLS</div>
                <p className="mt-1">Opslag loopt via Supabase en valt onder de bestaande Wiki-rechtenstructuur.</p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Categorie editor</h2>
              {categoryForm.id ? <span className="badge">Bewerken</span> : <span className="badge">Nieuw</span>}
            </div>
            <form onSubmit={saveCategory} className="mt-5 grid gap-4">
              <label className="grid gap-1">
                Naam
                <input
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm((prev) => ({ ...prev, name, slug: prev.slug || slugify(name) }));
                  }}
                  placeholder="Bijv. Privacy & AVG"
                />
              </label>
              <label className="grid gap-1">
                Slug
                <input
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  placeholder="privacy-avg"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1">
                  Kleur
                  <select
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, color: e.target.value }))}
                  >
                    <option value="blue">Blauw</option>
                    <option value="green">Groen</option>
                    <option value="red">Rood</option>
                    <option value="purple">Paars</option>
                    <option value="amber">Oranje</option>
                    <option value="slate">Grijs</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  Icoon
                  <input
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="bijv. shield"
                  />
                </label>
                <label className="grid gap-1">
                  Volgorde
                  <input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" className="btn" onClick={() => setCategoryForm(emptyCategory)}>Nieuwe categorie</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Opslaan..." : "Categorie opslaan"}
                </button>
              </div>
            </form>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Categorieën</h2>
              <span className="badge">{categories.length}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {categories.map((c) => {
                const count = articles.filter((a) => a.category === c.name).length;
              
  function parseMarkdownArticle(fileName, markdown) {
    const raw = String(markdown || "").replace(/\r\n/g, "\n").trim();
    const lines = raw.split("\n");
    const firstHeading = lines.find((line) => line.trim().startsWith("# "));
    const fallbackTitle = fileName
      .replace(/\.md$/i, "")
      .replace(/^\d+[_-]?/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    const title = firstHeading ? firstHeading.replace(/^#\s+/, "").trim() : fallbackTitle;
    const summary = lines
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("```"));

    return {
      title: title || fallbackTitle || "Nieuw wiki-artikel",
      slug: slugify(title || fallbackTitle || fileName),
      summary: summary || null,
      content: raw,
    };
  }

  async function importMarkdownFiles(e) {
    e.preventDefault();
    if (!client || !orgId) return;
    if (!importFiles.length) {
      toast.error("Kies eerst één of meerdere .md bestanden.");
      return;
    }

    setImporting(true);
    setImportResult("");

    const rows = [];
    for (const file of importFiles) {
      if (!file.name.toLowerCase().endsWith(".md")) continue;
      const markdown = await file.text();
      const parsed = parseMarkdownArticle(file.name, markdown);
      rows.push({
        organization_id: orgId,
        title: parsed.title,
        slug: parsed.slug,
        category: importCategory || null,
        summary: parsed.summary,
        content: parsed.content,
        tags: textToTags(importTagsText),
        status: importStatus,
        is_published: importStatus === "published",
        created_by: session?.user?.id || null,
        updated_by: session?.user?.id || null,
        updated_at: new Date().toISOString(),
      });
    }

    if (!rows.length) {
      setImporting(false);
      toast.error("Geen geldige .md bestanden gevonden.");
      return;
    }

    const { data, error } = await client
      .from("wiki_articles")
      .upsert(rows, { onConflict: "organization_id,slug" })
      .select("id,title");

    setImporting(false);

    if (error) {
      toast.error(error.message, "Markdown import mislukt");
      return;
    }

    const importedCount = data?.length || rows.length;
    setImportResult(`${importedCount} artikel(en) geïmporteerd naar de Wiki.`);
    toast.success(`${importedCount} artikel(en) geïmporteerd.`);
    setImportFiles([]);
    await loadAll();
  }

  return (
                  <div key={c.id || c.name} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.slug} · {count} artikel(en)</div>
                      </div>
                      <span className="badge">{c.color || "blue"}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="btn" onClick={() => editCategory(c)}>Bewerken</button>
                      <button className="btn btn-danger" onClick={() => deleteCategory(c)}>Verwijderen</button>
                    </div>
                  </div>
                );
              })}
              {!categories.length ? <div className="text-sm text-slate-500">Nog geen categorieën.</div> : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
