# Uspomena – MVP specification

> Version 1.0 · 22 November 2026 · branch `specs/mvp`

## 0. How to read this document

The prototype (this repo) is a complete frontend running on a **mock backend in `localStorage`**. The MVP turns it into a real system: a real backend and database, real photo storage, real emails and public signup.

Sources of truth, in priority order:

1. **This document**: what changes, is added or is cut compared with the prototype.
2. **`USE_CASES.txt`**: behavior of every existing feature (UC-01 – UC-76, SYS-1 – SYS-8). Anything not changed here works exactly as described there.
3. **`API.md`**: the HTTP contract. Anything not listed in §6 "API contract changes" stays the same (paths, field names, response shapes).
4. **`src/mock/server.js`**: the reference implementation of the business rules (companion validation, RSVP, gallery opening, notifications). The real backend must behave the same way, except for the bugs listed in §6.6.

The Definition of Done and the work order are in [`DOD.md`](DOD.md).

UI terms below are given in Serbian in quotes where they are literal UI copy (the app's default language).

---

## 1. Goal and scope

### 1.1 MVP goal

An organizer (a couple or a person being celebrated) opens an account themselves, builds an invitation, sends personal links to guests, tracks RSVPs, collects photos from guests (personal link and QR code), moderates them, shows the big album at the event and emails guests when the photos are ready. Everything runs in production on Vercel + Supabase, in Serbian, English and Russian.

### 1.2 In scope (MVP)

| Area | What |
|---|---|
| All existing features | UC-01 – UC-76 except the cut ones (§1.3), on a real backend |
| Account | Public signup (email + password), email verification, forgot password, Google sign-in, onboarding wizard, change email and password, delete own account |
| Photos | Direct upload to Supabase Storage; the original is kept; the system generates a thumbnail and a web version; the organizer downloads all originals (ZIP) |
| Email | Real sending via Resend: account emails (verification, reset, email change), "photos are ready", pre-deletion warnings; all in 3 languages |
| Privacy | Privacy policy and terms of use, analytics consent (Vercel Web Analytics), automatic data deletion after the event (default 3 months, changeable per account by the superadmin), account deletion |
| Superadmin | All existing powers (UC-71 – UC-76) plus setting the data retention period |
| Demo | The existing mock build (`npm run build:demo`) stays as a sales demo |

### 1.3 Out of scope (cut from MVP)

| What | Use cases | How |
|---|---|---|
| Custom invitation request | UC-33 | The "Samo vaša / Custom dizajn" card in the editor is hidden |
| Big-album print request | UC-50, second half of UC-51 | The "Uradite ovo za nas" button and the request-status notice are hidden |
| Custom design page | UC-52, UC-53 | Menu item and route `/app/custom-dizajn` hidden; the backend has no `design-requests` endpoints |
| Demo data reset | UC-57 | Demo build only |
| Payments, plans, quotas | – | None; accounts are free, with no limit on guests or photos |
| HEIC conversion, video | – | Not supported (§7.2) |
| Multiple events per account | – | One account = one event |

Cut features are **not deleted from the code**. They are hidden behind the feature flag `VITE_FEATURE_DESIGN_REQUESTS` (default `false`, `true` in the demo build), so the demo can still show them.

---

## 2. Actors and roles

| Actor | Change from the prototype |
|---|---|
| Visitor | Can open an account themselves (UC-77) |
| Organizer (`role: 'couple'`) | Signs up themselves or is created by the superadmin; goes through onboarding first (UC-81) |
| Guest (personal link / QR code) | Unchanged; still no account |
| Superadmin (`role: 'superadmin'`) | Same powers + retention period (UC-88). The first superadmin is created by a script (§8.4); public signup never creates a superadmin |
| System | New jobs: deletion after the retention period, warnings, cleanup of unfinished uploads (SYS-9 – SYS-13) |

---

## 3. Architecture

### 3.1 Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | **Monorepo** in this repo, npm workspaces: `apps/web` (current frontend), `apps/api` (backend), `packages/shared` (shared rules and types) | One branch and one PR; the agent sees the whole system |
| D2 | **Node 22 + TypeScript (strict)**, HTTP framework **Hono**, validation **Zod** | Same language as the frontend; Hono runs natively on Vercel and is easy to test (`app.request()`) |
| D3 | **Supabase Postgres**, ORM **Drizzle** + `drizzle-kit` SQL migrations, driver `postgres` through the Supabase pooler (transaction mode, `prepare: false`) | Serverless-friendly; migrations are plain SQL files in the repo |
| D4 | **Supabase Auth** for identity: email + password, verification, reset, Google OAuth. Our API verifies the Supabase JWT and reads the profile from our `profiles` table | Verification, reset and OAuth come ready-made and secure; we don't write our own password hashing or OAuth |
| D5 | **Supabase Storage**, private bucket `photos`. Guests upload files **directly to Storage** via a signed upload URL; the API only issues the URL and records metadata | A Vercel function accepts at most ~4.5 MB per request, and phone photos are often larger |
| D6 | **sharp** generates `thumb` (400 px) and `web` (1600 px) JPEG versions after upload | Gallery, wall and slideshow must be fast on mobile |
| D7 | **Resend** sends all email; templates in **React Email**, sr/en/ru. Account emails go through the Supabase **Send Email Hook** to our API | Supabase templates are single-language; the hook gives us emails in the user's language |
| D8 | **Vercel**, one project: static frontend + API as a Node function at `/api/*` (same origin, no CORS). **Vercel Cron** for daily jobs | One deploy, a preview per PR |
| D9 | For development and CI: **Supabase CLI** (`supabase start`) runs local Postgres + Auth + Storage | Integration and E2E tests run against real services, not mocks |
| D10 | The `API.md` contract stays: paths `/weddings/...`, camelCase field names. The DB table is called `events`, but the API and frontend still say "wedding" | Minimal frontend changes |

Before configuring anything, the agent checks current docs for Vercel (monorepo, Node functions, Cron), Supabase (Auth hooks, Storage signed upload URLs, CLI) and Resend. If something here no longer works as described, it records the deviation in `docs/mvp/DECISIONS.md` (§11) and picks the closest solution.

### 3.2 Repo layout

```
apps/
  web/                    ← current src/, index.html, vite.config.js (moved)
    src/app/config/auth.js   ← NEW: auth client (supabase | mock)
  api/
    src/
      app.ts              ← Hono app (all routes)
      routes/             ← auth, onboarding, admin, weddings, guests, photos, notifications, public, hooks, cron
      db/schema.ts        ← Drizzle schema
      db/migrations/      ← SQL migrations
      services/           ← storage, images (sharp), email (Resend), retention, rateLimit
      emails/             ← React Email templates (sr/en/ru)
    test/                 ← integration tests
packages/
  shared/                 ← enums, rules (gallery, companions, RSVP, phone, slug), error messages sr/en/ru, Zod schemas
api/
  [...route].ts           ← Vercel entry that mounts apps/api (exact form per current Vercel docs)
e2e/                      ← Playwright tests
supabase/                 ← config.toml for the Supabase CLI (local stack)
docs/mvp/                 ← this specification
```

`packages/shared` receives code that currently lives in two places: `src/utils/gallery.js`, `src/utils/phone.js` (minus the i18n part), `slugFor` and `parseCompanions`/`parseRsvp` from `src/mock/server.js`, the enums from `src/app/config/enums.js` and the messages from `src/mock/messages.js`. The mock, the real backend and the frontend all use the same code.

### 3.3 Request flow

```
Browser (apps/web)
  ├─ auth: supabase-js (sign-in, signup, Google, reset)       ──►  Supabase Auth
  ├─ API:  axiosInstance  Bearer <Supabase access token>      ──►  /api/* (Hono on Vercel)
  │                                                                   ├─ Postgres (Drizzle, service role)
  │                                                                   ├─ Storage (signed URLs, sharp)
  │                                                                   └─ Resend (email)
  └─ upload: PUT the file directly to the signed upload URL   ──►  Supabase Storage
Supabase Auth ── Send Email Hook ──► /api/hooks/auth-email ──► Resend
Vercel Cron  ──────────────────────► /api/cron/daily
```

The frontend never reads the database directly. All data goes through our API; the Supabase client on the frontend is used only for auth.

### 3.4 Environments

| Environment | Frontend + API | Supabase | Email |
|---|---|---|---|
| Local | `npm run dev` (Vite + API) | `supabase start` | Inbucket from the Supabase CLI, or a Resend test key |
| Preview (every PR) | Vercel Preview | separate **staging** Supabase project | Resend, allow-listed test addresses only |
| Production | Vercel Production | **production** Supabase project (Pro plan: daily backups, no pausing) | Resend, verified domain |
| Demo | `npm run build:demo` (mock, no API) | – | – |

Environment variables are documented in `.env.example` (per app). Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `SUPABASE_AUTH_HOOK_SECRET`) never go into the frontend or into git.

