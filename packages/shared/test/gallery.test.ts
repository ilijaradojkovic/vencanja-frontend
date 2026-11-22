import { describe, expect, it } from 'vitest';

import { CompanionType, GalleryOpenMode } from '../src/enums.ts';
import {
  businessDate,
  cleanNames,
  galleryOpensAt,
  isEmail,
  isEventDate,
  isGalleryOpen,
  type GalleryEvent,
} from '../src/gallery.ts';

const event = (
  galleryOpen: GalleryOpenMode,
  extra: { date?: string; galleryManualOpen?: boolean } = {},
): GalleryEvent => ({
  date: extra.date ?? '2026-05-15',
  settings:
    extra.galleryManualOpen === undefined
      ? { galleryOpen }
      : { galleryOpen, galleryManualOpen: extra.galleryManualOpen },
});

describe('galleryOpensAt (SYS-3)', () => {
  it('is the day after the event', () => {
    expect(galleryOpensAt(event(GalleryOpenMode.AFTER_WEDDING))).toBe('2026-05-16');
  });

  it('rolls over months and years', () => {
    expect(galleryOpensAt({ date: '2026-12-31', settings: { galleryOpen: GalleryOpenMode.AFTER_WEDDING } })).toBe(
      '2027-01-01',
    );
  });

  it('only applies to the after_wedding mode', () => {
    expect(galleryOpensAt(event(GalleryOpenMode.NOW))).toBeNull();
    expect(galleryOpensAt(event(GalleryOpenMode.MANUAL))).toBeNull();
    expect(galleryOpensAt({ settings: { galleryOpen: GalleryOpenMode.AFTER_WEDDING } })).toBeNull();
    expect(galleryOpensAt(null)).toBeNull();
  });
});

describe('isGalleryOpen', () => {
  it('is always open in "now" mode', () => {
    expect(isGalleryOpen(event(GalleryOpenMode.NOW), new Date('2020-01-01T00:00:00Z'))).toBe(true);
  });

  it('follows the manual switch', () => {
    expect(isGalleryOpen(event(GalleryOpenMode.MANUAL), new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(isGalleryOpen(event(GalleryOpenMode.MANUAL, { galleryManualOpen: true }))).toBe(true);
  });

  it('opens at Belgrade midnight on the day after the event, in summer time', () => {
    const summer = event(GalleryOpenMode.AFTER_WEDDING);
    // 2026-05-15T21:30Z is 23:30 in Belgrade; 22:30Z is already 00:30 on 16 May.
    expect(isGalleryOpen(summer, new Date('2026-05-15T21:30:00Z'))).toBe(false);
    expect(isGalleryOpen(summer, new Date('2026-05-15T22:30:00Z'))).toBe(true);
  });

  it('uses the same rule in winter time (UTC+1)', () => {
    const winter = { date: '2026-01-10', settings: { galleryOpen: GalleryOpenMode.AFTER_WEDDING } };
    expect(isGalleryOpen(winter, new Date('2026-01-10T22:30:00Z'))).toBe(false);
    expect(isGalleryOpen(winter, new Date('2026-01-10T23:30:00Z'))).toBe(true);
  });

  it('stays closed when the event date is unknown', () => {
    expect(isGalleryOpen({ settings: { galleryOpen: GalleryOpenMode.AFTER_WEDDING } })).toBe(false);
    expect(isGalleryOpen(undefined)).toBe(false);
  });
});

describe('businessDate', () => {
  it('returns the Europe/Belgrade calendar date', () => {
    expect(businessDate(new Date('2026-05-15T22:30:00Z'))).toBe('2026-05-16');
    expect(businessDate(new Date('2026-05-15T21:30:00Z'))).toBe('2026-05-15');
  });
});

describe('isEventDate', () => {
  it('accepts ISO calendar dates only', () => {
    expect(isEventDate('2026-05-15')).toBe(true);
    expect(isEventDate('2026-02-31')).toBe(false);
    expect(isEventDate('15.05.2026.')).toBe(false);
    expect(isEventDate(null)).toBe(false);
  });
});

describe('cleanNames', () => {
  it('trims and drops empty entries', () => {
    expect(cleanNames([' Ana ', '', null, 42])).toEqual(['Ana', '42']);
    expect(cleanNames(undefined)).toEqual([]);
  });
});

describe('isEmail', () => {
  it('accepts a simple address and rejects garbage', () => {
    expect(isEmail('gost@uspomena.test')).toBe(true);
    expect(isEmail(' gost@uspomena.test ')).toBe(true);
    expect(isEmail('gost')).toBe(false);
    expect(isEmail(undefined)).toBe(false);
  });
});

describe('CompanionType values used by the demo contract', () => {
  it('match the stored values', () => {
    expect(Object.values(CompanionType)).toEqual(['none', 'open', 'named']);
  });
});
