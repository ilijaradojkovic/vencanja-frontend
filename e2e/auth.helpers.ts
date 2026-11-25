import { expect, type Page } from '@playwright/test';

/** Local Mailpit (the Supabase CLI email UI) on the URL reported by `supabase status`. */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

type MailpitMessage = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Text: string;
  HTML: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for the newest message to an address and returns its detail (text + html). */
export async function waitForEmail(address: string, subjectIncludes?: string): Promise<MailpitMessage> {
  const wanted = address.toLowerCase();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const listResponse = await fetch(`${MAILPIT}/api/v1/messages`);
    const list = (await listResponse.json()) as { messages?: { ID: string; To: { Address: string }[] }[] };
    const matches = (list.messages ?? []).filter((message) =>
      message.To.some((to) => to.Address.toLowerCase() === wanted),
    );
    for (const message of matches) {
      const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as MailpitMessage;
      if (!subjectIncludes || detail.Subject.includes(subjectIncludes)) return detail;
    }
    await sleep(500);
  }
  throw new Error(`No email for ${address} in Mailpit after 30 s.`);
}

/** The first absolute link in the plain-text body (our templates contain one). */
export function linkFromEmail(message: MailpitMessage): string {
  const match = /https?:\/\/[^\s"'<]+/.exec(message.Text) ?? /href="([^"]+)"/.exec(message.HTML);
  if (!match?.[0] && !match?.[1]) throw new Error(`No link in email "${message.Subject}".`);
  return (match[1] ?? match[0]).replaceAll('&amp;', '&');
}

export const uniqueEmail = (prefix: string, project: string): string =>
  `${prefix}-${project.replaceAll(/[^a-z]/gi, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}@uspomena.test`;

export const PASSWORD = 'e2e-lozinka-123';

/**
 * Client components render on the server first; filling or clicking before
 * hydration leaves React's state empty and the submit silently fails. The root
 * layout marks `body[data-hydrated]` after mount, so every interaction waits for it.
 */
export const waitForHydration = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => document.body.dataset.hydrated === 'true', null, { timeout: 20_000 });

export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
}

/**
 * Next.js renders client components on the server first; a click that arrives
 * before hydration is simply lost. The retry re-clicks until the expected
 * navigation happens (the assertions themselves are unchanged).
 */
export async function clickUntilUrl(page: Page, name: string, url: RegExp): Promise<void> {
  await expect(async () => {
    await page.getByRole('button', { name }).click();
    await expect(page).toHaveURL(url, { timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

export const signOutThroughUi = (page: Page) => clickUntilUrl(page, 'Odjavi se', /\/login$/);

/**
 * The signup click can be lost while the dev server hydrates under parallel load
 * (seen on WebKit). Re-click until the check-email screen appears, but fail fast
 * with the displayed validation/API message instead of retrying a real error.
 */
export async function submitSignup(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Napravi nalog' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await button.click();
    const outcome = await Promise.race([
      page
        .waitForURL(/\/potvrda-emaila\?email=/, { timeout: 5000 })
        .then(() => 'navigated' as const)
        .catch(() => 'timeout' as const),
      page
        .locator('.form-error')
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => 'error' as const)
        .catch(() => 'timeout' as const),
    ]);
    if (outcome === 'navigated') return;
    if (outcome === 'error') {
      throw new Error(`Signup failed: ${await page.locator('.form-error').innerText()}`);
    }
  }
  throw new Error('Signup did not reach the check-email screen.');
}

/** Same retry, but the expected outcome is a heading of the next wizard step. */
export async function clickUntilText(page: Page, name: string, text: string): Promise<void> {
  await expect(async () => {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('heading', { name: text })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

/** UC-77 signup through the UI, then the confirmation link from Mailpit (S1). */
export async function signUpAndConfirm(page: Page, email: string): Promise<void> {
  await gotoHydrated(page, '/registracija');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Lozinka/).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await submitSignup(page);

  await expect(page).toHaveURL(/\/potvrda-emaila\?email=/);
  await expect(page.getByText(`Poslali smo link za potvrdu na ${email}.`)).toBeVisible();

  const message = await waitForEmail(email, 'Potvrdite');
  await gotoHydrated(page, linkFromEmail(message));
  await expect(page).toHaveURL(/\/onboarding/);
}

/** UC-81 onboarding for a wedding (S1). */
export async function completeWeddingOnboarding(
  page: Page,
  input: { partner1: string; partner2: string; date: string },
): Promise<void> {
  await clickUntilText(page, 'Dalje', 'Imena i datum');
  await page.getByLabel('Mlada').fill(input.partner1);
  await page.getByLabel('Mladoženja').fill(input.partner2);
  await page.getByLabel('Datum venčanja').fill(input.date);
  await clickUntilText(page, 'Dalje', 'Kontakt');
  await page.getByLabel(/^Telefon/).fill('064 123 4567');
  await page.getByLabel('Grad').fill('Beograd');
  await clickUntilUrl(page, 'Završi', /\/app(\?|$)/);
}
