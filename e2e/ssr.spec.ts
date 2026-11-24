import { expect, test, type Page } from '@playwright/test';

import {
  clickUntilText,
  clickUntilUrl,
  completeWeddingOnboarding,
  gotoHydrated,
  signUpAndConfirm,
  uniqueEmail,
} from './auth.helpers';

async function guestLinkFor(page: Page, guestName: string): Promise<string> {
  await gotoHydrated(page, '/app/gosti');
  await page.getByRole('button', { name: 'Novi gost' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Ime (kako piše na pozivnici)').fill(guestName);
  await modal.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(page.getByRole('status')).toContainText('Gost je dodat');
  const href = await page
    .getByRole('row')
    .filter({ hasText: guestName })
    .getByRole('link', { name: `Otvori pozivnicu za ${guestName}` })
    .getAttribute('href');
  return href ?? '';
}

/**
 * DOD M3: concurrent SSR requests with different locales/event types do not leak
 * state, and guest responses are `private, no-store` (SYS-3/D13, SPEC §3.3).
 */
test('concurrent SSR renders keep locale and event wording separate and stay private', async ({ page }, testInfo) => {
  const project = testInfo.project.name;

  // Wedding organizer (English request will use this page).
  await signUpAndConfirm(page, uniqueEmail('ssr-wedding', project));
  await completeWeddingOnboarding(page, { partner1: 'Ana', partner2: 'Marko', date: '2027-06-12' });
  const weddingPath = await guestLinkFor(page, 'Jelena Petrović');

  // Celebration organizer (Russian request will use this page).
  await signOut(page);
  await signUpAndConfirm(page, uniqueEmail('ssr-celebration', project));
  await page.getByRole('button', { name: 'Proslava' }).click();
  await clickUntilText(page, 'Dalje', 'Imena i datum');
  await page.getByLabel('Slavljenik').fill('Luka');
  await page.getByLabel('Naziv proslave').fill('18. rođendan');
  await page.getByLabel('Datum proslave').fill('2027-05-20');
  await clickUntilText(page, 'Dalje', 'Kontakt');
  await page.getByLabel(/^Telefon/).fill('060 111 2222');
  await clickUntilUrl(page, 'Završi', /\/app(\?|$)/);
  const celebrationPath = await guestLinkFor(page, 'Mila Jovanović');

  const [english, russian] = await Promise.all([
    page.request.get(weddingPath, { headers: { cookie: 'lang=en' } }),
    page.request.get(celebrationPath, { headers: { cookie: 'lang=ru' } }),
  ]);

  for (const response of [english, russian]) {
    expect(response.status()).toBe(200);
    // Dev normalizes the proxy header to `no-store`; production's exact
    // `private, no-store` is asserted by `npm run spike:check`.
    const cache = response.headers()['cache-control'] ?? '';
    expect(cache).toContain('no-store');
    expect(cache === 'no-store' || cache.includes('private')).toBe(true);
  }

  const englishHtml = await english.text();
  const russianHtml = await russian.text();

  // Different languages, different event types, no cross-contamination.
  expect(englishHtml).toContain('Open the invitation');
  expect(englishHtml).toContain('Ana');
  expect(englishHtml).toContain('Marko');
  expect(englishHtml).toContain('Jelena Petrović');
  expect(englishHtml).not.toContain('18. rođendan');
  expect(englishHtml).not.toContain('приглашает вас на праздник');

  expect(russianHtml).toContain('Открыть приглашение');
  expect(russianHtml).toContain('18. rođendan');
  expect(russianHtml).toContain('Mila Jovanović');
  expect(russianHtml).toContain('приглашает вас на праздник');
  expect(russianHtml).not.toContain('Open the invitation');
  expect(russianHtml).not.toContain('Ana');
});

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
