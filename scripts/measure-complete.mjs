#!/usr/bin/env node
/**
 * `npm run measure:complete` — DOD M4 measurement of `POST /public/uploads/:id/complete`
 * against the local stack (local Supabase only; refuses other hosts). It runs the
 * real Hono app in-process, so it can be started inside a resource-limited
 * container (see LOCAL_DEVELOPMENT.md §7):
 *
 *   - N completions of a 12 MP JPEG → p50/p95/max (target p95 < 5 s),
 *   - one ~30 MB high-megapixel JPEG → must complete,
 *   - one >50 MP "decompression bomb" with a tiny file → must fail cleanly (422 notImage),
 *
 * and prints a JSON summary with peak RSS. Everything it creates is deleted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(root, 'apps/web/.env.local'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
process.env.LOG_LEVEL ??= 'silent';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const host = new URL(supabaseUrl).hostname;
if (!['127.0.0.1', 'localhost', 'host.docker.internal'].includes(host)) {
  process.stderr.write(`Refusing to measure against non-local Supabase (${host}).\n`);
  process.exit(1);
}

const runs = Number(process.argv.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 20);
const { default: sharp } = await import('sharp');
const { app } = await import(join(root, 'packages/api/src/app.ts'));
const { getDb, closeDb } = await import(join(root, 'packages/api/src/db/client.ts'));
const { events, photos, profiles } = await import(join(root, 'packages/api/src/db/schema.ts'));
const { eq } = await import('drizzle-orm');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const admin = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 25);

const call = (path, method, body, token) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-real-ip': `198.51.100.${Math.floor(Math.random() * 200) + 20}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

/** A photo-like 12 MP JPEG: smooth gradient plus fine noise (≈ phone-camera size). */
const photoLike = async (width, height, quality, noise) => {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 3;
      const n = (Math.random() - 0.5) * noise;
      raw[index] = Math.max(0, Math.min(255, (x / width) * 200 + 30 + n));
      raw[index + 1] = Math.max(0, Math.min(255, (y / height) * 180 + 40 + n));
      raw[index + 2] = Math.max(0, Math.min(255, 120 + n));
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
};

const email = `measure-${Date.now()}@uspomena.test`;
const created = await (
  await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ email, password: 'measure-123', email_confirm: true }),
  })
).json();
const session = await (
  await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? serviceKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password: 'measure-123' }),
  })
).json();
const token = session.access_token;
const wedding = (
  await (
    await call(
      '/api/onboarding',
      'POST',
      { type: 'wedding', partner1: 'M', partner2: 'E', date: '2027-06-12', phone: '064 123 4567' },
      token,
    )
  ).json()
).wedding;
// The 50 MB development default would stop the measurement after a few photos.
await getDb().update(events).set({ storageLimitBytes: 5_000_000_000 }).where(eq(events.id, wedding.id));
const guest = (await (await call(`/api/weddings/${wedding.id}/guests`, 'POST', { name: 'Merenje' }, token)).json())
  .guest;

const uploadAndComplete = async (buffer, name) => {
  const ticket = (
    await (
      await call(`/api/public/invitations/${guest.token}/uploads`, 'POST', {
        files: [{ name, type: 'image/jpeg', size: buffer.byteLength }],
      })
    ).json()
  ).uploads[0];
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: buffer });
  if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
  const started = performance.now();
  const response = await call(`/api/public/uploads/${ticket.photoId}/complete`, 'POST', {
    uploadKey: ticket.uploadKey,
  });
  const ms = performance.now() - started;
  return { ms, status: response.status, body: await response.json() };
};

const result = { node: process.version, cpus: (await import('node:os')).cpus().length, runs, cases: {} };
try {
  const twelve = await photoLike(4000, 3000, 90, 24);
  const durations = [];
  for (let index = 0; index < runs; index++) {
    const outcome = await uploadAndComplete(twelve, `12mp-${index}.jpg`);
    if (outcome.status !== 200) throw new Error(`12 MP complete failed: ${JSON.stringify(outcome.body)}`);
    durations.push(outcome.ms);
  }
  durations.sort((a, b) => a - b);
  const pick = (q) => durations[Math.min(durations.length - 1, Math.ceil(q * durations.length) - 1)];
  result.cases['12mp'] = {
    megapixels: 12,
    bytes: twelve.byteLength,
    p50Ms: Math.round(pick(0.5)),
    p95Ms: Math.round(pick(0.95)),
    maxMs: Math.round(durations.at(-1)),
    targetP95Ms: 5000,
    pass: pick(0.95) < 5000,
  };

  // ≈30 MB, ≈36 MP (below the 50 MP ceiling): must complete.
  let big = await photoLike(7200, 5000, 97, 90);
  for (let quality = 96; big.byteLength > 30 * 1024 * 1024 && quality > 60; quality -= 3) {
    big = await photoLike(7200, 5000, quality, 90);
  }
  const bigOutcome = await uploadAndComplete(big, 'big.jpg');
  result.cases['30mb'] = {
    megapixels: 36,
    bytes: big.byteLength,
    status: bigOutcome.status,
    ms: Math.round(bigOutcome.ms),
    pass: bigOutcome.status === 200,
  };

  // 108 MP of a single colour: a few hundred KB that would decode to ~324 MB.
  const bomb = await sharp({ create: { width: 12000, height: 9000, channels: 3, background: '#808080' } })
    .jpeg({ quality: 50 })
    .toBuffer();
  const bombOutcome = await uploadAndComplete(bomb, 'bomb.jpg');
  result.cases.decompressionBomb = {
    megapixels: 108,
    bytes: bomb.byteLength,
    status: bombOutcome.status,
    code: bombOutcome.body.code,
    ms: Math.round(bombOutcome.ms),
    pass: bombOutcome.status === 422 && bombOutcome.body.code === 'notImage',
  };
} finally {
  clearInterval(sampler);
  result.peakRssMb = Math.round(peakRss / 1_000_000);
  const rows = await getDb().select().from(photos).where(eq(photos.eventId, wedding.id));
  const paths = rows.flatMap((row) => [row.originalPath, row.webPath, row.thumbPath]).filter(Boolean);
  if (paths.length) {
    await fetch(`${supabaseUrl}/storage/v1/object/photos`, {
      method: 'DELETE',
      headers: admin,
      body: JSON.stringify({ prefixes: paths }),
    });
  }
  await getDb().delete(profiles).where(eq(profiles.id, created.id));
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: admin });
  await closeDb();
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(Object.values(result.cases).every((entry) => entry.pass) ? 0 : 1);
