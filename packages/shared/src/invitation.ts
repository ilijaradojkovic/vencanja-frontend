import { MAX_SCHEDULE_MAP_URL_LENGTH, MAX_SCHEDULE_PLACE_LENGTH, MAX_SCHEDULE_TITLE_LENGTH } from './limits.ts';

/**
 * Invitation validation shared by the API and the organizer editor (SPEC §6.6
 * items 3 and 4). The 11 template ids are the ones in the prototype's
 * `templates/index.js`, not the four listed in the older API.md.
 */
export const INVITATION_TEMPLATE_IDS = [
  'klasik',
  'minimal',
  'botanika',
  'romantika',
  'editorijal',
  'noc',
  'rustik',
  'akvarel',
  'zlatna-geometrija',
  'boho',
  'bordo',
] as const;

export type InvitationTemplateId = (typeof INVITATION_TEMPLATE_IDS)[number];

export const isInvitationTemplateId = (value: unknown): value is InvitationTemplateId =>
  typeof value === 'string' && (INVITATION_TEMPLATE_IDS as readonly string[]).includes(value);

/** `#RRGGBB`, either case; stored as entered. */
export const ACCENT_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const isAccentColor = (value: unknown): value is string =>
  typeof value === 'string' && ACCENT_COLOR_PATTERN.test(value);

/** At most 20 schedule items (SPEC §6.6 item 3). */
export const MAX_SCHEDULE_ITEMS = 20;
/** 24-hour `HH:mm`. */
export const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isScheduleTime = (value: unknown): value is string =>
  typeof value === 'string' && SCHEDULE_TIME_PATTERN.test(value);

/** A schedule entry as the prototype stores it; `id`/`place`/`mapUrl` are optional. */
export type ScheduleItem = {
  id?: string;
  time: string;
  title: string;
  place?: string;
  mapUrl?: string;
};

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length <= max;

const isMapUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_SCHEDULE_MAP_URL_LENGTH &&
  (value === '' || /^https?:\/\/\S+$/i.test(value));

/**
 * Validates one schedule entry and trims its text. Returns null when the entry is
 * not usable, so the caller can answer with the shared `badSchedule` message.
 */
export const normalizeScheduleItem = (value: unknown): ScheduleItem | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const time = typeof item.time === 'string' ? item.time.trim() : '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!isScheduleTime(time)) return null;
  if (!title || title.length > MAX_SCHEDULE_TITLE_LENGTH) return null;
  if (item.place !== undefined && !isText(item.place, MAX_SCHEDULE_PLACE_LENGTH)) return null;
  if (item.id !== undefined && (typeof item.id !== 'string' || item.id.length > 64)) return null;
  if (item.mapUrl !== undefined && !isMapUrl(item.mapUrl)) return null;

  return {
    ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
    time,
    title,
    ...(typeof item.place === 'string' && item.place.trim() ? { place: item.place.trim() } : {}),
    ...(typeof item.mapUrl === 'string' && item.mapUrl.trim() ? { mapUrl: item.mapUrl.trim() } : {}),
  };
};
