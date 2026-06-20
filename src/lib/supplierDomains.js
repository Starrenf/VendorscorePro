export const SUPPLIER_DOMAIN_OPTIONS = [
  { value: 'ICT', label: 'ICT' },
  { value: 'Vastgoed & Gebouwen', label: 'Vastgoed & Gebouwen' },
  { value: 'Facilitaire Diensten', label: 'Facilitaire Diensten' },
  { value: 'Onderwijs', label: 'Onderwijs' },
  { value: 'HR', label: 'HR' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Inkoop/Juridisch', label: 'Inkoop/Juridisch' },
  { value: 'Security & Privacy', label: 'Security & Privacy' },
  { value: 'AI', label: 'AI' },
  { value: 'Generiek', label: 'Generiek' },
];

const ICT_ALIASES = [
  'ict',
  'it',
  'informatievoorziening',
  'iv',
  'sis',
  'studentinformatiesysteem',
  'student informatie systeem',
  'student informatie',
  'onderwijslogistiek',
  'lms',
  'elo',
  'roostering',
  'rooster',
  'itsm',
  'servicemanagement',
  'service management',
  'toetsing',
  'examinering',
  'examen',
  'cloud',
  'saas',
  'iam',
  'identity',
  'security',
  'applicatie',
  'applicaties',
];

export function normalizeSupplierDomain(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Generiek';
  if (ICT_ALIASES.includes(raw)) return 'ICT';
  if (['vastgoed & gebouwen', 'vastgoed', 'huisvesting', 'housing', 'gebouwenbeheer', 'gebouwen', 'gebouwbeheer'].includes(raw)) return 'Vastgoed & Gebouwen';
  if (['facilitaire diensten', 'facilitair', 'facility', 'facilities'].includes(raw)) return 'Facilitaire Diensten';
  if (['onderwijs', 'onderwijsdiensten'].includes(raw)) return 'Onderwijs';
  if (['hr', 'personeel', 'p&o'].includes(raw)) return 'HR';
  if (['finance', 'financiën', 'financien'].includes(raw)) return 'Finance';
  if (['inkoop/juridisch', 'inkoop', 'juridisch', 'legal'].includes(raw)) return 'Inkoop/Juridisch';
  if (['security & privacy', 'security', 'privacy', 'ciso', 'fg'].includes(raw)) return 'Security & Privacy';
  if (['ai', 'ai governance', 'kunstmatige intelligentie'].includes(raw)) return 'AI';
  if (['generiek', 'algemeen', 'overig'].includes(raw)) return 'Generiek';
  return String(value || '').trim() || 'Generiek';
}

export function supplierDomainLabel(value) {
  const normalized = normalizeSupplierDomain(value);
  return SUPPLIER_DOMAIN_OPTIONS.find((opt) => opt.value === normalized)?.label || normalized || 'Generiek';
}

export function supplierDomainChoices(value) {
  const normalized = normalizeSupplierDomain(value);
  const domains = normalized === 'Generiek' ? ['Generiek'] : [normalized, 'Generiek'];
  return Array.from(new Set(domains));
}
