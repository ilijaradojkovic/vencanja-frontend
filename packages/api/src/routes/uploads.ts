import { Hono, type Context } from 'hono';

import { ApiProblem } from '../errors.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { photoProcessingDurationSeconds, photoProcessingTotal, photoUploadsTotal } from '../metrics.ts';
import { RuleViolation } from '@uspomena/shared';

import { completeUpload, requestUploads, type UploadRequestInput } from '../services/photos.ts';
import { eventById, eventBySlug, guestByToken } from '../services/public.ts';

const fileCount = (input: UploadRequestInput): number => (Array.isArray(input.files) ? input.files.length : 0);

/** Counts the requested files by outcome without labels that identify anyone. */
const countedTickets = async <T>(
  link: 'personal' | 'qr',
  input: UploadRequestInput,
  run: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await run();
    photoUploadsTotal.inc({ link, outcome: 'reserved' }, fileCount(input));
    return result;
  } catch (error) {
    const outcome = error instanceof ApiProblem && error.code === 'storageLimit' ? 'storage_limit' : 'rejected';
    photoUploadsTotal.inc({ link, outcome }, fileCount(input));
    throw error;
  }
};

const COMPLETE_OUTCOMES: Record<string, string> = {
  notImage: 'not_image',
  tooLarge: 'too_large',
  storageLimit: 'storage_limit',
  uploadNotFound: 'missing',
  photoNotFound: 'invalid_key',
};

const body = async (c: Context<AppEnv>): Promise<UploadRequestInput> =>
  ((await c.req.json().catch(() => ({}))) as UploadRequestInput) ?? {};

/**
 * Signed direct-to-Storage uploads (SPEC §6.3): the guest asks the API for upload
 * URLs, PUTs the files straight to Storage, then calls `complete`. The API never
 * receives the file bytes, so the bucket's own size/MIME limits also apply.
 */
export const uploadRoutes = new Hono<AppEnv>()
  .post('/public/invitations/:token/uploads', async (c) => {
    const guest = await guestByToken(c.req.param('token'));
    if (!guest) return c.json(errorBody(c, 'invitationNotFound'), 404);
    const event = await eventById(guest.eventId);
    if (!event) return c.json(errorBody(c, 'invitationNotFound'), 404);
    const input = await body(c);
    return c.json({ uploads: await countedTickets('personal', input, () => requestUploads(event, guest, input)) }, 201);
  })
  .post('/public/weddings/:slug/uploads', async (c) => {
    const event = await eventBySlug(c.req.param('slug'));
    if (!event) return c.json(errorBody(c, 'weddingNotFound'), 404);
    if (!event.settings.allowGeneralUpload) return c.json(errorBody(c, 'qrUploadDisabled'), 403);
    const input = await body(c);
    return c.json({ uploads: await countedTickets('qr', input, () => requestUploads(event, null, input)) }, 201);
  })
  .post('/public/uploads/:photoId/complete', async (c) => {
    const payload = (await c.req.json().catch(() => ({}))) as { uploadKey?: unknown };
    const stop = photoProcessingDurationSeconds.startTimer();
    try {
      const result = await completeUpload(c.req.param('photoId'), payload.uploadKey);
      const outcome = result.processed ? 'processed' : 'already_done';
      photoProcessingTotal.inc({ outcome });
      stop({ outcome });
      return c.json({ id: result.id, status: result.status });
    } catch (error) {
      const code = error instanceof ApiProblem || error instanceof RuleViolation ? error.code : '';
      const outcome = COMPLETE_OUTCOMES[code] ?? 'error';
      photoProcessingTotal.inc({ outcome });
      stop({ outcome });
      throw error;
    }
  });
