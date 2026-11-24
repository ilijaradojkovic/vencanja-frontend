import { Hono, type Context } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import { completeUpload, requestUploads, type UploadRequestInput } from '../services/photos.ts';
import { eventById, eventBySlug, guestByToken } from '../services/public.ts';

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
    return c.json({ uploads: await requestUploads(event, guest, await body(c)) }, 201);
  })
  .post('/public/weddings/:slug/uploads', async (c) => {
    const event = await eventBySlug(c.req.param('slug'));
    if (!event) return c.json(errorBody(c, 'weddingNotFound'), 404);
    if (!event.settings.allowGeneralUpload) return c.json(errorBody(c, 'qrUploadDisabled'), 403);
    return c.json({ uploads: await requestUploads(event, null, await body(c)) }, 201);
  })
  .post('/public/uploads/:photoId/complete', async (c) => {
    const payload = (await c.req.json().catch(() => ({}))) as { uploadKey?: unknown };
    return c.json(await completeUpload(c.req.param('photoId'), payload.uploadKey));
  });
