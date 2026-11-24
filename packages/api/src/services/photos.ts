import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { isPhotoCategory, RuleViolation, type PhotoCategory } from '@uspomena/shared';
import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, photos } from '../db/schema.ts';
import { env } from '../env.ts';
import { ApiProblem } from '../errors.ts';
import type { EventRow } from './events.ts';
import type { GuestRow } from './guests.ts';
import { readImageMetadata } from './image.ts';
import { createSignedUploadUrl, deleteObjects, downloadObject } from './storage.ts';

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

  const [otherUsage] = await db
    .select({ used: sql<string>`coalesce(sum(${photos.sizeBytes}), 0)` })
    .from(photos)
    .where(and(eq(photos.eventId, event.id), ne(photos.id, photo.id)));
  const otherUsed = Number(otherUsage?.used ?? 0);
  if (otherUsed + metadata.size > event.storageLimitBytes) {
    await deleteObjects([photo.originalPath]);
    await db.delete(photos).where(eq(photos.id, photo.id));
    throw new ApiProblem(403, 'storageLimit');
  }

  const status = event.settings.autoApprovePhotos ? 'approved' : 'pending';
  const [updated] = await db
    .update(photos)
    .set({
      status,
      mime: `image/${metadata.format}`,
      sizeBytes: metadata.size,
      width: metadata.width,
      height: metadata.height,
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
