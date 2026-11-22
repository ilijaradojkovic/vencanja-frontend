# MVP decisions and deviations

This file records architecture decisions, spec corrections and implementation deviations. Scope changes still require owner approval.

## 2026-11-22 — M2: API token verification and `/auth/me`

`GET /api/auth/me` verifies the Supabase access token by calling Auth `/auth/v1/user` with the server-only service key, which checks signature, issuer and `exp`; a missing token answers `401 unauthorized`, an invalid/expired one `401 sessionExpired`. The API then reads the profile and enforces `active` (`401 accountDisabled`) and `tokens_valid_after` against the token's `iat` (`401 sessionExpired`), so deactivation and password changes end existing sessions immediately. When no profile exists it is created from the verified auth user (email, `user_metadata.locale`, `user_metadata.name`) and returned with `201`. The response shape is `{ profile: { id, role, email, name, phone, locale, active, onboardedAt, createdAt } }`, which the M2 web client will consume; `onboardingRequired` (`409`) on other protected routes follows in the next pass.

Three decisions taken at the start of M2 (recorded so they are not silently changed later):

- **No axios.** The product already has `apiFetch` (`apps/web/src/lib/diagnostics/api.ts`) with trace propagation; M2 extends it to attach `Authorization: Bearer <access token>` and `Accept-Language` instead of introducing a second client. SPEC §3.3 names `axiosInstance`; this is a tooling deviation with no contract change.
- **`/auth/callback` is added in the web pass (2b)** and handles both the email links produced by the M1 Send Email Hook and the Google callback.
- **Redirects and `409` coexist**: `proxy.ts` redirects are UX only (signed out → `/login?next=…`, not onboarded → `/onboarding`, superadmin ↔ `/admin`), while the API stays the authorization boundary and answers `409 onboardingRequired` on protected routes until onboarding is complete.

Evidence: 8 integration tests against the local stack — missing/invalid token `401`, seeded couple profile `200`, profile created for a brand-new auth user `201` (then deleted), deactivated profile `401 accountDisabled`, and a token issued before `tokens_valid_after` `401 sessionExpired`.

## 2026-11-22 — M2 complete: admin accounts, settings, session revocation and S12

The rest of M2 is in: superadmin account management, the account settings section, the UC-07 phone gate, `npm run admin:create`, and the Google state/callback coverage that local fixtures can prove. The milestone is now complete; the full milestone summary is in `PROGRESS.md`.

**API.** `GET/POST/PATCH/DELETE /admin/accounts[/:id]` and `POST /admin/accounts/:id/password` (behind a `401/403` superadmin guard) cover UC-71 – UC-76: list with guest/photo/storage counts and accounts that have not finished onboarding, create Auth user + profile + event with a generated 10-character password, edit type/names/date/phone/email (slug and invitation stay), reset a password, deactivate/reactivate and delete. `PATCH /auth/me` accepts `name`, `phone` and `locale` (phone cannot be cleared) for UC-08/UC-10. Account deletion removes the event's Storage objects (paths from the photo rows, batches of 100), the Supabase Auth user and the profile (DB cascade). A failed event creation in `POST /admin/accounts` rolls the half-created Auth user and profile back.

Decisions recorded here:

