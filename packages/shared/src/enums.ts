/**
 * Product and API enums, ported from the prototype's `src/app/config/enums.js`
 * (SPEC §3.2). The demo keeps its own copy.
 */

export const UserRole = Object.freeze({
  SUPERADMIN: 'superadmin',
  COUPLE: 'couple',
});
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EventType = Object.freeze({
  WEDDING: 'wedding',
  CELEBRATION: 'celebration',
});
export type EventType = (typeof EventType)[keyof typeof EventType];

export const RsvpStatus = Object.freeze({
  YES: 'yes',
  NO: 'no',
  PENDING: 'pending',
});
export type RsvpStatus = (typeof RsvpStatus)[keyof typeof RsvpStatus];

export const GuestSide = Object.freeze({
  BRIDE: 'mlada',
  GROOM: 'mladozenja',
  SHARED: 'zajednicki',
});
export type GuestSide = (typeof GuestSide)[keyof typeof GuestSide];

export const PhotoStatus = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  HIDDEN: 'hidden',
});
export type PhotoStatus = (typeof PhotoStatus)[keyof typeof PhotoStatus];

export const PhotoCategory = Object.freeze({
  MEMORIES: 'memories',
  WEDDING: 'wedding',
});
export type PhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];

export const CompanionType = Object.freeze({
  NONE: 'none',
  OPEN: 'open',
  NAMED: 'named',
});
export type CompanionType = (typeof CompanionType)[keyof typeof CompanionType];

export const GalleryOpenMode = Object.freeze({
  NOW: 'now',
  AFTER_WEDDING: 'after_wedding',
  MANUAL: 'manual',
});
export type GalleryOpenMode = (typeof GalleryOpenMode)[keyof typeof GalleryOpenMode];

export const USER_ROLES: readonly UserRole[] = Object.values(UserRole);
export const EVENT_TYPES: readonly EventType[] = Object.values(EventType);
export const RSVP_STATUSES: readonly RsvpStatus[] = Object.values(RsvpStatus);
export const GUEST_SIDES: readonly GuestSide[] = Object.values(GuestSide);
export const PHOTO_STATUSES: readonly PhotoStatus[] = Object.values(PhotoStatus);
export const PHOTO_CATEGORIES: readonly PhotoCategory[] = Object.values(PhotoCategory);
export const COMPANION_TYPES: readonly CompanionType[] = Object.values(CompanionType);
export const GALLERY_OPEN_MODES: readonly GalleryOpenMode[] = Object.values(GalleryOpenMode);

export const isPhotoStatus = (value: unknown): value is PhotoStatus =>
  typeof value === 'string' && (PHOTO_STATUSES as readonly string[]).includes(value);

export const isPhotoCategory = (value: unknown): value is PhotoCategory =>
  typeof value === 'string' && (PHOTO_CATEGORIES as readonly string[]).includes(value);

export const isGuestSide = (value: unknown): value is GuestSide =>
  typeof value === 'string' && (GUEST_SIDES as readonly string[]).includes(value);

export const isGalleryOpenMode = (value: unknown): value is GalleryOpenMode =>
  typeof value === 'string' && (GALLERY_OPEN_MODES as readonly string[]).includes(value);

export const isRsvpStatus = (value: unknown): value is RsvpStatus =>
  typeof value === 'string' && (RSVP_STATUSES as readonly string[]).includes(value);
