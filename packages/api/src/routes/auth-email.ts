import { Hono } from 'hono';

import { env } from '../env.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { getLogger } from '../logger.ts';
import { buildAuthEmail, type AuthEmailHookPayload } from '../services/auth-email.ts';
import { emailSender } from '../services/email.ts';
import { verifyWebhookSignature } from '../services/webhook.ts';

/**
 * `POST /api/hooks/auth-email` — Supabase Auth Send Email Hook (SPEC §3.3, M2
 * completes the templates). The raw body is verified with Standard Webhooks, the
 * message is rendered in the locale from the auth metadata and sent through the
 * `EmailSender` boundary (SMTP → Mailpit locally).
 *
 * The route answers `401` for a bad/missing signature, `400` for an unknown action
 * and `200` only after the provider accepted the message.
 */
export const authEmailRoutes = new Hono<AppEnv>().post('/hooks/auth-email', async (c) => {
  const rawBody = await c.req.text();

  if (
    !verifyWebhookSignature(
      rawBody,
      {
        id: c.req.header('webhook-id'),
        timestamp: c.req.header('webhook-timestamp'),
        signature: c.req.header('webhook-signature'),
      },
      env.authHookSecret(),
    )
  ) {
    return c.json(errorBody(c, 'unauthorized'), 401);
  }

  let payload: AuthEmailHookPayload;
  try {
    payload = JSON.parse(rawBody) as AuthEmailHookPayload;
  } catch {
    return c.json(errorBody(c, 'badRequest'), 400);
  }

  const message = buildAuthEmail(payload, env.appUrl());
  if (!message) return c.json(errorBody(c, 'badRequest'), 400);

  try {
    const { providerId } = await emailSender().send(message);
    getLogger().info(
      { requestId: c.get('requestId'), traceId: c.get('traceId'), kind: message.kind, providerId },
      'auth email sent',
    );
    return c.json({ ok: true });
  } catch (error) {
    getLogger().error(
      {
        requestId: c.get('requestId'),
        traceId: c.get('traceId'),
        kind: message.kind,
        err: { name: (error as Error).name, message: (error as Error).message },
      },
      'auth email failed',
    );
    return c.json(errorBody(c, 'internalError'), 500);
  }
});
