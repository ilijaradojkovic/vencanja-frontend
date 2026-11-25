import { expect, test } from '@playwright/test';

import { gotoHydrated } from './auth.helpers';

/**
 * UC-79 without a real Google project (M7 verifies delivery): the login page
 * offers Google, and a cancelled/failed OAuth callback returns to the login page
 * with the localized "link expired" message. The local identity fixture is
 * covered by the API integration test.
 */
test('UC-79 Google sign-in entry and callback error handling', async ({ page }) => {
  await gotoHydrated(page, '/login');
  await expect(page.getByRole('button', { name: 'Nastavi sa Google nalogom' })).toBeVisible();

  await page.goto('/auth/callback?error=access_denied&error_description=cancelled');
  await expect(page).toHaveURL(/\/login\?error=linkExpired$/);
  await expect(page.locator('.form-error')).toContainText(
    'Link je istekao ili je već iskorišćen. Prijavite se ponovo.',
  );
});
