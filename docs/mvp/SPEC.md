# Uspomena – MVP specification

> Version 1.5 · 22 November 2026 · branch `specs/mvp`
>
> Architecture and feasibility review incorporated; see [`DECISIONS.md`](DECISIONS.md).

## 0. How to read this document

The prototype (this repo) is a complete React + Vite frontend running on a **mock backend in `localStorage`**. The MVP turns it into a real system: a real backend and database, real photo storage, real emails and public signup.

The **product is a new Next.js app** (`apps/web`) that ports the prototype's screens, styles, templates and translations. The **Vite prototype stays as the demo** (`apps/demo`), frozen as it is now. It is the design and behavior reference for the port, and it isn't updated with MVP features.

Sources of truth, in priority order:

1. **This document**: what changes, is added or is cut compared with the prototype.
2. **`USE_CASES.txt`**: behavior of every existing feature (UC-01 – UC-76, SYS-1 – SYS-8). Anything not changed here works exactly as described there.
3. **`API.md`**: the HTTP contract. Anything not listed in §6 "API contract changes" stays the same (paths, field names, response shapes).
4. **The demo app (`apps/demo`, today's `src/`)**: the reference for look and interaction. Ported screens must look and behave the same unless this document says otherwise.
5. **`src/mock/server.js`** (`apps/demo/src/mock/server.js` after the move): the reference implementation of the business rules (companion validation, RSVP, gallery opening, notifications). The real backend must behave the same way, except for the bugs listed in §6.6.

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
| Superadmin | All existing powers (UC-71 – UC-76) plus per-account data retention and storage limits |
| Demo | The existing Vite prototype moves to `apps/demo`, unchanged, and stays as a sales demo on the mock backend (`npm run build:demo`) |

### 1.3 Out of scope (cut from MVP)

| What | Use cases | How |
|---|---|---|
| Custom invitation request | UC-33 | The "Samo vaša / Custom dizajn" card isn't ported to the editor |
| Big-album print request | UC-50, second half of UC-51 | The "Uradite ovo za nas" button and the request-status notice aren't ported |
| Custom design page | UC-52, UC-53 | Menu item and route `/app/custom-dizajn` aren't ported; the backend has no `design-requests` endpoints |
| Demo data reset | UC-57 | Demo only |
| Payments and commercial plans | – | None; accounts are free. Technical storage/abuse ceilings are still required (§8.2) and are not pricing tiers |
| HEIC conversion, video | – | Not supported (§7.2) |
| Multiple events per account | – | One account = one event |

Cut features stay in the demo app, so the demo can still show them. They're not ported to the product, so it needs no feature flag. Bringing them back later means porting them from the demo.

### 1.4 Scope assessment

This is a **production rebuild of an existing feature set**, not a small greenfield MVP: framework migration, public auth, all retained organizer/guest/admin features, photo processing, email, privacy and operations are substantial. The milestones must therefore prove a vertical, fully local skeleton before the full port; a large batch rewrite is not acceptable. Cloud integration is verified in M7/M8. If schedule pressure requires a smaller first release, candidates such as Google sign-in, the number of invitation templates or slideshow modes need an explicit owner decision and a SPEC/DoD update—they are not silently cut by the implementation agent.

---

## 2. Actors and roles

| Actor | Change from the prototype |
|---|---|
| Visitor | Can open an account themselves (UC-77) |
| Organizer (`role: 'couple'`) | Signs up themselves or is created by the superadmin; goes through onboarding first (UC-81) |
| Guest (personal link / QR code) | Unchanged; still no account |
| Superadmin (`role: 'superadmin'`) | Same powers + retention period and per-event storage limit (UC-88). The first superadmin is created by a script (§8.4); public signup never creates a superadmin |
| System | New jobs: deletion after the retention period, warnings, cleanup of unfinished uploads (SYS-9 – SYS-13) |

---

## 3. Architecture

### 3.1 Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | **Monorepo** in this repo, npm workspaces: `apps/web` (Next.js product), `apps/demo` (today's Vite prototype, frozen), `packages/api` (backend), `packages/shared` (shared rules and types) | Atomic contract/type changes and shared tooling; one implementation branch with task-scoped commits and **one consolidated PR after M8**, not one giant session/commit |
| D2 | **Node 24 LTS or the newest Vercel-supported active LTS**, with the major pinned in `.nvmrc`/`package.json`; TypeScript (strict) everywhere except the demo. Backend HTTP framework **Hono**, validation **Zod**. The Hono app lives in `packages/api` and is **mounted inside Next.js** at `app/api/[[...route]]/route.ts` (Node runtime) | Reproducible runtime; the `API.md` contract stays a self-contained, framework-independent unit that's easy to test (`app.request()`). One deploy, same origin |
| D11 | **Next.js (current stable at implementation, locked in the lockfile, App Router)** for the product frontend. Server components render the **guest pages** (`/i/*`, `/w/*`) and public pages (landing, legal). Initial data is loaded by calling the API's service layer directly, with no HTTP round trip. Interactive parts (envelope, RSVP, upload, gallery lightbox) and the **whole organizer and admin app** are client components | Faster first load for guests on mobile and proper link previews when invitations are shared on WhatsApp/Viber. The organizer app is behind login and needs no server rendering |
| D12 | The organizer and admin app keeps **Redux Toolkit + axios**: slices, thunks and API modules are ported from the demo, with a client `StoreProvider` per session | Same behavior as the prototype (optimistic updates, error toasts, 401 → sign-out) with the least rewriting |
| D13 | **i18n stays on i18next** with the existing JSON files (`sr`, `en`, `ru` plus the `celebration/` overlays). The language is stored in a **`lang` cookie** (not `localStorage`), so server-rendered pages come out in the right language. URLs have no locale prefix and keep the prototype's paths. Server rendering creates an i18next instance **per request**; the demo's mutable singleton and `setEventType` must not be shared between requests | Reuses translations and plural rules without leaking language or event type between users |
| D14 | Styles: the prototype's `theme.css` and fonts are ported as global CSS. **No redesign** and no switch to another CSS framework | Visual parity with the demo |
| D3 | **Supabase Postgres**, ORM **Drizzle** + `drizzle-kit` SQL migrations, driver `postgres` through the Supabase pooler (transaction mode, `prepare: false`) for runtime requests; migrations use a direct/session connection | Serverless-friendly runtime and reliable migrations; migrations are plain SQL files in the repo |
| D4 | **Supabase Auth** for identity: email + password, verification, reset, Google OAuth. Our API verifies the Supabase JWT and reads the profile from our `profiles` table | Verification, reset and OAuth come ready-made and secure; we don't write our own password hashing or OAuth |
| D5 | **Supabase Storage**, private bucket `photos`. Guests upload files **directly to Storage** via a signed upload URL; the API only issues the URL and records metadata | A Vercel function accepts at most ~4.5 MB per request, and phone photos are often larger |
| D6 | **sharp** generates `thumb` (400 px) and `web` (1600 px) JPEG versions after upload | Gallery, wall and slideshow must be fast on mobile |
| D7 | **Resend** sends production email; templates in **React Email**, sr/en/ru. Account emails go through the Supabase **Send Email Hook** to our API. Locally, the same `EmailSender` interface uses SMTP to Inbucket | Local development and E2E need no Resend account; the hook gives us localized emails in every environment |
| D8 | **Vercel**, one project for the product (`apps/web`, with the API inside it at `/api/*`, same origin, no CORS). **Vercel Cron** for daily jobs. The demo is deployed separately as a static site (its existing Dockerfile, or a second Vercel project) | One product deploy, a preview per PR |
| D9 | For development and CI: **Supabase CLI** (`supabase start`) runs local Postgres + Auth + Storage + Inbucket. M0–M6 require no hosted Supabase, Vercel, Resend, Google or analytics account | The agent and developer can implement and test the complete core product locally against real DB/Auth/Storage services, not mocks |
| D10 | The `API.md` contract stays where practical: paths `/weddings/...`, camelCase field names. The DB table is called `events`, but the API and frontend still say "wedding". Photo lists become paginated (§6.3), which is a deliberate contract change | Most ported Redux/API code remains recognizable without compromising performance at 5000 photos |
| D15 | **Next.js and Hono are complementary, not alternatives.** Next.js owns HTML rendering, metadata and browser auth cookies; Hono owns the JSON/HTTP API. Start with Hono mounted in one Next Node-runtime catch-all, not a separately deployed backend | Server-rendered guest pages and portable `app.request()` API tests without another service, CORS or deployment |
| D16 | **Local-first bootstrap, deterministic seeds and local observability.** Pino structured logs, Prometheus metrics and a provisioned Grafana dashboard are required; see [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) | A fresh clone is workable without cloud credentials, and failures are diagnosable through correlated logs and metrics |
| D17 | **Tester-exportable diagnostic reports.** Browser actions and API/service work share a W3C `traceparent` trace ID; local traces/logs can be exported as one sanitized JSON support bundle. Every handled error shows/copies its trace and request IDs | A tester can attach one file that reconstructs the failing action instead of saying only "it doesn't work" |

**Alternatives considered.** A Vite SPA + standalone Hono API has the lowest porting cost, but would still need an SSR/prerender solution for guest HTML and reliable WhatsApp/Viber metadata. Next route handlers without Hono are also viable and are the first fallback if the catch-all adapter fails, at the cost of losing the single framework-independent API entry point. A separately deployed Hono service is deferred until operational or scaling needs justify it; combining that with Vite requires an explicit SSR/metadata plan, not just reverting to an SPA. This is not a requirement to use every Next.js feature: organizer/admin screens remain client-rendered, and guest interactivity uses small client components.

Before configuring anything, the agent checks current docs for Next.js (App Router, Proxy/middleware, route handlers, CSP nonces and caching), Vercel (monorepo, Cron), Supabase (`@supabase/ssr`, Auth hooks, Storage signed upload URLs, CLI), Hono (Vercel/Next adapter) and Resend. If something here no longer works as described, it records the deviation in `docs/mvp/DECISIONS.md` (§11) and picks the closest solution.

### 3.2 Repo layout

```
apps/
  demo/                   ← today's src/, index.html, vite.config.js, Dockerfile (moved with git mv, otherwise unchanged)
  web/                    ← NEW Next.js app (TypeScript)
    app/                  ← App Router: same paths as the prototype (/, /login, /i/[token], /w/[slug]/upload, /app/gosti, /admin…)
      api/[[...route]]/route.ts  ← mounts packages/api (Node runtime)
    proxy.ts              ← Next 16+: Supabase session refresh, redirects and CSP nonce (`middleware.ts` only if an older Next version is deliberately pinned)
    src/features/         ← ported from the demo: pages → client components, Redux slices, services, API modules
    src/components/       ← ported shared UI (AppLayout, Modal, Icon, PhoneField…)
    src/templates/        ← the 11 invitation templates, ported
    src/lib/auth/         ← Supabase browser and server clients (@supabase/ssr)
    src/lib/i18n/         ← i18next for server and client, `lang` cookie
    locales/              ← copied from the demo (sr, en, ru, celebration/)
    styles/theme.css      ← ported from the demo
packages/
  api/
    src/
      app.ts              ← Hono app (all routes, basePath /api)
      routes/             ← auth, onboarding, admin, weddings, guests, photos, notifications, public, hooks, cron
      services/           ← business logic, also called through a `server-only` entry by Next server components; storage, images (sharp), email (SMTP locally, Resend in production), retention, rateLimit
      db/schema.ts        ← Drizzle schema
      db/migrations/      ← SQL migrations
      emails/             ← React Email templates (sr/en/ru)
    test/                 ← integration tests
  shared/                 ← enums, rules (gallery, companions, RSVP, phone, slug), error messages sr/en/ru, Zod schemas, API types
e2e/                      ← Playwright tests (against apps/web)
infra/observability/       ← local Prometheus/Grafana provisioning and Docker Compose
scripts/                  ← pinned local bootstrap/reset/seed/admin tooling
supabase/                 ← config.toml for the Supabase CLI (local stack)
docs/mvp/                 ← this specification
```

`packages/shared` receives code that currently lives in two places, rewritten in TypeScript: `src/utils/gallery.js`, `src/utils/phone.js` (minus the i18n part), `slugFor` and `parseCompanions`/`parseRsvp` from `src/mock/server.js`, the enums from `src/app/config/enums.js` and the messages from `src/mock/messages.js`. The product frontend and the backend both use it. The demo keeps its own copies and isn't changed.

Porting rules: ported components become `.tsx`, typed with `packages/shared` types. Copy (translation keys), CSS classes and DOM structure stay as in the demo, so the screens look the same. Anything that reads `localStorage` or `window` at import time moves into client components or effects. Server rendering must not depend on browser-only APIs.

### 3.3 Request flow

```
Browser
  ├─ auth: @supabase/ssr browser client (sign-in, signup, Google, reset; session in cookies) ──► Supabase Auth
  ├─ API:  axiosInstance  Bearer <Supabase access token>  ──►  Next.js /api/* ──► Hono (packages/api)
  │                                                                              ├─ Postgres (Drizzle, service role)
  │                                                                              ├─ Storage (signed URLs, sharp)
  │                                                                              └─ EmailSender (SMTP locally / Resend in production)
  └─ upload: PUT the file directly to the signed upload URL  ──►  Supabase Storage
Next.js server components (guest/public pages) ──► packages/api services (direct call, same rules as HTTP)
Next.js Proxy/middleware ──► refreshes the Supabase session cookie, redirects (/app → /login, → /onboarding)
Supabase Auth ── Send Email Hook ──► /api/hooks/auth-email ──► EmailSender (Inbucket locally / Resend in production)
Local terminal/cron runner or Vercel Cron ─► /api/cron/daily
```

The frontend never reads the database directly: browser code goes through our API, and server components call the same service functions the API uses through a `server-only` entry point. Public service calls receive locale and trusted request context (including IP) explicitly and apply the same archived/authorization/rate-limit/error rules as HTTP; they do not bypass controls merely because there is no HTTP round trip. The Supabase browser client is used only for auth. The API accepts **only** `Authorization: Bearer` (not the session cookie), so state-changing API requests aren't open to CSRF.

Guest responses are dynamically rendered and send `Cache-Control: private, no-store`; guest data, signed URLs and language/event overlays must never enter a shared Next.js/CDN cache. A nonce-based CSP also requires dynamic rendering, so the implementation must not claim static caching for those pages.

### 3.4 Environments

| Environment | Frontend + API | Supabase | Email |
|---|---|---|---|
| Local | `npm run dev` (Next.js, with the API inside) | Entirely local `supabase start`: Postgres + Auth + Storage | Local SMTP sender → Inbucket; no Resend key |
| Preview (from M7) | Vercel Preview | separate **staging** Supabase project | Resend, allow-listed test addresses only |
| Production | Vercel Production | **production** Supabase project (Pro plan: daily backups, no pausing) | Resend, verified domain |
| Demo | `npm run dev:demo` / `npm run build:demo` (Vite, mock, no API) | – | – |

Environment variables are documented in `.env.example` (per app) and [`ENVIRONMENT.md`](ENVIRONMENT.md). Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `SUPABASE_AUTH_HOOK_SECRET`) never go into the frontend or into git. **No cloud secrets are needed for M0–M6.** Local setup, seeds and observability are specified in [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md).

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
  terms_accepted_at timestamptz null, terms_version text null
  privacy_version text null
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
  retention_months  int not null default 3, CHECK 1..60
  storage_limit_bytes bigint not null default 50000000, CHECK > 0 ← 50 MB development default
  purge_at          timestamptz not null ← stored instant; recalculated transactionally on date/retention changes
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
  notify_claimed_at timestamptz null, notify_claim_token uuid null

