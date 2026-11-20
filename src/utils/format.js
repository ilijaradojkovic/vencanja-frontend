import env from '../app/config/env';
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
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('sr-Latn-RS', opts) : '';

export const weekday = (iso) => formatDate(iso, { weekday: 'long' });

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
export const persons = (n) => `${n} ${plural(n, 'osoba', 'osobe', 'osoba')}`;
export const personsAcc = (n) => `${n} ${plural(n, 'osobu', 'osobe', 'osoba')}`;
export const photosLabel = (n) => `${n} ${plural(n, 'fotografija', 'fotografije', 'fotografija')}`;

const appBase = () => {
  const { origin, pathname } = window.location;
  if (env.routerMode === 'hash') return `${origin}${pathname}#`;
  return origin;
};
export const guestLink = (token) => `${appBase()}/i/${token}`;
export const generalUploadLink = (slug) => `${appBase()}/w/${slug}/upload`;

export const SIDES = {
  [GuestSide.BRIDE]: 'Mladina strana',
  [GuestSide.GROOM]: 'Mladoženjina strana',
  [GuestSide.SHARED]: 'Zajednički',
};
export const RSVP_LABELS = {
  [RsvpStatus.YES]: 'Dolazi',
  [RsvpStatus.PENDING]: 'Čeka odgovor',
  [RsvpStatus.NO]: 'Ne dolazi',
};
export const PHOTO_STATUS = {
  [PhotoStatus.PENDING]: 'Na čekanju',
  [PhotoStatus.APPROVED]: 'Odobrena',
  [PhotoStatus.HIDDEN]: 'Sakrivena',
};
export const CATEGORIES = {
  [PhotoCategory.MEMORIES]: 'Zajedničke uspomene',
  [PhotoCategory.WEDDING]: 'Sa venčanja',
};
export const REQUEST_STATUS = {
  [DesignRequestStatus.RECEIVED]: 'Primljen',
  [DesignRequestStatus.IN_PROGRESS]: 'U izradi',
  [DesignRequestStatus.REVIEW]: 'Čeka vašu potvrdu',
  [DesignRequestStatus.DONE]: 'Završen',
};
export const REQUEST_TYPES = {
  [DesignRequestType.INVITATION]: 'Pozivnica',
  [DesignRequestType.ALBUM]: 'Album',
  [DesignRequestType.BOTH]: 'Pozivnica i album',
  [DesignRequestType.BIG_ALBUM]: 'Veliki album',
};
