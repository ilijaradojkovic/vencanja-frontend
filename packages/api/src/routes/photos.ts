import { Hono, type Context } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import {
  bulkUpdateStatus,
  deletePhoto,
  listEventPhotos,
  signedPhotoPayloads,
  updatePhotoStatus,
} from '../services/photos.ts';

const profileIdOf = (c: Context<AppEnv>): string | null => c.get('profile')?.id ?? null;

/**
 * Organizer photo list and moderation (UC-34, UC-36, UC-37, UC-39). Every photo in a
 * response carries freshly signed (1 h) `url`/`thumbUrl`. The onboarding guard has
 * already authenticated the organizer; every handler still checks event ownership.
 */
export const photoRoutes = new Hono<AppEnv>()
  .get('/weddings/:id/photos', async (c) => {
    const profileId = profileIdOf(c);
    if (!profileId) return c.json(errorBody(c, 'unauthorized'), 401);
    const rows = await listEventPhotos(profileId, c.req.param('id'));
    return c.json({ photos: await signedPhotoPayloads(rows) });
  })
  .patch('/photos/:id', async (c) => {
    const profileId = profileIdOf(c);
    if (!profileId) return c.json(errorBody(c, 'unauthorized'), 401);
    const body = (await c.req.json().catch(() => ({}))) as { status?: unknown };
    const [photo] = await signedPhotoPayloads([await updatePhotoStatus(profileId, c.req.param('id'), body.status)]);
    return c.json({ photo });
  })
  .post('/weddings/:id/photos/bulk-status', async (c) => {
    const profileId = profileIdOf(c);
    if (!profileId) return c.json(errorBody(c, 'unauthorized'), 401);
    const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown; status?: unknown };
    const updated = await bulkUpdateStatus(profileId, c.req.param('id'), body.ids, body.status);
    return c.json({ photos: await signedPhotoPayloads(updated) });
  })
  .delete('/photos/:id', async (c) => {
    const profileId = profileIdOf(c);
    if (!profileId) return c.json(errorBody(c, 'unauthorized'), 401);
    const id = c.req.param('id');
    await deletePhoto(profileId, id);
    return c.json({ id });
  });