photo_subscribers                        ← emails left via the QR link
  id, event_id FK CASCADE, email, name, locale, created_at, sent_at
  claimed_at timestamptz null, claim_token uuid null
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
  dedupe_key text null UNIQUE

rate_limits
  key text, window_start timestamptz, count int, PK(key, window_start)
```

Notes:

- The application explicitly sets `retention_months` from validated `RETENTION_MONTHS_DEFAULT` and `storage_limit_bytes` from `EVENT_STORAGE_LIMIT_MB_DEFAULT` (default `50`) when creating an event; SQL defaults are only safety nets. Environment variables cannot be SQL column defaults. The superadmin can subsequently change both values per account.
- `photos.status = 'uploading'` is **never** returned to the frontend, never counted in stats and never shown in the gallery or album. Its declared `size_bytes` reserves capacity until completion or cleanup.
- No `design_requests` table is created (out of scope).
- Deleting a guest keeps their photos (`guest_id = null`), as in UC-25.
- `Guest` and `Wedding` responses keep the shape from `API.md`; the API maps columns to JSON.

---

## 5. Functional requirements

### 5.1 Existing features

Every feature in `USE_CASES.txt` that isn't cut (§1.3) must be ported to the Next.js app and work on the real backend **exactly as in the prototype**: same copy, same look, same errors, same rules (SYS-1 – SYS-8). Differences:

| UC | Change |
|---|---|
| UC-01 | The landing page gets a **"Napravi nalog"** (Create account) button leading to UC-77. "Isprobaj demo" links to the separately deployed demo (`NEXT_PUBLIC_DEMO_URL`); "Pogledaj kao gost" links to a guest invitation in the demo |
| UC-02, UC-03 | Demo only (the product has no demo accounts) |
| UC-04 | An account is created by signup (UC-77) + onboarding (UC-81), **or** by the superadmin (UC-72). Default event settings are unchanged |
| UC-05 | Sign-in through Supabase Auth (email + password or Google). Same redirect rules; unfinished onboarding → `/onboarding`; unverified email → message + "Pošalji ponovo" (resend, UC-78). No demo buttons |
| UC-06 | The session lives in cookies via `@supabase/ssr`; Next Proxy/middleware refreshes it and redirects before the page renders, so there's no flash of protected content. `GET /auth/me` loads the profile on the client |
| UC-07 | Phone is collected in onboarding; the modal stays for accounts without a number |
| UC-08 | No link from design requests (cut) |
| UC-09 | Sign-out through the Supabase client (cookies cleared) + clearing Redux state |
| UC-10 | The language switcher writes the `lang` cookie (and `profiles.locale` when signed in) and re-renders; server-rendered pages read the cookie. A first visit with no cookie defaults to `sr` |
| UC-58 – UC-64, UC-66 – UC-70 | Guest pages are dynamically server-rendered with the invitation data. Interactivity (envelope, RSVP, upload, lightbox) hydrates on the client. They set `robots: noindex`, `Cache-Control: private, no-store` and link-preview metadata (`og:title` "Ana & Marko – pozivnica" or the celebration equivalent, plus a generic description). The guest's name, token and signed photo URLs are never in metadata |
| UC-14, UC-34 – UC-38 | Grids show `thumbUrl`; the enlarged view shows `url` (web version) |
| UC-39 | Deleting also removes all three files from Storage |
| UC-43 | The email is **actually sent** through the configured `EmailSender` (Inbucket locally, Resend in production); `sentAt` is set only for recipients where sending succeeded |
| UC-46 – UC-49 | Polaroids use `thumbUrl` (S/M) and `url` (L, slideshow) |
| UC-65, UC-66 | New upload flow (§7.1): progress and retry per file. Photos are not downscaled in the browser; the original arrives untouched |
| UC-72 | The superadmin also creates the Supabase Auth user (email already verified); event and profile are ready immediately, with no onboarding |
| UC-74 | The new password is set via the Supabase admin API; revoke all Supabase refresh sessions and set `tokens_valid_after`. The API rejects already-issued access tokens immediately; the frontend signs out when `/auth/me` returns `401` |
| UC-75 | Deactivation: `active=false`, `tokens_valid_after=now()` and a ban in Supabase Auth, so the user can neither refresh a token nor sign in |
| UC-76 | Also deletes the Supabase Auth user and all of the event's files in Storage |

### 5.2 New use cases

Same format as `USE_CASES.txt`. The agent adds them to `USE_CASES.txt` (new area "M. Nalog i privatnost") and updates the "Na prvi pogled" table.

**UC-77 Signup.** On `/registracija` the visitor enters an email and password (at least 8 characters) and ticks "I accept the terms of use and privacy policy" (required, with links). Clicking "Napravi nalog" shows a "Check your email" screen with the address. Call Supabase signup with `options.data` containing validated `locale`, accepted `termsVersion`/`privacyVersion` and `termsAcceptedAt`, and with `emailRedirectTo` set to `/auth/callback`; the Send Email Hook can use locale metadata before a profile exists. Store the accepted legal-document versions and timestamp when the profile is created.
The confirmation email arrives in the language chosen in the UI.
*Errors:* invalid email, short password, terms not accepted → message under the field. An email that already exists → the **same** "Check your email" message (we don't reveal that the account exists).
*Result:* clicking the email link signs the user in and goes to `/onboarding`. The profile's `locale` is taken from validated auth metadata, falling back to `sr`.

**UC-78 Resend confirmation.** A user with an unconfirmed email tries to sign in → "Confirm your email before signing in" and a "Pošalji ponovo" button (re-enabled after 60 s). The same button is on the "Check your email" screen.

**UC-79 Google sign-in.** A "Continue with Google" button on sign-in and signup. First time → the profile is created automatically, then onboarding. If an account with the same (confirmed) email already exists, Google is linked to that account. Google users accept the terms on the first onboarding step; acceptance stores the document versions and timestamp. Pass the selected locale in OAuth `queryParams`/redirect state where supported and otherwise persist the `lang` cookie through the callback; never put locale or tokens in logs.

**UC-80 Forgot password.** "Forgot your password?" on sign-in → `/zaboravljena-lozinka` → enter email → always the same message "If the account exists, we sent a link". The link opens `/nova-lozinka`, where the new password is entered twice. After saving, the user stays signed in on the current session, Supabase `signOut({ scope: 'others' })` revokes other refresh sessions, `POST /auth/password/complete` sets the access-token cutoff, and the client immediately refreshes the current session so it receives a post-cutoff token.
*Errors:* expired link → message and a button for a new link.

**UC-81 Onboarding.** A signed-in organizer without an event sees the wizard on `/onboarding`; every route under `/app` leads here until it's done:
1. Type: Wedding or Celebration (+ terms for Google users).
2. Names: bride and groom, or the celebrant and occasion name (optional); event date.
3. Contact: phone number (required; same validation and display as UC-08) and city (optional).
"Finish" creates the event with the default settings from UC-04, a slug built by the rules in "Svadba i proslava", and the opening line in the UI language. It goes to the dashboard with a "Welcome" message.
*Errors:* same rules and messages as UC-72. "Back" keeps entered data. Sign-out is possible at every step.

**UC-82 Change email.** Settings → Account → "Change email" → new address → with Supabase Secure Email Change enabled, confirmation links go to **both** the current and new addresses and the change completes only after the required confirmations. The current address stays valid until then; the UI shows "Awaiting confirmation: <new address>". A separate security notice is sent when the change completes.
*Errors:* email taken, invalid email.

**UC-83 Change password.** Settings → Account → current password + new password (twice). Wrong current password → error. Revoke other Supabase refresh sessions and set `tokens_valid_after` as in UC-80; revoking refresh tokens alone is insufficient because old access tokens remain valid until expiry. A user signed in only through Google sees "Set password", which sends the UC-80 email.

**UC-84 Delete account.** Settings → "Delete account" → a dialog explains what will be deleted (account, event, guests, photos, emails) and that it cannot be undone, and suggests downloading photos first (UC-85). The user types their event's address (slug) and confirms. Everything is deleted immediately (as in UC-76); the user is signed out and gets a confirmation email. The superadmin cannot delete themselves this way.

**UC-85 Download originals.** Photos → "Download all" → choose "Approved" or "All" → the browser builds a ZIP on the fly (streaming, without holding everything in memory) from paginated signed-original responses, with "N / M" progress. File names: `<sender>_<date>_<id>.<ext>`; sanitize path characters and use the unique ID to prevent collisions. Streaming uses a browser-supported stream saver/service worker with no third-party receiver; provide a tested desktop Chromium fallback of smaller batches or individual originals where Safari cannot stream large archives. Warn before very large downloads and never buffer the whole ZIP.
*Errors:* a single photo that fails after 3 attempts is skipped, and the end screen lists what wasn't downloaded. The enlarged view also has "Download original" for a single photo.
*Note:* this wasn't picked as a separate feature, but it is mandatory because of auto-deletion (SYS-9). Without it, organizers lose their photos after 3 months.

**UC-86 Analytics consent.** On the first visit to any page (guest pages included) a bar appears at the bottom: "We use anonymous, cookieless visit analytics to improve the site." with "Accept", "Decline" and a link to the privacy policy. Vercel Web Analytics loads **only after "Accept"**. The choice is stored in the browser; a "Privacy settings" link in the footer changes it.

**UC-87 Legal pages.** `/privatnost` and `/uslovi`, in 3 languages. Linked from signup, onboarding (Google), the landing page footer and guest page footers, and the upload page ("By sending photos you accept the [terms]"). The content is a **draft** the agent writes from a template (who the controller is, which data, purpose, retention per SYS-9, processors: Supabase, Vercel, Resend, user rights under ZZPL/GDPR, contact), clearly marked "DRAFT – pending legal review" in the code (not on the page).

**UC-88 Retention and storage limits (superadmin).** The account edit dialog gets "Keep data after the event (months)" (1–60, default 3) and "Photo storage limit (MB)" (1–200,000, default **50 MB**). The 50 MB default is intentionally low for development; the superadmin raises it per account when needed. Lowering the limit below current usage never deletes photos, but blocks new upload reservations until usage is below the limit or the limit is raised. The accounts table gets a "Deleted on" column with the date (or "Deleted <date>") and displays storage used/limit.

**UC-89 Deletion warning (organizer).** Settings always show "Photos and guests are deleted automatically on <date>." From 30 days before that date, the dashboard shows a bar "Data will be deleted on <date>. Download your photos." with a button leading to UC-85.

### 5.3 New system rules

| # | Rule |
|---|---|
| SYS-9 | **Auto-deletion.** `purge_at` is the instant at 00:00 Europe/Belgrade on the calendar date produced by `date + retention_months` (not a fixed number of 30-day months), stored in UTC. On/after `purge_at` the daily cron deletes all of the event's files from Storage plus its photos, guests, QR subscribers and `email_log` rows, and sets `purged_at`. The account and event (names, date, invitation) remain. Personal links, QR upload and the gallery then show "This event has been archived". The organizer sees an empty app with the bar "Data was deleted on <date>" and cannot add guests or photos. If the event date or retention period changes before purging, `purge_at` is recalculated, and warnings reset if the new date is later. A purged event is irreversible: editing its date/retention neither restores data nor clears `purged_at` |
| SYS-10 | **Email warnings** to the organizer 30 and 7 days before `purge_at`, each at most once (`purge_warned_*_at`), with a link to the download |
| SYS-11 | **Unfinished uploads:** photos in `uploading` older than 24 h are deleted (row and file) by the daily cron |
| SYS-12 | **Rate limiting** (§8.2). Exceeding it → `429` with the localized message "Too many attempts, please try again shortly." |
| SYS-13 | **Email language:** account emails use `profiles.locale` when a profile exists. During signup and other pre-profile flows, the hook uses validated Supabase `user_metadata.locale`, falling back to `sr`. Language changes update the profile; auth metadata is updated too when practical. The "photos are ready" email uses the language the guest had when leaving their email (`notify_locale`) |
| SYS-1 (addition) | Errors also carry stable/correlation fields: `{ "message": "...", "code": "invalidEmail", "requestId": "...", "traceId": "..." }`. Codes are message keys from `packages/shared`; correlation IDs are safe to show and are not authorization tokens |

---

## 6. API contract changes (relative to `API.md`)

Everything else in `API.md` still applies. At the end, the agent updates `API.md` to describe the post-MVP state.

### 6.1 Auth and profile

| Method | Path | Change |
|---|---|---|
| POST | `/auth/login` | **Removed.** Sign-in, signup, Google, reset and email/password change go through supabase-js directly to Supabase Auth |
| GET | `/auth/me` | Authorization: `Bearer <Supabase access token>`. The API verifies the signature (JWKS or the project JWT secret), `exp`, `iat >= floor(epoch(tokens_valid_after))` and `active`, with consistent second precision. If no profile exists, it creates one (`role: 'couple'`). Response `{ user: User }`; `User` gains `onboarded: bool`, `emailVerified: bool`, `providers: string[]`, `locale` |
| PATCH | `/auth/me` | Adds `locale`. Otherwise unchanged |
| POST | `/auth/password/complete` | **New.** After a successful Supabase password change and revocation of other refresh sessions, sets `tokens_valid_after=now()` and returns `204`. The client then refreshes its still-valid current session; a failed refresh returns to login |
| DELETE | `/auth/me` | **New** (UC-84). Body `{ confirmSlug }`; must match the event slug, otherwise `422`. Deletes everything; superadmin → `403` |
| POST | `/onboarding` | **New** (UC-81). Body `{ type, partner1, partner2?, occasion?, date, phone, city? }`. Validation as in `POST /admin/accounts`. Event already exists → `409`. Response `{ user, wedding }` |

For a user without finished onboarding, every route under `/weddings`, `/guests` and `/photos` returns `409 { code: 'onboardingRequired' }`.

### 6.2 Superadmin

- `POST /admin/accounts`: creates the Supabase Auth user (`email_confirm: true`) + profile + event. Otherwise unchanged.
- `PATCH /admin/accounts/:id`: also accepts `retentionMonths` (1–60) and `storageLimitMb` (integer 1–200,000). Changing the email also changes it in Supabase Auth. Lowering storage below current usage is allowed and only blocks new uploads.
- `AdminAccount` gains `onboarded`, `providers`, `wedding.retentionMonths`, `wedding.storageLimitBytes`, `wedding.storageUsedBytes`, `wedding.purgeAt`, `wedding.purgedAt`. The list includes accounts that haven't finished onboarding (`wedding: null`).

### 6.3 Photos: new upload flow

`POST /public/invitations/:token/photos` and `POST /public/weddings/:slug/photos` (multipart) **are removed**. They are replaced by:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/public/invitations/:token/uploads` | `{ category, senderName, message, files: [{ name, type, size }] }` | `{ uploads: [{ photoId, uploadUrl, uploadKey }] }` |
| POST | `/public/weddings/:slug/uploads` | same | same; `403` if `allowGeneralUpload=false` |
| PUT | `uploadUrl` (Supabase Storage) | raw file | – (the client sends it directly, with progress) |
| POST | `/public/uploads/:photoId/complete` | `{ uploadKey }` | `{ id, status }`: checks the file exists, reads dimensions, generates `thumb` and `web`, sets `pending`/`approved` per SYS-2 |

