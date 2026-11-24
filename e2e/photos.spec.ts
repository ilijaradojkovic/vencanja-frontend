import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { gotoHydrated } from './auth.helpers';
import {
  addGuest,
  createOrganizer,
  filePayload,
  listPhotos,
  patchSettings,
  readZip,
  signInUi,
  type Organizer,
} from './photos.helpers';

/** Uploads through the real page: pick files, send, wait for the thank-you. */
async function upload(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[], expected: number) {
  await page.getByTestId('file-input').setInputFiles(files);
  await page.getByRole('button', { name: /^Pošalji \d+ fotografij/ }).click();
  await expect(page.getByRole('heading', { name: 'Hvala vam!' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(new RegExp(`Poslali ste ${expected} fotografij`))).toBeVisible();
}

const approvedPolaroids = (page: Page) => page.getByRole('button', { name: /^Fotografija od / });

/** S7: personal-link upload with one oversized file rejected, moderation, album (UC-65, UC-36, UC-46). */
test('S7 guest sends photos, the organizer approves two and hides one, the album shows two', async ({
  page,
  browser,
}, testInfo) => {
  const organizer = await createOrganizer('s7', testInfo.project.name);
  const guestToken = await addGuest(organizer, 'Jelena Nikolić');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await gotoHydrated(guest, `/i/${guestToken}/upload`);
  await guest
    .getByTestId('file-input')
    .setInputFiles([
      await filePayload('prva.jpg', 1),
      await filePayload('druga.jpg', 2),
      await filePayload('treca.jpg', 3),
      { name: 'ogromna.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(31 * 1024 * 1024, 7) },
    ]);
  await expect(guest.locator('.form-error')).toContainText('ogromna.jpg je veća od 30 MB');
  await expect(guest.getByTestId('upload-tile')).toHaveCount(3);
  await guest.getByRole('button', { name: 'Pošalji 3 fotografije' }).click();
  await expect(guest.getByRole('heading', { name: 'Hvala vam!' })).toBeVisible({ timeout: 45_000 });
  await expect(guest.getByText('Poslali ste 3 fotografije')).toBeVisible();
  await guestContext.close();

  await signInUi(page, organizer.email);
  await gotoHydrated(page, '/app/fotografije');
  await expect(page.getByRole('button', { name: /Na čekanju/ })).toContainText('3');
  const cards = page.locator('.photo-card');
  await expect(cards).toHaveCount(3);
  // Grid thumbnails are the signed thumb derivative.
  await expect(cards.first().locator('img')).toHaveAttribute('src', /\/thumb\/.+\.jpg\?token=/);

  await cards.nth(0).getByRole('button', { name: 'Odobri' }).click();
  await expect(cards).toHaveCount(2);
  await cards.nth(0).getByRole('button', { name: 'Odobri' }).click();
  await expect(cards).toHaveCount(1);
  await cards.nth(0).getByRole('button', { name: 'Sakrij' }).click();
  await expect(page.getByText('Sve je pregledano')).toBeVisible();
  await expect(page.getByRole('button', { name: /Odobrene/ })).toContainText('2');
  await expect(page.getByRole('button', { name: /Sakrivene/ })).toContainText('1');

  await gotoHydrated(page, '/app/veliki-album');
  await expect(approvedPolaroids(page)).toHaveCount(2);
  await expect(approvedPolaroids(page).first().locator('img')).toHaveAttribute('src', /\/thumb\//);
  await approvedPolaroids(page).first().click();
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /\/web\/.+\.jpg\?token=/);
});

/** S8: QR upload with auto-approve appears immediately; QR upload off shows the message (UC-66, UC-55, UC-56). */
test('S8 QR upload with auto-approve appears in the album; turning QR upload off blocks the link', async ({
  page,
  browser,
}, testInfo) => {
  const organizer = await createOrganizer('s8', testInfo.project.name);
  await patchSettings(organizer, { autoApprovePhotos: true, allowGeneralUpload: true });

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await gotoHydrated(guest, `/w/${organizer.slug}/upload`);
  await guest.getByLabel('Šalje').fill('Kum Petar');
  await upload(guest, [await filePayload('qr-1.jpg', 11), await filePayload('qr-2.jpg', 12)], 2);

  await signInUi(page, organizer.email);
  await gotoHydrated(page, '/app/veliki-album');
  await expect(approvedPolaroids(page)).toHaveCount(2);
  await expect(page.getByText('Kum Petar').first()).toBeVisible();

  await patchSettings(organizer, { allowGeneralUpload: false });
  await gotoHydrated(guest, `/w/${organizer.slug}/upload`);
  await expect(guest.getByRole('heading', { name: 'Slanje je isključeno' })).toBeVisible();
  await guestContext.close();
});

/** S9: the network drops during the first PUT; the same photo is re-sent and not duplicated (UC-65, §7.1). */
test('S9 a dropped connection mid-upload is retried without duplicating the photo', async ({ browser }, testInfo) => {
  const organizer: Organizer = await createOrganizer('s9', testInfo.project.name);
  const guestToken = await addGuest(organizer, 'Marija');

  const context = await browser.newContext();
  const guest = await context.newPage();
  const putUrls: string[] = [];
  let dropped = false;
  await guest.route('**/storage/v1/object/upload/sign/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    putUrls.push(route.request().url());
    if (!dropped) {
      dropped = true;
      await context.setOffline(true);
      await route.abort('internetdisconnected');
      setTimeout(() => void context.setOffline(false), 300);
      return;
    }
    return route.continue();
  });

  await gotoHydrated(guest, `/i/${guestToken}/upload`);
  await upload(guest, [await filePayload('mreza.jpg', 21)], 1);
  expect(dropped).toBe(true);
  expect(putUrls.length).toBeGreaterThanOrEqual(2);
  // Every attempt went to the same signed URL (same photo id and path).
  expect(new Set(putUrls).size).toBe(1);
  const photos = await listPhotos(organizer);
  expect(photos).toHaveLength(1);
  expect(photos[0]?.status).toBe('pending');
  await context.close();
});

/** S10: download all originals; the ZIP has every file with the original bytes (UC-85). */
test('S10 the organizer downloads all originals as a ZIP with the original bytes', async ({
  page,
  browser,
}, testInfo) => {
  const organizer = await createOrganizer('s10', testInfo.project.name);
  const guestToken = await addGuest(organizer, 'Jovan');
  const originals = [
    await filePayload('jedan.jpg', 31),
    await filePayload('dva.jpg', 32),
    await filePayload('tri.jpg', 33),
  ];

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await gotoHydrated(guest, `/i/${guestToken}/upload`);
  await upload(guest, originals, 3);
  await guestContext.close();

  const isChromium = testInfo.project.name === 'chromium';
  if (isChromium) {
    // Exercise the Safari/Firefox path in Chromium too: without the File System
    // Access API the page saves bounded ZIP batches as normal downloads.
    await page.addInitScript(() => {
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
  }
  await signInUi(page, organizer.email);
  await gotoHydrated(page, '/app/fotografije');
  await page.getByRole('button', { name: 'Preuzmi sve' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Sve \(i na čekanju/ }).click();
  await expect(dialog.getByTestId('download-summary')).toContainText('3 fotografije');

  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await dialog.getByRole('button', { name: 'Preuzmi', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`uspomena-${organizer.slug}-1.zip`);
  await expect(dialog.getByTestId('download-progress')).toHaveText('3 / 3');
  const zip = readZip(readFileSync((await download.path()) as string));

  expect(zip.size).toBe(3);
  const names = [...zip.keys()];
  for (const name of names) expect(name).toMatch(/^Jovan_\d{4}-\d{2}-\d{2}_[0-9a-f-]{36}\.jpg$/);
  const stored = [...zip.values()].map((bytes) => bytes.toString('hex')).sort();
  expect(stored).toEqual(originals.map((file) => file.buffer.toString('hex')).sort());
});

/** S10 (streaming path): Chromium writes one archive through the File System Access API. */
test('S10 streams one ZIP through the file picker in Chromium', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The File System Access API exists only in Chromium.');
  const organizer = await createOrganizer('s10s', testInfo.project.name);
  const guestToken = await addGuest(organizer, 'Vesna');
  const originals = [await filePayload('a.jpg', 41), await filePayload('b.jpg', 42)];
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await gotoHydrated(guest, `/i/${guestToken}/upload`);
  await upload(guest, originals, 2);
  await guestContext.close();

  // Headless Chromium cannot show the native save dialog; the stub keeps the real
  // streaming code path and collects what it writes.
  await page.addInitScript(() => {
    const chunks: number[][] = [];
    (window as unknown as { __zipChunks: number[][] }).__zipChunks = chunks;
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => ({
      createWritable: async () =>
        new WritableStream<Uint8Array>({
          write: (chunk) => {
            chunks.push(Array.from(chunk));
          },
          close: () => {
            (window as unknown as { __zipDone: boolean }).__zipDone = true;
          },
        }),
    });
  });
  await signInUi(page, organizer.email);
  await gotoHydrated(page, '/app/fotografije');
  await page.getByRole('button', { name: 'Preuzmi sve' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Sve \(i na čekanju/ }).click();
  await expect(dialog.getByTestId('download-summary')).toContainText('2 fotografije');
  await dialog.getByRole('button', { name: 'Preuzmi', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Preuzimanje je završeno.', { timeout: 45_000 });
  await page.waitForFunction(() => (window as unknown as { __zipDone?: boolean }).__zipDone === true);
  const chunks = await page.evaluate(() => (window as unknown as { __zipChunks: number[][] }).__zipChunks);
  const zip = readZip(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  expect(zip.size).toBe(2);
  const stored = [...zip.values()].map((bytes) => bytes.toString('hex')).sort();
  expect(stored).toEqual(originals.map((file) => file.buffer.toString('hex')).sort());
});
