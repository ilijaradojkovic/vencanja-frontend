# MVP progress

One entry per completed milestone: what was done, what wasn't, known issues. Tasks and their evidence live in [`DOD.md`](DOD.md); deviations and tooling decisions live in [`DECISIONS.md`](DECISIONS.md).

## M1 – Local walking skeleton (complete)

**Done**

- `supabase/config.toml` for the local stack (API/db/Studio/Mailpit ports, auth URLs, private `photos` bucket with 30 MiB and JPEG/PNG/WebP limits, Send Email Hook, confirmations on), the Supabase CLI pinned as a root devDependency and `db:migrate` applying Drizzle migrations against `DIRECT_URL` or the local `DB_URL`.
- Lifecycle scripts: `dev:bootstrap` (prerequisites, stack, observability, generated `.env.local`/secrets, migrations, seeds, URLs), `dev:services`, `dev:teardown` and guarded `dev:reset` (`ALLOW_LOCAL_RESET=1`, local host/port allow-list, refuses `DIRECT_URL`).
- Drizzle schema for all seven SPEC §4 tables, eight enums, checks/indexes and RLS enabled with no policies; first migration verified on an empty database.
- Deterministic seeds (`packages/api/src/db/fixtures.ts` + `seed.ts`): 11 Auth users via the Admin API, 7 events, guests in every RSVP/companion/notify state, 2 subscribers, photos with real original/web/thumb objects, retention (30-day, 7-day, archived) and storage-limit fixtures; idempotent and local-only.
- API: `GET /health` with a real DB check, request/trace correlation (`requestId`, W3C `traceparent`, `x-request-id`/`x-trace-id`), `Accept-Language`, redacted Pino logs, the `{ message, code, requestId, traceId }` envelope with sr/en/ru messages, token-protected local `/api/metrics` with `prom-client` metrics, Prometheus + provisioned Grafana dashboard, and the Send Email Hook (`/api/hooks/auth-email`) verified with Standard Webhooks and delivered through the SMTP `EmailSender` to Mailpit.
- Product: Next.js mounted API at `/api/*`, dev-only `/api/health` probe, per-request guest HTML with locale metadata and `private, no-store`, tester diagnostic support bundle (`/dev/diagnostics`, `/api/diagnostics/export`, bounded `.logs/` JSONL) with S17.
- Tests/CI: 73 shared unit (100 % lines / 98.5 % branches), 37 API unit, 7 component, 3 integration against local Supabase, 8 Playwright (Chromium + iPhone WebKit, incl. S17); GitHub Actions runs lint/typecheck/tests/builds, integration and e2e jobs without cloud credentials.

**Not done / deferred**

- `/i/[token]` is still the M0 placeholder; seeded guest links and the real invitation arrive in M3. `/api/spike/*` remains as scaffolding for the spike check and is removed with the real routes.
- The `photos` bucket is declared in `config.toml` (created by the CLI) rather than a SQL migration; hosted bucket creation is on the M7 setup checklist.
- Cron is documented (`POST /api/cron/daily` with `CRON_SECRET` and injected `now`) but implemented in M6; Vercel scheduling is M7.
- Resend delivery, Google OAuth and Vercel deployment remain external checks for M7/M8; locally they are proven only at the state/callback and SMTP boundaries.

**Known issues**

- The root layout reads the `lang` cookie, so every route renders dynamically; public/static optimisation is revisited when performance is measured in M7.
- A bare `npx supabase …` needs `SUPABASE_AUTH_HOOK_SECRET="v1,$(cat supabase/.auth-hook-secret)"`; the lifecycle scripts set it.
- `npm audit` still reports advisories from the frozen demo's dependency tree only (2 moderate production, 1 high dev); the production gate is M7.

## M0 – Monorepo, architecture spike and tooling (complete)

**Done**

- The frozen Vite prototype moved unchanged (rename-only history) to `apps/demo`; root scripts `dev`, `dev:demo`, `build`, `build:demo`, `preview` work. The demo's production output is unchanged apart from build hashes.
- npm-workspaces monorepo: `@uspomena/web` (Next.js 16 App Router, TypeScript strict), `@uspomena/demo`, `@uspomena/api`, `@uspomena/shared`, one root lockfile and one `npm install`.
- `packages/shared`: product/API enums, gallery (SYS-3, Europe/Belgrade), companion, RSVP (incl. SYS-5 trimming), phone and slug rules, and sr/en/ru messages (SYS-6), covered by 73 Vitest tests at 100% lines / 98.5% branches (threshold 90%).
- Architecture spike passed in a production Next.js build: Hono mounted at `/api` for GET/POST/PUT/PATCH/DELETE on the Node runtime, a server component calling the API's `server-only` service (client import fails the build), per-request guest HTML with cookie locale metadata and `Cache-Control: private, no-store`, and `sharp` running natively. `npm run spike:check` repeats it.
- Tooling: root ESLint (flat config, `--max-warnings=0`), Prettier, `lint`/`format`/`typecheck` scripts, Vitest + Testing Library in `apps/web` with coverage thresholds, GitHub Actions CI (install → lint → typecheck → unit → component → build → build:demo) on Node 24 from `.nvmrc`.
- The demo Docker image builds from the repository root and serves the static demo; the demo was also checked by hand (sign-in, guest RSVP, QR/personal upload, photo approval, celebration and admin accounts).

**Not done / deferred**

- The CI workflow ran green on the pushed implementation branch (`specs/mvp`, run `44967685583`: install, lint, typecheck, unit, component, build, build:demo).
- No deployment, hosted service or cloud credential is involved in M0; the architecture spike is re-verified on Vercel Preview in M7.
- Integration and E2E jobs are added in M1, together with the local Supabase stack.

**Known issues**

- The root layout reads the `lang` cookie, so every route currently renders dynamically. Correct for guest pages; static/public pages are revisited when performance is measured in M7.
- `/api/spike/*`, the `/i/[token]` placeholder page, the guest fixture service and `spike:check` are M0 scaffolding and are replaced by the real routes and services in M1/M3.
- `npm audit` reports one high and three moderate advisories in the frozen demo's dependency tree (React 18/Vite 5 era). They are not in the product's dependency tree; upgrading the demo would violate its frozen state, and the production dependency audit gate belongs to M7.
- The demo's bundle hashes changed slightly because React 19 is now hoisted to the root for the product's test tooling and the demo resolves its own React 18. Same versions, same behaviour.