Rules: 1–50 files per request; `type` must be `image/jpeg`, `image/png` or `image/webp`; `size` ≤ 30 MB (`MAX_UPLOAD_MB`). The private bucket also enforces the same 30 MB file-size limit and MIME allow-list, because a signed URL bypasses the API during PUT. An invalid file → `422` with the file name. `uploadKey` is a random secret (32 bytes) stored only as a hash; a wrong key → `404`. A signed upload URL is valid for 2 h. Calling `complete` again after processing returns the photo's current `{ id, status }` without processing or changing moderation state; concurrent first completions are serialized by an atomic status transition or row lock. A file sharp can't read → the photo and stored object are deleted and the response is `422 { code: 'notImage' }`.

**Photo pagination.** `GET /weddings/:id/photos` accepts `cursor`, `limit` (default 50, maximum 100) and the existing filters, returning `{ photos: Photo[], nextCursor: string | null }`. Both public gallery endpoints accept the same cursor/limit and add `nextCursor` to `PublicGallery`; only approved photos are exposed. Cursors are opaque, signed or otherwise validated, and encode the stable `(createdAt, id)` ordering. Grids, gallery, album and slideshow load pages incrementally instead of fetching/signing 5000 URLs in one response. This intentionally changes the old array response in `API.md`.

`Photo` gains `thumbUrl`, `url` (web version), `width` and `height`. A page has no `originalUrl`. URLs are **signed** and valid for 1 h; the frontend doesn't cache them longer. The same applies to `PublicGallery.photos[]`.

