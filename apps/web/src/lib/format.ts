import type { Language } from '@uspomena/shared';

/** Locale used for Intl formatting, matching the prototype's language list. */
export const intlLocale = (locale: Language): string =>
  locale === 'en' ? 'en-GB' : locale === 'ru' ? 'ru-RU' : 'sr-Latn-RS';

const toDate = (iso: string): Date => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);

export const formatDate = (
  iso: string | null | undefined,
  locale: Language,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string => (iso ? toDate(iso).toLocaleDateString(intlLocale(locale), options) : '');

export const weekday = (iso: string, locale: Language): string => formatDate(iso, locale, { weekday: 'long' });

export const formatDateTime = (iso: string | null | undefined, locale: Language): string =>
  iso
    ? new Date(iso).toLocaleString(intlLocale(locale), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export const daysUntil = (isoDate: string): number => {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};
