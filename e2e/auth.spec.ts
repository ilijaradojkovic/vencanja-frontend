import { expect, test } from '@playwright/test';

import {
  PASSWORD,
  gotoHydrated,
  waitForHydration,
  clickUntilText,
  clickUntilUrl,
  signOutThroughUi,
  completeWeddingOnboarding,
  linkFromEmail,
  signUpAndConfirm,
  uniqueEmail,
  waitForEmail,
} from './auth.helpers';

const email = (prefix: string, project: string) => uniqueEmail(prefix, project);

/**
 * S1/S2/S3 against the entirely local stack: Next.js + the mounted API + local
 * Supabase Auth + Mailpit. Emails are read from Mailpit, never sent for real.
 */
test('S1 signup, email confirmation, wedding onboarding and dashboard countdown', async ({ page }, testInfo) => {
  const address = email('s1', testInfo.project.name);
  await signUpAndConfirm(page, address);
  await completeWeddingOnboarding(page, { partner1: 'Ana', partner2: 'Marko', date: '2027-06-12' });

  await expect(page).toHaveURL(/\/app(\?|$)/);
  await expect(page.getByTestId('countdown')).toContainText(/Do venčanja još \d+/);
});

test('S2 celebration onboarding uses the celebration wording and "18. rođendan"', async ({ page }, testInfo) => {
  const address = email('s2', testInfo.project.name);
  await signUpAndConfirm(page, address);

  await page.getByRole('button', { name: 'Proslava' }).click();
  await clickUntilText(page, 'Dalje', 'Imena i datum');
  await page.getByLabel('Slavljenik').fill('Mila');
  await page.getByLabel('Naziv proslave').fill('18. rođendan');
  await page.getByLabel('Datum proslave').fill('2027-05-20');
  await clickUntilText(page, 'Dalje', 'Kontakt');
  await page.getByLabel(/^Telefon/).fill('060 111 2222');
  await clickUntilUrl(page, 'Završi', /\/app(\?|$)/);

  await expect(page).toHaveURL(/\/app(\?|$)/);
  await expect(page.getByTestId('countdown')).toContainText(/Do proslave još \d+/);
  await expect(page.getByText('Proslava', { exact: true })).toBeVisible();
});

test('S3 forgot password, new password, sign in with the new one and reject the old one', async ({
  page,
}, testInfo) => {
  const address = email('s3', testInfo.project.name);
  await signUpAndConfirm(page, address);

  // Sign out from the onboarding wizard, then request the reset link (UC-80).
  await signOutThroughUi(page);

  await gotoHydrated(page, '/zaboravljena-lozinka');
  await page.getByLabel(/^Email/).fill(address);
  await page.getByRole('button', { name: 'Pošalji link' }).click();
  await expect(page.getByTestId('reset-sent')).toContainText('Ako nalog postoji');

  const message = await waitForEmail(address, 'Nova lozinka');
  await gotoHydrated(page, linkFromEmail(message));
  await expect(page).toHaveURL(/\/nova-lozinka$/);

  const newPassword = 'e2e-nova-lozinka-456';
  await page.getByLabel(/^Nova lozinka/).fill(newPassword);
  await page.getByLabel(/^Ponovite lozinku/).fill(newPassword);
  await clickUntilUrl(page, 'Sačuvaj novu lozinku', /\/onboarding$/);

  // The recovered session is signed in; the un-onboarded account lands in the wizard.
  await signOutThroughUi(page);
  await waitForHydration(page);

  await page.getByLabel(/^Email/).fill(address);
  await page.getByLabel(/^Lozinka/).fill(newPassword);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await signOutThroughUi(page);
  await waitForHydration(page);
  await page.getByLabel(/^Email/).fill(address);
  await page.getByLabel(/^Lozinka/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(page.locator('.form-error')).toContainText('Pogrešan email ili lozinka.');
});