| Method | Path | Response |
|---|---|---|
| GET | `/weddings/:id/photos/originals?status=approved\|all&cursor=…&limit=…` | `{ photos: [{ id, filename, url, size }], nextCursor }`: signed original URLs (valid 1 h) for UC-85; cursor pagination is mandatory |

### 6.4 Notifications

`POST /weddings/:id/photo-notifications` actually sends the emails through `EmailSender` (SMTP/Inbucket locally, Resend batch in production, at most 100 per call to Resend). Response: `{ sent, failed, sentAt, guestIds, subscriberIds }`; `guestIds`/`subscriberIds` contain only successful ones. Failed recipients stay "Čeka" (waiting) and can be retried. Every send is written to `email_log`. Claim eligible rows atomically with a unique token and lease before calling Resend (an `UPDATE … WHERE sent/notify_sent_at IS NULL AND (the corresponding claimed_at IS NULL OR claimed_at < leaseExpiry) RETURNING`); success sets the sent timestamp, failure clears the claim. Two concurrent calls must not select the same recipient. Use a stable `dedupe_key` and a provider idempotency key when supported. A crash between provider acceptance and the DB update cannot guarantee exactly-once email, so recovery is at-least-once and must be documented rather than claiming an impossible guarantee.

### 6.5 New system endpoints

