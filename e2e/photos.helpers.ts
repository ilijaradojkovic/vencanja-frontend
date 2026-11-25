import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

import { gotoHydrated, PASSWORD, uniqueEmail } from './auth.helpers';

/** Local configuration written by `dev:bootstrap` (local CLI keys only). */
const localEnv = (): Record<string, string> => {
  try {
    return Object.fromEntries(
      readFileSync(join(process.cwd(), 'apps/web/.env.local'), 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
};

const env = { ...localEnv(), ...process.env } as Record<string, string | undefined>;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? serviceKey;
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export type Organizer = { email: string; token: string; eventId: string; slug: string };

const api = async (path: string, method = 'GET', body?: unknown, token?: string) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${JSON.stringify(json)}`);
  return json;
};

/**
 * A fresh, isolated organizer with an onboarded wedding, created through the
 * local Auth admin API and the product API (no email round trip; S1 covers that).
 */
export async function createOrganizer(prefix: string, project: string): Promise<Organizer> {
  const email = uniqueEmail(prefix, project);
  const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { locale: 'sr' } }),
  });
  expect(created.ok).toBe(true);
  const session = (await (
    await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json()) as { access_token: string };
  const onboarding = await api(
    '/api/onboarding',
    'POST',
    { type: 'wedding', partner1: 'Ana', partner2: 'Marko', date: '2027-06-12', phone: '064 123 4567' },
    session.access_token,
  );
  const wedding = onboarding.wedding as { id: string; slug: string };
  return { email, token: session.access_token, eventId: wedding.id, slug: wedding.slug };
}

export async function addGuest(organizer: Organizer, name: string): Promise<string> {
  const body = await api(`/api/weddings/${organizer.eventId}/guests`, 'POST', { name }, organizer.token);
  return (body.guest as { token: string }).token;
}

/** UC-54 – UC-56 settings through the API (the settings screen is not ported yet). */
export const patchSettings = (organizer: Organizer, settings: Record<string, unknown>) =>
  api(`/api/weddings/${organizer.eventId}`, 'PATCH', { settings }, organizer.token);

export const listPhotos = async (organizer: Organizer, query = 'status=all') =>
  (await api(`/api/weddings/${organizer.eventId}/photos?${query}`, 'GET', undefined, organizer.token)).photos as {
    id: string;
    status: string;
  }[];

export async function signInUi(page: Page, email: string): Promise<void> {
  await gotoHydrated(page, '/login');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Lozinka/).fill(PASSWORD);
  await expect(async () => {
    await page.getByRole('button', { name: 'Prijavi se' }).click();
    await expect(page).toHaveURL(/\/app(\?|\/|$)/, { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
}

/** A real JPEG with distinct pixels, so each fixture has different bytes. */
export const jpeg = (seed: number, width = 640, height = 480): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: (seed * 67) % 255, g: (seed * 131) % 255, b: (seed * 29) % 255 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

export const filePayload = async (name: string, seed: number) => ({
  name,
  mimeType: 'image/jpeg',
  buffer: await jpeg(seed),
});

/** Reads a stored (or deflated-free) ZIP's central directory: name → bytes. */
export function readZip(zip: Buffer): Map<string, Buffer> {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('Not a ZIP file.');
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Bad central directory.');
    const method = zip.readUInt16LE(offset + 10);
    if (method !== 0) throw new Error(`Unexpected compression method ${method}.`);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    entries.set(name, zip.subarray(start, start + size));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
