#!/usr/bin/env node
/**
 * M0 architecture-spike check (DOD M0). Runs against a production build, so run
 * `npm run build` first. It proves that:
 *   - the Next.js catch-all mounts Hono for GET, POST, PUT, PATCH and DELETE,
 *   - sharp (a native Node module) runs inside the Node runtime,
 *   - a server component calls the API's `server-only` service,
 *   - guest HTML is per-request with locale metadata and `private, no-store`.
 *
 * The `/api/spike/*` routes and this script are replaced when M1 introduces the
 * real health route and services.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const port = Number(process.env.SPIKE_PORT ?? 3100);
const base = `http://127.0.0.1:${port}`;
const webDir = fileURLToPath(new URL('../apps/web/', import.meta.url));
const timeoutMs = 60_000;

const failures = [];

const assert = (name, condition, detail = '') => {
  if (condition) {
    process.stdout.write(`ok   ${name}\n`);
    return;
  }
  failures.push(name);
  process.stdout.write(`FAIL ${name}${detail ? `: ${detail}` : ''}\n`);
};

const waitForServer = async () => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // server not up yet
    }
    await sleep(500);
  }
  throw new Error(`server did not answer on ${base} within ${timeoutMs}ms`);
};

const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  cwd: webDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

const shutdown = () => {
  if (!server.killed) server.kill('SIGTERM');
};
process.on('exit', shutdown);
process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});

try {
  await waitForServer();

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await fetch(`${base}/api/spike/echo`, { method });
    const body = await response.json().catch(() => null);
    assert(
      `${method} /api/spike/echo`,
      response.ok && body?.method === method && body?.ok === true,
      `status ${response.status}, body ${JSON.stringify(body)}`,
    );
  }

  const imageResponse = await fetch(`${base}/api/spike/image`, { method: 'POST' });
  const imageBody = await imageResponse.json().catch(() => null);
  const thumbnail = imageBody?.thumbnail;
  assert(
    'sharp runs in the Node runtime',
    imageResponse.ok &&
      thumbnail?.width === 24 &&
      thumbnail?.height === 16 &&
      thumbnail?.format === 'jpeg' &&
      thumbnail.bytes > 0,
    `status ${imageResponse.status}, body ${JSON.stringify(imageBody)}`,
  );

  const guestApi = await fetch(`${base}/api/spike/guest/demo-jelena`);
  const guestApiBody = await guestApi.json().catch(() => null);
  assert('GET /api/spike/guest/:token', guestApi.ok && guestApiBody?.guest?.token === 'demo-jelena');
  const missingGuestApi = await fetch(`${base}/api/spike/guest/unknown-token`);
  assert('unknown guest through the API is 404', missingGuestApi.status === 404, `status ${missingGuestApi.status}`);

  const englishPage = await fetch(`${base}/i/demo-jelena`, { headers: { cookie: 'lang=en' } });
  const englishHtml = await englishPage.text();
  assert(
    'guest page renders the server-only service result',
    englishPage.ok && englishHtml.includes('Jelena Petrović'),
  );
  assert('guest page sets private, no-store', englishPage.headers.get('cache-control') === 'private, no-store');
  assert('guest page has the cookie locale on <html>', englishHtml.includes('<html lang="en"'));
  assert('guest page metadata is localized', englishHtml.includes('Invitation · Jelena Petrović'));
  assert('guest page exposes the Open Graph locale', englishHtml.includes('property="og:locale" content="en"'));

  const serbianPage = await fetch(`${base}/i/demo-jelena`, { headers: { cookie: 'lang=sr' } });
  const serbianHtml = await serbianPage.text();
  assert('guest page follows the locale cookie', serbianHtml.includes('<html lang="sr"'));

  const unknownGuestPage = await fetch(`${base}/i/unknown-token`);
  assert('unknown guest page is 404', unknownGuestPage.status === 404, `status ${unknownGuestPage.status}`);

  const landing = await fetch(base);
  assert('landing page still renders', landing.ok, `status ${landing.status}`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  failures.push('spike check crashed');
} finally {
  shutdown();
}

if (failures.length > 0) {
  process.stdout.write(`\n${failures.length} spike check(s) failed\n`);
  process.exit(1);
}
process.stdout.write('\narchitecture spike passed\n');
