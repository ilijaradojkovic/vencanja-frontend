# Uspomena – Definition of Done (DoD) and work plan

> Version 1.0 · 22 November 2026 · goes with [`SPEC.md`](SPEC.md)
> Tick the checkboxes in this file as items are done.

The document has three parts:

1. **General DoD**: applies to every task and milestone.
2. **Milestones M0 – M8**: the work order, and what must be done in each milestone.
3. **Final MVP DoD**: the conditions for calling the MVP done, with acceptance scenarios.

The agent ticks items (`[x]`) in `DOD.md` as it finishes them and commits that together with the code. An item is ticked only once it is **shown** to work (the test passes, the command was run), not when the code is written.

---

## 1. General DoD (every task)

A task is done when all of the following hold:

- [ ] Behavior matches `SPEC.md` and `USE_CASES.txt` (UC/SYS IDs named in the commit message or PR description).
- [ ] Tests per the pyramid (§1.1) are written and pass locally and in CI.
- [ ] No existing test has been deleted, skipped (`.skip`, `.only`) or weakened to make it pass.
- [ ] `npm run lint`, `npm run typecheck` (api, shared) and `npm run build` pass without errors.
- [ ] Every new string exists in **sr, en and ru** (and in `celebration/` where needed); no translation key renders as a raw key.
- [ ] Every new protected route has tests for: no token → `401`, wrong role → `403`, someone else's event → `403`/`404`.
- [ ] New error messages exist in `packages/shared` in 3 languages and are returned as `{ message, code }`.
- [ ] No secrets in code or in git; new env variables are in `.env.example` with a description.
- [ ] The DB schema changes only through migrations; each migration applies to an empty DB and to a DB in the previous state.
- [ ] The demo build (`npm run build:demo`) still works for every feature that exists in production.
- [ ] No `console.log`, commented-out code, or `TODO` without an issue or a note in `DECISIONS.md`.
- [ ] Deviations from the spec are recorded in `docs/mvp/DECISIONS.md`.

### 1.1 Test pyramid and thresholds

| Level | Tool | Covers | Threshold |
|---|---|---|---|
| Unit | Vitest | `packages/shared`: gallery (SYS-3, time zone), companions and RSVP (UC-18, UC-60, SYS-5), phone, slug, message translation; `apps/api` services (retention, rate limit, file names) | `packages/shared` ≥ 90% lines and branches |
| Integration (API) | Vitest + local Supabase (`supabase start`) | Every endpoint: success, validation (`422`), authorization (`401/403/404`), business rules. Real DB, real Storage; Resend is replaced by a test double at the boundary (`EmailSender` interface) | `apps/api` ≥ 80% lines |
| Component (FE) | Vitest + Testing Library + jsdom | `GuestModal`, RSVP form, upload page (new flow, retry), `NotifyGuestsModal`, onboarding, signup, consent bar, admin `AccountModal` | `apps/web/src` ≥ 60% lines for `features/` and `components/` |
| E2E | Playwright (Chromium + WebKit mobile profile) | The scenarios in §3 against the local stack (web + API + local Supabase + Inbucket for email) | All §3 scenarios pass |

Coverage thresholds are checked in CI, and the build fails if they aren't met.

---

## 2. Milestones