---

## 4. Data model

All tables have **RLS enabled with no policies** (anon and authenticated have no access); only the API accesses them, via the service role. Timestamps are `timestamptz` (UTC); event dates are `date`. Date-based business logic uses the **Europe/Belgrade** zone.

```
profiles
  id                uuid PK  = auth.users.id
  role              enum('superadmin','couple')  default 'couple'
  email             text unique (copy from auth, kept in sync)
  name              text
  phone             text  (E.164; required after onboarding)
  locale            enum('sr','en','ru') default 'sr'
  active            bool default true
  tokens_valid_after timestamptz null   ← JWTs issued before this are rejected (deactivation, new password)
  onboarded_at      timestamptz null
  created_at, last_login_at

events                                  ← "Wedding" in the API
  id                uuid PK
  owner_id          uuid FK profiles  UNIQUE (one event per account), ON DELETE CASCADE
  type              enum('wedding','celebration')
  occasion          text default ''
  slug              text UNIQUE  ^[a-z0-9-]{3,40}$
  partner1, partner2 text
  date              date
  rsvp_deadline     date null
  city              text default ''
  invitation        jsonb  { templateId, accentColor, headline, message, schedule[] }
  settings          jsonb  { autoApprovePhotos, allowGeneralUpload, galleryOpen, galleryManualOpen, galleryViaQr }
  retention_months  int default env RETENTION_MONTHS_DEFAULT (3), CHECK 1..60
  purge_warned_30_at, purge_warned_7_at  timestamptz null
  purged_at         timestamptz null
  created_at, updated_at

guests
  id uuid PK, event_id FK events ON DELETE CASCADE
  name, email, phone text
  token             text UNIQUE (12 chars, base62, crypto RNG)
  side              enum('mlada','mladozenja','zajednicki')
  companions        jsonb { type, max, names[] }
  max_persons       int
  invited_at, opened_at
  rsvp_status       enum('pending','yes','no'), rsvp_persons int, rsvp_companions text[], rsvp_note text, responded_at
  notify_email      text, notify_locale enum, notify_requested_at, notify_sent_at

photo_subscribers                        ← emails left via the QR link
  id, event_id FK CASCADE, email, name, locale, created_at, sent_at
  UNIQUE(event_id, email)

photos
  id uuid PK, event_id FK CASCADE, guest_id FK guests ON DELETE SET NULL
  sender_name, category enum('memories','wedding'), message
  status            enum('uploading','pending','approved','hidden')
  upload_key_hash   text   ← hash of a secret only the uploader receives (for "complete")
  original_path, web_path, thumb_path  text
  mime, size_bytes, width, height
  created_at, uploaded_at

email_log
  id, event_id null, profile_id null, kind, to_email, locale, provider_id, status('sent','failed'), error, created_at

rate_limits
  key text, window_start timestamptz, count int, PK(key, window_start)
```

