import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { isPhotoCategory, isPhotoStatus, RuleViolation, type PhotoCategory, type PhotoStatus } from '@uspomena/shared';
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, photos } from '../db/schema.ts';
import { env } from '../env.ts';
import { ApiProblem } from '../errors.ts';
import { decodeCursor, encodeCursor, parseLimit, type PhotoCursor } from './cursor.ts';
import { originalFileName } from './filenames.ts';
import type { EventRow } from './events.ts';
import type { GuestRow } from './guests.ts';
import { makeDerivatives, readImageMetadata } from './image.ts';
import { createSignedReadUrls, createSignedUploadUrl, deleteObjects, downloadObject, uploadObject } from './storage.ts';

const ALLOWED_MIME: Record<string, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const EXTENSION: Record<'jpeg' | 'png' | 'webp', string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
export const MAX_UPLOADS_PER_REQUEST = 50;
export const UPLOAD_URL_TTL_SECONDS = 7200;

export type UploadRequestInput = {
  category?: unknown;
  senderName?: unknown;
  message?: unknown;
  files?: unknown;
};

type ValidFile = { name: string; mime: keyof typeof ALLOWED_MIME; size: number; ext: string };

const text = (value: unknown, max: number): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length > max) throw new RuleViolation('textTooLong', { max });
  return trimmed;
};

const validateFiles = (input: unknown, maxBytes: number): ValidFile[] => {
  if (!Array.isArray(input) || input.length === 0) throw new RuleViolation('noFiles');
  if (input.length > MAX_UPLOADS_PER_REQUEST) throw new RuleViolation('tooManyFiles');

  return input.map((raw) => {
    const file = (raw ?? {}) as { name?: unknown; type?: unknown; size?: unknown };
    const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim().slice(0, 200) : 'fotografija';
    const mime = typeof file.type === 'string' ? file.type : '';
    const format = ALLOWED_MIME[mime];
    if (!format) throw new RuleViolation('notImage', { name });
    const size = Number(file.size);
    if (!Number.isInteger(size) || size <= 0) throw new RuleViolation('notImage', { name });
    if (size > maxBytes) throw new RuleViolation('tooLarge', { name, max: env.maxUploadMb() });
    return { name, mime: mime as keyof typeof ALLOWED_MIME, size, ext: EXTENSION[format] };
  });
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const sameHash = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export type UploadTicket = { photoId: string; uploadUrl: string; uploadKey: string };

/**
 * `POST …/uploads` (SPEC §6.3): validates the declared files, reserves their bytes
 * against the event's storage ceiling under a row lock, creates `uploading` rows
 * and returns a signed upload URL plus a secret upload key for each.
 */
export const requestUploads = async (
  event: EventRow,
  guest: GuestRow | null,
  input: UploadRequestInput,
): Promise<UploadTicket[]> => {
  const files = validateFiles(input.files, env.maxUploadMb() * 1024 * 1024);
  const category: PhotoCategory =
    input.category === undefined
      ? 'wedding'
      : isPhotoCategory(input.category)
        ? input.category
        : (() => {
            throw new RuleViolation('badRequest');
          })();
  const senderName = text(input.senderName ?? guest?.name ?? '', 120);
  const message = text(input.message ?? '', 1000);
  const requested = files.reduce((total, file) => total + file.size, 0);

  const db = getDb();
  const created = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, event.id)).for('update');
    if (!locked) throw new ApiProblem(404, 'weddingNotFound');
    const [usage] = await tx
      .select({ used: sql<string>`coalesce(sum(${photos.sizeBytes}), 0)` })
      .from(photos)
      .where(eq(photos.eventId, event.id));
    const used = Number(usage?.used ?? 0);
    if (used + requested > locked.storageLimitBytes) throw new ApiProblem(403, 'storageLimit');

    const rows = files.map((file) => {
      const id = crypto.randomUUID();
      const uploadKey = randomBytes(32).toString('base64url');
      return {
        id,
        uploadKey,
        row: {
          id,
          eventId: event.id,
          guestId: guest?.id ?? null,
          senderName,
          category,
          message,
          status: 'uploading' as const,
          uploadKeyHash: sha256(uploadKey),
          originalPath: `events/${event.id}/original/${id}.${file.ext}`,
          mime: file.mime,
          sizeBytes: file.size,
        },
      };
    });

    await tx.insert(photos).values(rows.map((entry) => entry.row));
    return rows;
  });

  try {
    return await Promise.all(
      created.map(async (entry) => {
        const { uploadUrl } = await createSignedUploadUrl(entry.row.originalPath);
        return { photoId: entry.row.id, uploadUrl, uploadKey: entry.uploadKey };
      }),
    );
  } catch (error) {
    // Signing failed: release the reservation so it does not block the account.
    await db
      .delete(photos)
      .where(
        and(
          eq(photos.eventId, event.id),
          sql`${photos.id} = any(${sql.raw(`array['${created.map((entry) => entry.row.id).join("','")}']::uuid[]`)})`,
        ),
      );
    throw error;
  }
};

