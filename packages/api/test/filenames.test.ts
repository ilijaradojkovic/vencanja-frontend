import { describe, expect, it } from 'vitest';

import { extensionOf, originalFileName, sanitizeNamePart } from '../src/services/filenames.ts';

const base = {
  id: '0b8e1c4e-5b8a-4a3e-9b1f-1c2d3e4f5a6b',
  senderName: 'Jelena Petrović',
  createdAt: new Date('2027-06-12T21:15:00Z'),
  mime: 'image/jpeg',
  originalPath: 'events/e/original/x.jpg',
};

describe('original file names (UC-85)', () => {
  it('builds <sender>_<date>_<id>.<ext> and keeps Unicode letters', () => {
    expect(originalFileName(base)).toBe('Jelena-Petrović_2027-06-12_0b8e1c4e-5b8a-4a3e-9b1f-1c2d3e4f5a6b.jpg');
    expect(originalFileName({ ...base, senderName: 'Мария', mime: 'image/png' })).toMatch(/^Мария_2027-06-12_.*\.png$/);
  });

  it('removes path separators, traversal, reserved and control characters', () => {
    expect(sanitizeNamePart('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeNamePart('a\\b:c*d?e"f<g>h|i')).toBe('abcdefghi');
    expect(sanitizeNamePart('evil\u0000‮name')).toBe('evilname');
    expect(sanitizeNamePart('  ...  ')).toBe('');
    expect(originalFileName({ ...base, senderName: '../' })).toMatch(/^gost_/);
  });

  it('bounds the sender part and keeps names unique by id', () => {
    const long = originalFileName({ ...base, senderName: 'x'.repeat(300) });
    expect(long.split('_')[0]).toHaveLength(40);
    const other = originalFileName({ ...base, id: '1b8e1c4e-5b8a-4a3e-9b1f-1c2d3e4f5a6b' });
    expect(other).not.toBe(originalFileName(base));
  });

  it('derives the extension from the MIME type or the stored path', () => {
    expect(extensionOf('image/webp', null)).toBe('webp');
    expect(extensionOf(null, 'events/e/original/x.PNG')).toBe('png');
    expect(extensionOf(null, null)).toBe('jpg');
    expect(extensionOf(null, 'weird.path/with')).toBe('jpg');
  });
});
