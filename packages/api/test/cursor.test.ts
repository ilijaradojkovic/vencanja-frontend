import { describe, expect, it } from 'vitest';

import { decodeCursor, DEFAULT_PAGE_SIZE, encodeCursor, MAX_PAGE_SIZE, parseLimit } from '../src/services/cursor.ts';

describe('photo cursor', () => {
  const cursor = { createdAt: '2026-11-24T18:00:00.123456Z', id: '0b8e1c4e-5b8a-4a3e-9b1f-1c2d3e4f5a6b' };

  it('round-trips an opaque URL-safe cursor', () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it('treats a missing cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('rejects malformed or tampered cursors', () => {
    const bad = [
      'not-base64-json',
      Buffer.from('{}').toString('base64url'),
      Buffer.from(JSON.stringify(['2026-11-24', cursor.id])).toString('base64url'),
      Buffer.from(JSON.stringify([cursor.createdAt, "x' or 1=1"])).toString('base64url'),
      Buffer.from(JSON.stringify([cursor.createdAt])).toString('base64url'),
    ];
    for (const value of bad) expect(() => decodeCursor(value)).toThrow();
  });

  it('defaults the limit to 50 and caps it at 100', () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(parseLimit('20')).toBe(20);
    expect(parseLimit('500')).toBe(MAX_PAGE_SIZE);
    for (const value of ['0', '-1', '2.5', 'abc']) expect(() => parseLimit(value)).toThrow();
  });
});
