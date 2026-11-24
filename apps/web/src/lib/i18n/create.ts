import { createInstance, type i18n } from 'i18next';
import type { Language } from '@uspomena/shared';

import enAuth from '../../../locales/en/auth.json';
import enCommon from '../../../locales/en/common.json';
import enDashboard from '../../../locales/en/dashboard.json';
import enGuests from '../../../locales/en/guests.json';
import enInvite from '../../../locales/en/invite.json';
import enTemplates from '../../../locales/en/templates.json';
import enCelebrationCommon from '../../../locales/en/celebration/common.json';
import enCelebrationDashboard from '../../../locales/en/celebration/dashboard.json';
import enCelebrationGuests from '../../../locales/en/celebration/guests.json';
import enCelebrationInvite from '../../../locales/en/celebration/invite.json';
import enCelebrationTemplates from '../../../locales/en/celebration/templates.json';
import ruAuth from '../../../locales/ru/auth.json';
import ruCommon from '../../../locales/ru/common.json';
import ruDashboard from '../../../locales/ru/dashboard.json';
import ruGuests from '../../../locales/ru/guests.json';
import ruInvite from '../../../locales/ru/invite.json';
import ruTemplates from '../../../locales/ru/templates.json';
import ruCelebrationCommon from '../../../locales/ru/celebration/common.json';
import ruCelebrationDashboard from '../../../locales/ru/celebration/dashboard.json';
import ruCelebrationGuests from '../../../locales/ru/celebration/guests.json';
import ruCelebrationInvite from '../../../locales/ru/celebration/invite.json';
import ruCelebrationTemplates from '../../../locales/ru/celebration/templates.json';
import srAuth from '../../../locales/sr/auth.json';
import srCommon from '../../../locales/sr/common.json';
import srDashboard from '../../../locales/sr/dashboard.json';
import srGuests from '../../../locales/sr/guests.json';
import srInvite from '../../../locales/sr/invite.json';
import srTemplates from '../../../locales/sr/templates.json';
import srCelebrationCommon from '../../../locales/sr/celebration/common.json';
import srCelebrationDashboard from '../../../locales/sr/celebration/dashboard.json';
import srCelebrationGuests from '../../../locales/sr/celebration/guests.json';
import srCelebrationInvite from '../../../locales/sr/celebration/invite.json';
import srCelebrationTemplates from '../../../locales/sr/celebration/templates.json';
import enPhotos from '../../../locales/en/photos.json';
import enBigAlbum from '../../../locales/en/bigAlbum.json';
import enCelebrationBigAlbum from '../../../locales/en/celebration/bigAlbum.json';
import ruPhotos from '../../../locales/ru/photos.json';
import ruBigAlbum from '../../../locales/ru/bigAlbum.json';
import ruCelebrationBigAlbum from '../../../locales/ru/celebration/bigAlbum.json';
import srPhotos from '../../../locales/sr/photos.json';
import srBigAlbum from '../../../locales/sr/bigAlbum.json';
import srCelebrationBigAlbum from '../../../locales/sr/celebration/bigAlbum.json';

export type Namespace = 'auth' | 'common' | 'dashboard' | 'guests' | 'invite' | 'templates' | 'photos' | 'bigAlbum';

type Resources = Record<string, Record<string, unknown>>;

const BASE: Record<Language, Resources> = {
  sr: {
    auth: srAuth,
    common: srCommon,
    dashboard: srDashboard,
    guests: srGuests,
    invite: srInvite,
    templates: srTemplates,
    photos: srPhotos,
    bigAlbum: srBigAlbum,
  },
  en: {
    auth: enAuth,
    common: enCommon,
    dashboard: enDashboard,
    guests: enGuests,
    invite: enInvite,
    templates: enTemplates,
    photos: enPhotos,
    bigAlbum: enBigAlbum,
  },
  ru: {
    auth: ruAuth,
    common: ruCommon,
    dashboard: ruDashboard,
    guests: ruGuests,
    invite: ruInvite,
    templates: ruTemplates,
    photos: ruPhotos,
    bigAlbum: ruBigAlbum,
  },
};

const CELEBRATION: Record<Language, Resources> = {
  sr: {
    common: srCelebrationCommon,
    dashboard: srCelebrationDashboard,
    guests: srCelebrationGuests,
    invite: srCelebrationInvite,
    templates: srCelebrationTemplates,
    bigAlbum: srCelebrationBigAlbum,
  },
  en: {
    common: enCelebrationCommon,
    dashboard: enCelebrationDashboard,
    guests: enCelebrationGuests,
    invite: enCelebrationInvite,
    templates: enCelebrationTemplates,
    bigAlbum: enCelebrationBigAlbum,
  },
  ru: {
    common: ruCelebrationCommon,
    dashboard: ruCelebrationDashboard,
    guests: ruCelebrationGuests,
    invite: ruCelebrationInvite,
    templates: ruCelebrationTemplates,
    bigAlbum: ruCelebrationBigAlbum,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = (base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = base[key];
    out[key] = isRecord(current) && isRecord(value) ? deepMerge(current, value) : value;
  }
  return out;
};

/** Per-language resources for one event type; celebration overlays are merged per request (SYS-8). */
export const resourcesFor = (locale: Language, eventType: 'wedding' | 'celebration'): { [ns: string]: Resources } => {
  const base = BASE[locale];
  const overlay = eventType === 'celebration' ? (CELEBRATION[locale] ?? {}) : {};
  const merged: Resources = {};
  for (const [ns, values] of Object.entries(base)) {
    const over = overlay[ns];
    merged[ns] = over ? deepMerge(values as Record<string, unknown>, over as Record<string, unknown>) : values;
  }
  return { [locale]: merged };
};

/**
 * A fresh i18next instance per request/render. Nothing is stored in a module-level
 * singleton, so concurrent server renders of different languages/event types cannot
 * leak translations into each other (D13).
 */
export const createI18nInstance = (locale: Language, eventType: 'wedding' | 'celebration' = 'wedding'): i18n => {
  const instance = createInstance();
  // `initAsync: false` initializes synchronously, so the instance is usable in the
  // same render on both the server and the client.
  void instance.init({
    resources: resourcesFor(locale, eventType),
    lng: locale,
    fallbackLng: 'sr',
    supportedLngs: ['sr', 'en', 'ru'],
    ns: ['auth', 'common', 'dashboard', 'guests', 'invite', 'templates', 'photos', 'bigAlbum'],
    defaultNS: 'auth',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
};
