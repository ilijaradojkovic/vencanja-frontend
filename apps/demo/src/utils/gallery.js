import { CompanionType, GalleryOpenMode } from '../app/config/enums';

const DAY = 86400000;

export const galleryOpensAt = (wedding) => {
  const mode = wedding?.settings?.galleryOpen;
  if (mode !== GalleryOpenMode.AFTER_WEDDING || !wedding?.date) return null;
  const d = new Date(`${wedding.date}T00:00:00Z`);
  return new Date(d.getTime() + DAY).toISOString().slice(0, 10);
};

export const isGalleryOpen = (wedding, now = new Date()) => {
  const s = wedding?.settings || {};
  if (s.galleryOpen === GalleryOpenMode.NOW) return true;
  if (s.galleryOpen === GalleryOpenMode.MANUAL) return !!s.galleryManualOpen;
  const opensAt = galleryOpensAt(wedding);
  return !!opensAt && now >= new Date(`${opensAt}T00:00:00`);
};

export const maxCompanions = (guest) => {
  const c = guest?.companions;
  if (!c || c.type === CompanionType.NONE) return 0;
  if (c.type === CompanionType.NAMED) return c.names.length;
  return c.max || 0;
};

export const companionsFromMaxPersons = (maxPersons) => {
  const n = Math.max(1, Number(maxPersons) || 1) - 1;
  return n > 0 ? { type: CompanionType.OPEN, max: n, names: [] } : { type: CompanionType.NONE, max: 0, names: [] };
};

export const cleanNames = (list) => (Array.isArray(list) ? list : []).map((x) => String(x || '').trim()).filter(Boolean);

export const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || '').trim());
