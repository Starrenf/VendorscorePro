import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Layers3, ShieldCheck, Workflow } from "lucide-react";
import "./architecture.css";

export default function MoraAbout() {
  return (
    <div className="space-y-6">
      <div className="arch-hero">
        <div className="arch-hero-brand">
          <div className="arch-mora-logo-wrap">
            <img src="/architecture/mora-logo.png" onError={(e) => { e.currentTarget.src = "/architecture/mora-logo-placeholder.svg"; }} alt="MORA" className="arch-mora-logo" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">Uitleg & positionering</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">MORA in Governix</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/78">MORA helpt om onderwijsprocessen, applicaties, informatievoorziening en ketens gestructureerd inzichtelijk te maken. Governix gebruikt deze laag om governance en leveranciersrisico te verbinden met architectuurimpact.</p>
          </div>
        </div>
        <Link to="/architecture" className="btn bg-white text-[#0c4f9f] hover:bg-white/90">Naar cockpit</Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <BookOpen className="h-7 w-7 text-blue-700" />
          <h2 className="mt-3 text-xl font-bold">Wat is MORA?</h2>
          <p className="mt-2 text-sm text-slate-600">MORA staat voor Middelbaar Onderwijs Referentie Architectuur. Het biedt een gedeelde taal en structuur voor processen, applicaties, informatieobjecten en ketens binnen het mbo.</p>
        </div>
        <div className="card p-5">
          <ShieldCheck className="h-7 w-7 text-emerald-700" />
          <h2 className="mt-3 text-xl font-bold">Waarom koppelen aan governance?</h2>
          <p className="mt-2 text-sm text-slate-600">Een applicatie is pas goed bestuurbaar als je weet waar deze in de keten zit, welke leverancier erbij hoort, welke contracten eraan hangen en welke risico’s ontstaan bij uitval.</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-900">Van architectuur naar actie</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ["MORA", "Architectuurcomponenten"],
            ["Applicaties", "Governix data"],
            ["Leveranciers", "Contracten & eigenaar"],
            ["Governance", "Checklist & risico"],
            ["Actie", "Cockpit-resultaten"],
          ].map(([title, text], idx) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <Layers3 className="mx-auto h-6 w-6 text-blue-700" />
              <div className="mt-2 font-bold text-slate-900">{title}</div>
              <div className="mt-1 text-xs text-slate-500">{text}</div>
              {idx < 4 ? <ArrowRight className="mx-auto mt-3 hidden h-5 w-5 text-slate-300 md:block" /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-3">
          <Workflow className="mt-1 h-6 w-6 text-violet-700" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Visuele uitgangspunten</h2>
            <p className="mt-2 text-sm text-slate-600">De cockpit gebruikt klikbare tegels, stoplichten, voortgangsbalken en directe query-resultaten. Hierdoor zie je meteen waar je staat en wat nog moet gebeuren.</p>
            <ul className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <li>• Gekoppeld aan MORA: groen</li>
              <li>• Match kandidaat: oranje</li>
              <li>• Niet gekoppeld: rood</li>
              <li>• BIV of datakwaliteit incompleet: paars/grijs</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card p-5 bg-slate-50">
        <h2 className="font-bold text-slate-900">Logo toevoegen</h2>
        <p className="mt-1 text-sm text-slate-600">Plaats het officiële MORA-logo later in <code>public/architecture/mora-logo.png</code>. Tot die tijd toont Governix automatisch een nette placeholder.</p>
      </div>
    </div>
  );
}
