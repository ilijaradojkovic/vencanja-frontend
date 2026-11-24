import { expect, test } from '@playwright/test';

import { gotoHydrated } from './auth.helpers';

/**
 * M1 walking skeleton (DOD M1): the landing page renders and the product really
 * calls the mounted API at `/api/*` — the development probe only shows "ok" when
 * `/api/health` reached the local database.
 */
test.describe('landing page', () => {
  test('opens from the product and reports a healthy local API', async ({ page }) => {
    const health = page.waitForResponse((response) => response.url().endsWith('/api/health'));
    await page.goto('/');

    const response = await health;
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Uspomena');
    await expect(page.getByTestId('api-health')).toHaveText(/API: ok \(v[\d.]+\)/);
  });

  // M3: `/i/[token]` is the DB-backed personal invitation (seeded guest `seedguest001`).
  test('renders the seeded guest invitation in the cookie language with private caching', async ({ page }) => {
    await page.context().addCookies([{ name: 'lang', value: 'en', domain: 'localhost', path: '/' }]);
    await page.goto('/i/seedguest001');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Jelena Petrović');

    const cacheControl = await page.evaluate(async () => {
      const response = await fetch('/i/seedguest001');
      return response.headers.get('cache-control');
    });
    // `next dev` answers `no-store`; the production build gets the exact
    // `private, no-store` from proxy.ts, which `npm run spike:check` asserts.
    expect(cacheControl).toMatch(/^(private, )?no-store$/);
  });

  test('switches the guest invitation language without a reload (UC-10)', async ({ page }) => {
    await gotoHydrated(page, '/i/seedguest001');
    await expect(page.getByRole('button', { name: 'Otvori pozivnicu' })).toBeVisible();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Open the invitation' })).toBeVisible();
    await page.getByRole('button', { name: 'Srpski' }).click();
    await expect(page.getByRole('button', { name: 'Otvori pozivnicu' })).toBeVisible();
  });

  test('returns a 404 envelope for an unknown guest link', async ({ page }) => {
    const response = await page.goto('/i/unknown-token');
    expect(response?.status()).toBe(404);
  });
});
