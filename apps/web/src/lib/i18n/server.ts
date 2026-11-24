import type { Language } from '@uspomena/shared';
import type { i18n } from 'i18next';

import { createI18nInstance } from './create';
import { getLocale } from './locale';

/**
 * Server translation (D13): every request creates its own i18next instance from the
 * `lang` cookie (and, for guest pages, the event type), so no language or celebration
 * overlay state is shared between concurrent requests. Client components get their
 * own instance through `LocaleProvider`.
 */
export type Translator = {
  locale: Language;
  i18n: i18n;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const createTranslator = (locale: Language, eventType: 'wedding' | 'celebration' = 'wedding'): Translator => {
  const i18n = createI18nInstance(locale, eventType);
  return { locale, i18n, t: (key, params) => String(i18n.t(key, params ?? {})) };
};

/** Translator for the current request, from the `lang` cookie. */
export const getTranslator = async (eventType: 'wedding' | 'celebration' = 'wedding'): Promise<Translator> =>
  createTranslator(await getLocale(), eventType);
