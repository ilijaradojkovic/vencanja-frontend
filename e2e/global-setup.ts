/**
 * Warms the mounted API before the scenarios start. The Supabase Send Email Hook
 * calls `/api/hooks/auth-email` synchronously during signup; on a cold Next.js dev
 * server the first compilation can exceed GoTrue's hook timeout and turn signup
 * into `hook_timeout_after_retry`. One `/api/health` request compiles the API
 * catch-all route, so auth emails are delivered from the first test on.
 */
export default async function globalSetup(): Promise<void> {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // The dev server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The API at ${base}/api/health did not become ready.`);
}
