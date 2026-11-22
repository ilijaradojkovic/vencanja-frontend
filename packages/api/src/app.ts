import { Hono } from 'hono';

import { errorHandler, notFoundHandler } from './errors.ts';
import { errorBody, type AppEnv } from './http.ts';
import { language } from './middleware/language.ts';
import { metricsMiddleware } from './middleware/metrics.ts';
import { requestContext } from './middleware/request-context.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { healthRoutes } from './routes/health.ts';
import { metricsRoutes } from './routes/metrics.ts';
import { getGuestByToken } from './services/guest.ts';
import { makeThumbnailProbe } from './services/image.ts';

/** HTTP methods the product API needs (SPEC §6). */
export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ApiMethod = (typeof API_METHODS)[number];

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', requestContext());
app.use('*', language());
app.use('*', metricsMiddleware());
app.use('*', requestLogger());

app.route('/', healthRoutes);
app.route('/', metricsRoutes);

/**
 * M0 architecture spike. These `/spike/*` routes exist only to prove that the
 * Next.js catch-all mounts Hono for every HTTP method, that a Node-only native
 * module (sharp) runs inside the production build, and that a server component
 * can call the same service the API uses. They are replaced by the real routes
 * in M2/M3.
 */
for (const method of API_METHODS) {
  app.on(method, '/spike/echo', (c) => c.json({ method: c.req.method, ok: true }));
}

app.get('/spike/guest/:token', (c) => {
  const guest = getGuestByToken(c.req.param('token'));
  return guest ? c.json({ guest }) : c.json(errorBody(c, 'guestNotFound'), 404);
});

app.post('/spike/image', async (c) => c.json({ thumbnail: await makeThumbnailProbe() }));

app.notFound(notFoundHandler);
app.onError(errorHandler);

export { app };
