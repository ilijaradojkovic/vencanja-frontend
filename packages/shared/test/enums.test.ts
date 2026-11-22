import { describe, expect, it } from 'vitest';

import {
  COMPANION_TYPES,
  CompanionType,
  EVENT_TYPES,
  EventType,
  GALLERY_OPEN_MODES,
  GalleryOpenMode,
  GUEST_SIDES,
  GuestSide,
  isGalleryOpenMode,
  isGuestSide,
  isRsvpStatus,
  PHOTO_CATEGORIES,
  PHOTO_STATUSES,
  PhotoCategory,
  PhotoStatus,
  RSVP_STATUSES,
  RsvpStatus,
  USER_ROLES,
  UserRole,
} from '../src/enums.ts';

describe('product enums', () => {
  it('keep the values stored by the prototype', () => {
    expect(Object.values(UserRole)).toEqual(['superadmin', 'couple']);
    expect(Object.values(EventType)).toEqual(['wedding', 'celebration']);
    expect(Object.values(RsvpStatus)).toEqual(['yes', 'no', 'pending']);
    expect(Object.values(GuestSide)).toEqual(['mlada', 'mladozenja', 'zajednicki']);
    expect(Object.values(PhotoStatus)).toEqual(['pending', 'approved', 'hidden']);
    expect(Object.values(PhotoCategory)).toEqual(['memories', 'wedding']);
    expect(Object.values(CompanionType)).toEqual(['none', 'open', 'named']);
    expect(Object.values(GalleryOpenMode)).toEqual(['now', 'after_wedding', 'manual']);
  });

  it('expose the same values as lists for validation', () => {
    expect(USER_ROLES).toEqual(['superadmin', 'couple']);
    expect(EVENT_TYPES).toEqual(['wedding', 'celebration']);
    expect(RSVP_STATUSES).toEqual(['yes', 'no', 'pending']);
    expect(GUEST_SIDES).toEqual(['mlada', 'mladozenja', 'zajednicki']);
    expect(PHOTO_STATUSES).toEqual(['pending', 'approved', 'hidden']);
    expect(PHOTO_CATEGORIES).toEqual(['memories', 'wedding']);
    expect(COMPANION_TYPES).toEqual(['none', 'open', 'named']);
    expect(GALLERY_OPEN_MODES).toEqual(['now', 'after_wedding', 'manual']);
  });

  it('are frozen so a typo cannot mutate them at runtime', () => {
    expect(Object.isFrozen(UserRole)).toBe(true);
    expect(Object.isFrozen(GalleryOpenMode)).toBe(true);
  });
});

describe('enum guards', () => {
  it('accept known values only', () => {
    expect(isGuestSide('mlada')).toBe(true);
    expect(isGuestSide('family')).toBe(false);
    expect(isGuestSide(undefined)).toBe(false);

    expect(isGalleryOpenMode('after_wedding')).toBe(true);
    expect(isGalleryOpenMode('later')).toBe(false);

    expect(isRsvpStatus('pending')).toBe(true);
    expect(isRsvpStatus('yes')).toBe(true);
    expect(isRsvpStatus('')).toBe(false);
  });
});
