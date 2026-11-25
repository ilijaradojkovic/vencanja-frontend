import { expect, test } from '@playwright/test';

import {
  PASSWORD,
  completeWeddingOnboarding,
  gotoHydrated,
  linkFromEmail,
  signUpAndConfirm,
  uniqueEmail,
  waitForEmail,
  waitForHydration,
} from './auth.helpers';

/**
 * UC-82 Secure Email Change and UC-83 change password, end to end with Mailpit:
 * both addresses get a confirmation link, the change completes only after both,
 * and the new password revokes the old one.
 */
test('UC-82/UC-83 change email on both addresses, then change the password', async ({ page }, testInfo) => {
  const original = uniqueEmail('acc', testInfo.project.name);
  const nextEmail = uniqueEmail('acc-next', testInfo.project.name);

  await signUpAndConfirm(page, original);
  await completeWeddingOnboarding(page, { partner1: 'Ana', partner2: 'Marko', date: '2027-06-12' });
  await expect(page).toHaveURL(/\/app(\?|$)/);

  // Settings → Account (UC-82).
  await gotoHydrated(page, '/app/podesavanja');
  await page.getByLabel(/^Nova email adresa/).fill(nextEmail);
  await page.getByRole('button', { name: 'Promeni email' }).click();
  await expect(page.getByText(`Čeka potvrdu: ${nextEmail}`)).toBeVisible();

  const currentAddressMail = await waitForEmail(original, 'Potvrda promene');
  const newAddressMail = await waitForEmail(nextEmail, 'Potvrdite novu');
  expect(linkFromEmail(currentAddressMail)).not.toBe(linkFromEmail(newAddressMail));

  // The change completes only after both addresses confirm.
  await page.goto(linkFromEmail(currentAddressMail));
  await waitForHydration(page);
  await page.goto(linkFromEmail(newAddressMail));
  await waitForHydration(page);

  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await waitForHydration(page);
  await page.getByLabel(/^Email/).fill(nextEmail);
  await page.getByLabel(/^Lozinka/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(page).toHaveURL(/\/app(\?|$)/);

  // UC-06: the session survives a reload without another sign-in.
  await page.reload();
  await expect(page).toHaveURL(/\/app(\?|$)/);
  await expect(page.getByTestId('countdown')).toBeVisible();

  // Settings → Account (UC-83): wrong current password is rejected, then the new one works.
  await gotoHydrated(page, '/app/podesavanja');
  const newPassword = 'e2e-promenjena-456';
  await page.getByLabel('Trenutna lozinka').fill('pogresna-lozinka');
  await page.getByLabel('Nova lozinka').fill(newPassword);
  await page.getByLabel('Ponovite novu lozinku').fill(newPassword);
  await page.getByRole('button', { name: 'Promeni lozinku' }).click();
  await expect(page.locator('.form-error')).toContainText('Trenutna lozinka nije ispravna.');

  await page.getByLabel('Trenutna lozinka').fill(PASSWORD);
  await page.getByRole('button', { name: 'Promeni lozinku' }).click();
  await expect(page.getByRole('status').first()).toContainText('Lozinka je promenjena.');

  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await waitForHydration(page);
  await page.getByLabel(/^Email/).fill(nextEmail);
  await page.getByLabel(/^Lozinka/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(page.locator('.form-error')).toContainText('Pogrešan email ili lozinka.');

  await page.getByLabel(/^Lozinka/).fill(newPassword);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(page).toHaveURL(/\/app(\?|$)/);
});
