import { describe, expect, it } from 'vitest';

import { formatPhone, isValidPhone, normalizePhone } from '../src/phone.ts';

describe('normalizePhone', () => {
  it('turns a local Serbian number into the +381 form', () => {
    expect(normalizePhone('064 123 4567')).toBe('+381641234567');
    expect(normalizePhone('064/123-4567')).toBe('+381641234567');
    expect(normalizePhone('(064) 123.4567')).toBe('+381641234567');
  });

  it('accepts international prefixes', () => {
    expect(normalizePhone('0038164123456')).toBe('+38164123456');
    expect(normalizePhone('+381 64 123 4567')).toBe('+381641234567');
    expect(normalizePhone('+49 30 12345678')).toBe('+493012345678');
  });

  it('returns an empty string for unusable input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone('12345')).toBe('');
    expect(normalizePhone('+1234567890123456')).toBe('');
    expect(normalizePhone('telefon')).toBe('');
  });
});

describe('isValidPhone', () => {
  it('reflects the normalization result', () => {
    expect(isValidPhone('064 123 4567')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('groups a Serbian number for display', () => {
    expect(formatPhone('+381641234567')).toBe('+381 64 123 4567');
    expect(formatPhone('+38164123456')).toBe('+381 64 123 456');
  });

  it('returns other numbers unchanged', () => {
    expect(formatPhone('+493012345678')).toBe('+493012345678');
    expect(formatPhone('')).toBe('');
    expect(formatPhone(null)).toBe('');
  });
});
