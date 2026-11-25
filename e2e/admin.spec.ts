import { expect, test } from '@playwright/test';

import { gotoHydrated, uniqueEmail, waitForHydration } from './auth.helpers';

const ADMIN = { email: 'admin@uspomena.test', password: 'admin-local-123' };

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await gotoHydrated(page, '/login');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Lozinka/).fill(password);
  await page.getByRole('button', { name: 'Prijavi se' }).click();
}

/**
 * S12: the superadmin creates a celebration account, the organizer signs in
 * without onboarding, the superadmin deactivates the account, the organizer is
 * signed out and can no longer sign in, and guest pages keep working (UC-72, UC-75).
 */
test('S12 superadmin creates and deactivates an account; the organizer is signed out', async ({
  page,
  browser,
}, testInfo) => {
  const email = uniqueEmail('s12', testInfo.project.name);
  const password = 's12-lozinka-123';

  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await waitForHydration(page);

  await page.getByRole('button', { name: 'Novi nalog' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('radio', { name: 'Proslava' }).click();
  await modal.getByLabel('Slavljenik', { exact: true }).fill('Testni');
  await modal.getByLabel('Naziv proslave', { exact: true }).fill('10. rođendan');
  await modal.getByLabel('Datum proslave', { exact: true }).fill('2027-05-20');
  await modal.getByLabel(/^Email za prijavu/).fill(email);
  await modal.getByLabel(/^Telefon/).fill('060 111 2222');
  await modal.getByLabel(/^Lozinka/).fill(password);
  // A click can be lost while React hydrates under parallel load; retry until the
  // credentials dialog replaces the form.
  await expect(async () => {
    await modal.getByRole('button', { name: 'Napravi nalog' }).click();
    await expect(page.getByRole('heading', { name: 'Nalog je napravljen' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });

  const credentials = page.getByRole('dialog');
  await expect(credentials).toContainText('Nalog je napravljen');
  await expect(credentials).toContainText(email);
  await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
  await credentials.getByRole('button', { name: 'Zatvori' }).click();

  // The organizer signs in on a separate device and stays signed in there.
  const organizer = await browser.newContext();
  const organizerPage = await organizer.newPage();
  await login(organizerPage, email, password);
  await expect(organizerPage).toHaveURL(/\/app(\?|$)/);
  await expect(organizerPage.getByTestId('countdown')).toContainText(/Do proslave još \d+/);

  // Deactivate from the admin table (UC-75).
  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await waitForHydration(page);
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(async () => {
    await row.getByRole('button', { name: 'Deaktiviraj' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deaktiviraj' }).click();
    await expect(page.getByRole('status')).toContainText('Nalog je deaktiviran.', { timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await expect(row.getByText('Deaktivirana')).toBeVisible();

  // The already signed-in organizer is sent back to the login page.
  await organizerPage.goto('/app');
  await expect(organizerPage).toHaveURL(/\/login/);

  // And a new sign-in is refused with the prototype's message.
  await login(organizerPage, email, password);
  await expect(organizerPage).toHaveURL(/\/login$/);
  await expect(organizerPage.locator('.form-error')).toContainText('Nalog je deaktiviran. Javite se administratoru.');
  await organizer.close();

  // Guest pages are unaffected by the organizer's deactivation.
  const guest = await page.request.get('/i/seedguest001');
  expect(guest.status()).toBe(200);
  expect(await guest.text()).toContain('Jelena Petrović');
});