| Method | Path | Protection | Purpose |
|---|---|---|---|
| POST | `/hooks/auth-email` | Supabase hook signature (Standard Webhooks, `SUPABASE_AUTH_HOOK_SECRET`) over the raw body | Sends account emails via the configured `EmailSender`; locale resolution per SYS-13. Secure Email Change is enabled, so current/new addresses and the differently named token hashes are mapped exactly per current Supabase docs |
| GET | `/cron/daily` | `Authorization: Bearer CRON_SECRET` | SYS-9, SYS-10, SYS-11, `rate_limits` cleanup. Idempotent; safe to run several times a day |
| GET | `/health` | public | `{ ok, version, db: 'ok' }` |
| POST | `/diagnostics/export` | **Local only:** `DIAGNOSTICS_ENABLED=true`; otherwise `404` | Combines validated, size-limited sanitized client events with matching local traces/logs into the D17 JSON report; no arbitrary log queries |
| GET | `/metrics` | `METRICS_ENABLED=true` + Bearer `METRICS_TOKEN`; production-disabled by default | Prometheus metrics with normalized/low-cardinality labels |
| – | `design-requests` | – | Don't exist in the real backend (demo mock only) |
| – | `/__mock/reset` | – | Demo mock only |

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
5. If a file fails: retry the **same photo ID/path** up to 3 times with backoff; never create a new upload row for a retry. After an ambiguous upload result, try `complete` before re-uploading. After final failure show "Not sent – Try again" for that file only. The thank-you screen (UC-65) appears once all files are done or skipped; its count is the number of successful uploads.
6. While uploading, closing the tab asks for confirmation (`beforeunload`).

