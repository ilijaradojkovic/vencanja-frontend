import { createInstance, type i18n } from 'i18next';
import type { Language } from '@uspomena/shared';

import en from '../../../locales/en/auth.json';
import ru from '../../../locales/ru/auth.json';
import sr from '../../../locales/sr/auth.json';
import { getLocale } from './locale';

/**
 * Server translation for the product pages (D13): every request creates its own
 * i18next instance from the `lang` cookie, so no language (or event-type) state
 * is shared between requests. Client components receive the strings they need as
 * a typed `copy` prop, which also keeps them easy to test.
 */
const RESOURCES = {
  sr: { auth: sr },
  en: { auth: en },
  ru: { auth: ru },
} as const;

export type Translator = {
  locale: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const createTranslator = async (locale: Language): Promise<Translator> => {
  const instance: i18n = createInstance();
  await instance.init({
    lng: locale,
    fallbackLng: 'sr',
    supportedLngs: ['sr', 'en', 'ru'],
    resources: RESOURCES,
    defaultNS: 'auth',
    initImmediate: false,
    interpolation: { escapeValue: false },
  });
  return { locale, t: (key, params) => String(instance.t(key, params ?? {})) };
};

/** Translator for the current request, from the `lang` cookie. */
export const getTranslator = async (): Promise<Translator> => createTranslator(await getLocale());
