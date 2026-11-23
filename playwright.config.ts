import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the local stack only (DOD §1.1): Next.js with the mounted
 * API on :3000, local Supabase for data. Playwright starts the dev server itself
 * unless one is already running, so `npm run test:e2e` works after
 * `npm run dev:bootstrap`.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // The Supabase Send Email Hook calls the Next.js dev server synchronously during
  // signup; many parallel workers occasionally hit GoTrue's hook timeout (EOF) and
  // delivered a confirmation link whose token was rolled back. Two workers keep the
  // auth scenarios deterministic on a laptop and in CI.
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
