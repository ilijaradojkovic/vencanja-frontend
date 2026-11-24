# MVP progress

One entry per completed milestone: what was done, what wasn't, known issues. Tasks and their evidence live in [`DOD.md`](DOD.md); deviations and tooling decisions live in [`DECISIONS.md`](DECISIONS.md).

## M4 – Photos (complete)

**Done**

- Signed direct-to-Storage upload flow (`…/uploads`, PUT, `complete`) with hashed upload keys, idempotent completion, atomic reservations and the actual-size check under the event row lock (a concurrent-completion overrun was found and fixed); sharp `web` (1600 px) and `thumb` (400 px) with EXIF rotation and EXIF/GPS stripped, 50 MP ceiling.
- Moderation (`PATCH`, event-scoped `bulk-status`, `DELETE` of all three objects); `GET /weddings/:id/photos` and both public galleries with one-hour signed `url`/`thumbUrl` and validated `(createdAt, id)` cursor pagination (default 50, max 100, status/category/guest filters, counts, `total`).
- UC-85: paginated signed originals with sanitized unique names, browser ZIP via `client-zip` (streamed to disk in Chromium, bounded 200 MB archives elsewhere) and single-photo download.
- Product UI: Photos page, dashboard "new photos", big album (wall/per guest/slideshow, incremental pages), guest gallery for the personal and QR links, and the upload page (screening incl. HEIC, 3 parallel PUTs with per-file progress, 3 retries on the same photo, Try again/Skip, `beforeunload`). Expired signed URLs reload the loaded pages.
- Observability: `photo_uploads_total`, `photo_processing_total`, `photo_processing_duration_seconds` with Grafana panels; `npm run measure:complete` — 12 MP p95 326 ms at 1 vCPU / 2 GB, 26.6 MB / 36 MP completes, 108 MP bomb fails with `422 notImage`.
- Tests: 90 integration (real Storage), 67 component, 79 + 51 unit and 21 Playwright scenarios per browser project including S7–S10; CI (Chromium + WebKit) is green on `50eed2a`.

**Not done / deferred**

- The organizer settings screen for photo options (UC-54 – UC-56: auto-approve, QR upload, gallery mode) is not ported; the API supports it and S8 sets it through `PATCH /weddings/:id`.
- "Photos are ready" emails are M5; retention/archiving and account deletion are M6; Preview measurement of `complete` is M7.

**Known issues**

- Seeding a fresh stack after integration tests have run can fail on the seed's fixed slugs (test leftovers); `ALLOW_LOCAL_RESET=1 npm run dev:reset` resolves it.
- The upload copy keeps the prototype's nominative "Pošalji 1 fotografija" wording.
- Album "per guest" stacks group the loaded pages only; very large albums show complete stacks after "show more".

## M3 – Event, invitation, guests, RSVP (complete)

**Done**

- `GET /weddings/current` and `PATCH /weddings/:id` with the SPEC §6.6 validation: unique slug, 11 templates, `#RRGGBB` accents, text limits, ≤20 schedule items with `HH:mm`, known settings only and `purge_at` recalculation on a date change; foreign ids answer `404`.
- Guests: list/create/import (≤1000 normalized rows)/edit/delete with the shared companion rules, a 12-character personal token, SYS-5 trimming, manual RSVP entry and photos kept on delete.
- Public API: invitation by token, first `opened`, RSVP, notify with `notify_locale`/SYS-4 reset, public wedding by slug, and both galleries with SYS-3 in Europe/Belgrade (approved photos only while open). Signed photo URLs and pagination are M4.
- SYS-12 fixed-window rate limits (300/min public reads, 30/10 min RSVP+notify per IP, 30/10 min per user for onboarding and `PATCH /auth/me`) with atomic counting, hashed keys, localized `429`.
- Product UI: dashboard stats, guests page (search/side/RSVP filters, paging, add/edit with companions and manual answers, import, CSV, link/WhatsApp/open, delete), invitation editor (11 looks, accents, text, schedule, live preview) and the server-rendered personal invitation (envelope, RSVP, notify, gallery status, localized not-found page). Client i18n uses one i18next instance per locale/event type (`react-i18next`), with the demo locale files and celebration overlays.
- Tests: 60 integration, 37 component, 79+40 unit and 28 Playwright tests (S1–S6, S12, S17, landing, SSR locale/event isolation). CI is green.

