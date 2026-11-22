/**
 * Phone rules from the prototype's `src/utils/phone.js` (minus its i18n helpers,
 * which stay in the locale files). Serbian numbers entered with a leading `0`
 * become `+381…`; anything that is not 8–15 digits after `+` is rejected.
 */

export const normalizePhone = (input: unknown): string => {
  let value = String(input ?? '')
    .trim()
    .replace(/[\s\-/().]/g, '');
  if (!value) return '';
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  else if (value.startsWith('0')) value = `+381${value.slice(1)}`;
  else if (!value.startsWith('+')) value = `+${value}`;
  return /^\+\d{8,15}$/.test(value) ? value : '';
};

export const isValidPhone = (input: unknown): boolean => normalizePhone(input) !== '';

/** Formats a stored `+381…` number for display; other numbers are returned as stored. */
export const formatPhone = (phone?: string | null): string => {
  if (!phone) return '';
  const match = /^\+381(\d{2})(\d{3})(\d{3,4})$/.exec(phone);
  return match ? `+381 ${match[1]} ${match[2]} ${match[3]}` : phone;
};
