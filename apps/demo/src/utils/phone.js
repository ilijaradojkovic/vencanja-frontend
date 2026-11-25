import i18n from '../app/config/i18n';

export function normalizePhone(input) {
  let s = String(input || '').trim().replace(/[\s\-/().]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (s.startsWith('0')) s = `+381${s.slice(1)}`;
  else if (!s.startsWith('+')) s = `+${s}`;
  return /^\+\d{8,15}$/.test(s) ? s : '';
}

export const isValidPhone = (input) => normalizePhone(input) !== '';

export function formatPhone(phone) {
  if (!phone) return '';
  const m = /^\+381(\d{2})(\d{3})(\d{3,4})$/.exec(phone);
  if (m) return `+381 ${m[1]} ${m[2]} ${m[3]}`;
  return phone;
}

export const phoneHint = () => i18n.t('common:phone.hint');
export const phoneError = () => i18n.t('common:phone.error');
