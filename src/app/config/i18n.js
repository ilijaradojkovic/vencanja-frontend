import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const modules = import.meta.glob('../../locales/*/*.json', { eager: true });

const overlayModules = import.meta.glob('../../locales/*/celebration/*.json', { eager: true });

const collect = (mods) => {
  const out = {};
  for (const [path, mod] of Object.entries(mods)) {
    const [, lng, ns] = path.match(/locales\/([a-z]+)\/(?:celebration\/)?([a-zA-Z]+)\.json$/);
    out[lng] = out[lng] || {};
    out[lng][ns] = mod.default;
  }
  return out;
};

const resources = collect(modules);
const celebration = collect(overlayModules);
const baseBundles = JSON.parse(JSON.stringify(resources));

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const deepMerge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  return out;
};

export const DEFAULT_LANGUAGE = 'sr';

export const LANGUAGES = [
  { code: 'sr', short: 'SR', label: 'Srpski', locale: 'sr-Latn-RS' },
  { code: 'en', short: 'EN', label: 'English', locale: 'en-GB' },
  { code: 'ru', short: 'RU', label: 'Русский', locale: 'ru-RU' },
];

const STORAGE_KEY = 'uspomena-lang';

const savedLanguage = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : null;
  } catch {
    return null;
  }
};

const setDocumentLanguage = (lng) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.title = i18n.t('common:meta.title', { lng });
};

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage() || DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((l) => l.code),
  ns: Object.keys(resources[DEFAULT_LANGUAGE] || {}),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  showSupportNotice: false,
  react: { bindI18nStore: 'added' },
});

setDocumentLanguage(i18n.language);

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* empty */
  }
  setDocumentLanguage(lng);
});

let currentEventType = 'wedding';

export function setEventType(type) {
  const next = type === 'celebration' ? 'celebration' : 'wedding';
  if (next === currentEventType) return;
  currentEventType = next;
  for (const [lng, namespaces] of Object.entries(baseBundles)) {
    for (const [ns, bundle] of Object.entries(namespaces)) {
      const merged = next === 'celebration' ? deepMerge(bundle, celebration[lng]?.[ns]) : bundle;
      i18n.addResourceBundle(lng, ns, merged, false, true);
    }
  }
  setDocumentLanguage(i18n.language);
}

export const currentLocale = () => (LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]).locale;

export default i18n;
