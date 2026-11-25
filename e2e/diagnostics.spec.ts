import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/**
 * S17 (DOD §3): a tester triggers a validation failure in the local testing menu,
 * opens the error details, copies the ID and downloads one diagnostic JSON that
 * carries the same trace ID on the browser and server side, ordered events and no
 * sensitive content.
 */
test('S17 tester downloads one correlated, redacted diagnostic bundle', async ({ page }) => {
  await page.goto('/dev/diagnostics');
  await page.getByLabel('Broj osoba (dozvoljeno 1–3)').fill('9');
  await page.getByRole('button', { name: 'Pošalji neispravan zahtev' }).click();

  await expect(page.getByTestId('diagnostic-panel')).toBeVisible();
  await expect(page.getByTestId('diagnostic-code')).toHaveText('personsRange');
  const traceId = (await page.getByTestId('diagnostic-trace').textContent())?.trim();
  expect(traceId).toMatch(/^[0-9a-f]{32}$/);

  await page.getByRole('button', { name: 'Kopiraj ID' }).click();
  await expect(page.getByTestId('diagnostic-copied')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Preuzmi dijagnostiku' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`uspomena-diagnostic-${traceId}.json`);
  const path = await download.path();
  const bundle = JSON.parse(readFileSync(String(path), 'utf8')) as {
    schemaVersion: number;
    traceId: string;
    requestIds: string[];
    events: { kind: string; traceId: string; status?: number; requestId?: string }[];
    spans: { route: string | null; status: number | null; requestId: string | null }[];
    warnings: string[];
  };

  expect(bundle.schemaVersion).toBe(1);
  expect(bundle.traceId).toBe(traceId);
  expect(bundle.warnings).toEqual([]);
  expect(bundle.events.length).toBeGreaterThan(0);
  expect(bundle.events.every((event) => event.traceId === traceId)).toBe(true);
  expect(bundle.events.some((event) => event.kind === 'request')).toBe(true);
  expect(bundle.events.some((event) => event.kind === 'response' && event.status === 422)).toBe(true);

  expect(bundle.spans.length).toBeGreaterThan(0);
  expect(bundle.spans.some((span) => span.route === '/api/spike/validate' && span.status === 422)).toBe(true);
  expect(bundle.requestIds).toContain(bundle.spans[0]?.requestId ?? 'missing');

  const serialized = JSON.stringify(bundle);
  expect(serialized).not.toMatch(/couple@uspomena\.test/);
  expect(serialized).not.toMatch(/sb_secret|Bearer |password/i);
  // The redactions summary names these categories; no actual header value may appear.
  expect(serialized).not.toMatch(/authorization:|cookie:/i);
});
