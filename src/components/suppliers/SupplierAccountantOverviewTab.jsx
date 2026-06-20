import { useEffect, useMemo, useState } from "react";
import Notice from "../Notice";
import { useToast } from "../ToastProvider";
import { supabase } from "../../lib/supabase";

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("nl-NL");
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return String(value || "leverancier")
    .replaceAll(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replaceAll(/\s+/g, "_")
    .slice(0, 80);
}

function KeyValue({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function SupplierAccountantOverviewTab({ supplier, organization }) {
  const toast = useToast();
  const client = supabase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    overview: null,
    contracts: [],
    applications: [],
    summaries: [],
    documents: [],
    subprocessors: [],
    meetings: [],
    actions: [],
    risks: [],
  });

  const orgId = supplier?.organization_id || organization?.id;

  useEffect(() => {
    if (!supplier?.id || !orgId || !client) return;
    loadAll();
  }, [supplier?.id, orgId, client]);

  async function safeSelect(table, queryBuilder, fallback = []) {
    try {
      const { data, error } = await queryBuilder;
      if (error) {
        console.warn(`${table} load failed`, error);
        return fallback;
      }
      return data || fallback;
    } catch (err) {
      console.warn(`${table} load failed`, err);
      return fallback;
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const overview = await safeSelect(
        "supplier_accountant_overview_view",
        client
          .from("supplier_accountant_overview_view")
          .select("*")
          .eq("id", supplier.id)
          .eq("organization_id", orgId)
          .maybeSingle(),
        null,
      );

      const contracts = await safeSelect(
        "supplier_contracts",
        client
          .from("supplier_contracts")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
      );

      const applications = await safeSelect(
        "applications",
        client
          .from("applications")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
      );

      const appIds = (applications || []).map((a) => a.id).filter(Boolean);
      let summaries = [];
      if (appIds.length) {
        summaries = await safeSelect(
          "application_contract_summaries",
          client
            .from("application_contract_summaries")
            .select("*")
            .in("application_id", appIds)
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false }),
        );
      }

      const documents = await safeSelect(
        "supplier_documents",
        client
          .from("supplier_documents")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
      );

      const subprocessors = await safeSelect(
        "subprocessors",
        client
          .from("subprocessors")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
      );

      const meetings = await safeSelect(
        "supplier_meetings",
        client
          .from("supplier_meetings")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("meeting_date", { ascending: false }),
      );

      const actions = await safeSelect(
        "supplier_actions",
        client
          .from("supplier_actions")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("due_date", { ascending: true }),
      );

      const risks = await safeSelect(
        "supplier_risk_profiles",
        client
          .from("supplier_risk_profiles")
          .select("*")
          .eq("supplier_id", supplier.id)
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
      );

      setData({
        overview,
        contracts,
        applications,
        summaries,
        documents,
        subprocessors,
        meetings,
        actions,
        risks,
      });
    } catch (err) {
      setError(err?.message || "Accountant-overzicht kon niet worden geladen.");
    } finally {
      setLoading(false);
    }
  }

  const report = useMemo(() => {
    const overview = data.overview || {};
    const openActions = (data.actions || []).filter((a) => String(a.status || "").toLowerCase() !== "afgerond");
    const latestRisk = data.risks?.[0] || null;
    return {
      generatedAt: new Date(),
      supplierName: supplier?.name || overview.name || "Leverancier",
      organizationName: organization?.name || "Gilde Opleidingen",
      overview,
      openActions,
      latestRisk,
    };
  }, [data, supplier, organization]);

  function buildPlainText() {
    const lines = [];
    lines.push(`Accountant-overzicht leverancier: ${report.supplierName}`);
    lines.push(`Organisatie: ${report.organizationName}`);
    lines.push(`Gegenereerd op: ${report.generatedAt.toLocaleString("nl-NL")}`);
    lines.push("");
    lines.push("1. Basisgegevens");
    lines.push(`- Leverancier: ${report.supplierName}`);
    lines.push(`- KVK: ${supplier?.kvk_number || "Niet vastgelegd"}`);
    lines.push(`- Classificatie: ${supplier?.classification || "Niet vastgelegd"}`);
    lines.push(`- Domein/categorie: ${supplier?.category || "Niet vastgelegd"}`);
    lines.push(`- Status: ${supplier?.is_active === false ? "Inactief" : "Actief"}`);
    lines.push("");
    lines.push("2. Contract en governance");
    lines.push(`- Governance score: ${report.overview.governance_score ?? report.overview.governance_score_percent ?? 0}%`);
    lines.push(`- Checklist: ${report.overview.checked_items ?? report.overview.governance_checked_items ?? 0}/${report.overview.total_items ?? report.overview.governance_total_items ?? 0}`);
    lines.push(`- Contracten: ${data.contracts.length}`);
    lines.push(`- Documenten: ${data.documents.length}`);
    lines.push(`- Applicaties/kroonjuwelen: ${data.applications.length}`);
    lines.push(`- Subverwerkers/AI: ${data.subprocessors.length}`);
    lines.push(`- Open acties: ${report.openActions.length}`);
    lines.push("");
    lines.push("3. Contracten");
    data.contracts.forEach((c, i) => lines.push(`${i + 1}. ${c.title || c.contract_name || c.name || "Contract"} | einddatum: ${fmtDate(c.end_date || c.contract_end_date)} | status: ${c.status || "—"}`));
    if (!data.contracts.length) lines.push("Geen contractregels vastgelegd.");
    lines.push("");
    lines.push("4. Applicaties en contractsamenvattingen");
    data.applications.forEach((a, i) => {
      const summary = data.summaries.find((s) => s.application_id === a.id);
      lines.push(`${i + 1}. ${a.name || "Applicatie"} | status: ${a.status || "—"} | kroonjuweel: ${a.is_critical ? "ja" : "nee"}`);
      if (summary?.summary_text) lines.push(`   Samenvatting: ${summary.summary_text}`);
    });
    if (!data.applications.length) lines.push("Geen applicaties vastgelegd.");
    lines.push("");
    lines.push("5. Risico, acties en documentatie");
    if (report.latestRisk) lines.push(`- Laatste risicoscore: ${report.latestRisk.overall_risk_score || "—"}`);
    report.openActions.forEach((a, i) => lines.push(`${i + 1}. ${a.title || a.action || "Actie"} | deadline: ${fmtDate(a.due_date)} | status: ${a.status || "open"}`));
    if (!report.openActions.length) lines.push("Geen open acties gevonden.");
    lines.push("");
    lines.push("6. Audit / volledigheid");
    lines.push(`- Laatst bijgewerkt leverancier: ${fmtDate(supplier?.updated_at)}`);
    lines.push(`- Laatste overleg: ${fmtDate(report.overview.latest_meeting_date)}`);
    lines.push(`- Laatste contractsamenvatting: ${fmtDate(report.overview.latest_contract_summary_updated_at)}`);
    return lines.join("\n");
  }

  function exportWord() {
    const text = buildPlainText();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Accountant-overzicht</title><style>body{font-family:Arial,sans-serif;line-height:1.45;color:#111827}h1{color:#0f3769}pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style></head><body><h1>Accountant-overzicht leverancier</h1><pre>${escapeHtml(text)}</pre></body></html>`;
    downloadBlob(`accountant_${safeFileName(report.supplierName)}.doc`, html, "application/msword;charset=utf-8");
    toast?.success?.("Accountant-overzicht geëxporteerd naar Word.");
  }

  function exportCsv() {
    const rows = [
      ["Onderdeel", "Waarde"],
      ["Leverancier", report.supplierName],
      ["Organisatie", report.organizationName],
      ["Governance score", `${report.overview.governance_score ?? report.overview.governance_score_percent ?? 0}%`],
      ["Checklist", `${report.overview.checked_items ?? report.overview.governance_checked_items ?? 0}/${report.overview.total_items ?? report.overview.governance_total_items ?? 0}`],
      ["Contracten", data.contracts.length],
      ["Documenten", data.documents.length],
      ["Applicaties", data.applications.length],
      ["Subverwerkers/AI", data.subprocessors.length],
      ["Open acties", report.openActions.length],
      ["Laatste overleg", fmtDate(report.overview.latest_meeting_date)],
      ["Gegenereerd op", report.generatedAt.toLocaleString("nl-NL")],
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    downloadBlob(`accountant_${safeFileName(report.supplierName)}.csv`, csv, "text/csv;charset=utf-8");
    toast?.success?.("Accountant-overzicht geëxporteerd naar CSV.");
  }

  if (loading) return <div className="card p-6 text-sm text-slate-600">Accountant-overzicht laden…</div>;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Accountant-overzicht</h2>
          <p className="mt-1 text-sm text-slate-600">
            Bundel per leverancier de belangrijkste contract-, governance-, risico- en compliance-informatie voor accountantscontrole of interne verantwoording.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" type="button" onClick={loadAll}>Verversen</button>
          <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-primary" type="button" onClick={exportWord}>Export Word</button>
        </div>
      </div>

      {error ? <Notice title="Let op" tone="warning">{error}</Notice> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <KeyValue label="Governance" value={`${report.overview.governance_score ?? report.overview.governance_score_percent ?? 0}%`} />
        <KeyValue label="Contracten" value={data.contracts.length} />
        <KeyValue label="Documenten" value={data.documents.length} />
        <KeyValue label="Open acties" value={report.openActions.length} />
      </div>

      <Section title="Basisgegevens">
        <div className="grid gap-3 md:grid-cols-3">
          <KeyValue label="Leverancier" value={report.supplierName} />
          <KeyValue label="KVK" value={supplier?.kvk_number} />
          <KeyValue label="Classificatie" value={supplier?.classification} />
          <KeyValue label="Categorie" value={supplier?.category} />
          <KeyValue label="Status" value={supplier?.is_active === false ? "Inactief" : "Actief"} />
          <KeyValue label="Laatst bijgewerkt" value={fmtDate(supplier?.updated_at)} />
        </div>
      </Section>

      <Section title="Contracten en contract-samenvattingen" right={<span className="badge">{data.contracts.length} contract(en)</span>}>
        <div className="space-y-3">
          {data.contracts.length ? data.contracts.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="font-semibold">{c.title || c.contract_name || c.name || "Contract"}</div>
              <div className="mt-1 text-sm text-slate-600">Status: {c.status || "—"} • Einddatum: {fmtDate(c.end_date || c.contract_end_date)} • Opzegtermijn: {c.notice_period || c.termination_notice || "—"}</div>
            </div>
          )) : <div className="text-sm text-slate-500">Geen contractregels vastgelegd.</div>}
        </div>
      </Section>

      <Section title="Applicaties / kroonjuwelen" right={<span className="badge">{data.applications.length} applicatie(s)</span>}>
        <div className="space-y-3">
          {data.applications.length ? data.applications.map((a) => {
            const summary = data.summaries.find((s) => s.application_id === a.id);
            return (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{a.name || "Applicatie"}</div>
                  <span className="badge">{a.is_critical ? "Kroonjuweel" : a.status || "applicatie"}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">{a.description || "Geen omschrijving vastgelegd."}</div>
                {summary ? (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="font-semibold">Contractsamenvatting v{summary.version || "1.0"}</div>
                    <div className="mt-1 line-clamp-4 whitespace-pre-wrap">{summary.summary_text || "Geen tekst vastgelegd."}</div>
                  </div>
                ) : null}
              </div>
            );
          }) : <div className="text-sm text-slate-500">Geen applicaties vastgelegd.</div>}
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Risico en open acties">
          <div className="space-y-3 text-sm">
            {report.latestRisk ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="font-semibold">Risicoscore: {report.latestRisk.overall_risk_score || "—"}</div>
                <div className="mt-1 text-slate-600">{report.latestRisk.notes || "Geen toelichting vastgelegd."}</div>
              </div>
            ) : <div className="text-slate-500">Geen risicoprofiel vastgelegd.</div>}
            {report.openActions.length ? report.openActions.map((a) => (
              <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="font-semibold">{a.title || a.action || "Actie"}</div>
                <div className="text-slate-600">Deadline: {fmtDate(a.due_date)} • Status: {a.status || "open"}</div>
              </div>
            )) : <div className="text-slate-500">Geen open acties gevonden.</div>}
          </div>
        </Section>

        <Section title="Documentatie en compliance">
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <KeyValue label="Documenten" value={data.documents.length} />
              <KeyValue label="Subverwerkers/AI" value={data.subprocessors.length} />
              <KeyValue label="Overleggen" value={data.meetings.length} />
              <KeyValue label="Laatste overleg" value={fmtDate(report.overview.latest_meeting_date)} />
            </div>
            {data.documents.slice(0, 5).map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-2">
                {d.title || d.name || d.file_name || "Document"} <span className="text-slate-500">({d.document_type || d.type || "document"})</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Notice title="Aanvulling voor audit/accountant">
        Dit overzicht is bedoeld als verzamelrapport. Controleer vóór verzending of alle contractdocumenten, verwerkersafspraken, SLA/DAP-documenten en eventuele besluiten formeel zijn vastgelegd.
      </Notice>
    </div>
  );
}
