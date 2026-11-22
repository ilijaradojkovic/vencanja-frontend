# MVP decisions and deviations

This file records architecture decisions, spec corrections and implementation deviations. Scope changes still require owner approval.

## 2026-11-22 — M1: local lifecycle scripts and reset guards

The lifecycle commands are small Node scripts under `scripts/` sharing `scripts/lib/local-stack.mjs`, which reads the ports and project id from `supabase/config.toml` and parses `supabase status -o json`:

- `dev:bootstrap` checks the pinned Node major and a running Docker, pre-checks ports `54321–54324` only when the stack is down, starts Supabase, starts the observability stack when `infra/observability/docker-compose.yml` exists (skipped with a message until the metrics task lands), refuses a non-local `DIRECT_URL`, applies migrations, applies seeds when seed files exist, then prints the local URLs and the disposable publishable/secret keys.
- `dev:services` restarts Supabase and observability without migrations or seeds.
- `dev:reset` requires `ALLOW_LOCAL_RESET=1` and refuses while `DIRECT_URL` is set. It recreates the stack with `supabase stop --no-backup` + `supabase start` (so schema *and* Storage are genuinely clean, unlike `db reset`, which would leave the Drizzle journal behind) and then migrates and seeds with `DIRECT_URL` cleared.
- `dev:teardown` stops observability and Supabase while keeping volumes.
- `db:seed` applies `supabase/seed.sql` and `supabase/seeds/*.sql` in name order through `psql` in the local database container with `ON_ERROR_STOP=1`, after the same host/port guard. Seed fixtures are added by the next M1 task; until then it reports that there are no seed files.

Evidence: bootstrap on a cold stack, `dev:services` while running, teardown then bootstrap again, a refused reset without the guard, a refused reset with a foreign `DIRECT_URL`, a successful guarded reset that removed a probe table and recreated the Drizzle journal, and `db:seed` applying a probe SQL file twice without duplicating data (file removed afterwards).

## 2026-11-22 — M1: local Supabase stack, pinned CLI and migration runner

`supabase/` is initialised with `config.toml` for project id `vencanja-frontend`: API `54321`, database `54322`, Studio `54323`, email UI `54324`, SMTP `54325`/POP3 `54326`, Storage enabled, and Auth `site_url` `http://localhost:3000` with `localhost` and `127.0.0.1` in the redirect allow-list. The Supabase CLI is a pinned root devDependency (3.2.0) so every script uses one version; `npm run supabase:start` / `supabase:stop` wrap it and the stack survives a stop/start cycle from backup.

**Deviation (tool only).** The current CLI renders the local mailbox with **Mailpit**, not Inbucket: `supabase status -o env` reports `MAILPIT_URL` and the SMTP/POP3 ports stay 54324/54325. Local email behaviour is unchanged for M0–M6 and no cloud account is involved, so this is recorded rather than treated as a spec change; `ENVIRONMENT.md` and `LOCAL_DEVELOPMENT.md` now say Mailpit, while the `SPEC.md`/`DOD.md` wording is left as authored.

`npm run db:migrate` (`scripts/db-migrate.mjs`) applies forward-only Drizzle migrations by running `drizzle-kit migrate` in `packages/api` against `DIRECT_URL`. When `DIRECT_URL` is unset it uses the local stack's `DB_URL` from `supabase status -o env`, prints only the target host/database (never credentials), and exits non-zero without touching data on failure. The migration runner needs `drizzle-orm`, `drizzle-kit` and the `postgres` driver; with no schema yet `drizzle-kit generate` wrote an empty journal, so the first real migration is added by the M1 schema task and re-applied. Verified: start from scratch, stop/start from backup, `db:migrate` initialising `drizzle.__drizzle_migrations` on the local Postgres, REST `200` and Mailpit `200` after the cycle, and a failing connection exiting `1` with a clear message.

## 2026-11-22 — M0: architecture spike result

