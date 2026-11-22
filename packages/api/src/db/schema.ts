import type { CompanionSet } from '@uspomena/shared';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Drizzle schema for every product table in SPEC §4.
 *
 * Rules that are visible here:
 * - timestamps are `timestamptz` (UTC), event dates are `date`;
 * - every table has RLS enabled with no policies (only the service role reads
 *   them through the API);
 * - `profiles.id` is the Supabase auth user id. There is no cross-schema foreign
 *   key to `auth.users` because that schema is owned by Supabase Auth and is not
 *   part of this schema file; the API keeps the rows in sync and deletes the
 *   profile explicitly on account deletion (UC-84). See DECISIONS.md.
 */

export const userRole = pgEnum('user_role', ['superadmin', 'couple']);
export const locale = pgEnum('locale', ['sr', 'en', 'ru']);
export const eventType = pgEnum('event_type', ['wedding', 'celebration']);
export const guestSide = pgEnum('guest_side', ['mlada', 'mladozenja', 'zajednicki']);
export const rsvpStatus = pgEnum('rsvp_status', ['pending', 'yes', 'no']);
export const photoCategory = pgEnum('photo_category', ['memories', 'wedding']);
export const photoStatus = pgEnum('photo_status', ['uploading', 'pending', 'approved', 'hidden']);
export const emailStatus = pgEnum('email_status', ['sent', 'failed']);

export type InvitationDesign = {
  templateId: string;
  accentColor: string;
  headline: string;
  message: string;
  schedule: { time: string; title: string }[];
};

export type EventSettings = {
  autoApprovePhotos: boolean;
  allowGeneralUpload: boolean;
  galleryOpen: 'now' | 'after_wedding' | 'manual';
  galleryManualOpen: boolean;
  galleryViaQr: boolean;
};

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    role: userRole('role').notNull().default('couple'),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    locale: locale('locale').notNull().default('sr'),
    active: boolean('active').notNull().default(true),
    /** JWTs issued before this instant are rejected (deactivation, new password). */
    tokensValidAfter: timestamptz('tokens_valid_after'),
    termsAcceptedAt: timestamptz('terms_accepted_at'),
    termsVersion: text('terms_version'),
    privacyVersion: text('privacy_version'),
    onboardedAt: timestamptz('onboarded_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastLoginAt: timestamptz('last_login_at'),
  },
  (t) => [uniqueIndex('profiles_email_unique').on(t.email), index('profiles_role_idx').on(t.role)],
).enableRLS();

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: eventType('type').notNull().default('wedding'),
    occasion: text('occasion').notNull().default(''),
    slug: text('slug').notNull(),
    partner1: text('partner1').notNull(),
    partner2: text('partner2').notNull().default(''),
    date: date('date').notNull(),
    rsvpDeadline: date('rsvp_deadline'),
    city: text('city').notNull().default(''),
    invitation: jsonb('invitation').$type<InvitationDesign>().notNull(),
    settings: jsonb('settings').$type<EventSettings>().notNull(),
    retentionMonths: integer('retention_months').notNull().default(3),
    storageLimitBytes: bigint('storage_limit_bytes', { mode: 'number' }).notNull().default(50_000_000),
    /** Stored instant at 00:00 Europe/Belgrade; recalculated on date/retention change. */
    purgeAt: timestamptz('purge_at').notNull(),
    purgeWarned30At: timestamptz('purge_warned_30_at'),
    purgeWarned7At: timestamptz('purge_warned_7_at'),
    purgedAt: timestamptz('purged_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('events_slug_unique').on(t.slug),
    uniqueIndex('events_owner_unique').on(t.ownerId),
    index('events_purge_at_idx').on(t.purgeAt),
    check('events_retention_months_range', sql`${t.retentionMonths} between 1 and 60`),
    check('events_storage_limit_positive', sql`${t.storageLimitBytes} > 0`),
    check('events_slug_format', sql`${t.slug} ~ '^[a-z0-9-]{3,40}$'`),
  ],
).enableRLS();