**Not done / deferred**

- Photo upload and gallery pages, signed URLs, pagination, moderation and the big album are M4; the invitation's album card therefore shows the gallery status and notify form only.
- "Photos are ready" notifications and the QR upload/gallery pages are M4/M5.
- Retention display, account deletion and legal pages are M6.
- Full dashboard widgets (replies list, new-photos strip, QR card) and the prototype sidebar are not ported yet; the M3 dashboard has the countdown, key stats and quick links.

**Known issues**

- Client bundles include all three languages and the celebration overlays; guest-route code-splitting and the 250 KB gzip budget are measured in M7.
- The seed fixture `luka-18-rodjendan` owns that slug locally, so a celebration created with the same names gets a `-2` suffix (the rule is asserted by integration tests).
- Re-running the E2E suite locally leaves its created organizers/guests behind (unique addresses); `dev:reset` clears them.

## M2 – Accounts and authorization (complete)

**Done**

- Product auth UI from the prototype's card: `/login` (wrong password, unverified → resend, disabled, Google entry), `/registracija` (8-character password, required legal acceptance stored in auth metadata, existing email shows the same check-email screen), `/potvrda-emaila` with a 60-second resend, `/zaboravljena-lozinka`, `/nova-lozinka`, `/auth/callback` (email `token_hash` + Google PKCE `code`), `/onboarding` (type → names/date → phone/city, back keeps data, 409-safe) and a minimal `/app` countdown dashboard. Copy is in sr/en/ru.
- `/app/podesavanja` Account section: email change with "awaiting confirmation", password change (current password verified, other sessions revoked, cutoff, re-authentication), "Set password" for Google-only accounts, phone and language. The UC-07 phone dialog blocks the app until a number is saved.
- `/admin`: the prototype's accounts table, search and status filters, account create/edit modal, one-time credentials dialog, password reset, deactivate/reactivate and delete confirmations. `npm run admin:create` creates a superadmin (local by default, hosted only with `ALLOW_ADMIN_CREATE=1`).
- API: `GET/POST/PATCH/DELETE /admin/accounts[/:id]`, `POST /admin/accounts/:id/password`, `PATCH /auth/me`, the superadmin guard, `POST /onboarding`, `GET /weddings/current`, `POST /auth/password/complete` and the `401/403/409 onboardingRequired` guards. Account deletion removes Storage objects, the Auth user and the profile (DB cascade). Secure Email Change maps both token hashes and sends two localized emails.
- Tests: 23 integration (auth, onboarding/guard, admin CRUD + validation + revocation, Google identity fixture), 34 component (auth forms, onboarding, settings, phone gate, admin page), 20 Playwright (S1, S2, S3, S12, UC-82 both-address email change, UC-83 password change, UC-06 reload, Google callback, S17, landing) on Chromium and mobile WebKit; 73 shared + 38 API unit tests. All root checks and CI are green.

**Not done / deferred**

- Real Google OAuth configuration/delivery, Resend delivery and Vercel deployment remain M7/M8 external checks; locally they are covered only by the identity/callback fixtures.
- The full organizer shell/sidebar, dashboard widgets, guests, photos and the real invitation `/i/[token]` are M3; the S12 guest assertion uses the seeded placeholder page until then.
- Settings data-retention display and account deletion (UC-84/UC-89) are M6. Admin retention and per-account storage-limit fields (UC-88) are also M6.
- The admin list has no pagination and fetches providers with a single 1000-user Auth call.

**Known issues**

- The admin UI shows inline status messages instead of the prototype's toasts (the product has no toast container yet).
- Refresh-session revocation deletes rows in Supabase Auth's `auth.sessions`/`auth.refresh_tokens` (no admin endpoint exists); access-token revocation and deactivation bans are independent of that detail.
- Re-running the auth E2E suite locally leaves its created accounts behind (each run uses unique addresses); local `dev:reset` clears them.

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
