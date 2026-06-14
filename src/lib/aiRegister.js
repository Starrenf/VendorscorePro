export const AI_RISK_CLASSIFICATIONS = [
  {
    value: "unacceptable",
    label: "Onaanvaardbaar risico",
    shortLabel: "Onaanvaardbaar",
    tone: "rose",
    description:
      "Verboden of niet-toegestane AI-toepassing. Alleen opnemen als afgewezen/historisch signaal, niet als actieve toepassing.",
    registerAdvice:
      "Niet actief gebruiken. Leg besluitvorming, blokkade en eventuele exit vast.",
  },
  {
    value: "high",
    label: "Hoog risico",
    shortLabel: "Hoog",
    tone: "amber",
    description:
      "AI met significante impact op veiligheid, gezondheid, grondrechten, onderwijsbeoordeling, HR, toegang of geautomatiseerde besluitvorming.",
    registerAdvice:
      "Uitgebreide registratie, DPIA/risicobeoordeling, menselijk toezicht, logging, documentatie en periodieke review verplicht stellen.",
  },
  {
    value: "limited",
    label: "Beperkt risico",
    shortLabel: "Beperkt",
    tone: "sky",
    description:
      "AI met transparantieplicht, zoals chatbots, generatieve AI of ondersteuning waarbij gebruikers moeten weten dat AI wordt gebruikt.",
    registerAdvice:
      "Leg transparantiemaatregelen, doel, data, leverancier en menselijke controle vast.",
  },
  {
    value: "minimal",
    label: "Minimaal risico",
    shortLabel: "Minimaal",
    tone: "emerald",
    description:
      "AI met geringe impact, zoals eenvoudige filtering of niet-kritische aanbevelingen zonder besluitvorming over personen.",
    registerAdvice:
      "Basisregistratie volstaat; blijf AVG, security en leveranciersafspraken controleren.",
  },
  {
    value: "unknown",
    label: "Onbekend / nog te beoordelen",
    shortLabel: "Onbekend",
    tone: "slate",
    description:
      "De risicoklasse is nog niet vastgesteld of de documentatie is onvoldoende.",
    registerAdvice:
      "Actie nodig: vraag leverancier om AI-documentatie, datastromen, modelinformatie en verwerkersinformatie.",
  },
];

export const AI_RISK_MAP = AI_RISK_CLASSIFICATIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

export function aiRiskLabel(value) {
  return AI_RISK_MAP[value]?.label || AI_RISK_MAP.unknown.label;
}

export function aiRiskTone(value) {
  return AI_RISK_MAP[value]?.tone || "slate";
}

export function aiRiskBadgeClass(value) {
  const tone = aiRiskTone(value);
  const map = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return map[tone] || map.slate;
}

export const AI_STATUS_OPTIONS = [
  { value: "concept", label: "Concept" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Goedgekeurd" },
  { value: "active", label: "Actief" },
  { value: "deprecated", label: "Uitgefaseerd" },
  { value: "rejected", label: "Afgewezen" },
];

export function aiStatusLabel(value) {
  return AI_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "Concept";
}

export const MITIGATION_TYPES = [
  { value: "privacy", label: "Privacy" },
  { value: "security", label: "Security" },
  { value: "legal", label: "Juridisch" },
  { value: "governance", label: "Governance" },
  { value: "transparency", label: "Transparantie" },
  { value: "human_oversight", label: "Menselijk toezicht" },
  { value: "technical", label: "Technisch" },
  { value: "contractual", label: "Contractueel" },
  { value: "other", label: "Overig" },
];

export const AI_RECOMMENDATIONS = [
  {
    title: "Hoog risico of automatische besluitvorming",
    trigger: "Hoog risico, onderwijsbeoordeling, HR/recruitment, profilering of automatische besluitvorming.",
    advice: "Voer DPIA/AI-risicobeoordeling uit, leg menselijk toezicht vast, borg logging en vraag leverancier om technische documentatie en conformiteitsinformatie.",
  },
  {
    title: "Persoonsgegevens of bijzondere persoonsgegevens",
    trigger: "AI verwerkt persoonsgegevens, studentgegevens, HR-data of gevoelige gegevens.",
    advice: "Controleer DPA, subverwerkers, datalocatie, bewaartermijn, doelbinding, proportionaliteit en rechten van betrokkenen.",
  },
  {
    title: "Generatieve AI of chatbot",
    trigger: "Gebruikers interacteren met AI of AI genereert tekst, beeld, advies of feedback.",
    advice: "Registreer transparantiemaatregelen: maak duidelijk dat AI wordt gebruikt en geef instructies voor veilig gebruik.",
  },
  {
    title: "Training op klantdata",
    trigger: "Leverancier gebruikt klantdata voor training of verbetering van modellen.",
    advice: "Alleen toestaan na expliciete juridische en privacybeoordeling. Leg opt-out/contractuele beperking vast.",
  },
  {
    title: "Onbekende datalocatie of non-EU verwerking",
    trigger: "Datalocatie onbekend of verwerking buiten EU/EER.",
    advice: "Vraag leverancier om datalocatie, doorgiftegrondslag, subverwerkerslijst en aanvullende waarborgen.",
  },
];

export function buildAiWarnings(item) {
  const warnings = [];
  const risk = item?.ai_risk_classification || "unknown";
  if (risk === "unacceptable") warnings.push("Onaanvaardbaar risico: actieve inzet niet toestaan.");
  if (risk === "high" && !item?.dpia_completed) warnings.push("Hoog risico zonder afgeronde DPIA/risicobeoordeling.");
  if (item?.processes_personal_data && !item?.dpa_present) warnings.push("AI verwerkt persoonsgegevens, maar DPA is niet vastgelegd.");
  if (item?.automated_decision_making && !item?.human_oversight) warnings.push("Automatische besluitvorming zonder menselijk toezicht.");
  if (item?.trains_on_customer_data) warnings.push("Training op klantdata: juridisch/privacy expliciet beoordelen.");
  if (!item?.data_location) warnings.push("Datalocatie onbekend.");
  if (item?.eu_data_storage === false) warnings.push("Non-EU of onbekende EU-opslag: doorgifte en waarborgen controleren.");
  if (!item?.subprocessor_known) warnings.push("Subverwerkersinformatie ontbreekt of is niet bevestigd.");
  return warnings;
}
