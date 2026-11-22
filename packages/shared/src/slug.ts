/**
 * Slug rules for the public event address (`/w/:slug`) and the invitation link.
 * Ported from `slugFor` in the prototype mock; the mock's uniqueness loop is
 * split into `uniqueSlug` so the same rule works against a database.
 */

export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 40;

/** Longest generated base, leaving room for a `-2` uniqueness suffix. */
const MAX_BASE_LENGTH = 34;
const FALLBACK_SLUG = 'vencanje';

/** `-i-` joins the couple ("ana-i-marko"); celebrations use `-` ("luka-18-rodjendan"). */
export const WEDDING_SLUG_SEPARATOR = '-i-';
export const CELEBRATION_SLUG_SEPARATOR = '-';

export const isValidSlug = (value: unknown): boolean => typeof value === 'string' && SLUG_PATTERN.test(value);

/** Lowercases, strips diacritics and collapses everything else into hyphens. */
export const baseSlug = (first: string, second = '', separator: string = WEDDING_SLUG_SEPARATOR): string =>
  `${first}${second ? separator + second : ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_BASE_LENGTH) || FALLBACK_SLUG;

/** Appends `-2`, `-3`, … until `isTaken` reports a free slug. */
export const uniqueSlug = (base: string, isTaken: (slug: string) => boolean): string => {
  let slug = base;
  for (let index = 2; isTaken(slug); index += 1) slug = `${base}-${index}`;
  return slug;
};