export type CompletedPhoto = { id: string; status: 'uploading' | 'pending' | 'approved' | 'hidden' };

export type PhotoPayload = {
  id: string;
  weddingId: string;
  guestId: string | null;
  senderName: string;
  category: PhotoCategory;
  message: string;
  status: 'uploading' | PhotoStatus;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: string;
  /** Signed (1 h) URL of the web version; null while it does not exist yet. */
  url: string | null;
  /** Signed (1 h) URL of the thumbnail; null while it does not exist yet. */
  thumbUrl: string | null;
};

type PhotoRow = typeof photos.$inferSelect;

const signedOf = (signed: Map<string, string>, path: string | null): string | null =>
  path ? (signed.get(path) ?? null) : null;

/**
 * Signs the web and thumb paths of a page of photos in one Storage request
 * (SPEC §6.3, §7.3). Originals are never signed here.
 */
export const signPhotoUrls = async (rows: Pick<PhotoRow, 'webPath' | 'thumbPath'>[]): Promise<Map<string, string>> =>
  createSignedReadUrls(
    rows.flatMap((row) => [row.webPath, row.thumbPath]).filter((path): path is string => Boolean(path)),
  );

export const toPhotoPayload = (photo: PhotoRow, signed: Map<string, string> = new Map()): PhotoPayload => ({
  id: photo.id,
  weddingId: photo.eventId,
  guestId: photo.guestId,
  senderName: photo.senderName,
  category: photo.category,
  message: photo.message,
  status: photo.status,
  width: photo.width,
  height: photo.height,
  sizeBytes: photo.sizeBytes,
  createdAt: photo.createdAt.toISOString(),
  url: signedOf(signed, photo.webPath),
  thumbUrl: signedOf(signed, photo.thumbPath),
});

/** Payloads with freshly signed read URLs for a list of photo rows. */
export const signedPhotoPayloads = async (rows: PhotoRow[]): Promise<PhotoPayload[]> => {
  const signed = await signPhotoUrls(rows);
  return rows.map((row) => toPhotoPayload(row, signed));
};

const ownedEventId = async (profileId: string, eventId: string): Promise<string> => {
  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, profileId)))
    .limit(1);
  if (!event) throw new ApiProblem(404, 'weddingNotFound');
  return event.id;
};

