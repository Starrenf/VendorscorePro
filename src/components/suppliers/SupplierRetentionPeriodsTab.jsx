import Notice from "../Notice";

const RETENTION_ROWS = [
  {
    domain: "Fiscale administratie",
    record: "Basisgegevens administratie (grootboek, debiteuren/crediteuren, inkoop/verkoop, voorraad, loonadministratie voor zover fiscaal relevant)",
    period: "7 jaar",
    basis: "Fiscale bewaarplicht / Belastingdienst",
    action: "Gebruik dit als minimale bewaartermijn voor contract- en facturatiedossiers met fiscale relevantie.",
  },
  {
    domain: "Fiscale administratie",
    record: "Gegevens over onroerende zaken",
    period: "10 jaar",
    basis: "Fiscale bewaarplicht / Belastingdienst",
    action: "Alleen relevant als leverancier/contract betrekking heeft op vastgoed of onroerende zaken.",
  },
  {
    domain: "AVG / persoonsgegevens",
    record: "Persoonsgegevens algemeen",
    period: "Niet langer dan noodzakelijk",
    basis: "AVG opslagbeperking",
    action: "Leg per verwerking doel, grondslag, bewaartermijn en verwijdermoment vast in DPA/DPIA of verwerkingsregister.",
  },
  {
    domain: "AVG / medewerkers",
    record: "Kopie identiteitsbewijs werknemer",
    period: "Minimaal 5 jaar na einde kalenderjaar uitdiensttreding",
    basis: "Identificatieplicht werkgever",
    action: "Alleen opnemen indien leverancier HR-/personeelsgegevens verwerkt.",
  },
  {
    domain: "Contractmanagement",
    record: "Contract, SLA, DPA, offertes, addenda, gespreksverslagen, verlengingen",
    period: "Beleidsmatig vastleggen; advies: minimaal looptijd + 7 jaar",
    basis: "Geen generieke wettelijke termijn; koppelen aan fiscale bewaarplicht, bewijspositie en audit/accountant",
    action: "Gebruik als Gilde-werkafspraak voor leveranciersdossiers en accountant-overzichten.",
  },
  {
    domain: "Inkoop / aanbesteding",
    record: "Aanbestedingsdossier, gunningsbesluit, inschrijvingen, beoordelingsdocumenten",
    period: "Organisatiebeleid / archiefselectielijst controleren",
    basis: "Afhankelijk van publieke sector/archiefbeleid en type procedure",
    action: "Neem dit als aandachtspunt op bij contracten met aanbestedingsrisico.",
  },
  {
    domain: "Security & logging",
    record: "Logging, audittrail, incidentregistratie, datalekregistratie",
    period: "Per verwerking/doel vastleggen",
    basis: "AVG, securitybeleid, DPA/SLA en proportionaliteit",
    action: "Leg in Governix vast of de leverancier logging bewaart, hoe lang en wie toegang heeft.",
  },
];

const CHECKLIST = [
  "Is er een contractuele bewaartermijn opgenomen?",
  "Is de bewaartermijn afgestemd op doel, grondslag en AVG-minimalisatie?",
  "Is duidelijk wie data verwijdert na einde contract?",
  "Is data-export vóór verwijdering geregeld?",
  "Zijn back-ups, logs en audittrails apart benoemd?",
  "Is er een aantoonbare vernietigingsverklaring of exitrapport mogelijk?",
  "Zijn accountant-/fiscale bewaarplichten meegenomen?",
];

export default function SupplierRetentionPeriodsTab() {
  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-lg font-semibold">Bewaartermijnen</h2>
        <p className="mt-1 text-sm text-slate-600">
          Naslag voor wettelijke en beleidsmatige bewaartermijnen binnen contract-, governance- en leveranciersdossiers.
        </p>
      </div>

      <Notice title="Let op" tone="warning">
        Dit overzicht is bedoeld als praktische contractmanagement-referentie. Controleer bij twijfel altijd het geldende Gilde-archiefbeleid, de DPA/DPIA en juridisch advies.
      </Notice>

      <div className="card p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 border-b border-slate-200">
              <th className="py-2 pr-4">Domein</th>
              <th className="py-2 pr-4">Gegeven/document</th>
              <th className="py-2 pr-4">Bewaartermijn</th>
              <th className="py-2 pr-4">Basis</th>
              <th className="py-2 pr-4">Actie in Governix</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_ROWS.map((row, index) => (
              <tr key={index} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4 font-medium text-slate-900">{row.domain}</td>
                <td className="py-3 pr-4 text-slate-700">{row.record}</td>
                <td className="py-3 pr-4 font-semibold text-slate-900">{row.period}</td>
                <td className="py-3 pr-4 text-slate-700">{row.basis}</td>
                <td className="py-3 pr-4 text-slate-700">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="font-semibold">Checklist per leverancier</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 list-disc pl-5">
            {CHECKLIST.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="card p-4">
          <div className="font-semibold">Aanbevolen velden voor later</div>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <div><strong>bewaartermijn_contract:</strong> looptijd + x jaar</div>
            <div><strong>bewaartermijn_persoonsgegevens:</strong> per verwerking</div>
            <div><strong>bewaartermijn_logs:</strong> aantal dagen/maanden</div>
            <div><strong>verwijderafspraak:</strong> ja/nee + bewijs</div>
            <div><strong>exit_retention_notes:</strong> afspraken bij beëindiging</div>
          </div>
        </div>
      </div>
    </div>
  );
}