Milestones are done in order. A milestone is done when all of its items are ticked and the general DoD holds. After each milestone: commit, green CI, and a short entry in `docs/mvp/PROGRESS.md` (what was done, what wasn't, known issues).

### M0 – Monorepo and tooling

- [ ] Frontend moved to `apps/web` (history kept via `git mv`); `npm run dev`, `build`, `build:demo` and `preview` work from the root.
- [ ] npm workspaces: `apps/web`, `apps/api`, `packages/shared`.
- [ ] `packages/shared` contains the enums, the gallery, companion, RSVP, phone and slug rules, and the error messages (SPEC §3.2); the mock and web import them from there; the old copies are deleted.
- [ ] Unit tests for `packages/shared`, with a coverage threshold.
- [ ] ESLint + Prettier for the whole repo; TypeScript strict for `api` and `shared`.
- [ ] Vitest and Testing Library set up in `apps/web`; at least one component test passes.
- [ ] GitHub Actions: lint → typecheck → unit → build (web + demo). Integration and E2E are added in M1.
- [ ] The demo build behaves the same as before the move (manual check: demo sign-in, guest RSVP, upload, approval).
- [ ] Dockerfile updated to the new path (still the mock demo).

### M1 – Walking skeleton

- [ ] `supabase/` with `config.toml`; `supabase start` brings up the local stack; `npm run db:migrate` applies migrations.
- [ ] Drizzle schema for every table in SPEC §4; RLS enabled with no policies; the first migration passes on an empty DB.
- [ ] Bucket `photos` (private) is created by a migration or seed script.
- [ ] `apps/api`: Hono app, `GET /health` (checks the DB), middleware for `requestId`, JSON logs, `Accept-Language`, error format `{ message, code }`.
- [ ] The Vercel entry mounts the API at `/api/*`; with `VITE_USE_MOCK=false` the frontend calls `/api/health` and shows the result in dev.
- [ ] Vercel project connected: a Preview deploy per PR (staging Supabase) and Production (production Supabase). Env variables set in Vercel.
- [ ] Migrations are applied automatically before deploy (Preview → staging, Production → production).
- [ ] CI: integration tests against `supabase start` in GitHub Actions; one integration test (`/health`) passes.
- [ ] Playwright set up; one E2E test (opening the landing page against the real API) passes in CI.

### M2 – Accounts and authorization

- [ ] `auth.js` interface with Supabase and mock implementations; `axiosInstance` sends the Supabase access token.
- [ ] The API verifies the JWT (signature, `exp`, `iat >= tokens_valid_after`, `active`) and creates the profile on the first `GET /auth/me`.
- [ ] UC-77 signup, UC-78 resend, UC-79 Google, UC-80 forgot password, UC-82 change email and UC-83 change password work locally (Inbucket) and on Preview (Resend).
- [ ] The Send Email Hook (`/hooks/auth-email`) verifies the signature and sends emails in sr/en/ru; templates exist for signup, recovery and email_change (new and old address).
- [ ] UC-81 onboarding: route, wizard, `POST /onboarding`, redirects (`/app` → `/onboarding` until done, `409 onboardingRequired` from the API).
- [ ] UC-05, UC-06, UC-07 and UC-09 work on Supabase Auth with the same messages as the prototype.
- [ ] Superadmin: `npm run admin:create`; UC-71 – UC-76 on the real backend (Supabase admin API); deactivation and a new password invalidate sessions immediately (test: old token → `401`).
- [ ] Google OAuth configured in the staging and production Supabase projects (redirect URLs for Preview and Production).
- [ ] Tests: integration tests for all auth/admin routes; component tests for signup and onboarding; E2E scenarios S1, S2, S3, S12.

### M3 – Event, invitation, guests, RSVP

- [ ] `GET /weddings/current` and `PATCH /weddings/:id` with the validation from SPEC §6.6 (unique slug, templateId, color, schedule, settings).
- [ ] Guests: list, create, import (up to 1000 rows, normalized), edit (SYS-5), delete (photos stay).
- [ ] Public: invitation, `opened`, RSVP, `notify` (with `notify_locale`), `GET /public/weddings/:slug`, gallery (empty while closed; SYS-3 in Europe/Belgrade).
- [ ] Rate limiting (SYS-12) on public routes, with a test for `429`.
- [ ] UC-11 – UC-32, UC-58 – UC-64 and UC-70 work on the real backend (photo parts come in M4).
- [ ] Tests: integration tests for every route in this milestone, including every error in `USE_CASES.txt` (e.g. `companionNotInvited`, `personsRange`, `badSlug`); E2E scenarios S4, S5, S6.

### M4 – Photos

- [ ] New upload flow (SPEC §6.3, §7.1): `…/uploads`, PUT to Storage, `complete`, idempotency, `uploadKey` stored as a hash.
- [ ] sharp: `thumb` and `web`, EXIF rotation, EXIF/GPS stripped (test: output has no GPS tag).
- [ ] Moderation: `PATCH /photos/:id`, `bulk-status` (own photos only, tested with a foreign ID), `DELETE` (removes all 3 files).
- [ ] Signed URLs in lists and in the gallery; the frontend reloads the list when a URL expires.
- [ ] Grids use `thumbUrl`; the enlarged view and slideshow use `url` (UC-34 – UC-40, UC-46 – UC-49, UC-14).
- [ ] UC-85 download originals (in-browser streaming ZIP) and single-photo download.
- [ ] Upload page: per-file progress, 3 automatic retries, "Try again", `beforeunload`, rejection of HEIC and oversized files.
- [ ] Mock updated to the new flow (the demo build can upload).
- [ ] Tests: integration (upload with real Storage, wrong key, oversized file, non-image, QR disabled `403`); component tests for upload; E2E scenarios S7, S8, S9, S10.
- [ ] Measurement: `complete` for a 12 MP JPEG has p95 < 5 s on Preview.

### M5 – "Photos are ready" email

- [ ] `EmailSender` interface (Resend in production, a test double in tests, Inbucket or Resend test mode locally).
- [ ] React Email templates for "photos are ready" (guest, QR subscriber), wedding and celebration, sr/en/ru, with the personal link.
- [ ] `POST /weddings/:id/photo-notifications` really sends; `sentAt` only for successes; `failed` in the response; `email_log`.
- [ ] Protection against double sending (test: two parallel calls → each recipient gets one email).
- [ ] UC-16, UC-43 – UC-45 and SYS-4 work on the real backend.
- [ ] Tests: integration (including `galleryViaQr=false` and closed gallery `409`); E2E scenario S11 (the email arrives in Inbucket and its link opens the gallery).

### M6 – Privacy and data retention

- [ ] UC-87 `/privatnost`, `/uslovi` (draft, 3 languages) and every link to them.
- [ ] UC-86 consent bar; Vercel Web Analytics loads only after "Accept" (test: without consent there is no analytics script).
- [ ] UC-84 account deletion (`DELETE /auth/me`): DB, Storage, the Supabase Auth user, and a confirmation email.
- [ ] UC-88 retention in admin; UC-89 display in settings and on the dashboard.
- [ ] `GET /cron/daily` with `CRON_SECRET`: SYS-9, SYS-10, SYS-11, `rate_limits` cleanup; Vercel Cron set up (once a day, 03:00 Europe/Belgrade).
- [ ] Archived state (SYS-9) on guest pages and in the organizer app.
- [ ] Tests: integration tests for the cron (time is injected; deletion really removes files from Storage; idempotency; recalculation after a date change); E2E scenarios S13, S14.

### M7 – Cut features, landing page, finishing

- [ ] `VITE_FEATURE_DESIGN_REQUESTS=false` hides UC-33, UC-50, part of UC-51, UC-52 and UC-53 (menu, route, card, button); `true` in the demo build.
- [ ] Landing page: "Create account"; demo buttons and demo data reset only in the demo build.
- [ ] Security headers (SPEC §8.1) set and verified (a test or a script that reads the headers from Preview).
- [ ] Code splitting: guest routes don't load the editor, admin or big album; JS for `/i/:token` ≤ 250 KB gzip (measured in CI or by a script).
- [ ] Lighthouse mobile on Preview for `/i/:token`, `/i/:token/upload` and `/w/:slug/galerija`: LCP < 2.5 s, Accessibility ≥ 90.
- [ ] `npm audit --omit=dev`: no high/critical.

### M8 – Hardening and launch

- [ ] All E2E scenarios in §3 pass in CI against the local stack, and manually (or automatically) on Preview.
- [ ] Load test on staging: 200 concurrent upload sessions of 5 photos each (k6 or a Playwright script); no 5xx and no lost photos.
- [ ] Manual QA checklist done on a real iPhone (Safari) and Android (Chrome): invitation, RSVP, upload from the library and the camera, gallery, QR upload, and the slideshow on a TV (desktop Chrome, full screen).
- [ ] Backup and restore tried on staging; the procedure is described in `docs/mvp/RUNBOOK.md` (plus: rotating secrets, running the cron manually, creating a superadmin, what to do when Resend is down).
- [ ] Production: Supabase Pro, Resend domain verified (SPF, DKIM), Google OAuth with the production redirect, Vercel Cron active, first superadmin created.
- [ ] Docs updated: `README.md` (running the monorepo, environments, deploy), `API.md` (post-MVP state), `USE_CASES.txt` (changed UCs, UC-77 – UC-89, SYS-9 – SYS-13, and resolved items removed from "Otvorena pitanja").

---

## 3. Acceptance scenarios (E2E)

Each scenario is one Playwright test (or group) with the same ID in its name. They pass in sr; S1 and S11 also pass in en and ru (with emails in that language).

| ID | Scenario | UC/SYS |
|---|---|---|
| S1 | A visitor signs up, confirms the email from Inbucket, completes onboarding (wedding) and sees the dashboard with "N days until the wedding" | UC-77, UC-81, UC-11 |
| S2 | Same for a celebration ("18. rođendan"): slug `luka-18-rodjendan`, celebration wording, sides Family/Friends/Other | UC-81, SYS-8 |
| S3 | Forgot password → email → new password → sign in with the new one; the old one fails | UC-80 |
| S4 | The organizer adds a guest with named companions, imports a 3-row list, changes the invitation's look and color, saves | UC-17, UC-18, UC-19, UC-27, UC-28, UC-32 |
| S5 | A guest opens the personal link → envelope → invitation with their name → RSVPs yes with 1 companion → leaves an email; the organizer sees the response and "opened" | UC-58 – UC-61, UC-21 |
| S6 | The organizer changes companions for a guest who already responded; the response is trimmed per SYS-5 | UC-24, SYS-5 |
| S7 | A guest sends 3 photos from the personal link (one is oversized and rejected); the organizer sees them pending, approves 2 and hides 1; the big album shows 2 | UC-65, UC-36, UC-46 |
| S8 | QR upload with auto-approve on: photos appear in the album immediately; after QR upload is turned off, the link shows "Uploads are turned off" | UC-66, UC-55, UC-56 |
| S9 | Network drops mid-upload (Playwright offline) → the file is re-sent and no photo is duplicated | UC-65, §7.1 |
| S10 | The organizer downloads all originals as a ZIP; it contains the right number of files with the original bytes | UC-85 |
| S11 | Gallery "manual", opened → "Notify guests" → the email arrives in Inbucket in the guest's language → its link opens the gallery with approved photos; sending again doesn't resend the same email | UC-41, UC-43, UC-68, SYS-4, SYS-13 |
| S12 | The superadmin creates an account (celebration); the organizer signs in without onboarding; the superadmin deactivates it → the organizer is signed out and can't sign in; the guest still sees the invitation | UC-72, UC-75 |
| S13 | The organizer deletes the account; the guest's personal link shows "Invitation not found"; the files no longer exist in Storage | UC-84 |
| S14 | Cron with an injected date: a warning 30 days before (email), then deletion on `purgeAt`; the gallery shows "archived" and the organizer sees "Data was deleted" | SYS-9, SYS-10, UC-89 |
| S15 | Without consent there are no analytics requests; after "Accept" there are; the choice survives a reload | UC-86 |
| S16 | Another organizer tries to read and modify a different event's guests and photos through the API → `403`/`404`, nothing changes | §8.1 |

---

## 4. Final MVP DoD

The MVP is done when **all** of the following hold:

- [ ] Milestones M0 – M8 are done (all items ticked).
- [ ] Scenarios S1 – S16 pass in CI; CI on the branch is green.
- [ ] The coverage thresholds in §1.1 are met.
- [ ] Production runs on Vercel with the production Supabase project; `/api/health` returns `ok`; scenarios S1, S5, S7 and S11 have been walked through manually in production with a real phone and a real email.
- [ ] No open bugs block the main flow (signup → invitation → RSVP → upload → moderation → album → notification).
- [ ] `DECISIONS.md` lists every deviation; no scope-changing deviation lacks the owner's approval.
- [ ] `PROGRESS.md` has a final entry: what shipped, known limitations, and suggestions for the next version (e.g. bringing back custom design, HEIC, payments).
- [ ] The demo build works and can be deployed as a separate site.
