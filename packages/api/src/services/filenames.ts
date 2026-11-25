/**
 * Download file names for originals (UC-85): `<sender>_<date>_<id>.<ext>`. Path
 * separators, reserved and control characters are removed, whitespace becomes
 * `-`, the sender part is bounded, and the photo id keeps every name unique.
 */
const RESERVED = /[\\/:*?"<>|\p{Cc}\p{Cf}]/gu;
const MAX_SENDER = 40;

export const sanitizeNamePart = (value: string): string =>
  value
    .normalize('NFC')
    .replace(RESERVED, '')
    .replace(/\s+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, MAX_SENDER);

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const extensionOf = (mime: string | null, path: string | null): string => {
  if (mime && EXTENSIONS[mime]) return EXTENSIONS[mime];
  const fromPath = path?.split('.').pop()?.toLowerCase();
  return fromPath && /^[a-z0-9]{2,5}$/.test(fromPath) ? fromPath : 'jpg';
};

export const originalFileName = (photo: {
  id: string;
  senderName: string;
  createdAt: Date;
  mime: string | null;
  originalPath: string | null;
}): string => {
  const sender = sanitizeNamePart(photo.senderName) || 'gost';
  const date = photo.createdAt.toISOString().slice(0, 10);
  return `${sender}_${date}_${photo.id}.${extensionOf(photo.mime, photo.originalPath)}`;
};
