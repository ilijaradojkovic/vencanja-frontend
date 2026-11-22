import { CompanionType, GalleryOpenMode } from './enums.ts';

/** Event dates and date-based business logic use the Europe/Belgrade zone (SPEC §4). */
export const BUSINESS_TIME_ZONE = 'Europe/Belgrade';

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type CompanionSet = {
  type: CompanionType;
  max: number;
  names: string[];
};

export type GallerySettings = {
  galleryOpen?: GalleryOpenMode;
  galleryManualOpen?: boolean;
};

export type GalleryEvent = {
  date?: string | null;
  settings?: GallerySettings | null;
};

export const isEventDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  // A round trip rejects calendar dates such as 2026-02-31, which roll over.
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};

/** Calendar date (YYYY-MM-DD) of an instant in the Europe/Belgrade zone. */
export const businessDate = (now: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: 'year' | 'month' | 'day'): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

/**
 * The date on which the gallery opens by itself: the day after the event (SYS-3).
 * Returns null unless the event date is known and the mode is `after_wedding`.
 */
export const galleryOpensAt = (event: GalleryEvent | null | undefined): string | null => {
  const mode = event?.settings?.galleryOpen;
  const date = event?.date;
  if (mode !== GalleryOpenMode.AFTER_WEDDING || !isEventDate(date)) return null;
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
};

/**
 * Whether guests may see the gallery. The `after_wedding` comparison happens in
 * Europe/Belgrade, so it opens at local midnight regardless of the server zone
 * (SPEC §6.6 item 5).
 */
export const isGalleryOpen = (event: GalleryEvent | null | undefined, now: Date = new Date()): boolean => {
  const settings = event?.settings ?? {};
  if (settings.galleryOpen === GalleryOpenMode.NOW) return true;
  if (settings.galleryOpen === GalleryOpenMode.MANUAL) return Boolean(settings.galleryManualOpen);
  const opensAt = galleryOpensAt(event);
  return opensAt !== null && businessDate(now) >= opensAt;
};

/** Trims a list of names, dropping empty entries. */
export const cleanNames = (list: unknown): string[] =>
  (Array.isArray(list) ? list : []).map((item) => String(item ?? '').trim()).filter(Boolean);

export const isEmail = (value: unknown): boolean => /^\S+@\S+\.\S+$/.test(String(value ?? '').trim());
