import { describe, expect, it } from 'vitest';

import { isValidSlug, SLUG_PATTERN } from '@uspomena/shared';

import {
  SEED_EVENTS,
  SEED_GUESTS,
  SEED_LIMIT_PHOTOS,
  SEED_PHOTOS,
  SEED_USER_IDS,
  SEED_USERS,
} from '../src/db/fixtures.ts';

const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

describe('seed users', () => {
  it('are local-only, unique and documented', () => {
    expect(unique(SEED_USERS.map((user) => user.email))).toBe(true);
    expect(unique(SEED_USERS.map((user) => SEED_USER_IDS[user.key]))).toBe(true);
    expect(SEED_USERS.every((user) => user.email.endsWith('@uspomena.test'))).toBe(true);
    expect(SEED_USERS.every((user) => user.password.length >= 8)).toBe(true);
  });

  it('cover exactly one superadmin and the onboarding/deactivation states', () => {
    expect(SEED_USERS.filter((user) => user.role === 'superadmin')).toHaveLength(1);
    expect(SEED_USERS.some((user) => !user.emailConfirmed)).toBe(true);
    expect(SEED_USERS.some((user) => !user.onboarded && user.emailConfirmed)).toBe(true);
    expect(SEED_USERS.some((user) => !user.active)).toBe(true);
    expect(SEED_USERS.some((user) => user.googleLinked)).toBe(true);
    expect(SEED_USERS.some((user) => !user.profile)).toBe(true);
  });
});

describe('seed events', () => {
  it('use the demo slugs and one event per owner', () => {
    const slugs = SEED_EVENTS.map((event) => event.slug);
    expect(unique(slugs)).toBe(true);
    expect(slugs.every((slug) => isValidSlug(slug) && SLUG_PATTERN.test(slug))).toBe(true);
    expect(unique(SEED_EVENTS.map((event) => event.owner))).toBe(true);
    expect(slugs).toContain('ana-i-marko');
    expect(slugs).toContain('luka-18-rodjendan');
  });

  it('reference seeded owners and stay within the retention rules', () => {
    for (const event of SEED_EVENTS) {
      expect(SEED_USERS.some((user) => user.key === event.owner)).toBe(true);
      expect(event.retentionMonths).toBeGreaterThanOrEqual(1);
      expect(event.retentionMonths).toBeLessThanOrEqual(60);
      expect(event.storageLimitBytes ?? 1).toBeGreaterThan(0);
      if (event.date) expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('cover the retention matrix', () => {
    const byKey = new Map(SEED_EVENTS.map((event) => [event.key, event]));
    expect(byKey.get('retention30')?.purgeAfterDays).toBe(30);
    expect(byKey.get('retention7')?.purgeAfterDays).toBe(7);
    expect(byKey.get('retention7')?.purgeWarned30).toBe(true);
    expect(byKey.get('archived')?.purged).toBe(true);
    expect(byKey.get('storageLimit')?.storageLimitBytes).toBe(2_000_000);
  });
});

describe('seed guests', () => {
  it('have deterministic tokens and cover every RSVP state', () => {
    expect(unique(SEED_GUESTS.map((guest) => guest.token))).toBe(true);
    expect(unique(SEED_GUESTS.map((guest) => guest.id))).toBe(true);
    expect(SEED_GUESTS.every((guest) => /^[A-Za-z0-9]{12}$/.test(guest.token))).toBe(true);
    expect(new Set(SEED_GUESTS.map((guest) => guest.rsvpStatus))).toEqual(new Set(['pending', 'yes', 'no']));
    expect(SEED_GUESTS.some((guest) => guest.companions.type === 'named')).toBe(true);
    expect(SEED_GUESTS.some((guest) => guest.companions.type === 'open')).toBe(true);
    expect(SEED_GUESTS.some((guest) => guest.companions.type === 'none')).toBe(true);
    expect(SEED_GUESTS.some((guest) => guest.notify?.sent === false)).toBe(true);
    expect(SEED_GUESTS.some((guest) => guest.notify?.sent === true)).toBe(true);
  });

  it('keep the RSVP answer consistent with the companions', () => {
    for (const guest of SEED_GUESTS) {
      if (guest.rsvpStatus !== 'yes') {
        expect(guest.rsvpPersons).toBe(0);
        expect(guest.rsvpCompanions).toEqual([]);
        continue;
      }
      expect(guest.rsvpPersons).toBeGreaterThanOrEqual(1);
      if (guest.companions.type === 'named') {
        expect(guest.rsvpCompanions.every((name) => guest.companions.names.includes(name))).toBe(true);
        expect(guest.rsvpPersons).toBe(1 + guest.rsvpCompanions.length);
      }
      expect(guest.rsvpCompanions.length).toBeLessThanOrEqual(guest.rsvpPersons - 1);
    }
  });
});

describe('seed photos', () => {
  it('cover every moderation state and reserve space only while uploading', () => {
    const statuses = SEED_PHOTOS.map((photo) => photo.status);
    expect(new Set(statuses)).toEqual(new Set(['approved', 'pending', 'hidden', 'uploading']));

    for (const photo of SEED_PHOTOS) {
      if (photo.status === 'uploading') {
        expect(photo.files).toBe(false);
        expect(photo.sizeBytes).toBeGreaterThan(0);
      } else {
        expect(photo.files).toBe(true);
        expect(['jpeg', 'png', 'webp']).toContain(photo.format);
      }
    }
    expect(SEED_LIMIT_PHOTOS.every((photo) => photo.files && photo.status === 'approved')).toBe(true);
  });
});
