import {
  isAccentColor,
  isEventDate,
  isInvitationTemplateId,
  MAX_CITY_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_INVITATION_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SCHEDULE_ITEMS,
  normalizeScheduleItem,
  RuleViolation,
  type ScheduleItem,
} from '@uspomena/shared';

import type { EventSettings, InvitationDesign } from '../db/schema.ts';
import type { EventRow } from './events.ts';

const TOP_LEVEL_KEYS = [
  'slug',
  'partner1',
  'partner2',
  'occasion',
  'date',
  'rsvpDeadline',
  'city',
  'invitation',
  'settings',
] as const;
const INVITATION_KEYS = ['templateId', 'accentColor', 'headline', 'message', 'schedule'] as const;
const SETTINGS_KEYS: (keyof EventSettings)[] = [
  'autoApprovePhotos',
  'allowGeneralUpload',
  'galleryOpen',
  'galleryManualOpen',
  'galleryViaQr',
];

export type WeddingPatch = {
  slug?: string;
  partner1?: string;
  partner2?: string;
  occasion?: string;
  date?: string;
  rsvpDeadline?: string | null;
  city?: string;
  invitation?: InvitationDesign;
  settings?: EventSettings;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length > max) throw new RuleViolation('textTooLong', { max });
  return trimmed;
};

const eventDateCode = (event: EventRow): 'dateRequired' | 'celebrationDateRequired' =>
  event.type === 'celebration' ? 'celebrationDateRequired' : 'dateRequired';

/** Validates and normalizes a `PATCH /weddings/:id` body (SPEC §6.6 items 2, 3, 7). */
export const parseWeddingPatch = (event: EventRow, body: unknown): WeddingPatch => {
  if (!isObject(body)) throw new RuleViolation('badRequest');
  const unknown = Object.keys(body).filter((key) => !(TOP_LEVEL_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) throw new RuleViolation('badRequest');
  if (Object.keys(body).length === 0) throw new RuleViolation('badRequest');

  const patch: WeddingPatch = {};

  if (body.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    patch.slug = slug;
  }

  if (body.partner1 !== undefined) {
    const partner1 = text(body.partner1, MAX_NAME_LENGTH);
    if (!partner1) throw new RuleViolation(event.type === 'celebration' ? 'celebrantRequired' : 'namesRequired');
    patch.partner1 = partner1;
  }

  if (body.partner2 !== undefined) {
    const partner2 = text(body.partner2, MAX_NAME_LENGTH);
    // A wedding cannot lose the second name; a celebration has no use for it.
    if (event.type === 'wedding' && !partner2) throw new RuleViolation('namesRequired');
    patch.partner2 = partner2;
  }

  if (body.occasion !== undefined) patch.occasion = text(body.occasion, MAX_NAME_LENGTH);

  if (body.date !== undefined) {
    if (!isEventDate(body.date)) throw new RuleViolation(eventDateCode(event));
    patch.date = body.date;
  }

  if (body.rsvpDeadline !== undefined) {
    if (body.rsvpDeadline !== null && !isEventDate(body.rsvpDeadline)) throw new RuleViolation('badDeadline');
    patch.rsvpDeadline = body.rsvpDeadline;
  }

  if (body.city !== undefined) patch.city = text(body.city, MAX_CITY_LENGTH);

  if (body.invitation !== undefined) {
    if (!isObject(body.invitation)) throw new RuleViolation('badRequest');
    const unknownInvitation = Object.keys(body.invitation).filter(
      (key) => !(INVITATION_KEYS as readonly string[]).includes(key),
    );
    if (unknownInvitation.length > 0) throw new RuleViolation('badRequest');
    patch.invitation = mergeInvitation(event.invitation, body.invitation);
  }

  if (body.settings !== undefined) {
    if (!isObject(body.settings)) throw new RuleViolation('badRequest');
    patch.settings = mergeSettings(event.settings, body.settings);
  }

  return patch;
};

const mergeInvitation = (existing: InvitationDesign, input: Record<string, unknown>): InvitationDesign => {
  const templateId = input.templateId ?? existing.templateId;
  if (!isInvitationTemplateId(templateId)) throw new RuleViolation('badTemplate');

  const accentColor = input.accentColor ?? existing.accentColor;
  if (!isAccentColor(accentColor)) throw new RuleViolation('badColor');

  const headline = input.headline !== undefined ? input.headline : existing.headline;
  if (typeof headline !== 'string' || headline.trim().length > MAX_HEADLINE_LENGTH) {
    throw new RuleViolation('textTooLong', { max: MAX_HEADLINE_LENGTH });
  }

  const message = input.message !== undefined ? input.message : existing.message;
  if (typeof message !== 'string' || message.trim().length > MAX_INVITATION_MESSAGE_LENGTH) {
    throw new RuleViolation('textTooLong', { max: MAX_INVITATION_MESSAGE_LENGTH });
  }

  let schedule: ScheduleItem[] = existing.schedule;
  if (input.schedule !== undefined) {
    if (!Array.isArray(input.schedule)) throw new RuleViolation('badSchedule');
    if (input.schedule.length > MAX_SCHEDULE_ITEMS) throw new RuleViolation('tooManyScheduleItems');
    schedule = input.schedule.map((item) => {
      const normalized = normalizeScheduleItem(item);
      if (!normalized) throw new RuleViolation('badSchedule');
      return normalized;
    });
  }

  return { templateId, accentColor, headline, message, schedule };
};

const mergeSettings = (existing: EventSettings, input: Record<string, unknown>): EventSettings => {
  const unknown = Object.keys(input).filter((key) => !(SETTINGS_KEYS as string[]).includes(key));
  if (unknown.length > 0) throw new RuleViolation('badSettings');

  const next: EventSettings = { ...existing };
  for (const key of SETTINGS_KEYS) {
    if (input[key] === undefined) continue;
    if (key === 'galleryOpen') {
      const mode = input[key];
      if (mode !== 'now' && mode !== 'after_wedding' && mode !== 'manual') throw new RuleViolation('badGalleryMode');
      next.galleryOpen = mode;
      continue;
    }
    const value = input[key];
    if (typeof value !== 'boolean') throw new RuleViolation('badSettings');
    next[key] = value;
  }
  return next;
};
