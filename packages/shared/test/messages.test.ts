import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  MESSAGE_KEYS,
  parseLanguage,
  translateMessage,
} from '../src/messages.ts';

describe('message catalogue', () => {
  it('has at least one key', () => {
    expect(MESSAGE_KEYS.length).toBeGreaterThan(0);
  });

  it('has a non-empty translation for every key in sr, en and ru', () => {
    for (const key of MESSAGE_KEYS) {
      for (const language of LANGUAGES) {
        const text = translateMessage(key, {}, language);
        expect(text.trim(), `${key}/${language}`).not.toBe('');
        expect(text, `${key}/${language}`).not.toBe(key);
      }
    }
  });

  it('starts every sentence in uppercase and does not leave raw placeholders', () => {
    for (const key of MESSAGE_KEYS) {
      for (const language of LANGUAGES) {
        const text = translateMessage(key, { name: 'Ana', max: 3 }, language);
        expect(text).not.toMatch(/\{\{/);
        expect(text[0]).toBe(text[0]?.toUpperCase());
      }
    }
  });
});

describe('translateMessage', () => {
  it('returns the message in the requested language', () => {
    expect(translateMessage('invitationNotFound', {}, 'en')).toBe('Invitation not found. Please check the link.');
    expect(translateMessage('invitationNotFound', {}, 'ru')).toBe('Приглашение не найдено. Проверьте ссылку.');
  });

  it('interpolates parameters', () => {
    expect(translateMessage('personsRange', { max: 3 }, 'en')).toBe(
      'The number of people must be between 1 and 3.',
    );
    expect(translateMessage('notImage', { name: 'slika.heic' }, 'sr')).toBe('slika.heic nije slika.');
  });

  it('renders a missing parameter as an empty string', () => {
    expect(translateMessage('notImage', {}, 'en')).toBe(' is not an image.');
  });

  it('treats regex replacement characters literally', () => {
    expect(translateMessage('notImage', { name: '$& photo $1' }, 'en')).toBe('$& photo $1 is not an image.');
  });
});

describe('parseLanguage', () => {
  it('accepts the supported languages', () => {
    expect(parseLanguage('sr')).toBe('sr');
    expect(parseLanguage('en')).toBe('en');
    expect(parseLanguage('ru')).toBe('ru');
  });

  it('reads the primary tag of an Accept-Language header', () => {
    expect(parseLanguage('en-GB,en;q=0.9')).toBe('en');
    expect(parseLanguage('RU-ru,RU;q=0.8')).toBe('ru');
  });

  it('falls back to Serbian for missing or unknown values', () => {
    expect(parseLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(parseLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(parseLanguage('')).toBe(DEFAULT_LANGUAGE);
    expect(parseLanguage('de-DE')).toBe(DEFAULT_LANGUAGE);
  });
});