iPhone: Safari sends JPEG instead of HEIC when picking from the photo library. If a HEIC file still arrives, the guest is told that photo isn't supported.

### 7.2 Processing (backend)

- `original_path`: `events/{eventId}/original/{photoId}.{ext}`, never modified.
- `web_path`: `events/{eventId}/web/{photoId}.jpg`, long side 1600 px, JPEG q80, rotated per EXIF, **EXIF/GPS stripped**.
- `thumb_path`: `events/{eventId}/thumb/{photoId}.jpg`, 400 px, q75, same treatment.
- Processing one photo must fit within the configured Vercel function memory/duration limit; that's why `complete` is called per photo. The M0/M4 spikes must prove that the Next/Hono deployment bundles and runs `sharp` on the Node runtime. Set an explicit pixel/decompression limit and concurrency of one inside a request; reject decompression bombs and over-large dimensions cleanly. Measure real 30 MB/high-megapixel files, not only a 12 MP happy path.
- `complete` verifies the object at the server-generated path, actual byte size and decoded format; client-declared MIME and size are not trusted.
- Deleting a photo, an account or an event (SYS-9) also deletes the files; deleting a guest doesn't delete their photos. Storage deletes are batched.

### 7.3 Display

Grids (dashboard, Photos, gallery, wall S/M, per guest) use `thumbUrl`; the enlarged view, wall L and the slideshow use `url`. Images have `loading="lazy"`, `width`/`height` (no layout shift) and `decoding="async"`. When a signed URL expires (an image fails to load), the page reloads the list.