export const guests = pgTable(
  'guests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** 12 characters, base62, generated with a crypto RNG. */
    token: text('token').notNull(),
    side: guestSide('side').notNull().default('zajednicki'),
    companions: jsonb('companions').$type<CompanionSet>().notNull(),
    maxPersons: integer('max_persons').notNull().default(1),
    invitedAt: timestamptz('invited_at').notNull().defaultNow(),
    openedAt: timestamptz('opened_at'),
    rsvpStatus: rsvpStatus('rsvp_status').notNull().default('pending'),
    rsvpPersons: integer('rsvp_persons').notNull().default(0),
    rsvpCompanions: text('rsvp_companions')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rsvpNote: text('rsvp_note').notNull().default(''),
    respondedAt: timestamptz('responded_at'),
    notifyEmail: text('notify_email').notNull().default(''),
    notifyLocale: locale('notify_locale').notNull().default('sr'),
    notifyRequestedAt: timestamptz('notify_requested_at'),
    notifySentAt: timestamptz('notify_sent_at'),
    notifyClaimedAt: timestamptz('notify_claimed_at'),
    notifyClaimToken: uuid('notify_claim_token'),
  },
  (t) => [
    uniqueIndex('guests_token_unique').on(t.token),
    index('guests_event_idx').on(t.eventId),
    index('guests_event_rsvp_idx').on(t.eventId, t.rsvpStatus),
    check('guests_side_range', sql`${t.side} in ('mlada', 'mladozenja', 'zajednicki')`),
    check('guests_rsvp_persons_range', sql`${t.rsvpPersons} >= 0`),
  ],
).enableRLS();

export const photoSubscribers = pgTable(
  'photo_subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    locale: locale('locale').notNull().default('sr'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    sentAt: timestamptz('sent_at'),
    claimedAt: timestamptz('claimed_at'),
    claimToken: uuid('claim_token'),
  },
  (t) => [
    uniqueIndex('photo_subscribers_event_email_unique').on(t.eventId, t.email),
    index('photo_subscribers_event_idx').on(t.eventId),
  ],
).enableRLS();

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** Deleting a guest keeps their photos (UC-25). */
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    senderName: text('sender_name').notNull().default(''),
    category: photoCategory('category').notNull().default('wedding'),
    message: text('message').notNull().default(''),
    status: photoStatus('status').notNull().default('uploading'),
    /** Hash of the secret only the uploader receives, for `complete`. */
    uploadKeyHash: text('upload_key_hash'),
    originalPath: text('original_path'),
    webPath: text('web_path'),
    thumbPath: text('thumb_path'),
    mime: text('mime'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    uploadedAt: timestamptz('uploaded_at'),
  },
  (t) => [
    index('photos_event_idx').on(t.eventId),
    index('photos_event_status_created_idx').on(t.eventId, t.status, t.createdAt),
    index('photos_guest_idx').on(t.guestId),
    check('photos_size_bytes_positive', sql`${t.sizeBytes} is null or ${t.sizeBytes} > 0`),
  ],
).enableRLS();

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    toEmail: text('to_email').notNull(),
    locale: locale('locale').notNull().default('sr'),
    providerId: text('provider_id'),
    status: emailStatus('status').notNull(),
    error: text('error'),
    /** Provider-level deduplication key (SYS-4, SYS-13). */
    dedupeKey: text('dedupe_key'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_log_dedupe_key_unique').on(t.dedupeKey),
    index('email_log_event_idx').on(t.eventId),
    index('email_log_created_idx').on(t.createdAt),
  ],
).enableRLS();

/** Fixed-window counters for SYS-12; cleaned up by the daily cron. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamptz('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), check('rate_limits_count_positive', sql`${t.count} >= 0`)],
).enableRLS();