Notes:

- `photos.status = 'uploading'` is **never** returned to the frontend, never counted in stats and never shown in the gallery or album.
- No `design_requests` table is created (out of scope).
- Deleting a guest keeps their photos (`guest_id = null`), as in UC-25.
- `Guest` and `Wedding` responses keep the shape from `API.md`; the API maps columns to JSON.

---

## 5. Functional requirements

### 5.1 Existing features

Every feature in `USE_CASES.txt` that isn't cut (§1.3) must work on the real backend **exactly as in the prototype**: same copy, same errors, same rules (SYS-1 – SYS-8). Differences:

| UC | Change |
|---|---|
| UC-01 | The landing page gets a **"Napravi nalog"** (Create account) button leading to UC-77. "Isprobaj demo" and "Pogledaj kao gost" appear only in the demo build |
| UC-02, UC-03 | Demo build only |
| UC-04 | An account is created by signup (UC-77) + onboarding (UC-81), **or** by the superadmin (UC-72). Default event settings are unchanged |
| UC-05 | Sign-in through Supabase Auth (email + password or Google). Same redirect rules; unfinished onboarding → `/onboarding`; unverified email → message + "Pošalji ponovo" (resend, UC-78). Demo buttons only in the demo build |
| UC-06 | supabase-js keeps the session (token refresh); `GET /auth/me` on load |
| UC-07 | Phone is collected in onboarding; the modal stays for accounts without a number |
| UC-08 | No link from design requests (cut) |
| UC-09 | Sign-out through supabase-js + clearing Redux state |
| UC-14, UC-34 – UC-38 | Grids show `thumbUrl`; the enlarged view shows `url` (web version) |
| UC-39 | Deleting also removes all three files from Storage |
| UC-43 | The email is **actually sent** (Resend); `sentAt` is set only for recipients where sending succeeded |
| UC-46 – UC-49 | Polaroids use `thumbUrl` (S/M) and `url` (L, slideshow) |
| UC-65, UC-66 | New upload flow (§7.1): progress and retry per file. Photos are not downscaled in the browser; the original arrives untouched |
| UC-72 | The superadmin also creates the Supabase Auth user (email already verified); event and profile are ready immediately, with no onboarding |
| UC-74 | The new password is set via the Supabase admin API; all sessions stop working (`tokens_valid_after`) |
| UC-75 | Deactivation: `active=false`, `tokens_valid_after=now()` and a ban in Supabase Auth, so the user can neither refresh a token nor sign in |
| UC-76 | Also deletes the Supabase Auth user and all of the event's files in Storage |

