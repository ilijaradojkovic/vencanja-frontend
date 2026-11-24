import { RuleViolation } from '@uspomena/shared';

/** Cursor pagination for photo lists (SPEC §6.3): default 50, maximum 100. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * Position after the last returned row of the stable `(createdAt, id)` ordering.
 * `createdAt` keeps Postgres microseconds; a JS `Date` would truncate them and
 * skip or repeat rows created within the same millisecond.
 */
export type PhotoCursor = { createdAt: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

/** Opaque, URL-safe cursor. */
export const encodeCursor = (cursor: PhotoCursor): string =>
  Buffer.from(JSON.stringify([cursor.createdAt, cursor.id])).toString('base64url');

/**
 * Validates the cursor's shape (SPEC §6.3 "signed or otherwise validated"). A
 * cursor only moves within a query that is already scoped by event and status,
 * so a forged cursor cannot reveal other rows; a malformed one is `422 badRequest`.
 */
export const decodeCursor = (value: unknown): PhotoCursor | null => {
  if (value === undefined || value === null || value === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      TIMESTAMP.test(parsed[0]) &&
      UUID.test(parsed[1]) &&
      !Number.isNaN(Date.parse(parsed[0]))
    ) {
      return { createdAt: parsed[0], id: parsed[1].toLowerCase() };
    }
  } catch {
    // Falls through to the validation error.
  }
  throw new RuleViolation('badRequest');
};

export const parseLimit = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return DEFAULT_PAGE_SIZE;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new RuleViolation('badRequest');
  return Math.min(limit, MAX_PAGE_SIZE);
};
