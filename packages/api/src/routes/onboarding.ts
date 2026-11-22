import { isEventDate, isValidPhone, normalizePhone, RuleViolation, type Language } from '@uspomena/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { getDb } from '../db/client.ts';
import { profiles } from '../db/schema.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { readBearerToken } from '../services/auth.ts';
import { createEvent, findEventForOwner, toWeddingPayload } from '../services/events.ts';
import { loadSession } from '../services/profiles.ts';
import { toProfilePayload } from './auth.ts';

const MAX_NAME = 120;
const MAX_CITY = 120;

type OnboardingBody = {
  type?: unknown;
  partner1?: unknown;
  partner2?: unknown;
  occasion?: unknown;
  date?: unknown;
  phone?: unknown;
  city?: unknown;
};

const text = (value: unknown, max: number, code: 'nameTooLong' | 'cityTooLong'): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length > max) throw new RuleViolation(code);
  return trimmed;
};

type OnboardingInput = {
  type: 'wedding' | 'celebration';
  partner1: string;
  partner2: string;
  occasion: string;
  date: string;
  phone: string;
  city: string;
  locale: Language;
};

/** Validation mirrors `POST /admin/accounts` (SPEC §6.1, UC-81); errors are `422` with a shared code. */
export const parseOnboarding = (body: OnboardingBody, locale: Language): OnboardingInput => {
  const type = body.type === 'celebration' ? 'celebration' : body.type === 'wedding' ? 'wedding' : null;
  if (!type) throw new RuleViolation('badRequest');

  const partner1 = text(body.partner1, MAX_NAME, 'nameTooLong');
  const partner2 = text(body.partner2, MAX_NAME, 'nameTooLong');
  const occasion = text(body.occasion, MAX_NAME, 'nameTooLong');
  const city = text(body.city, MAX_CITY, 'cityTooLong');

  if (!partner1) throw new RuleViolation(type === 'wedding' ? 'namesRequired' : 'celebrantRequired');
  if (type === 'wedding' && !partner2) throw new RuleViolation('namesRequired');

  const date = typeof body.date === 'string' ? body.date : '';
  if (!isEventDate(date)) throw new RuleViolation(type === 'wedding' ? 'dateRequired' : 'celebrationDateRequired');

  const phone = normalizePhone(body.phone);
  if (!isValidPhone(phone)) throw new RuleViolation('invalidPhone');

  return { type, partner1, partner2, occasion, date, phone, city, locale };
};

/**
 * `POST /api/onboarding` — creates the organizer's single event with the default
 * invitation and settings, records the phone and finishes onboarding (UC-81).
 * An account that already has an event answers `409`.
 */
export const onboardingRoutes = new Hono<AppEnv>().post('/onboarding', async (c) => {
  const token = readBearerToken(c.req.header('authorization'));
  if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

  const session = await loadSession(token);
  if (!session.ok) return c.json(errorBody(c, session.code), 401);

  const body = (await c.req.json().catch(() => ({}))) as OnboardingBody;
  const input = parseOnboarding(body, session.profile.locale);

  const existing = await findEventForOwner(session.profile.id);
  if (session.profile.onboardedAt || existing) return c.json(errorBody(c, 'conflict'), 409);

  const event = await createEvent({ ownerId: session.profile.id, ...input });

  const name =
    input.type === 'wedding'
      ? `${input.partner1} i ${input.partner2}`
      : [input.partner1, input.occasion].filter(Boolean).join(' · ');
  const [profile] = await getDb()
    .update(profiles)
    .set({ phone: input.phone, name, onboardedAt: new Date() })
    .where(eq(profiles.id, session.profile.id))
    .returning();
  if (!profile) return c.json(errorBody(c, 'internalError'), 500);

  return c.json({ profile: toProfilePayload(profile), wedding: toWeddingPayload(event) }, 201);
});
