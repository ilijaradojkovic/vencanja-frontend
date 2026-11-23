import { RuleViolation } from '@uspomena/shared';
import { Hono } from 'hono';

import { env } from './env.ts';
import { errorHandler, notFoundHandler } from './errors.ts';
import { errorBody, type AppEnv } from './http.ts';
import { language } from './middleware/language.ts';
import { metricsMiddleware } from './middleware/metrics.ts';
import { adminGuard } from './middleware/admin.ts';
import { onboardingGuard } from './middleware/onboarding.ts';
import { rateLimitByIp } from './middleware/rate-limit.ts';
import { requestContext } from './middleware/request-context.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { adminRoutes } from './routes/admin.ts';
import { authEmailRoutes } from './routes/auth-email.ts';
import { authRoutes } from './routes/auth.ts';
import { diagnosticsRoutes } from './routes/diagnostics.ts';
import { guestRoutes } from './routes/guests.ts';
import { healthRoutes } from './routes/health.ts';
import { metricsRoutes } from './routes/metrics.ts';
import { onboardingRoutes } from './routes/onboarding.ts';
import { publicRoutes } from './routes/public.ts';
import { weddingRoutes } from './routes/weddings.ts';
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
app.route('/', authEmailRoutes);
app.route('/', diagnosticsRoutes);
app.route('/', authRoutes);
app.route('/', onboardingRoutes);

// Organizer data routes: 401 without a token, 409 onboardingRequired until UC-81 is done.
for (const prefix of ['/weddings/*', '/guests/*', '/photos/*']) app.use(prefix, onboardingGuard());
app.route('/', weddingRoutes);
app.route('/', guestRoutes);

// SYS-12: the public guest API is limited by trusted IP; RSVP/notify have the stricter
// write window on top of the general read limit. Middleware is registered before the
// routes so it wraps them.
app.use(
  '/public/*',
  rateLimitByIp(() => ({
    scope: 'public-read',
    limit: env.rateLimitPublicReadPerMin(),
    windowMs: 60_000,
  })),
);
for (const path of [
  '/public/invitations/:token/rsvp',
  '/public/invitations/:token/notify',
  '/public/weddings/:slug/notify',
]) {
  app.use(
    path,
    rateLimitByIp(() => ({
      scope: 'public-write',
      limit: env.rateLimitPublicWritePer10Min(),
      windowMs: 600_000,
    })),
  );
}

app.route('/', publicRoutes);

// Superadmin routes: 401 without a token, 403 for every other role.
app.use('/admin/*', adminGuard());
app.route('/', adminRoutes);

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

/** Local validation failure used by the diagnostics tests and S17 (removed with the spike). */
app.post('/spike/validate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { persons?: unknown };
  const persons = Number(body.persons);
  if (!Number.isInteger(persons) || persons < 1 || persons > 3) {
    throw new RuleViolation('personsRange', { max: 3 });
  }
  return c.json({ ok: true, persons });
});

app.notFound(notFoundHandler);
app.onError(errorHandler);

export { app };