### 5.2 New use cases

Same format as `USE_CASES.txt`. The agent adds them to `USE_CASES.txt` (new area "M. Nalog i privatnost") and updates the "Na prvi pogled" table.

**UC-77 Signup.** On `/registracija` the visitor enters an email and password (at least 8 characters) and ticks "I accept the terms of use and privacy policy" (required, with links). Clicking "Napravi nalog" shows a "Check your email" screen with the address. The confirmation email arrives in the language chosen in the UI.
*Errors:* invalid email, short password, terms not accepted → message under the field. An email that already exists → the **same** "Check your email" message (we don't reveal that the account exists).
*Result:* clicking the email link signs the user in and goes to `/onboarding`. The profile's `locale` is taken from the UI.

**UC-78 Resend confirmation.** A user with an unconfirmed email tries to sign in → "Confirm your email before signing in" and a "Pošalji ponovo" button (re-enabled after 60 s). The same button is on the "Check your email" screen.

**UC-79 Google sign-in.** A "Continue with Google" button on sign-in and signup. First time → the profile is created automatically, then onboarding. If an account with the same (confirmed) email already exists, Google is linked to that account. Google users accept the terms on the first onboarding step.

**UC-80 Forgot password.** "Forgot your password?" on sign-in → `/zaboravljena-lozinka` → enter email → always the same message "If the account exists, we sent a link". The link opens `/nova-lozinka`, where the new password is entered twice. After saving, the user is signed in and other sessions stop working.
*Errors:* expired link → message and a button for a new link.

**UC-81 Onboarding.** A signed-in organizer without an event sees the wizard on `/onboarding`; every route under `/app` leads here until it's done:
1. Type: Wedding or Celebration (+ terms for Google users).
2. Names: bride and groom, or the celebrant and occasion name (optional); event date.
3. Contact: phone number (required; same validation and display as UC-08) and city (optional).
"Finish" creates the event with the default settings from UC-04, a slug built by the rules in "Svadba i proslava", and the opening line in the UI language. It goes to the dashboard with a "Welcome" message.
*Errors:* same rules and messages as UC-72. "Back" keeps entered data. Sign-out is possible at every step.

**UC-82 Change email.** Settings → Account → "Change email" → new address → confirmation email to the **new** address and a notice to the old one. Until confirmed, the old email stays valid; the UI shows "Awaiting confirmation: <new address>".
*Errors:* email taken, invalid email.

**UC-83 Change password.** Settings → Account → current password + new password (twice). Wrong current password → error. Other sessions stop working. A user signed in only through Google sees "Set password", which sends the UC-80 email.

**UC-84 Delete account.** Settings → "Delete account" → a dialog explains what will be deleted (account, event, guests, photos, emails) and that it cannot be undone, and suggests downloading photos first (UC-85). The user types their event's address (slug) and confirms. Everything is deleted immediately (as in UC-76); the user is signed out and gets a confirmation email. The superadmin cannot delete themselves this way.

**UC-85 Download originals.** Photos → "Download all" → choose "Approved" or "All" → the browser builds a ZIP on the fly (streaming, without holding everything in memory) from the originals via signed URLs, with "N / M" progress. File names: `<sender>_<date>_<id>.<ext>`. The enlarged view has "Download original" for a single photo.
*Errors:* a single photo that fails after 3 attempts is skipped, and the end screen lists what wasn't downloaded.
*Note:* this wasn't picked as a separate feature, but it is mandatory because of auto-deletion (SYS-9). Without it, organizers lose their photos after 3 months.

**UC-86 Analytics consent.** On the first visit to any page (guest pages included) a bar appears at the bottom: "We use anonymous, cookieless visit analytics to improve the site." with "Accept", "Decline" and a link to the privacy policy. Vercel Web Analytics loads **only after "Accept"**. The choice is stored in the browser; a "Privacy settings" link in the footer changes it.

**UC-87 Legal pages.** `/privatnost` and `/uslovi`, in 3 languages. Linked from signup, onboarding (Google), the landing page footer and guest page footers, and the upload page ("By sending photos you accept the [terms]"). The content is a **draft** the agent writes from a template (who the controller is, which data, purpose, retention per SYS-9, processors: Supabase, Vercel, Resend, user rights under ZZPL/GDPR, contact), clearly marked "DRAFT – pending legal review" in the code (not on the page).

**UC-88 Retention period (superadmin).** The account edit dialog gets a field "Keep data after the event (months)", 1–60, default 3. The accounts table gets a "Deleted on" column with the date (or "Deleted <date>").

**UC-89 Deletion warning (organizer).** Settings always show "Photos and guests are deleted automatically on <date>." From 30 days before that date, the dashboard shows a bar "Data will be deleted on <date>. Download your photos." with a button leading to UC-85.

### 5.3 New system rules

| # | Rule |
|---|---|
| SYS-9 | **Auto-deletion.** `purgeAt = date + retention_months` (Europe/Belgrade). On `purgeAt` the daily cron deletes all of the event's files from Storage plus its photos, guests, QR subscribers and `email_log` rows, and sets `purged_at`. The account and event (names, date, invitation) remain. Personal links, QR upload and the gallery then show "This event has been archived". The organizer sees an empty app with the bar "Data was deleted on <date>" and cannot add guests or photos. If the event date or retention period changes, `purgeAt` is recalculated, and warnings reset if the new date is later |
| SYS-10 | **Email warnings** to the organizer 30 and 7 days before `purgeAt`, each at most once (`purge_warned_*_at`), with a link to the download |
| SYS-11 | **Unfinished uploads:** photos in `uploading` older than 24 h are deleted (row and file) by the daily cron |
| SYS-12 | **Rate limiting** (§8.2). Exceeding it → `429` with the localized message "Too many attempts, please try again shortly." |
| SYS-13 | **Email language:** account emails use `profiles.locale` (set at signup and updated when a signed-in user switches language). The "photos are ready" email uses the language the guest had when leaving their email (`notify_locale`) |
| SYS-1 (addition) | Errors also carry a stable code: `{ "message": "...", "code": "invalidEmail" }`. Codes are the message keys from `packages/shared` |

---

## 6. API contract changes (relative to `API.md`)

Everything else in `API.md` still applies. At the end, the agent updates `API.md` to describe the post-MVP state.

### 6.1 Auth and profile

| Method | Path | Change |
|---|---|---|
| POST | `/auth/login` | **Removed.** Sign-in, signup, Google, reset and email/password change go through supabase-js directly to Supabase Auth |
| GET | `/auth/me` | Authorization: `Bearer <Supabase access token>`. The API verifies the signature (JWKS or the project JWT secret), `exp`, `iat >= tokens_valid_after` and `active`. If no profile exists, it creates one (`role: 'couple'`). Response `{ user: User }`; `User` gains `onboarded: bool`, `emailVerified: bool`, `providers: string[]`, `locale` |
| PATCH | `/auth/me` | Adds `locale`. Otherwise unchanged |
| DELETE | `/auth/me` | **New** (UC-84). Body `{ confirmSlug }`; must match the event slug, otherwise `422`. Deletes everything; superadmin → `403` |
| POST | `/onboarding` | **New** (UC-81). Body `{ type, partner1, partner2?, occasion?, date, phone, city? }`. Validation as in `POST /admin/accounts`. Event already exists → `409`. Response `{ user, wedding }` |

For a user without finished onboarding, every route under `/weddings`, `/guests` and `/photos` returns `409 { code: 'onboardingRequired' }`.

### 6.2 Superadmin

- `POST /admin/accounts`: creates the Supabase Auth user (`email_confirm: true`) + profile + event. Otherwise unchanged.
- `PATCH /admin/accounts/:id`: also accepts `retentionMonths` (1–60). Changing the email also changes it in Supabase Auth.
- `AdminAccount` gains `onboarded`, `providers`, `wedding.retentionMonths`, `wedding.purgeAt`, `wedding.purgedAt`. The list includes accounts that haven't finished onboarding (`wedding: null`).

### 6.3 Photos: new upload flow

`POST /public/invitations/:token/photos` and `POST /public/weddings/:slug/photos` (multipart) **are removed**. They are replaced by:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/public/invitations/:token/uploads` | `{ category, senderName, message, files: [{ name, type, size }] }` | `{ uploads: [{ photoId, uploadUrl, uploadKey }] }` |
| POST | `/public/weddings/:slug/uploads` | same | same; `403` if `allowGeneralUpload=false` |
| PUT | `uploadUrl` (Supabase Storage) | raw file | – (the client sends it directly, with progress) |
| POST | `/public/uploads/:photoId/complete` | `{ uploadKey }` | `{ id, status }`: checks the file exists, reads dimensions, generates `thumb` and `web`, sets `pending`/`approved` per SYS-2 |

Rules: 1–50 files per request; `type` must be `image/jpeg`, `image/png` or `image/webp`; `size` ≤ 30 MB (`MAX_UPLOAD_MB`). An invalid file → `422` with the file name. `uploadKey` is a random secret (32 bytes) stored only as a hash; a wrong key → `404`. A signed upload URL is valid for 2 h. Calling `complete` again for an already processed photo returns the same result (idempotent). A file sharp can't read → the photo is deleted and the response is `422 { code: 'notImage' }`.

`Photo` gains `thumbUrl`, `url` (web version), `width` and `height`. The list has no `originalUrl`. URLs are **signed** and valid for 1 h; the frontend doesn't cache them longer. The same applies to `PublicGallery.photos[]`.

| Method | Path | Response |
|---|---|---|
| GET | `/weddings/:id/photos/originals?status=approved\|all` | `[{ id, filename, url, size }]`: signed original URLs (valid 1 h) for UC-85 |

### 6.4 Notifications

`POST /weddings/:id/photo-notifications` actually sends the emails (Resend batch, at most 100 per call to Resend). Response: `{ sent, failed, sentAt, guestIds, subscriberIds }`; `guestIds`/`subscriberIds` contain only successful ones. Failed recipients stay "Čeka" (waiting) and can be retried. Every send is written to `email_log`. Two concurrent calls must not send the same email twice (row lock, or `UPDATE … WHERE sent_at IS NULL RETURNING`).

### 6.5 New system endpoints

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/hooks/auth-email` | Supabase hook signature (Standard Webhooks, `SUPABASE_AUTH_HOOK_SECRET`) | Sends account emails (signup, recovery, email_change, and magic link if Supabase sends one) via Resend in the user's `locale` |
| GET | `/cron/daily` | `Authorization: Bearer CRON_SECRET` | SYS-9, SYS-10, SYS-11, `rate_limits` cleanup. Idempotent; safe to run several times a day |
| GET | `/health` | public | `{ ok, version, db: 'ok' }` |
| – | `design-requests` | – | Don't exist in the real backend (mock only) |
| – | `/__mock/reset` | – | Mock only |

### 6.6 Prototype bugs the real backend must fix

1. In the mock, `POST /weddings/:id/photos/bulk-status` changes photos without checking ownership. The real backend changes **only** that event's photos; foreign IDs are silently skipped.
2. `PATCH /weddings/:id` doesn't check `slug` uniqueness. A taken slug → `422 badSlug`.
3. `PATCH /weddings/:id` doesn't validate `invitation.templateId` (must be one of the 11 in `templates/index.js`), `accentColor` (`#RRGGBB`), `schedule` (at most 20 items, `time` as `HH:mm`) or `settings` (known fields only, correct types).
4. `API.md` lists only 4 `templateId`s; the 11 in the code apply (`klasik, minimal, botanika, romantika, editorijal, noc, rustik, akvarel, zlatna-geometrija, boho, bordo`).
5. `isGalleryOpen` compares the date in the browser's local zone; the backend computes it in Europe/Belgrade.
6. Guest import doesn't validate `side` or `phone`. The backend normalizes the phone (leaving it empty if invalid) and turns an unknown `side` into `zajednicki`. At most 1000 rows per import.
7. All string inputs get a maximum length (name 120, message/note 1000, headline 200, invitation message 2000).

---

## 7. Photos: details

### 7.1 Upload (frontend)

1. The guest picks photos (same UI as now). Files that aren't JPEG/PNG/WebP or are larger than 30 MB are rejected immediately, with a message.
2. `POST …/uploads` for all picked files.
3. Files are sent in parallel (at most 3 at a time) by PUT to `uploadUrl`; each has its own progress, and total progress is the sum.
4. After each file, `POST /public/uploads/:id/complete`.
5. If a file fails: up to 3 automatic retries with backoff, then "Not sent – Try again" for that file only. The thank-you screen (UC-65) appears once all files are done or skipped; its count is the number of successful uploads.
6. While uploading, closing the tab asks for confirmation (`beforeunload`).

iPhone: Safari sends JPEG instead of HEIC when picking from the photo library. If a HEIC file still arrives, the guest is told that photo isn't supported.

### 7.2 Processing (backend)

- `original_path`: `events/{eventId}/original/{photoId}.{ext}`, never modified.
- `web_path`: `events/{eventId}/web/{photoId}.jpg`, long side 1600 px, JPEG q80, rotated per EXIF, **EXIF/GPS stripped**.
- `thumb_path`: `events/{eventId}/thumb/{photoId}.jpg`, 400 px, q75, same treatment.
- Processing one photo must fit within the Vercel function duration limit; that's why `complete` is called per photo.
- Deleting a photo, an account or an event (SYS-9) also deletes the files; deleting a guest doesn't delete their photos. Storage deletes are batched.

### 7.3 Display

Grids (dashboard, Photos, gallery, wall S/M, per guest) use `thumbUrl`; the enlarged view, wall L and the slideshow use `url`. Images have `loading="lazy"`, `width`/`height` (no layout shift) and `decoding="async"`. When a signed URL expires (an image fails to load), the page reloads the list.

---

## 8. Non-functional requirements

### 8.1 Security

- Every protected route checks both **role** and **ownership** (the event belongs to the user). Every route has a test that another user gets `403`/`404`.
- Guest token: 12 base62 characters from a cryptographic RNG; never logged.
- The Supabase `service_role` key exists only in the API. The `photos` bucket is private.
- Security headers on all responses (Vercel config): `Content-Security-Policy` (self + Supabase + Vercel analytics domains), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera allowed for self only).
- Passwords: at least 8 characters (Supabase setting), plus a leaked-password check if the plan supports it.
- Logs are structured (JSON, `requestId`) and contain no passwords, tokens, guest tokens or message contents.
- `npm audit --omit=dev` shows no high/critical vulnerabilities at release.