The spike passed in a production `next build`/`next start`: `apps/web/app/api/[[...route]]/route.ts` exports `handle(app)` from `@hono/vercel` for GET, POST, PUT, PATCH and DELETE on the Node runtime (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`), a server component on `/i/[token]` calls `@uspomena/api/server-only` (a `server-only` entry that fails the build when imported from a client component, verified), guest HTML is per-request with `<html lang>`, localized title/description and `og:locale` from the `lang` cookie, `proxy.ts` sets `Cache-Control: private, no-store` on `/i/*` and `/w/*`, and sharp runs inside the Node runtime (a create→resize→JPEG probe returns 24×16). Next.js already lists `sharp` in its default external packages, so no extra config was needed. `scripts/spike-check.mjs` (`npm run spike:check`) repeats all of this against a running production build.

The spike routes (`/api/spike/*`), the `server-only` guest fixture service, the `/i/[token]` placeholder page and the spike script are scaffolding for this DoD item; M1 introduces the real `/health` route, middleware/trace context and services, and M3/M6 port the invitation. Because the root layout reads the locale cookie, every route currently renders dynamically; that is correct for guest HTML and will be revisited for static/public pages when performance is measured in M7. No fallback adapter was needed.

## 2026-11-22 — M0: demo image builds from the repository root

The demo stays a plain static site, but with npm workspaces its lockfile lives at the repository root, so `apps/demo/Dockerfile` is now built with the root as context (`docker build -f apps/demo/Dockerfile .`): it copies the root `package.json`/`package-lock.json` plus `apps/demo/package.json`, installs only the demo workspace, and builds `build:demo`. The build image moves from `node:22-alpine` to `node:24-alpine` to match the pinned Node major; nginx and the SPA/caching configuration are unchanged. The ignore file lives at the repository root. Verified by building the image and requesting `/` and `/i/demo-jelena` from the container (both `200`).

## 2026-11-22 — M0: one React copy for the hoisted test tooling

The frozen demo pins React 18 while the product uses React 19, and npm hoists exactly one copy to the repository root. `@testing-library/react` is hoisted as well, so with React 18 at the root the component tests mixed React 18 and React 19 and failed with “Objects are not valid as a React child”. The root `package.json` therefore declares `react`/`react-dom` 19.3.1 as devDependencies so the hoisted copy matches the product; the demo resolves its own React 18 from `apps/demo/node_modules`, so its dependencies and behaviour stay unchanged. Alias/inline workarounds in the Vitest config did not affect hoisted packages and were removed. `apps/web` runs Vitest + Testing Library in jsdom with v8 coverage thresholds (60% lines/branches); one component test covers the landing page.

## 2026-11-22 — M0: lint/format scope for the frozen demo and the specs

ESLint (flat config, `eslint-config-next` core-web-vitals + TypeScript, Prettier last) runs over the whole repository with `--max-warnings=0`. The frozen `apps/demo` is linted only for plain JavaScript/React mistakes: Next.js-only advice and rules that would force a refactor of frozen code (`@next/next/no-img-element`, `react-hooks/exhaustive-deps`, `jsx-a11y/role-supports-aria-props`, `import/no-anonymous-default-export` and the React Compiler hook rules) are disabled for that path. Prettier runs on code (`apps/web`, `packages/*`, root configs) but ignores `apps/demo` and the specification/reference documents (`docs/`, `AGENTS.md`, `API.md`, `USE_CASES.txt`), which are authored separately and would otherwise produce a large unrelated diff. ESLint is pinned to 9.39.5 because some plugins used by `eslint-config-next` do not declare ESLint 10 peer support yet. No product behavior changes.

## 2026-11-22 — M0: `packages/shared` scope and gallery time zone

`packages/shared` ports the prototype enums, the gallery/companion/RSVP/phone/slug rules and the sr/en/ru messages, together with its own Vitest suite and coverage thresholds. Three deliberate differences: the demo-only design-request enums are not ported (the feature is cut from the product, SPEC §1.3), the mock-only `routeNotFound` and cut-feature `phoneRequiredForDesigner`/`describeRequest` messages are not ported, and `isGalleryOpen` evaluates the `after_wedding` day in Europe/Belgrade for every caller instead of the browser zone (SPEC §6.6 item 5), covered by summer/winter midnight tests. The frozen demo keeps its own copies. Unit tests for the shared package pass with 100% lines and 98.5% branches (threshold 90%).

## 2026-11-22 — M0: one agent-instructions file

Next.js 16.4 writes `apps/web/AGENTS.md` on `next dev`/`next build` to point agents at the docs bundled with the installed `next` package. The repository already maintains the authoritative `AGENTS.md` at its root, so `apps/web/next.config.ts` sets `agentRules: false` and the generated file is not committed. This affects tooling only; no product behavior, UC or API requirement changes.

## 2026-11-22 — v1.5 consolidated-PR workflow

The owner wants one big PR after the complete implementation. All Pi sessions therefore work on one `feat/mvp` branch created from the committed `specs/mvp` baseline. Each completed task still gets a focused commit and verification evidence, milestones update `PROGRESS.md`, and pushes run branch CI, but no milestone PRs are opened. After M8, one consolidated PR from `feat/mvp` to `main` includes the specification baseline and all implementation commits. One PR does not mean one long session, one commit or deferred testing.

## 2026-11-22 — v1.4 tester diagnostic exports

The owner required testers to provide an exact failure trace, not merely a screenshot or an isolated server error. Browser actions and API/service steps now share W3C trace context, with separate request/span IDs. A tester's **Download diagnostic report** action creates one schema-versioned JSON attachment containing sanitized chronological browser events, API outcomes, matching local backend spans/logs, local stack/cause and explicit missing-data warnings. Error details also support copying trace/request IDs.

The local backend export is development-only; Preview/Production reports contain client events and correlation IDs for provider-log lookup. Reports exclude credentials, tokens, signed URLs, personal content and media, and redaction/correlation is covered by S17. Local JSONL capture is bounded and git-ignored. This complements, rather than replaces, Pino logs and Prometheus/Grafana metrics.

## 2026-11-22 — v1.3 local-first development and observability

The owner prioritized a fully usable local environment for both developers and implementation agents. M0–M6 now require no hosted Supabase, Vercel, Resend, Google or analytics account: the pinned Supabase CLI provides Postgres/Auth/Storage/Inbucket, a local SMTP `EmailSender` replaces Resend, deterministic seeds cover realistic fixtures, and cron is invoked locally with injected time. Real Google/Resend/Vercel delivery remains an explicit M7/M8 external check rather than something a local test claims to prove.

Local observability uses Pino structured/redacted request logs, `prom-client`, Prometheus and a provisioned Grafana dashboard. Logs/metrics use normalized routes and stable codes, never guest tokens, raw IDs, IPs or email labels. Local `/api/metrics` is token-protected and production-disabled by default because per-instance Vercel counters are not globally accurate; production MVP relies on structured provider logs/metrics until a separate hosted telemetry decision is made.

See `LOCAL_DEVELOPMENT.md` for the one-command bootstrap, seed matrix, reset guards, URLs and locally-ready acceptance criteria.

## 2026-11-22 — v1.2 storage-limit decision

The owner resolved Q6: each event has a **50 MB (50,000,000-byte) default limit for originals and upload reservations**, intentionally low during development. The superadmin can adjust the stored limit per account from 1 to 200,000 MB; changing it does not delete existing photos. Lowering it below current usage only prevents new upload reservations until usage fits or the limit is raised. `EVENT_STORAGE_LIMIT_MB_DEFAULT=50` controls newly created events.

Q3 remains open for public launch; all other open questions retain their SPEC defaults.

## 2026-11-22 — v1.1 architecture and feasibility review

**Status:** review incorporated into `SPEC.md` and `DOD.md`; no implementation has been performed.

### Framework decision

Keep **Next.js for the product UI** and **Hono for the JSON API**, initially mounted in one Next.js Node-runtime catch-all. They are not competing answers to the same question:

- Next.js provides server-rendered guest HTML, per-request metadata and server/browser auth integration.
- Hono provides a compact route tree, Zod validation boundary and framework-independent `app.request()` tests.
- The organizer/admin app remains client-rendered; Next.js does not imply SSR everywhere.
- M0/M1 must prove all HTTP methods, `server-only` service imports, dynamic/no-cache guest rendering and `sharp` locally; v1.3 moves Vercel verification to M7. If the adapter fails, prefer Next route handlers first and record the change. Reverting to Vite + standalone Hono requires a separate SSR/metadata plan.

### Corrections incorporated

- Aligned the DoD with the new Next.js product and unchanged Vite demo; removed stale `apps/api`, Vite feature-flag and mock-update tasks.
- Added an explicit scope warning: this is a production rebuild, not a small greenfield MVP.
- Required per-request i18n instances and private/no-store guest responses to prevent cross-request or cache leaks.
- Signup locale now comes from validated Supabase auth metadata before a profile exists; secure email change handles both addresses.
- Password/admin revocation now covers both refresh sessions and already-issued access tokens.
- Added terms/privacy acceptance evidence, cursor pagination for photo/gallery/original lists, atomic upload reservations and bucket-enforced file limits.
- Added `sharp` resource limits, actual-file validation and an idempotent same-photo retry flow.
- Replaced the notification double-send claim with atomic leased claims, deduplication and an honest crash-recovery limitation.
- Stored a calculated `purge_at`; prevented post-purge date edits from implying recovery; scheduled cron in UTC.
- Required controlled, backward-compatible migrations without concurrent Preview schema migrations.
- Added a tested large-download fallback and made legal review a public-launch gate.

### Owner decisions following the review

- **Q6 — resolved in v1.2:** 50 MB/event by default, adjustable per account by the superadmin. This is a technical abuse control, not a commercial plan.
- **Q3 — still required before public launch:** provide legal/controller details and obtain legal review. Draft pages are sufficient only during development.

### Official documentation checked for this review

- Hono on Next.js: https://hono.dev/docs/getting-started/nextjs
- Next.js Proxy/CSP and dynamic-rendering consequences: https://nextjs.org/docs/app/getting-started/proxy and https://nextjs.org/docs/app/guides/content-security-policy
- Supabase Send Email Hook, including metadata and secure email change: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- Supabase sign-out scopes and access-token caveat: https://supabase.com/docs/guides/auth/signout
- Supabase Storage file/bucket limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- Vercel Cron UTC behavior: https://vercel.com/docs/cron-jobs

## Implementation deviation template

Append a new dated entry for each deviation: **what was expected, what was observed, why, chosen alternative, affected UC/SYS/API requirements, tests, and owner approval when scope changes.**