- **Response shapes** are `{ accounts }`, `{ account }` and `{ password }`, matching the envelope style used elsewhere (`{ wedding }`, `{ profile }`) rather than API.md's bare arrays. The web client and tests consume these shapes.
- **Refresh-session revocation** uses `delete from auth.sessions/auth.refresh_tokens where user_id = …` because GoTrue exposes no admin endpoint for it (admin `signOut` needs the user's JWT). Access tokens are killed separately by `tokens_valid_after`, and deactivation also bans the user in GoTrue. This reaches into Supabase Auth's tables; it is recorded as a deliberate, tested dependency for local and hosted Supabase (test: the old refresh token no longer exchanges). If the internal schema ever changes, `tokens_valid_after` + the ban still block access.
- **Banned tokens map to `accountDisabled`:** after a deactivation, Auth rejects the user's token before the API can read the profile, so `loadSession` falls back to the token's `sub` and reports `401 accountDisabled` when that profile is inactive (the prototype's message) instead of `sessionExpired`.
- **Profile email sync:** `ensureProfile` updates `profiles.email` when the verified Auth email differs, so a completed Secure Email Change is visible in `/auth/me` and settings without a separate endpoint.
- **Email change UI** reads Supabase's `user.new_email` and shows "Čeka potvrdu: …"; the change completes only after both addresses confirm (E2E with Mailpit).
- **Password change** verifies the current password with a password grant, then reuses the UC-80 completion (revoke other sessions, cutoff, re-authenticate). Google-only accounts (`providers` without `email`) get "Set password", which sends the recovery email.
- **Sign-out** stays `scope: 'local'` (recorded earlier); the admin password reset/deactivation revoke sessions server-side.
- **Admin UI** is a port of the prototype's table, search, filters, account modal, credentials modal and confirm dialogs using the same classes/copy. Toasts are replaced by an inline `role="status"` line (the product has no toast container yet), and the admin-created password is shown once in the credentials dialog with a copy action. `providers` for the whole list come from one `/auth/v1/admin/users?per_page=1000` call; the 1000-account cap is acceptable for the MVP and the list itself has no pagination yet.
- **Settings and shell scope:** `/app/podesavanja` has only the Account section (email, password, phone, language); retention and account deletion stay in M6. The prototype's sidebar is replaced by a minimal header (Pregled, Podešavanja, Odjavi se) plus the UC-07 phone dialog; the full organizer shell arrives with M3. `/app` redirects the superadmin to `/admin` and `/admin` redirects an organizer to `/app` (UC-05) in server components, not in the proxy (the proxy still has no DB access).
- **`npm run admin:create -- --email … [--password …]`** creates or repairs a superadmin through the Admin API plus an upsert into `profiles`, prints a generated 12-character password once, and refuses a non-local target unless `ALLOW_ADMIN_CREATE=1`. Local usage is documented in `LOCAL_DEVELOPMENT.md`.
- **Google (UC-79)** is covered at the local boundary only: an integration test creates an `auth.identities` Google row, signs in and asserts `providers: ['google']` (which drives "Set password"), and E2E checks the Google button plus a cancelled OAuth callback returning to `/login?error=linkExpired`. Real Google OAuth configuration and delivery remain M7/M8 and are not claimed as verified.
- **CI e2e seeds fixtures**: S12 signs in as the seeded superadmin, so the e2e job now runs `npm run db:seed` after migrations. E2E still creates its own accounts and events for the scenarios.
- **Onboarding session lag:** the wizard retries the profile load once (400 ms) before redirecting to `/login`, because a WebKit run occasionally read the callback cookies one tick late.

Evidence: 23 integration tests including admin authorization (`401/403`), create/validate/duplicate email, edit type/names/date/email/purge recalculation, reset password (old access token `401 sessionExpired`, old password rejected, refresh token rejected), deactivate/reactivate (old token `401 accountDisabled`, sign-in banned, reactivation allowed), delete (Auth user `404`, profile/event gone, Storage object gone), `PATCH /auth/me`, and the Google identity fixture. 34 component tests (settings email/password/phone/Google, phone gate, admin list/search/filter/create/credentials/reset/deactivate/delete/API error). 20 Playwright tests on Chromium and mobile WebKit, including S12 (superadmin creates a celebration, organizer signs in without onboarding, deactivation signs the organizer out and blocks sign-in, guest page unaffected), UC-82 (both addresses confirmed from Mailpit), UC-83 (wrong current password rejected, new password works, old fails), UC-06 (session survives a reload) and the Google callback error. `lint`, `typecheck`, `test:unit`, `test:component`, `build`, `build:demo`, `test:integration`, `test:e2e` and `format:check` are green.

## 2026-11-22 — M2: auth screens, onboarding, secure email change and password revocation

The account UI is ported from the prototype's sign-in card (`apps/demo/src/app/theme.css` and `login.page.jsx` layout) into `apps/web`: `/login`, `/registracija`, `/potvrda-emaila`, `/zaboravljena-lozinka`, `/nova-lozinka`, `/auth/callback`, `/onboarding`, a minimal `/app` dashboard and a superadmin `/admin` placeholder. `theme.css` is copied unchanged (font packages imported from `app/layout.tsx`), and the auth copy lives in `apps/web/locales/{sr,en,ru}/auth.json`. Server pages create one i18next instance per request from the `lang` cookie and pass the strings a client component needs as a typed `copy` prop, so no language state is shared between requests and components stay testable without an i18n provider (the full namespace set and the language switcher arrive with the organizer app).

API additions: `POST /onboarding` creates the single event with `DEFAULT_INVITATION`/`DEFAULT_EVENT_SETTINGS`, a unique slug from the shared rules, the 50 MB storage default and `purge_at` at 00:00 Europe/Belgrade on `date + retention_months`; it stores the normalized phone, the display name and `onboarded_at`, and answers `409` once an event exists. `GET /weddings/current` returns `{ wedding }` and a guard placed in front of `/weddings/*`, `/guests/*` and `/photos/*` verifies the token (`401`) and onboarding (`409 onboardingRequired`) before any M3 handler exists. `POST /auth/password/complete` moves `tokens_valid_after` to the current second after a password change, so already-issued access tokens are rejected immediately. `/auth/me` now also stores the legal acceptance from the signup metadata (`termsVersion`, `privacyVersion`, `termsAcceptedAt`) on the profile created on first call.

Deviations and decisions:

- **`apiFetch` attaches the token** (recorded in the earlier M2 entry); no axios instance was introduced.
- **Response shapes:** `/auth/me` keeps `{ profile }`; onboarding and `/weddings/current` use `{ profile, wedding }` / `{ wedding }` instead of SPEC §6.1's `{ user, wedding }`. The earlier decision that the web client consumes `profile` is unchanged; `User.onboarded`/`emailVerified`/`providers` are not added yet (the client reads `onboardedAt` and Supabase reports verification).
- **Onboarding redirect** is a server-component redirect in `/app` (and a client redirect after `409`) rather than a DB lookup in `proxy.ts`; the API guard remains the authorization boundary and the proxy only handles the signed-out redirect. With only `/app` protected so far this avoids a per-request profile query in the proxy; when the rest of `/app` is ported the check moves into the proxy.
- **Secure Email Change** follows the current Supabase payload exactly: `token_hash_new` belongs to the current address and `token_hash` to the new one, so `email_change` sends two emails (`auth_email_change_current`, `auth_email_change_new`). With Secure Email Change disabled a single email goes to `user.new_email`. The hook sends every message in the payload and answers `500` if any send fails.
- **Password completion re-authenticates.** After `updateUser`, `signOut({ scope: 'others' })` and the cutoff call, the client signs the current browser in again with the password just set instead of calling `refreshSession()`. Refreshing a session created by a recovery link raced the revocation and intermittently produced an unauthenticated browser (E2E reproduced it); re-authentication still satisfies "stays signed in", "other sessions revoked" and "old access tokens rejected". `tokens_valid_after` uses second precision with a strict `<` comparison, matching SPEC §6.1's `iat >= floor(epoch(tokens_valid_after))`.
- **Sign-out uses `scope: 'local'`** (UC-09): it clears this browser immediately and never blocks on Auth latency; revoking other devices is not part of the use case. A global revoke can be added in settings later.
- **Local Supabase Auth rate limits were raised** in `supabase/config.toml` (`sign_in_sign_ups`/`token_verifications` 200 per 5 min, `email_sent` 100 per hour, `token_refresh` 300) because the E2E suite exercises signup, confirmation, recovery and sign-in in one run; the CLI defaults (2 emails/hour) make local auth flows untestable. Hosted limits stay an M7 configuration item.
- **Hydration marker for E2E:** the root layout renders a client `HydrationMarker` that sets `body[data-hydrated]`. Client components render on the server first, and filling/submitting before hydration left React state empty (observed as flaky auth E2E). Tests wait for the marker; the retry helpers then also tolerate a lost click. This is a test hook only and renders nothing.
- **Minimal dashboard and admin:** `/app` shows the welcome and "Do venčanja/proslave još N" countdown (S1/S2), and `/admin` is a placeholder so the superadmin redirect is not a 404. The full dashboards, settings (including UC-07's phone modal, change email/password UI) and the admin account table are the remaining M2/M3 tasks.
- **S2 wording:** the scenario's slug `luka-18-rodjendan` is already owned by a local seed fixture, so the E2E run uses a different celebrant and asserts the celebration wording/countdown; the exact slug rule and the `-2` suffix are asserted in the onboarding integration test. Guest sides (Family/Friends/Other) belong to the guests milestone and are not part of onboarding.

CI follow-up: the E2E job now exports the local Supabase URL/keys and the bare hook secret for the product (the CLI steps keep the `v1,`-prefixed form of the same secret), because the auth scenarios exercise real signup, confirmation and recovery emails through the local Auth + Mailpit stack. It also runs `npm run db:migrate` after `supabase start`: previously only `/api/health` was touched, which needs no product tables, while `/auth/me` and `/onboarding` do. The first CI run of this slice failed the e2e job with a `500` from the missing `profiles` table; the follow-up run (`45061887296`) is green in all three jobs.

Evidence: 14 integration tests against local Supabase (missing token `401`, validation `422` codes, event defaults/slug/`purge_at`, repeat onboarding `409`, guard `409 onboardingRequired` on `/weddings` and `/guests`, password cutoff rejecting the old token and accepting a fresh session, legal metadata stored). 24 component tests (signup validation/locale/terms, onboarding steps/back/payload/API error, login success/wrong password/unverified resend, forgot/sent, reset validation/success/expired, check-email countdown). 14 Playwright tests pass on Chromium and mobile WebKit: S1 (signup → Mailpit confirmation → wedding onboarding → countdown), S2 (celebration wording), S3 (forgot → Mailpit recovery link → new password → new password works, old fails), plus the existing S17/landing tests. `lint`, `typecheck`, `test:unit` (111), `test:component`, `build`, `build:demo`, `format:check` and `test:integration` are green.

## 2026-11-22 — M1: tester diagnostic support bundle

The browser keeps a bounded in-memory ring (200 allow-listed events: kind, trace/span/request IDs, method, normalized route, status, duration, stable code, retry attempt) in `apps/web/src/lib/diagnostics/ring.ts`; `apiFetch` sends a W3C `traceparent`, records request/response/failure events and keeps retries on one trace. Nothing is uploaded automatically. A local-only `/dev/diagnostics` page (`NEXT_PUBLIC_DIAGNOSTICS_ENABLED=true`, otherwise `404`) triggers a real `422` through `/api/spike/validate`, shows the localized message with code/trace/request IDs, a copy-ID action (clipboard with a selection fallback) and a download action.

`POST /api/diagnostics/export` exists only when `DIAGNOSTICS_ENABLED=true` and not production (`404` otherwise). It caps the request at 256 KB, requires `schemaVersion: 1` and a 32-hex trace ID, re-sanitizes client events through an allow-list, reads matching lines from today's/yesterday's bounded JSONL files under the git-ignored `.logs/` (one file per day, pruned after 7 days or 100 MB), and returns one document: schema version, timestamp, environment, version, trace ID, all request IDs, sanitized client events (sorted), server spans, redacted logs, explicit `warnings` (e.g. `serverLogsMissing`) and a `redactions` summary. Pino mirrors the same records to the JSONL stream only in local diagnostics mode, so product behaviour never depends on those files.

Evidence: S17 passes on Chromium and WebKit — the validation failure yields one trace ID shared by browser events and the server span, `warnings` is empty, the span has route `/api/spike/validate` and status `422`, request IDs reconcile, and the serialized bundle contains no email, bearer token, password or header value. API unit tests cover the disabled `404`, schema/trace/size rejections, malformed JSON and the allow-list stripping of extra fields.

## 2026-11-22 — M1: local Supabase Auth email hook and SMTP path

`supabase/config.toml` enables `[auth.hook.send_email]` with `uri = "http://host.docker.internal:3000/api/hooks/auth-email"` and `secrets = "env(SUPABASE_AUTH_HOOK_SECRET)"` (the CLI requires the `v1,whsec_<base64>` form), and email confirmations are on. `npm run dev:bootstrap` generates a local `whsec_…` secret into the git-ignored `supabase/.auth-hook-secret`, writes the bare value to `apps/web/.env.local` for the API and passes the `v1,`-prefixed value to every CLI call through `scripts/lib/local-stack.mjs`. Consequences: the local config is invalid for a bare `npx supabase …` without that variable, so the lifecycle scripts are the supported entry points (documented), and the CI jobs generate an ephemeral secret before `supabase start`.

`POST /api/hooks/auth-email` verifies the Standard Webhooks signature over the raw body (HMAC-SHA256, 5-minute tolerance, timing-safe comparison), rejects unknown/malformed payloads with `400`, and sends through the `EmailSender` boundary — `nodemailer` SMTP to Mailpit locally; Resend and the React Email templates are M5. Copy exists for signup, recovery, email_change (current and new address), magic link, invite and reauthentication in sr/en/ru, with the locale taken from validated auth metadata (UC-77, SYS-6). The callback link is built from `APP_URL` rather than the payload's `site_url`, because GoTrue reports its own auth base (`127.0.0.1:54321/auth/v1`) there, which is not where the product callback lives.

Evidence: `POST /auth/v1/recover` produced a signed hook call (`200`, `auth email sent`) and a message in Mailpit; a signup with `locale: ru` metadata produced the Russian subject "Подтвердите email · Uspomena"; the recovery link is `http://localhost:3000/auth/callback?token_hash=…&type=recovery&next=…`; an unsigned request to the hook answers `401` with the error envelope and sends nothing. Unit tests cover signature acceptance/tampering/staleness, locale resolution, action coverage and the route's `200`/`400`/`401` paths.

Local cron invocation is documented in `LOCAL_DEVELOPMENT.md`: `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` and an injected `now`, implemented in M6 and scheduled on Vercel in M7.

## 2026-11-22 — M1: Playwright E2E on Chromium and mobile WebKit

Playwright 1.65 is a root devDependency with `playwright.config.ts` (testDir `e2e`, Chromium desktop and an iPhone 15 WebKit profile, traces and video on failure) and starts the product itself via `webServer` (`npm run dev`, reused when already running). `npm run test:e2e` therefore needs only a bootstrapped local stack. `tsconfig.e2e.json` typechecks the config and specs under the same strict settings and is part of the root `typecheck`.

`e2e/landing.spec.ts` proves the walking skeleton: the landing page renders, the development probe reaches `/api/health` (`200`, correlated `x-request-id`) and shows `API: ok (v…)`; the M0 guest placeholder page follows the `lang` cookie, answers a localized 404 for unknown tokens and is not shared-cached (dev answers `no-store`; the production build's exact `private, no-store` stays asserted by `spike:check`). The DB-backed invitation replaces the placeholder in M3.

CI runs a third job (`e2e`): `npm ci` → `npx playwright install --with-deps chromium webkit` → `npx supabase start` → export `DATABASE_URL` from `supabase status -o env` → `npm run test:e2e`, uploading the report on failure and stopping the stack in an `always()` step. All six tests (three per browser project) pass locally, and the job is green in GitHub Actions.

## 2026-11-22 — M1: deterministic local seeds with real Storage files

Seeds are a TypeScript runner (`packages/api/src/db/seed.ts` + `fixtures.ts`), executed by Node's built-in type stripping, called from `npm run db:seed` after any `supabase/seed.sql`/`seeds/*.sql` files. It is idempotent (fixed UUIDs, `on conflict do update`, `x-upsert` uploads) and refuses to run unless `SUPABASE_URL` is local and `DATABASE_URL` is the local database; `dev:bootstrap` and `dev:reset` always run it. SQL seed files stay supported for future SQL-only fixtures, which is why the runner does not use `supabase db reset` seeding.

Fixture coverage (LOCAL_DEVELOPMENT.md §3): superadmin; wedding organizer with invitation, settings and 50 MB limit; celebration organizer with a manual gallery already open; verified-but-not-onboarded organizer; unconfirmed organizer without a profile; a local Google identity (an `auth.identities` row, explicitly not a real OAuth test); a deactivated organizer plus event; 30-day and 7-day retention events with the matching warning flags; an already purged event; a storage-limit event with two real files and a limit of used + 100 KB; seven guests covering pending/yes/no, named/open/no companions and notification pending/sent; two QR subscribers; six photo rows covering `uploading` (size reservation only, no files), `pending`, `approved` (JPEG, PNG, WebP) and `hidden`, each with original/web/thumb objects in the private bucket.

Auth users are created/updated through the Supabase Admin API with documented disposable passwords, so no password hashes are invented; the Google fixture inserts the identity row directly because the Admin API cannot create provider identities. Fixture passwords are listed in `LOCAL_DEVELOPMENT.md` §3. Retention fixtures derive `date`/`purge_at` from the seed run (Belgrade midnight) so the 30/7-day warnings and the archive are always due; identities, UUIDs, slugs and tokens stay fixed. No email is sent.

Evidence: a first run created 11 Auth users, 10 profiles, 7 events, 7 guests, 8 photos, 2 subscribers and 21 Storage objects; a second run kept exactly those counts; `dev:reset` then rebuilt the whole stack and reseeded to the same state; the couple account authenticated through the Auth password grant (a wrong password was rejected); the archived/30-day/7-day/purge timestamps matched the intended windows (29.9 d, 6.9 d, purged in the past); and a downloaded seeded original is a real 1200×800 JPEG (Storage requires both the `apikey` and `Authorization` headers, which the API client must send too).

## 2026-11-22 — M1: API integration tests against the local stack in CI

`npm run test:integration` (`scripts/test-integration.mjs`) starts the local Supabase stack if needed, applies migrations with `DIRECT_URL` cleared, and runs `packages/api` integration tests with the real local `DATABASE_URL` — no mocks, no cloud credentials. The suite (`packages/api/test-integration/health.test.ts`) checks `GET /api/health` against Postgres with correlation headers, asserts the migrated schema (the seven tables, RLS enabled on each, zero policies) and the 404 envelope in front of a live connection. `vitest.integration.config.ts` runs files serially with a 30 s timeout; unit tests stay in `vitest.config.ts`.

GitHub Actions runs it as a second job (`integration`) in the same workflow: `npm ci` → `npx supabase start` (the CLI is the pinned npm devDependency, Docker is available on the runner) → `npm run test:integration` → `supabase stop --no-backup` in an `always()` step. Unit tests remain a separate job that needs no database.

## 2026-11-22 — M1: local metrics, Prometheus/Grafana and log redaction

Metrics are registered with `prom-client` in `packages/api/src/metrics.ts`: `http_requests_total{method,route,status}`, `http_request_duration_seconds{method,route}` (with buckets), `http_errors_total{route,code}` plus the default Node process metrics. Labels are Hono route templates (`/api/health`, `/api/guests/:id`) and unmatched requests collapse to `/api/*`, so no raw path, token, ID or email can become a label; `normalizeRoute` has its own unit test. Errors are counted in the shared error handlers with their stable code.

`GET /api/metrics` is disabled (`404`) unless `METRICS_ENABLED=true` (false by default, local-only in practice), requires `Authorization: Bearer METRICS_TOKEN`, answers `401` otherwise, and fails closed with `503` when metrics are enabled but the token is missing. `npm run dev:bootstrap` generates a random `METRICS_TOKEN` per bootstrap, writes it to the git-ignored `apps/web/.env.local` and to `infra/observability/metrics-token`; Prometheus reads it through `authorization.credentials_file`, so no shell templating or committed secret is involved. Docker creates a directory when a bind-mount source is missing (it did on the first run), so bootstrap replaces such a directory with the token file.

`infra/observability/docker-compose.yml` starts `prom/prometheus:v3.16.0` (`:9090`) and `grafana/grafana:13.3.1` (`:3001`, local `admin`/`admin`, analytics and sign-up disabled) with a provisioned Prometheus datasource (explicit `uid: prometheus`), a provisioned dashboard (`Uspomena · local API`: request rate, p95 latency, errors by code, responses by status, Node process) and `host.docker.internal:3000` as the scrape target with `host-gateway` for Linux. `dev:bootstrap`/`dev:services`/`dev:teardown` already start and stop this stack. Pinning the datasource uid matters: Grafana refuses to restart when a provisioned dashboard references an unknown uid, so the stack was recreated once with `down -v` while it was still uncommitted.

Pino logging was already correlated and redacted; this task added `REDACT_PATHS` for authorization/cookie headers and token fields, a testable `createLogger(destination)` factory, and a redaction test that logs a bearer token, a session cookie and a guest token and asserts none of them reach the output. `packages/api` now has Vitest unit tests (`npm run test:unit` runs shared + api): 14 tests cover trace-context propagation and rejection of malformed/all-zero `traceparent`, locale resolution, the 404/422/500 envelope with localized messages and correlation IDs, the `/health` failure path, metrics gating by flag and token, route-label normalization and log redaction.

Evidence: `/api/metrics` answered `401` without a token and `200` with it, exposing `http_requests_total{route="/api/metrics"}`; the Prometheus target `uspomena-api` reported `up`; a Prometheus query returned the request counts by status; Grafana listed the `Prometheus` datasource with uid `prometheus`, the provisioned dashboard with its five panels, and successfully proxied a Prometheus query; `npm run dev:teardown` stops both stacks.

## 2026-11-22 — M1: Hono health route, correlation middleware and the error envelope

`packages/api` now has a real walking skeleton: `GET /health` checks the Postgres connection through Drizzle/postgres.js and answers `{ ok, version, db }` (`200`/`503`); middleware creates a `requestId` per request and a W3C `traceId` inherited from a valid `traceparent` or generated when the header is missing/invalid, echoes `x-request-id`, `x-trace-id` and a fresh `traceparent`, resolves `Accept-Language` through `packages/shared`, and emits one redacted Pino line per request (method, route template, status, duration, both IDs). Unknown routes and thrown errors answer `{ message, code, requestId, traceId }` where `code` is a shared message key translated into the request language; seven new envelope messages (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `internalError`) were added to `packages/shared` in sr/en/ru. Validation errors from shared rules map to `422` with the rule's own message key.

Configuration is read lazily (`packages/api/src/env.ts`), so bundling during `next build` never needs runtime secrets and a missing `DATABASE_URL` fails at the first request with a clear message instead of a silent default. `npm run dev:bootstrap` now also writes `apps/web/.env.local` (git-ignored, `0600`) with the local Supabase URL/keys, `DATABASE_URL` and `APP_URL` from `supabase status`; `apps/web/.env.example` documents every product variable. The landing page renders a development-only `ApiHealth` probe that calls `/api/health` (covered by three component tests); production builds do not render it.

The private `photos` bucket is declared in `supabase/config.toml` (`[storage.buckets.photos]`, `public = false`, JPEG/PNG/WebP, 30 MB limit) rather than in a SQL migration, because the Supabase CLI owns bucket creation and recreates it on every local start/reset; hosted environments get the same bucket from the M7 setup checklist. The CLI stores "30MB" as 30 MiB (31,457,280 bytes), so `MAX_UPLOAD_MB` is treated as MiB throughout. A migration would have been a hand-written entry in the Drizzle journal with no schema source, and `db:reset` semantics would still depend on the CLI.

Evidence: `/api/health` `200` in a production `next start` with the response headers above; `404` envelope in Russian and English; `traceparent` propagation keeping the caller's trace id and recording the parent span; `503 { ok: false, db: "error" }` when `DATABASE_URL` points at a closed port; structured JSON request lines in production and pino-pretty lines in dev; dev server rendering the probe and returning `200` from `/api/health`; `next build` and the component tests passing without any `.env.local`; `psql` showing `storage.buckets.photos` with `public = false`, the 30 MiB limit and the three MIME types after a clean reset.

## 2026-11-22 — M1: Drizzle schema and the first migration

`packages/api/src/db/schema.ts` defines all seven tables of SPEC §4 (`profiles`, `events`, `guests`, `photo_subscribers`, `photos`, `email_log`, `rate_limits`), eight enums, the spec's unique/index requirements, its checks (`retention_months` 1–60, positive storage limit and photo size, slug format, side values, non-negative RSVP persons and rate-limit counts) and `.enableRLS()` on every table, which `drizzle-kit generate` emits as `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. The generated migration `db/migrations/0000_military_landau.sql` plus its snapshot are committed; the snapshot/journal are excluded from Prettier because they are tool output that regenerates on every `drizzle-kit generate`.

Deliberate choices, all within the spec:

- `profiles.id` carries the Supabase auth user id but has **no** cross-schema foreign key to `auth.users`: that schema belongs to Supabase Auth, is not part of this schema file, and defining it would make `drizzle-kit` try to create it. The API keeps the values in sync and deletes the profile explicitly with the auth user (UC-84).
- Event/photo/guest/RSVP/email enums keep the spec's storage values (`mlada|mladozenja|zajednicki`, `uploading|pending|approved|hidden`, `sent|failed`, …) so the demo's stored values stay valid; TypeScript names live in `packages/shared`.
- `bigint` columns (`storage_limit_bytes`, `size_bytes`) use Drizzle's `number` mode because the spec's 50 MB / 30 MB limits are far below `Number.MAX_SAFE_INTEGER`; timestamps are `timestamptz` with `mode: 'date'`.
- Extra indexes beyond the spec are limited to query paths the API needs and to the daily cron: `events.purge_at`, `photos(event_id, status, created_at)`, `guests(event_id, rsvp_status)`, `email_log.created_at`, plus unique indexes for `events.slug`, `events.owner_id`, `guests.token`, `profiles.email`, `photo_subscribers(event_id, email)` and `email_log.dedupe_key` (nullable, so many rows without a key remain allowed).

Evidence: `drizzle-kit generate` reported 7 tables and produced the migration; a guarded local reset (clean stack) followed by `npm run db:migrate` created everything on an empty database — `pg_tables` shows all seven tables with `rowsecurity = true`, `pg_policies` is empty, eight enum types and seven check constraints exist, and `drizzle.__drizzle_migrations` holds one row. Re-running `db:migrate` is a no-op.

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
