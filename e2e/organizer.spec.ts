import { expect, test, type Page } from '@playwright/test';

import {
  completeWeddingOnboarding,
  gotoHydrated,
  signUpAndConfirm,
  uniqueEmail,
  waitForHydration,
} from './auth.helpers';

async function newOrganizer(page: Page, prefix: string, project: string): Promise<void> {
  const email = uniqueEmail(prefix, project);
  await signUpAndConfirm(page, email);
  await completeWeddingOnboarding(page, { partner1: 'Ana', partner2: 'Marko', date: '2027-06-12' });
  await expect(page).toHaveURL(/\/app(\?|$)/);
}

async function addGuest(
  page: Page,
  input: { name: string; companions?: 'named' | 'none'; names?: string[] },
): Promise<void> {
  await gotoHydrated(page, '/app/gosti');
  await page.getByRole('button', { name: 'Novi gost' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Ime (kako piše na pozivnici)').fill(input.name);
  if (input.companions === 'named') {
    await modal.getByLabel('Tačno navedene osobe').check();
    const names = input.names ?? ['Nikola'];
    for (let index = 0; index < names.length; index += 1) {
      if (index > 0) await modal.getByRole('button', { name: 'Dodaj pratioca' }).click();
      await modal
        .getByLabel('npr. Marija', { exact: true })
        .nth(index)
        .fill(names[index] ?? '');
    }
  }
  await modal.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(page.getByRole('status')).toContainText('Gost je dodat');
}

/** S4: guest with named companions, import, invitation look/colour, save (UC-17/18/19/27/28/32). */
test('S4 organizer adds guests, imports a list and changes the invitation look', async ({ page }, testInfo) => {
  await newOrganizer(page, 's4', testInfo.project.name);
  await addGuest(page, { name: 'Jelena Nikolić', companions: 'named', names: ['Nikola'] });

  await page.getByRole('button', { name: 'Uvezi spisak' }).click();
  const importModal = page.getByRole('dialog');
  await importModal
    .getByLabel('Spisak gostiju')
    .fill('Porodica Nikolić; 4; 064 123 4567\nMarija Đurić; 1\nKum Petar; 2');
  await importModal.getByRole('button', { name: 'Uvezi (3)' }).click();
  await expect(page.getByRole('status')).toContainText('Dodato gostiju: 3');
  await expect(page.getByRole('cell', { name: 'Porodica Nikolić', exact: true })).toBeVisible();

  await gotoHydrated(page, '/app/pozivnica');
  await expect(page.getByRole('heading', { name: 'Pozivnica' })).toBeVisible();
  await page.getByRole('radio', { name: /Botanika/ }).click();
  await page.getByRole('radio', { name: /Botanika/ }).click();
  await page.getByRole('button', { name: 'Boja #5E7A4E' }).click();
  await page.getByRole('button', { name: 'Sačuvaj izmene' }).click();
  await expect(page.getByRole('status')).toContainText('Pozivnica je sačuvana');

  await waitForHydration(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: /Botanika/ })).toHaveAttribute('aria-checked', 'true');
});

/** S5: personal link, envelope, RSVP with one named companion, notify email, organizer sees it. */
test('S5 guest opens the invitation, confirms with a companion and leaves an email', async ({
  page,
  browser,
}, testInfo) => {
  await newOrganizer(page, 's5', testInfo.project.name);
  await addGuest(page, { name: 'Jelena Nikolić', companions: 'named', names: ['Nikola'] });

  const row = page.getByRole('row').filter({ hasText: 'Jelena Nikolić' });
  const href = await row.getByRole('link', { name: 'Otvori pozivnicu za Jelena Nikolić' }).getAttribute('href');
  expect(href).toMatch(/^\/i\/[0-9A-Za-z]{12}$/);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await gotoHydrated(guestPage, href ?? '');
  await expect(guestPage.getByRole('heading', { name: /Jelena Nikolić/ })).toBeVisible();
  await expect(guestPage.getByText('Lična pozivnica')).toBeVisible();
  await guestPage.getByRole('button', { name: 'Otvori pozivnicu' }).click();
  await expect(guestPage.getByRole('heading', { name: 'Potvrdite dolazak' })).toBeVisible({ timeout: 15_000 });
  await expect(guestPage.getByRole('heading', { name: /Ana.*Marko/ }).first()).toBeVisible();

  await guestPage.getByRole('button', { name: 'Dolazim' }).click();
  await guestPage.getByLabel('Nikola').check();
  await guestPage.getByRole('button', { name: 'Potvrdi' }).click();
  await expect(guestPage.getByRole('heading', { name: 'Hvala, vidimo se!' })).toBeVisible({ timeout: 15_000 });
  await expect(guestPage.getByText('Želite li da vas obavestimo kada slike sa venčanja budu spremne?')).toBeVisible();

  // UC-61: the notify question comes after the answer.
  await guestPage
    .locator('form')
    .filter({ hasText: 'Preskoči' })
    .getByLabel(/^Email/)
    .fill('jelena@uspomena.test');
  await guestPage.getByRole('button', { name: 'Obavesti me' }).click();
  await expect(guestPage.getByText('Sa vama: Nikola')).toBeVisible({ timeout: 15_000 });
  await expect(guestPage.getByText('Obavestićemo vas na jelena@uspomena.test').first()).toBeVisible();

  await gotoHydrated(page, '/app/gosti');
  const updatedRow = page.getByRole('row').filter({ hasText: 'Jelena Nikolić' });
  await expect(updatedRow.getByText('Dolazi')).toBeVisible();
  await expect(updatedRow.getByText('2 / 2')).toBeVisible();
  await expect(updatedRow.getByText('Otvorena')).toBeVisible();
  await expect(updatedRow.getByText('Čeka')).toBeVisible();
  await expect(updatedRow.getByText('sa: Nikola')).toBeVisible();

  await guestContext.close();
});

/** S6: changing companions trims an existing answer (SYS-5). */
test('S6 companion changes trim the guest answer', async ({ page, browser }, testInfo) => {
  await newOrganizer(page, 's6', testInfo.project.name);
  await addGuest(page, { name: 'Mila Petrović', companions: 'named', names: ['Nikola', 'Jovana'] });

  const row = page.getByRole('row').filter({ hasText: 'Mila Petrović' });
  const href = await row.getByRole('link', { name: 'Otvori pozivnicu za Mila Petrović' }).getAttribute('href');

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await gotoHydrated(guestPage, href ?? '');
  await guestPage.getByRole('button', { name: 'Otvori pozivnicu' }).click();
  await guestPage.getByRole('button', { name: 'Dolazim' }).click();
  await guestPage.getByLabel('Nikola').check();
  await guestPage.getByLabel('Jovana').check();
  await guestPage.getByRole('button', { name: 'Potvrdi' }).click();
  await expect(guestPage.getByRole('heading', { name: 'Hvala, vidimo se!' })).toBeVisible({ timeout: 15_000 });
  await guestContext.close();

  await gotoHydrated(page, '/app/gosti');
  const guestRow = page.getByRole('row').filter({ hasText: 'Mila Petrović' });
  await guestRow.getByRole('button', { name: 'Izmeni Mila Petrović' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Ukloni pratioca 2' }).click();
  await modal.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(page.getByRole('status')).toContainText('Gost je sačuvan');

  const trimmed = page.getByRole('row').filter({ hasText: 'Mila Petrović' });
  await expect(trimmed.getByText('Dolazi')).toBeVisible();
  await expect(trimmed.getByText('2 / 2')).toBeVisible();
  await expect(trimmed.getByText('sa: Nikola')).toBeVisible();
});