/** `created_at` with microseconds, for cursors (a JS Date would truncate it). */
const cursorTimestamp = sql<string>`to_char(${photos.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export type PhotoPage = { rows: PhotoRow[]; nextCursor: string | null };

/**
 * One page of photos in the stable `(createdAt, id)` order (SPEC §6.3). Fetches
 * `limit + 1` rows to know whether another page exists.
 */
export const pagePhotos = async (
  where: SQL | undefined,
  order: 'asc' | 'desc',
  cursor: PhotoCursor | null,
  limit: number,
): Promise<PhotoPage> => {
  const after = cursor
    ? order === 'desc'
      ? sql`(${photos.createdAt}, ${photos.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
      : sql`(${photos.createdAt}, ${photos.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined;
  const direction = order === 'desc' ? desc : asc;
  const rows = await getDb()
    .select({ photo: photos, at: cursorTimestamp })
    .from(photos)
    .where(and(where, after))
    .orderBy(direction(photos.createdAt), direction(photos.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => row.photo),
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.at, id: last.photo.id }) : null,
  };
};

export type PhotoCounts = { pending: number; approved: number; hidden: number; all: number };

/** Per-status totals for the Photos tabs (processed photos only). */
export const countEventPhotos = async (eventId: string): Promise<PhotoCounts> => {
  const rows = await getDb()
    .select({ status: photos.status, count: sql<string>`count(*)` })
    .from(photos)
    .where(and(eq(photos.eventId, eventId), ne(photos.status, 'uploading')))
    .groupBy(photos.status);
  const counts: PhotoCounts = { pending: 0, approved: 0, hidden: 0, all: 0 };
  for (const row of rows) {
    if (row.status === 'uploading') continue;
    counts[row.status] = Number(row.count);
    counts.all += Number(row.count);
  }
  return counts;
};

export type PhotoListQuery = {
  status?: string;
  category?: string;
  guestId?: string;
  order?: string;
  cursor?: string;
  limit?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const categoryFilter = (value: unknown): SQL | undefined => {
  if (value === undefined || value === '' || value === 'all') return undefined;
  if (!isPhotoCategory(value)) throw new RuleViolation('badRequest');
  return eq(photos.category, value);
};

/**
 * `GET /weddings/:id/photos` (UC-34): processed photos with signed URLs, newest
 * first by default (`order=asc` for the album/slideshow), filtered by status,
 * category and guest, one cursor page at a time. `uploading` reservations are
 * never listed.
 */
export const listEventPhotos = async (
  profileId: string,
  eventId: string,
  query: PhotoListQuery = {},
): Promise<PhotoPage & { counts: PhotoCounts }> => {
  await ownedEventId(profileId, eventId);

  const status =
    query.status === undefined || query.status === '' || query.status === 'all' ? null : statusOf(query.status);
  if (query.guestId !== undefined && query.guestId !== '' && !UUID.test(query.guestId)) {
    throw new RuleViolation('badRequest');
  }
  if (query.order !== undefined && query.order !== 'asc' && query.order !== 'desc')
    throw new RuleViolation('badRequest');
  const where = and(
    eq(photos.eventId, eventId),
    status ? eq(photos.status, status) : ne(photos.status, 'uploading'),
    categoryFilter(query.category),
    query.guestId ? eq(photos.guestId, query.guestId) : undefined,
  );
  const [page, counts] = await Promise.all([
    pagePhotos(where, query.order === 'asc' ? 'asc' : 'desc', decodeCursor(query.cursor), parseLimit(query.limit)),
    countEventPhotos(eventId),
  ]);
  return { ...page, counts };
};

export type OriginalFile = { id: string; filename: string; url: string; size: number };

/** Signed (1 h) original URLs that make the browser save under the given name. */
const signOriginals = async (rows: PhotoRow[]): Promise<OriginalFile[]> => {
  const signed = await createSignedReadUrls(
    rows.map((row) => row.originalPath).filter((path): path is string => Boolean(path)),
  );
  return rows.flatMap((row) => {
    const url = row.originalPath ? signed.get(row.originalPath) : undefined;
    if (!url) return [];
    const filename = originalFileName(row);
    return [{ id: row.id, filename, url: `${url}&download=${encodeURIComponent(filename)}`, size: row.sizeBytes ?? 0 }];
  });
};

/**
 * `GET /weddings/:id/photos/originals` (UC-85): signed original URLs, oldest
 * first, one mandatory cursor page at a time, for `approved` or `all` processed
 * photos. The first page's `total`/`totalBytes` drive progress and the large-
 * download warning.
 */
export const listOriginals = async (
  profileId: string,
  eventId: string,
  query: { status?: string; cursor?: string; limit?: string } = {},
): Promise<{ photos: OriginalFile[]; nextCursor: string | null; total: number; totalBytes: number }> => {
  const id = await ownedEventId(profileId, eventId);
  if (query.status !== undefined && query.status !== 'approved' && query.status !== 'all') {
    throw new RuleViolation('badRequest');
  }
  const where = and(
    eq(photos.eventId, id),
    query.status === 'all' ? ne(photos.status, 'uploading') : eq(photos.status, 'approved'),
  );
  const [page, [totals]] = await Promise.all([
    pagePhotos(where, 'asc', decodeCursor(query.cursor), parseLimit(query.limit)),
    getDb()
      .select({ total: sql<string>`count(*)`, bytes: sql<string>`coalesce(sum(${photos.sizeBytes}), 0)` })
      .from(photos)
      .where(where),
  ]);
  return {
    photos: await signOriginals(page.rows),
    nextCursor: page.nextCursor,
    total: Number(totals?.total ?? 0),
    totalBytes: Number(totals?.bytes ?? 0),
  };
};

/** `GET /photos/:id/original` (UC-85 single download): one signed original. */
export const originalFor = async (profileId: string, photoId: string): Promise<OriginalFile> => {
  const owned = await ownedPhoto(profileId, photoId);
  if (!owned || owned.photo.status === 'uploading') throw new ApiProblem(404, 'photoNotFound');
  const [file] = await signOriginals([owned.photo]);
  if (!file) throw new ApiProblem(404, 'photoNotFound');
  return file;
};

const statusOf = (value: unknown): PhotoStatus => {
  if (!isPhotoStatus(value)) throw new RuleViolation('badStatus');
  return value;
};

/** The photo must belong to an event of this organizer; otherwise it is not found. */
export const ownedPhoto = async (
  profileId: string,
  photoId: string,
): Promise<{ photo: typeof photos.$inferSelect; event: EventRow } | null> => {
  const db = getDb();
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!photo) return null;
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, photo.eventId), eq(events.ownerId, profileId)))
    .limit(1);
  return event ? { photo, event } : null;
};

/** `PATCH /photos/:id` (UC-36): approve, hide or send back to pending. */
export const updatePhotoStatus = async (
  profileId: string,
  photoId: string,
  status: unknown,
): Promise<typeof photos.$inferSelect> => {
  const owned = await ownedPhoto(profileId, photoId);
  if (!owned) throw new ApiProblem(404, 'photoNotFound');
  const [updated] = await getDb()
    .update(photos)
    .set({ status: statusOf(status) })
    .where(eq(photos.id, photoId))
    .returning();
  if (!updated) throw new ApiProblem(404, 'photoNotFound');
  return updated;
};

/**
 * `POST /weddings/:id/photos/bulk-status` (UC-37, SPEC §6.6 item 1): only this
 * event's photos are touched; foreign IDs are silently skipped instead of failing
 * the whole batch.
 */
export const bulkUpdateStatus = async (
  profileId: string,
  eventId: string,
  ids: unknown,
  status: unknown,
): Promise<(typeof photos.$inferSelect)[]> => {
  const nextStatus = statusOf(status);
  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, profileId)))
    .limit(1);
  if (!event) throw new ApiProblem(404, 'weddingNotFound');
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw new RuleViolation('badRequest');

  const updated = await getDb()
    .update(photos)
    .set({ status: nextStatus })
    .where(and(eq(photos.eventId, eventId), inArray(photos.id, ids as string[])))
    .returning();
  return updated;
};

/** `DELETE /photos/:id` (UC-39): removes the row and all three stored objects. */
export const deletePhoto = async (profileId: string, photoId: string): Promise<void> => {
  const owned = await ownedPhoto(profileId, photoId);
  if (!owned) throw new ApiProblem(404, 'photoNotFound');
  const paths = [owned.photo.originalPath, owned.photo.webPath, owned.photo.thumbPath].filter((path): path is string =>
    Boolean(path),
  );
  if (paths.length > 0) await deleteObjects(paths);
  await getDb().delete(photos).where(eq(photos.id, photoId));
};

/**
 * `POST /public/uploads/:photoId/complete` (SPEC §6.3): checks the object, reads
 * the real dimensions with sharp, reconciles the reservation, sets the moderation
 * status (SYS-2) and is idempotent for repeated calls.
 */
export const completeUpload = async (photoId: string, uploadKey: unknown): Promise<CompletedPhoto> => {
  if (typeof uploadKey !== 'string' || !uploadKey) throw new RuleViolation('badRequest');
  const db = getDb();
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!photo || !photo.uploadKeyHash || !sameHash(sha256(uploadKey), photo.uploadKeyHash)) {
    throw new ApiProblem(404, 'photoNotFound');
  }
  if (photo.status !== 'uploading') return { id: photo.id, status: photo.status };

  const [event] = await db.select().from(events).where(eq(events.id, photo.eventId)).limit(1);
  if (!event || !photo.originalPath) throw new ApiProblem(404, 'photoNotFound');

  const buffer = await downloadObject(photo.originalPath);
  if (!buffer) throw new RuleViolation('uploadNotFound');

  const metadata = await readImageMetadata(buffer);
  if (!metadata) {
    // The object exists but is not a usable image: remove both (SPEC §6.3).
    await deleteObjects([photo.originalPath]);
    await db.delete(photos).where(eq(photos.id, photo.id));
    throw new RuleViolation('notImage', { name: photo.senderName || 'fotografija' });
  }

  const maxBytes = env.maxUploadMb() * 1024 * 1024;
  if (metadata.size > maxBytes) {
    await deleteObjects([photo.originalPath]);
    await db.delete(photos).where(eq(photos.id, photo.id));
    throw new RuleViolation('tooLarge', { name: photo.senderName || 'fotografija', max: env.maxUploadMb() });
  }

  // Reconcile the reservation with the actual size under the same event row lock
  // as new reservations, so concurrent completions cannot both pass the limit.
  const fits = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(events).where(eq(events.id, event.id)).for('update');
    if (!locked) return false;
    const [otherUsage] = await tx
      .select({ used: sql<string>`coalesce(sum(${photos.sizeBytes}), 0)` })
      .from(photos)
      .where(and(eq(photos.eventId, event.id), ne(photos.id, photo.id)));
    if (Number(otherUsage?.used ?? 0) + metadata.size > locked.storageLimitBytes) return false;
    await tx.update(photos).set({ sizeBytes: metadata.size }).where(eq(photos.id, photo.id));
    return true;
  });
  if (!fits) {
    await deleteObjects([photo.originalPath]);
    await db.delete(photos).where(eq(photos.id, photo.id));
    throw new ApiProblem(403, 'storageLimit');
  }

  // Derivatives are generated before the atomic status transition; a repeated
  // complete after a failure regenerates and overwrites them (x-upsert).
  const derivatives = await makeDerivatives(buffer);
  const webPath = `events/${event.id}/web/${photo.id}.jpg`;
  const thumbPath = `events/${event.id}/thumb/${photo.id}.jpg`;
  await uploadObject(webPath, derivatives.web.buffer);
  await uploadObject(thumbPath, derivatives.thumb.buffer);

  const status = event.settings.autoApprovePhotos ? 'approved' : 'pending';
  const [updated] = await db
    .update(photos)
    .set({
      status,
      mime: `image/${metadata.format}`,
      sizeBytes: metadata.size,
      width: metadata.width,
      height: metadata.height,
      webPath,
      thumbPath,
      uploadedAt: new Date(),
    })
    .where(and(eq(photos.id, photo.id), eq(photos.status, 'uploading')))
    .returning();

  if (updated) return { id: updated.id, status: updated.status };
  // A concurrent completion won the atomic transition; report its state.
  const [current] = await db.select().from(photos).where(eq(photos.id, photo.id)).limit(1);
  if (!current) throw new ApiProblem(404, 'photoNotFound');
  return { id: current.id, status: current.status };
};