### 8.2 Rate limiting (SYS-12)

A fixed window in the `rate_limits` table (no new service). Key = route + IP (plus token where there is one):

| Route | Limit |
|---|---|
| `POST …/uploads` | 20 / 10 min per token, or per slug+IP |
| `POST …/rsvp`, `…/notify` | 30 / 10 min per IP |
| `GET /public/*` | 300 / min per IP |
| `POST /onboarding`, `PATCH /auth/me` | 30 / 10 min per user |
| Supabase Auth (sign-in, signup, reset) | Supabase built-in limits, configured in `supabase/config.toml` |

Values live in env. On the wedding day, 150+ guests on the same Wi-Fi share an IP, which is why upload limits are per token/slug and not only per IP.

### 8.3 Performance and scale

Target scale per event: up to 500 guests, up to 5000 photos, up to 200 guests uploading at the same time.

- Guest pages (`/i/*`, `/w/*`): LCP < 2.5 s on a mid-range Android phone over 4G (Lighthouse mobile profile). JS for those routes ≤ 250 KB gzip, via route-level code splitting: the editor, admin and big album never load for guests.
- API p95 < 300 ms for everything except `complete` (p95 < 5 s for a 12 MP photo).
- A list of 5000 photos: `GET /weddings/:id/photos` < 1.5 s (URLs signed in batches).

