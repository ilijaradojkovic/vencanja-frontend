import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../src/app.ts';
import { buildAuthEmail, resolveAuthEmailLocale } from '../src/services/auth-email.ts';
import { setEmailSenderForTests, type EmailMessage } from '../src/services/email.ts';
import { verifyWebhookSignature } from '../src/services/webhook.ts';

const SECRET = `whsec_${Buffer.from('local-test-secret-value-32-bytes!!').toString('base64')}`;
const now = Math.floor(Date.now() / 1000);

const sign = (body: string, id: string, timestamp: number) =>
  `v1,${createHmac('sha256', Buffer.from(SECRET.slice('whsec_'.length), 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')}`;

const payload = (locale: string | undefined, action = 'signup', email = 'gost@uspomena.test') =>
  JSON.stringify({
    user: { email, user_metadata: locale ? { locale } : null },
    email_data: {
      token_hash: 'hash123',
      email_action_type: action,
      site_url: 'http://127.0.0.1:54321/auth/v1',
      redirect_to: 'http://localhost:3000/app',
    },
  });

beforeEach(() => {
  process.env.SUPABASE_AUTH_HOOK_SECRET = SECRET;
  process.env.APP_URL = 'http://localhost:3000';
  process.env.EMAIL_DRIVER = 'smtp';
});

afterEach(() => {
  setEmailSenderForTests(null);
  vi.restoreAllMocks();
});

describe('verifyWebhookSignature', () => {
  const body = payload('sr');
  const headers = (signature: string) => ({ id: 'msg_1', timestamp: String(now), signature });

  it('accepts a correctly signed body', () => {
    expect(verifyWebhookSignature(body, headers(sign(body, 'msg_1', now)), SECRET, now)).toBe(true);
  });

  it('accepts a signature list that contains the valid one', () => {
    const signature = `v1,AAAA ${sign(body, 'msg_1', now)}`;
    expect(verifyWebhookSignature(body, headers(signature), SECRET, now)).toBe(true);
  });

  it('rejects a wrong secret, a modified body and missing headers', () => {
    const otherSecret = `whsec_${Buffer.from('another-local-secret-32-bytes-!!!!').toString('base64')}`;
    const signed = sign(body, 'msg_1', now);

    expect(verifyWebhookSignature(body, headers(signed), otherSecret, now)).toBe(false);
    expect(verifyWebhookSignature(`${body} `, headers(signed), SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, { ...headers(signed), id: undefined }, SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, { ...headers(signed), signature: undefined }, SECRET, now)).toBe(false);
  });

  it('rejects stale timestamps and unsigned secrets', () => {
    expect(verifyWebhookSignature(body, headers(sign(body, 'msg_1', now - 3600)), SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, headers(sign(body, 'msg_1', now)), '', now)).toBe(false);
  });
});

describe('buildAuthEmail', () => {
  it('uses the locale from the auth metadata', () => {
    expect(resolveAuthEmailLocale(JSON.parse(payload('ru')))).toBe('ru');
    expect(resolveAuthEmailLocale(JSON.parse(payload('en-GB')))).toBe('en');
    expect(resolveAuthEmailLocale(JSON.parse(payload(undefined)))).toBe('sr');
  });

  it('renders the localized subject and the canonical callback link', () => {
    const russian = buildAuthEmail(JSON.parse(payload('ru')), 'http://localhost:3000');
    expect(russian?.subject).toBe('Подтвердите email · Uspomena');
    expect(russian?.kind).toBe('auth_signup');
    expect(russian?.to).toBe('gost@uspomena.test');
    expect(russian?.text).toContain('http://localhost:3000/auth/callback?token_hash=hash123&type=signup');
    expect(russian?.text).toContain('next=http%3A%2F%2Flocalhost%3A3000%2Fapp');

    expect(buildAuthEmail(JSON.parse(payload('en')), 'http://localhost:3000')?.subject).toBe(
      'Confirm your email · Uspomena',
    );
  });

  it('shares the email_change copy for both confirmation steps', () => {
    const current = buildAuthEmail(JSON.parse(payload('sr', 'email_change_current')), 'http://localhost:3000');
    const next = buildAuthEmail(JSON.parse(payload('sr', 'email_change_new')), 'http://localhost:3000');
    expect(current?.subject).toBe('Promena email adrese · Uspomena');
    expect(next?.subject).toBe(current?.subject);
  });

  it('ignores unknown actions and incomplete payloads', () => {
    expect(buildAuthEmail(JSON.parse(payload('sr', 'unknown_action')), 'http://localhost:3000')).toBeNull();
    expect(buildAuthEmail({ user: { email: 'x@uspomena.test' } }, 'http://localhost:3000')).toBeNull();
    expect(buildAuthEmail({ email_data: { email_action_type: 'signup' } }, 'http://localhost:3000')).toBeNull();
  });
});

describe('POST /api/hooks/auth-email', () => {
  const sendHook = (body: string, id: string, timestamp: number, signature?: string) =>
    app.request('/api/hooks/auth-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': signature ?? sign(body, id, timestamp),
      },
      body,
    });

  it('sends the email through the EmailSender boundary', async () => {
    const sent: EmailMessage[] = [];
    setEmailSenderForTests({
      send: async (message) => {
        sent.push(message);
        return { providerId: 'test' };
      },
    });

    const response = await sendHook(payload('en'), 'msg_2', now);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe('Confirm your email · Uspomena');
  });

  it('refuses an unsigned or tampered request without sending mail', async () => {
    const sent: EmailMessage[] = [];
    setEmailSenderForTests({
      send: async (message) => {
        sent.push(message);
        return { providerId: 'test' };
      },
    });

    const tampered = await sendHook(`${payload('sr')}`, 'msg_3', now, 'v1,bm9wZQ==');
    expect(tampered.status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('rejects unknown actions with the error envelope', async () => {
    const response = await sendHook(payload('sr', 'unknown_action'), 'msg_4', now);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('badRequest');
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