Photos are rendered with plain `<img>`, **not `next/image`**. We already generate our own sizes, and signed URLs change every hour, which would defeat the image optimizer's cache and add Vercel image-optimization cost. `next/image` is fine for static assets (landing page, template previews).

---

## 8. Non-functional requirements

### 8.1 Security

- Every protected route checks both **role** and **ownership** (the event belongs to the user). Every route has a test that another user gets `403`/`404`.
- Guest token: 12 base62 characters from a cryptographic RNG; never logged. Rate-limit keys store keyed hashes of tokens/IPs, not reusable raw secrets.
- The Supabase `service_role` key exists only in the API. The `photos` bucket is private.
- Security headers on all responses (`next.config` headers + Proxy/middleware): `Content-Security-Policy` with a per-request nonce for Next's inline scripts on dynamic pages (self + Supabase + Vercel analytics domains; no `unsafe-eval` in production), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera allowed for self only). Test actual deployed pages, including Supabase image/connect domains and upload/stream-saver service-worker behavior.
- Passwords: at least 8 characters (Supabase setting), plus a leaked-password check if the plan supports it.
- Logs are structured (JSON, `requestId`, `traceId`) and contain no passwords, tokens, guest tokens or message contents.
- `npm audit --omit=dev` shows no high/critical vulnerabilities at release.

### 8.2 Rate limiting (SYS-12)

A fixed window in the `rate_limits` table (no new service). Increment and limit checks must be one atomic SQL upsert/transaction; concurrent requests must not both pass. Key = route + IP (plus token where there is one), using the deployment platform's trusted client-IP value rather than an arbitrary forwarded header:

| Route | Limit |
|---|---|
| `POST …/uploads` | 20 / 10 min per token, or per slug+IP |
| `POST …/rsvp`, `…/notify` | 30 / 10 min per IP |
| `GET /public/*` | 300 / min per IP |
| `POST /onboarding`, `PATCH /auth/me` | 30 / 10 min per user |
| Supabase Auth (sign-in, signup, reset) | Supabase built-in limits, configured in `supabase/config.toml` |

Values live in env. On the wedding day, 150+ guests on the same Wi-Fi share an IP, which is why upload limits are per token/slug and not only per IP.

**Cost/abuse circuit breaker.** "Free" cannot mean unbounded public storage. Before issuing upload URLs, lock the event row (or use an equivalent serializable reservation) and atomically reserve the declared bytes in `uploading` rows; reject the batch with `403 { code: 'storageLimit' }` if accepted plus reserved originals would exceed `events.storage_limit_bytes`. New events default to **50 MB = 50,000,000 bytes**, intentionally low for development, via `EVENT_STORAGE_LIMIT_MB_DEFAULT=50`; the superadmin can adjust the stored limit per account (UC-88). Completion reconciles the reservation with actual bytes and rejects/deletes an object that would exceed the ceiling; abandoned reservations are released by SYS-11. Lowering the ceiling below existing usage never deletes existing files. Per-file and per-request checks alone do not bound storage cost.

Supabase Auth's built-in limits complement, but do not replace, the application limits above. Rate limits and storage ceilings return localized errors and are tested under concurrency.

### 8.3 Performance and scale

Target scale per event: up to 500 guests, up to 5000 photos, up to 200 guests uploading at the same time.

- Guest pages (`/i/*`, `/w/*`): server-rendered; LCP < 2.5 s on a mid-range Android phone over 4G (Lighthouse mobile profile). First-load JS for those routes ≤ 250 KB gzip (per `next build` output). The editor, admin, big album and Redux store never load for guests; the invitation page loads only the template it uses (dynamic import per `templateId`).
- API p95 < 300 ms for everything except `complete` (p95 < 5 s for a 12 MP photo; larger supported images must fail cleanly or complete within the configured function limit).
- Photo reads are measured **per 50-item page**, including signed URL generation; there is no requirement or endpoint that returns all 5000 signed photos at once. Album/slideshow interactions remain responsive while later pages load.

### 8.4 Operations

- Migrations are applied by a controlled release job before the new app version receives traffic; concurrent Preview deployments must not migrate the shared staging schema. Use backward-compatible expand/contract migrations so the previous production version can still serve during rollout; forward-only, no manual DB edits.
- `npm run admin:create -- --email … --password …` creates a superadmin in the chosen environment.
- Vercel Cron uses UTC (`0 1 * * *`), not a claimed fixed Belgrade wall-clock time; business calculations still use Europe/Belgrade. The daily job is idempotent and safe for late or duplicate delivery. Before M7, the same endpoint is exercised locally with injected time and no Vercel account.
- Local bootstrap/reset/seed and logging/metrics behavior follows [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md); development and CI must not require hosted services.
- `/health` for uptime checks; 5xx errors are visible in structured local/CI logs and later Vercel logs.
- Backups: the production Supabase project is on the Pro plan (daily backups). The restore procedure is tried once on staging and documented in `docs/mvp/RUNBOOK.md`.

