import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { isRuleViolation, type MessageKey } from '@uspomena/shared';

import { errorBody, type AppEnv } from './http.ts';
import { getLogger } from './logger.ts';
import { language } from './middleware/language.ts';
import { requestContext } from './middleware/request-context.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { healthRoutes } from './routes/health.ts';
import { getGuestByToken } from './services/guest.ts';
import { makeThumbnailProbe } from './services/image.ts';

/** HTTP methods the product API needs (SPEC §6). */
export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ApiMethod = (typeof API_METHODS)[number];

/** Maps a framework status to the shared message key shown to the user. */
const STATUS_MESSAGES: Record<number, MessageKey> = {
  400: 'badRequest',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'notFound',
  409: 'conflict',
  422: 'badRequest',
  429: 'tooManyRequests',
};

export const app = new Hono<AppEnv>().basePath('/api');

app.use('*', requestContext());
app.use('*', language());
app.use('*', requestLogger());

app.route('/', healthRoutes);

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

app.notFound((c) => c.json(errorBody(c, 'notFound'), 404));

app.onError((error, c) => {
  const logger = getLogger();

  if (isRuleViolation(error)) {
    return c.json(errorBody(c, error.code, error.params), 422);
  }

  if (error instanceof HTTPException) {
    const code = STATUS_MESSAGES[error.status] ?? 'internalError';
    return c.json(errorBody(c, code), error.status);
  }

  logger.error(
    {
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
      route: c.req.routePath,
      err: { name: error.name, message: error.message, stack: error.stack },
    },
    'unhandled error',
  );

  return c.json(errorBody(c, 'internalError'), 500);
});
