import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Standard Webhooks verification for the Supabase Send Email Hook (M2 completes the
 * template work, M1 proves the local path). The secret looks like
 * `whsec_<base64>`; the signature is `v1,<base64 hmac-sha256 of id.timestamp.body>`
 * and the timestamp must be recent to block replays.
 */
const TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
};

const decodeSecret = (secret: string): Buffer =>
  Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64');

const signatures = (header: string | undefined): string[] =>
  (header ?? '')
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));

export const verifyWebhookSignature = (
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean => {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', decodeSecret(secret))
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest();
  const provided = signatures(headers.signature).map((signature) => Buffer.from(signature, 'base64'));

  return provided.some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected));
};
