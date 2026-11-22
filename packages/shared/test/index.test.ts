import { describe, expect, it } from 'vitest';

import { isRuleViolation, RuleViolation } from '../src/errors.ts';
import { isGalleryOpen, isEmail, normalizePhone, parseRsvp, translateMessage } from '../src/index.ts';

describe('RuleViolation', () => {
  it('carries the message key and its parameters', () => {
    const error = new RuleViolation('personsRange', { max: 3 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RuleViolation');
    expect(error.code).toBe('personsRange');
    expect(error.params).toEqual({ max: 3 });
    expect(isRuleViolation(error)).toBe(true);
    expect(isRuleViolation(new Error('other'))).toBe(false);
  });

  it('defaults to no parameters', () => {
    expect(new RuleViolation('guestNotFound').params).toEqual({});
  });
});

describe('public entry point', () => {
  it('re-exports the shared rules the frontend and API both need', () => {
    expect(normalizePhone('064 123 4567')).toBe('+381641234567');
    expect(isEmail('gost@uspomena.test')).toBe(true);
    expect(isGalleryOpen({ settings: { galleryOpen: 'now' } })).toBe(true);
    expect(() => parseRsvp({ companions: { type: 'none', max: 0, names: [] } }, {})).toThrow(RuleViolation);
    expect(translateMessage('guestNotFound', {}, 'en')).toBe('Guest not found.');
  });
});
