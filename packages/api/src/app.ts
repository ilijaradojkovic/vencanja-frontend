import { Hono } from 'hono';

import { getGuestByToken } from './services/guest.ts';
import { makeThumbnailProbe } from './services/image.ts';

/** HTTP methods the product API needs (SPEC §6). */
export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ApiMethod = (typeof API_METHODS)[number];

/**
 * M0 architecture spike. These `/spike/*` routes exist only to prove that the
 * Next.js catch-all mounts Hono for every HTTP method, that a Node-only native
 * module (sharp) runs inside the production build, and that a server component
 * can call the same service the API uses. They are replaced by the real routes
 * in M1.
 */
export const app = new Hono().basePath('/api');

for (const method of API_METHODS) {
  app.on(method, '/spike/echo', (c) => c.json({ method: c.req.method, ok: true }));
}

app.get('/spike/guest/:token', (c) => {
  const guest = getGuestByToken(c.req.param('token'));
  return guest ? c.json({ guest }) : c.json({ error: 'guestNotFound', code: 'guestNotFound' }, 404);
});

app.post('/spike/image', async (c) => c.json({ thumbnail: await makeThumbnailProbe() }));
