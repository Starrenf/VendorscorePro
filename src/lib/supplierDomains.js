export const SUPPLIER_DOMAIN_OPTIONS = [
  { value: 'ict', label: 'ICT' },
  { value: 'facilitair', label: 'Facilitair' },
  { value: 'huisvesting', label: 'Huisvesting' },
  { value: 'generiek', label: 'Generiek' },
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
  if (!raw) return 'generiek';
  if (ICT_ALIASES.includes(raw)) return 'ict';
  if (['facilitair', 'facility', 'facilities', 'gebouwenbeheer'].includes(raw)) return 'facilitair';
  if (['huisvesting', 'housing', 'vastgoed'].includes(raw)) return 'huisvesting';
  if (['generiek', 'algemeen', 'overig'].includes(raw)) return 'generiek';
  return raw;
}

export function supplierDomainLabel(value) {
  const normalized = normalizeSupplierDomain(value);
  return SUPPLIER_DOMAIN_OPTIONS.find((opt) => opt.value === normalized)?.label || 'Generiek';
}

export function supplierDomainChoices(value) {
  const normalized = normalizeSupplierDomain(value);
  const domains = normalized === 'generiek' ? ['generiek'] : [normalized, 'generiek'];
  return Array.from(new Set(domains));
}
