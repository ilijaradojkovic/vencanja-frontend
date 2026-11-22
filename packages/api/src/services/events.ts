import {
  businessDate,
  CELEBRATION_SLUG_SEPARATOR,
  WEDDING_SLUG_SEPARATOR,
  baseSlug,
  uniqueSlug,
  type Language,
} from '@uspomena/shared';
import { and, eq, ne } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, type EventSettings, type InvitationDesign } from '../db/schema.ts';
import { env } from '../env.ts';

export type EventRow = typeof events.$inferSelect;

const BELGRADE = 'Europe/Belgrade';

/** 00:00 Europe/Belgrade for the calendar date of `date` (SYS-9). */
const belgradeMidnight = (date: Date): Date => {
  const [year, month, day] = businessDate(date)
    .split('-')
    .map((part) => Number(part));
  const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BELGRADE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess + 12 * 3_600_000));
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const offset =
    Date.UTC(value('year'), value('month') - 1, value('day'), value('hour') % 24, value('minute')) -
    (guess + 12 * 3_600_000);
  return new Date(guess - offset);
};

/** Instant at 00:00 Europe/Belgrade on `date + months` (calendar months, not 30-day months). */
export const purgeAtFor = (eventDate: string, retentionMonths: number): Date => {
  const next = new Date(`${eventDate}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + retentionMonths);
  return belgradeMidnight(next);
};

/** Event type wording, in the UI language of the organizer (UC-81). */
const HEADLINE: Record<Language, Record<'wedding' | 'celebration', string>> = {
  sr: { wedding: 'Venčavamo se', celebration: 'Proslavljamo' },
  en: { wedding: 'We are getting married', celebration: "We're celebrating" },
  ru: { wedding: 'Мы женимся', celebration: 'Мы празднуем' },
};

const MESSAGE: Record<Language, Record<'wedding' | 'celebration', string>> = {
  sr: {
    wedding: 'Sa radošću vas pozivamo da podelite naš dan sa nama.',
    celebration: 'Sa radošću vas pozivamo da proslavite sa nama.',
  },
  en: {
    wedding: 'We joyfully invite you to share our day with us.',
    celebration: 'We joyfully invite you to celebrate with us.',
  },
  ru: {
    wedding: 'С радостью приглашаем вас разделить с нами этот день.',
    celebration: 'С радостью приглашаем вас отпраздновать вместе с нами.',
  },
};

/** Default invitation and settings of a new event (UC-04, UC-81; SPEC §5.1). */
export const defaultInvitation = (type: 'wedding' | 'celebration', locale: Language): InvitationDesign => ({
  templateId: 'klasik',
  accentColor: '#2D4A3E',
  headline: HEADLINE[locale][type],
  message: MESSAGE[locale][type],
  schedule: [
    {
      time: '16:00',
      title: locale === 'sr' ? 'Okupljanje gostiju' : locale === 'en' ? 'Guests arrive' : 'Сбор гостей',
    },
    { time: '17:00', title: locale === 'sr' ? 'Ceremonija' : locale === 'en' ? 'Ceremony' : 'Церемония' },
    {
      time: '19:00',
      title: locale === 'sr' ? 'Večera i slavlje' : locale === 'en' ? 'Dinner and celebration' : 'Ужин и праздник',
    },
  ],
});

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  autoApprovePhotos: false,
  allowGeneralUpload: true,
  galleryOpen: 'after_wedding',
  galleryManualOpen: false,
  galleryViaQr: true,
};

export type CreateEventInput = {
  ownerId: string;
  type: 'wedding' | 'celebration';
  partner1: string;
  partner2?: string;
  occasion?: string;
  date: string;
  city?: string;
  locale: Language;
};

/** Slug rules from the prototype (`ana-i-marko`, `luka-18-rodjendan`), made unique in the DB. */
export const uniqueEventSlug = async (input: CreateEventInput): Promise<string> => {
  const db = getDb();
  const base =
    input.type === 'wedding'
      ? baseSlug(input.partner1, input.partner2 ?? '', WEDDING_SLUG_SEPARATOR)
      : baseSlug(input.partner1, input.occasion ?? '', CELEBRATION_SLUG_SEPARATOR);

  const taken = await db.select({ slug: events.slug }).from(events).where(eq(events.slug, base)).limit(1);
  if (taken.length === 0) return base;

  const candidates = await db.select({ slug: events.slug }).from(events);
  const used = new Set(candidates.map((row) => row.slug));
  return uniqueSlug(base, (slug) => used.has(slug));
};

export const createEvent = async (input: CreateEventInput): Promise<EventRow> => {
  const db = getDb();
  const retentionMonths = env.retentionMonthsDefault();
  const [created] = await db
    .insert(events)
    .values({
      ownerId: input.ownerId,
      type: input.type,
      occasion: input.occasion?.trim() ?? '',
      slug: await uniqueEventSlug(input),
      partner1: input.partner1,
      partner2: input.partner2?.trim() ?? '',
      date: input.date,
      city: input.city?.trim() ?? '',
      invitation: defaultInvitation(input.type, input.locale),
      settings: DEFAULT_EVENT_SETTINGS,
      retentionMonths,
      storageLimitBytes: env.eventStorageLimitMbDefault() * 1_000_000,
      purgeAt: purgeAtFor(input.date, retentionMonths),
    })
    .returning();
  if (!created) throw new Error('Could not create the event.');
  return created;
};

export const findEventForOwner = async (ownerId: string): Promise<EventRow | null> => {
  const [event] = await getDb().select().from(events).where(eq(events.ownerId, ownerId)).limit(1);
  return event ?? null;
};

/** Slug uniqueness for later edits (PATCH in M3); ignores the event being edited. */
export const slugTakenByOther = async (slug: string, eventId: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.slug, slug), ne(events.id, eventId)))
    .limit(1);
  return Boolean(row);
};

export type WeddingPayload = {
  id: string;
  type: 'wedding' | 'celebration';
  occasion: string;
  slug: string;
  partner1: string;
  partner2: string;
  date: string;
  city: string;
  invitation: InvitationDesign;
  settings: EventSettings;
  retentionMonths: number;
  storageLimitBytes: number;
  purgeAt: string;
  purgedAt: string | null;
};

export const toWeddingPayload = (event: EventRow): WeddingPayload => ({
  id: event.id,
  type: event.type,
  occasion: event.occasion,
  slug: event.slug,
  partner1: event.partner1,
  partner2: event.partner2,
  date: event.date,
  city: event.city,
  invitation: event.invitation,
  settings: event.settings,
  retentionMonths: event.retentionMonths,
  storageLimitBytes: event.storageLimitBytes,
  purgeAt: event.purgeAt.toISOString(),
  purgedAt: event.purgedAt?.toISOString() ?? null,
});
