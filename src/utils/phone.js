/**
 * Broj telefona naloga (mladenaca) – koristi se da ih dizajner/podrška kontaktira
 * (custom dizajn, štampa albuma…). Čuva se normalizovan u međunarodnom obliku: +381641234567.
 */

/** "064/123-45-67", "00381 64 123 4567", "+381 64 1234567" → "+381641234567"; nevažeće → '' */
export function normalizePhone(input) {
  let s = String(input || '').trim().replace(/[\s\-/().]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (s.startsWith('0')) s = `+381${s.slice(1)}`; // domaći format → Srbija
  else if (!s.startsWith('+')) s = `+${s}`;
  return /^\+\d{8,15}$/.test(s) ? s : '';
}

export const isValidPhone = (input) => normalizePhone(input) !== '';

/** "+381641234567" → "+381 64 123 4567" (ostale zemlje: samo razmak posle pozivnog broja) */
export function formatPhone(phone) {
  if (!phone) return '';
  const m = /^\+381(\d{2})(\d{3})(\d{3,4})$/.exec(phone);
  if (m) return `+381 ${m[1]} ${m[2]} ${m[3]}`;
  return phone;
}

export const PHONE_HINT = 'Na ovaj broj vas kontaktiramo za custom dizajn, štampu albuma i slično.';
export const PHONE_ERROR = 'Unesite ispravan broj telefona, npr. 064 123 4567.';