### 8.4 Operations

- Migrations are applied in CI/CD before deploy (`drizzle-kit migrate`); forward-only, no manual DB edits.
- `npm run admin:create -- --email … --password …` creates a superadmin in the chosen environment.
- `/health` for uptime checks; 5xx errors are visible in Vercel logs.
- Backups: the production Supabase project is on the Pro plan (daily backups). The restore procedure is tried once on staging and documented in `docs/mvp/RUNBOOK.md`.

### 8.5 Accessibility, browsers, languages

- WCAG 2.1 AA for forms on guest pages and signup (labels, focus, contrast, keyboard).
- Support: last 2 versions of Safari iOS and Chrome Android, plus desktop Chrome, Firefox, Safari and Edge.
- Every new string in the UI and in emails exists in sr, en and ru (and in `celebration/` where the celebration wording differs). The plural rules in the README apply.

---

## 9. Frontend: list of changes

1. Move to `apps/web`; build and dev work from the root (`npm run dev` starts web + API).
2. `src/app/config/auth.js`: an interface `signUp, signIn, signInWithGoogle, signOut, resendConfirmation, requestPasswordReset, updatePassword, updateEmail, getAccessToken, onAuthChange`, with a Supabase implementation and a mock one (demo). `axiosInstance` gets its token from `getAccessToken()`.
3. New routes: `/registracija`, `/potvrda-emaila` (check your email), `/auth/callback`, `/zaboravljena-lozinka`, `/nova-lozinka`, `/onboarding`, `/privatnost`, `/uslovi`. Guest routes gain the archived state (SYS-9).
4. Login: Google button, "Forgot your password?", link to signup; demo buttons only in mock mode.
5. Settings: an "Account" section (email, password, phone, language), "Data retention" (UC-89) and "Delete account" (UC-84); "Demo mode" only in mock mode.
6. Photos: "Download all" (UC-85), `thumbUrl`/`url`.
7. Upload page: new flow (§7.1) and a link to the terms.
8. Admin: retention field, "Deleted on" column, display of accounts without onboarding.
9. Consent bar + Vercel Web Analytics (UC-86); footer with legal links.
10. The feature flag `VITE_FEATURE_DESIGN_REQUESTS` hides everything in §1.3.
11. The mock (`src/mock`) is updated to the new contract (upload flow, `/auth/me`, onboarding, `/photos/originals`), so the demo build does everything production does except real emails and Google sign-in.

---

## 10. Open questions (non-blocking; the default is listed)

| # | Question | Default until the owner decides |
|---|---|---|
| Q1 | Domain and sender address for emails | `uspomena.rs`, `Uspomena <noreply@uspomena.rs>`; the agent uses env variables `APP_URL`, `EMAIL_FROM` |
| Q2 | Is the phone number still required now that custom design is cut? | Stays required (UC-07) |
| Q3 | Text of the privacy policy and terms | Draft (UC-87), pending legal review before public launch |
| Q4 | A 3-month retention is short for guests who open the gallery late | Stays 3; the superadmin extends it per account |
| Q5 | After SYS-9, can the organizer create a new event? | Not in the MVP (one event per account); they can delete the account and sign up again |

---

## 11. Deviations

If the agent has to deviate from this specification (a service doesn't work as described, a rule conflicts with `USE_CASES.txt`, something is impossible), it **does not silently change the spec**. It records in `docs/mvp/DECISIONS.md`: the date, what, why, what was chosen instead and which UCs/requirements are affected. A deviation that changes scope (adds or removes a feature) waits for the owner's approval.