### 8.5 Accessibility, browsers, languages

- WCAG 2.1 AA for forms on guest pages and signup (labels, focus, contrast, keyboard).
- Support: last 2 versions of Safari iOS and Chrome Android, plus desktop Chrome, Firefox, Safari and Edge.
- Every new string in the UI and in emails exists in sr, en and ru (and in `celebration/` where the celebration wording differs). The plural rules in the README apply.

### 8.6 Logging and metrics

- All Next server/API requests use structured Pino logs with a generated `requestId`, propagated W3C `traceId`, normalized route, status and duration; sensitive headers, tokens, raw guest paths, IPs and message bodies are redacted.
- Local `prom-client` metrics cover HTTP rate/latency/errors, photo upload/processing, rate/storage limits, email outcomes and cron jobs. Prometheus scrapes a token-protected local `/api/metrics`; a provisioned Grafana dashboard is part of `dev:bootstrap`.
- Metric labels use route templates/stable codes only, never raw IDs, tokens, emails or unbounded values. Logging/metric redaction has tests.
- In-memory metrics are a **local diagnostic system**, not a claim of accurate aggregation across serverless production instances. Production uses structured provider logs/metrics; adding a hosted telemetry backend is outside MVP.
- Exact local URLs, commands, seed fixtures and dashboard requirements are in [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md).
- A tester's **Download diagnostic report** action exports schema-versioned JSON containing the trace/request IDs, sanitized chronological browser events, API outcomes, local backend spans and matching logs. Local traces cover route → service → DB/Storage/email/image/cron steps with timestamps, durations, parent/span IDs and error details. The export contains no secrets, signed URLs, personal message bodies or raw tokens.
- Local backend traces/logs are bounded, ignored files under `.logs/`; diagnostic backend export returns `404` unless `DIAGNOSTICS_ENABLED=true`. Preview/Production client reports still export the trace/request IDs and client events for provider-log lookup, but do not claim to include server logs.

---

## 9. Frontend

### 9.1 Demo (`apps/demo`)

1. Today's `src/`, `index.html`, `vite.config.js`, `package.json` scripts and `Dockerfile` move to `apps/demo` with `git mv`. No functional changes.
2. `npm run dev:demo` and `npm run build:demo` work from the root, and the demo looks and behaves exactly as it does today.
3. The demo doesn't get MVP features and doesn't follow API changes. Its mock stays as it is.

### 9.2 Product (`apps/web`, Next.js)

1. A new Next.js app (App Router, TypeScript strict) with every retained screen ported from the demo (§3.2 porting rules). The routes are the prototype's routes: `/`, `/login`, `/i/[token]`, `/i/[token]/upload`, `/i/[token]/galerija`, `/w/[slug]/upload`, `/w/[slug]/galerija`, `/app`, `/app/gosti`, `/app/pozivnica`, `/app/fotografije`, `/app/veliki-album`, `/app/podesavanja`, `/admin`, plus a not-found page.
2. Auth: `src/lib/auth` with the `@supabase/ssr` browser and server clients; `proxy.ts` on current Next.js refreshes the session and redirects (signed out → `/login?next=…`, superadmin ↔ `/admin`, not onboarded → `/onboarding`). Authorization is still enforced by the API; redirects are UX, not a security boundary. `axiosInstance` gets the access token from the browser client.
3. New routes: `/registracija`, `/potvrda-emaila` (check your email), `/auth/callback` (route handler for the email link and Google), `/zaboravljena-lozinka`, `/nova-lozinka`, `/onboarding`, `/privatnost`, `/uslovi`. Guest routes gain the archived state (SYS-9).
4. Login: Google button, "Forgot your password?", link to signup; no demo buttons.
5. Settings: an "Account" section (email, password, phone, language), "Data retention" (UC-89) and "Delete account" (UC-84); no "Demo mode".
6. Photos: "Download all" (UC-85), `thumbUrl`/`url`.
7. Upload page: new flow (§7.1) and a link to the terms.
8. Admin: retention and per-account storage-limit fields, storage usage, "Deleted on" column, display of accounts without onboarding.
9. Consent bar + `@vercel/analytics` rendered only after consent (UC-86); footer with legal links.
10. Not ported: everything in §1.3 (design requests, print request, demo reset, demo login buttons).
11. i18n per D13; `<html lang>` follows the cookie; the tab title and every error message are translated as in UC-10.
12. Error and loading states: `not-found` and `error` boundaries per route segment, styled like the prototype's "Stranica nije pronađena" / UC-70 pages.

---

## 10. Open questions

Open questions do not block local development unless marked otherwise. **Q3 blocks public launch.** The listed defaults keep implementation unambiguous; changing scope still needs owner approval.

| # | Question | Default until the owner decides |
|---|---|---|
| Q1 | Domain and sender address for emails | `uspomena.rs`, `Uspomena <noreply@uspomena.rs>`; the agent uses env variables `APP_URL`, `EMAIL_FROM` |
| Q2 | Is the phone number still required now that custom design is cut? | Stays required (UC-07) |
| Q3 | Text of the privacy policy and terms | Draft during development (UC-87); named legal/controller details and legal review are required before public launch |
| Q4 | A 3-month retention is short for guests who open the gallery late | Stays 3; the superadmin extends it per account |
| Q5 | After SYS-9, can the organizer create a new event? | Not in the MVP (one event per account); they can delete the account and sign up again |

---

## 11. Deviations

If the agent has to deviate from this specification (a service doesn't work as described, a rule conflicts with `USE_CASES.txt`, something is impossible), it **does not silently change the spec**. It records in `docs/mvp/DECISIONS.md`: the date, what, why, what was chosen instead and which UCs/requirements are affected. A deviation that changes scope (adds or removes a feature) waits for the owner's approval.
