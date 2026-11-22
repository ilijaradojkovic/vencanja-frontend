import { describe, expect, it } from 'vitest';

import { baseSlug, CELEBRATION_SLUG_SEPARATOR, isValidSlug, uniqueSlug } from '../src/slug.ts';

describe('baseSlug', () => {
  it('joins a couple with the wedding separator', () => {
    expect(baseSlug('Ana', 'Marko')).toBe('ana-i-marko');
  });

  it('strips diacritics and transliterates đ', () => {
    expect(baseSlug('Đorđe', 'Žarko')).toBe('djordje-i-zarko');
  });

  it('collapses punctuation and surrounding spaces into single hyphens', () => {
    expect(baseSlug('  Ana  Marija ', 'Marko! Petrović ')).toBe('ana-marija-i-marko-petrovic');
  });

  it('builds the celebration address from the celebrant and occasion', () => {
    expect(baseSlug('Luka', '18. rođendan', CELEBRATION_SLUG_SEPARATOR)).toBe('luka-18-rodjendan');
  });

  it('truncates the base so a uniqueness suffix still fits', () => {
    const slug = baseSlug('a'.repeat(60), 'b'.repeat(60));
    expect(slug).toHaveLength(34);
    expect(isValidSlug(`${slug}-12`)).toBe(true);
  });

  it('falls back to a generic slug when nothing usable remains', () => {
    expect(baseSlug('!!!')).toBe('vencanje');
    expect(baseSlug('', '')).toBe('vencanje');
  });
});

describe('uniqueSlug', () => {
  const taken = (...slugs: string[]) => (slug: string) => slugs.includes(slug);

  it('returns the base when it is free', () => {
    expect(uniqueSlug('ana-i-marko', taken())).toBe('ana-i-marko');
  });

  it('appends an incrementing suffix', () => {
    expect(uniqueSlug('ana-i-marko', taken('ana-i-marko', 'ana-i-marko-2'))).toBe('ana-i-marko-3');
  });
});

describe('isValidSlug', () => {
  it('accepts 3–40 lowercase characters, digits and hyphens', () => {
    expect(isValidSlug('abc')).toBe(true);
    expect(isValidSlug('luka-18-rodjendan')).toBe(true);
    expect(isValidSlug('a'.repeat(40))).toBe(true);
  });

  it('rejects too short, too long, uppercase and non-slug input', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('a'.repeat(41))).toBe(false);
    expect(isValidSlug('Ana')).toBe(false);
    expect(isValidSlug('ana_marko')).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
  });
});
