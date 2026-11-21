import env from '../app/config/env';
import i18n, { currentLocale } from '../app/config/i18n';
import {
  DesignRequestStatus,
  DesignRequestType,
  GuestSide,
  PhotoCategory,
  PhotoStatus,
  RsvpStatus,
} from '../app/config/enums';

export const daysUntil = (isoDate) => {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const formatDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(currentLocale(), opts) : '';

export const weekday = (iso) => formatDate(iso, { weekday: 'long' });

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(currentLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const persons = (n) => i18n.t('common:count.persons', { count: n });
export const personsAcc = (n) => i18n.t('common:count.personsAcc', { count: n });
export const photosLabel = (n) => i18n.t('common:count.photos', { count: n });
export const daysLabel = (n) => i18n.t('common:count.days', { count: n });

const appBase = () => {
  const { origin, pathname } = window.location;
  if (env.routerMode === 'hash') return `${origin}${pathname}#`;
  return origin;
};
export const loginLink = () => `${appBase()}/login`;
export const guestLink = (token) => `${appBase()}/i/${token}`;
export const generalUploadLink = (slug) => `${appBase()}/w/${slug}/upload`;
export const guestGalleryLink = (token) => `${appBase()}/i/${token}/galerija`;
export const generalGalleryLink = (slug) => `${appBase()}/w/${slug}/galerija`;

const liveLabels = (prefix, keys) => Object.defineProperties(
  {},
  Object.fromEntries(keys.map((k) => [k, { enumerable: true, get: () => i18n.t(`common:${prefix}.${k}`) }])),
);

export const SIDES = liveLabels('side', Object.values(GuestSide));
export const RSVP_LABELS = liveLabels('rsvp', Object.values(RsvpStatus));
export const PHOTO_STATUS = liveLabels('photoStatus', Object.values(PhotoStatus));
export const CATEGORIES = liveLabels('category', Object.values(PhotoCategory));
export const REQUEST_STATUS = liveLabels('requestStatus', Object.values(DesignRequestStatus));
export const REQUEST_TYPES = liveLabels('requestType', Object.values(DesignRequestType));
