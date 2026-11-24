# MVP decisions and deviations

This file records architecture decisions, spec corrections and implementation deviations. Scope changes still require owner approval.

## 2026-11-22 — M2: API token verification and `/auth/me`

`GET /api/auth/me` verifies the Supabase access token by calling Auth `/auth/v1/user` with the server-only service key, which checks signature, issuer and `exp`; a missing token answers `401 unauthorized`, an invalid/expired one `401 sessionExpired`. The API then reads the profile and enforces `active` (`401 accountDisabled`) and `tokens_valid_after` against the token's `iat` (`401 sessionExpired`), so deactivation and password changes end existing sessions immediately. When no profile exists it is created from the verified auth user (email, `user_metadata.locale`, `user_metadata.name`) and returned with `201`. The response shape is `{ profile: { id, role, email, name, phone, locale, active, onboardedAt, createdAt } }`, which the M2 web client will consume; `onboardingRequired` (`409`) on other protected routes follows in the next pass.

Three decisions taken at the start of M2 (recorded so they are not silently changed later):

- **No axios.** The product already has `apiFetch` (`apps/web/src/lib/diagnostics/api.ts`) with trace propagation; M2 extends it to attach `Authorization: Bearer <access token>` and `Accept-Language` instead of introducing a second client. SPEC §3.3 names `axiosInstance`; this is a tooling deviation with no contract change.
- **`/auth/callback` is added in the web pass (2b)** and handles both the email links produced by the M1 Send Email Hook and the Google callback.
- **Redirects and `409` coexist**: `proxy.ts` redirects are UX only (signed out → `/login?next=…`, not onboarded → `/onboarding`, superadmin ↔ `/admin`), while the API stays the authorization boundary and answers `409 onboardingRequired` on protected routes until onboarding is complete.

Evidence: 8 integration tests against the local stack — missing/invalid token `401`, seeded couple profile `200`, profile created for a brand-new auth user `201` (then deleted), deactivated profile `401 accountDisabled`, and a token issued before `tokens_valid_after` `401 sessionExpired`.

## 2026-11-24 — Fixes from the M0–M4 product walkthrough

A full browser walkthrough of the product (fresh signup → onboarding → guests → invitation → RSVP → upload → moderation → album → galleries → ZIP → settings → admin) found four M3-era UI bugs that the existing tests did not catch. All are fixed with tests that fail on the old code:

1. **Raw translation keys on the dashboard** (`dashboard.stats.invited`, `dashboard.addGuests`, …): the server page resolved them in the default `auth` namespace although they live in `dashboard`. The keys now use `dashboard:`. The same scan found two more untranslated labels: the guest form's email (`common:fields.email` → `auth:fields.email`, as in the demo) and the invitation editor's address label (`settings:wedding.slug` with a hard-coded "Adresa" fallback); the demo's `settings` namespace (sr/en/ru + celebration overlay) is now ported so it resolves. New `test/translation-keys.test.ts` statically resolves every literal `t('…')` in `apps/web` against its file's namespace in sr/en/ru for wedding and celebration (it fails on the old dashboard).
2. **Countdown without the unit** ("Do venčanja još 200"): the day count is now pluralized through `common:count.days` like the prototype ("… 200 dana"). S1/S2 now assert `\d+ (dan|dana)`, the translated stats and no `dashboard.*` text.
3. **Language switch needed a reload on client pages:** `LocaleProvider` kept the i18next instance from its first render, so after "English" the server parts (title, `<html lang>`) changed but client text stayed Serbian. The instance is now memoized per locale/event type. Covered by a component test (sr → en → ru rerender) and a landing E2E that switches the guest invitation to English and back without a reload.
4. **Double full stop** in "Galerija se otvara gostima 13. jun 2027..": Serbian dates end with a dot and the sentence adds one. A shared `galleryStatusText` (invitation, gallery, upload pages) collapses a final `..` (Russian "2027 г." keeps its abbreviation dot); unit-tested for sr/en/ru. The frozen demo has the same double dot and is not changed.

Still open (not a bug fix): the organizer settings screen for photo options (UC-54 – UC-56).

## 2026-11-24 — M4: E2E S7–S10, measurement, upload metrics and demo check

**E2E (`e2e/photos.spec.ts`):** S7 (personal upload with a 31 MB file rejected, approve 2 / hide 1, album shows 2 with thumb URLs and the lightbox with the web URL), S8 (QR upload with auto-approve appears in the album; QR upload off shows "Slanje je isključeno"), S9 (the first Storage PUT is aborted with the context offline; the same signed URL is retried and exactly one pending photo exists), S10 twice (the bounded-batch download — forced in Chromium by removing `showSaveFilePicker`, native on WebKit — saves `uspomena-<slug>-1.zip` whose three entries equal the uploaded bytes; and the streaming path in Chromium through a stubbed picker because headless Chromium cannot show the native save dialog).

Deviations:

- **Organizers for S7–S10 are created through the local Auth admin API and `POST /api/onboarding`, then sign in through `/login`**, instead of the full signup/Mailpit round trip (S1–S3 already cover it); every test still creates isolated data.
- **S8 toggles `autoApprovePhotos` / `allowGeneralUpload` through `PATCH /api/weddings/:id`** because the organizer settings screen for photo options (UC-54 – UC-56) has not been ported to the product yet. The guest-facing behaviour is exercised in the browser; porting that screen remains open (it is not an M4 DoD item) and is reported as a gap.

**Measurement (`npm run measure:complete`, LOCAL_DEVELOPMENT.md §6.1),** in a `node:24-bookworm-slim` container with `--cpus=1 --memory=2g` (the default Vercel function size) against local Supabase: 20 × 12 MP JPEG (3.3 MB) completions p50 287 ms, **p95 326 ms**, max 329 ms (target < 5 s); a 26.6 MB / 36 MP JPEG completed in 974 ms; a 108 MP single-colour JPEG (634 KB) failed cleanly with `422 notImage` in 39 ms; peak RSS 1,325 MB including the script's own fixture generation, no OOM. Unconstrained on the 4-core host: p95 239 ms. Preview measurement is repeated in M7.

**Metrics:** `photo_uploads_total{link,outcome}`, `photo_processing_total{outcome}` and `photo_processing_duration_seconds{outcome}` (bounded labels only) plus three Grafana panels; an integration test checks the counters move and contain no photo id or guest token, and the running dev server's `/api/metrics` showed them after S7. Pino request logs for upload routes carry only the normalized route (`/api/public/uploads/:photoId/complete`), never the upload key or signed URL; Next's own dev access log prints raw page paths as before (dev-only output, not our structured logs).

**Demo:** `git diff 10201c0^ HEAD -- apps/demo` is empty and `npm run build:demo` passes; the product upload flow uses no mock adapter. A browser walkthrough of the built demo (`vite preview`, Playwright/Chromium, one context because the mock DB lives in `localStorage`) after M4 passed the M0 checklist with no page errors: "Demo mladenci" sign-in → dashboard; guest `/#/i/milica` opens the envelope and answers "Dolazim"; the same guest uploads two photos ("Hvala vam!"); the organizer's guest list shows Milica as coming; both photos appear pending, are approved, show under "Odobrene" and appear on the big-album wall.

**Local tooling notes:** the project needs Node 24 (`.nvmrc`); `dev:bootstrap` refuses Node 22. If integration tests run against a fresh stack *before* the first seed, their leftover events can take the seed's fixed slugs and `db:seed` fails on the unique slug — `ALLOW_LOCAL_RESET=1 npm run dev:reset` fixes it (pre-existing behaviour, not changed here).

## 2026-11-24 — M4: guest upload page

`/i/:token/upload` (UC-65) and `/w/:slug/upload` (UC-66) implement SPEC §7.1 on the signed upload flow; the invitation's album card links to it again (and to the gallery when open), as in the prototype.

Decisions:

- **Screening before any request:** HEIC/HEIF (by MIME or `.heic/.heif` name, because iOS can send an empty type) gets an iPhone-specific message; anything other than JPEG/PNG/WebP and files over `MAX_UPLOAD_MB` (30) are rejected with the file name. The picker `accept` is narrowed to the three types. The 50-files-per-request cap from the prototype stays.
- **Sending:** one ticket request for the batch, then at most three PUTs in parallel via `XMLHttpRequest` (fetch has no upload progress), per-file progress plus a byte-weighted total, then `complete` per file. Tickets are never requested again for a retry.
- **Retries (step 5):** up to three automatic retries with 1/2/4 s backoff on the same photo id and signed URL. A network error, timeout or 5xx PUT is *ambiguous*: the next attempt calls `complete` first and only re-uploads on `uploadNotFound`; a `409` (object already exists) goes straight to `complete`. A Storage 4xx stops retrying. `notImage`/`tooLarge`/`storageLimit` from `complete` are final (the server already removed the photo) and offer only "Skip"; other failures offer "Try again" (same ticket) and "Skip".
- **Thank-you:** shown when every remaining file is sent (failed ones are tried again or skipped), counting the successful files; if all were skipped, the page returns to the picker instead of thanking for zero photos. "Notify me" is submitted after a successful batch as before.
- **`beforeunload`** is registered only while a file is queued, uploading or processing.
- **Copy:** the thank-you and send-button wording reuses the prototype's `common:count.photos` (nominative) unchanged.

Evidence: 10 component tests (67 total, 82.6 % lines) — screening of HEIC/PDF/>30 MB, ≤3 concurrent PUTs with per-file 50 % and 38 % total progress, ticket body, `beforeunload` prevented mid-upload, thank-you count; `complete` before re-PUT after an ambiguous PUT on the same id, no re-PUT when the file was stored, four attempts then "failed", `409` → `complete`, final `notImage`; "Try again" without new tickets, "Skip" with the successful count and notify, the storage-limit ticket error and the QR "uploads are turned off" screen. Real-browser PUTs are covered by E2E S7–S9.

## 2026-11-24 — M4: UC-85 download originals

`GET /api/weddings/:id/photos/originals?status=approved|all&cursor&limit` returns `{ photos: [{ id, filename, url, size }], nextCursor, total, totalBytes }` (oldest first, cursor mandatory as in SPEC §6.3; `total`/`totalBytes` are an addition for "N / M" progress and the large-download warning). `GET /api/photos/:id/original` returns `{ original }` for the single-photo download (an addition; the SPEC table only lists the bulk endpoint). Original URLs are signed for 1 h and carry Storage's `download=<filename>` so the browser saves them as attachments.

Decisions:

- **File names:** `<sender>_<YYYY-MM-DD>_<photoId>.<ext>` (`services/filenames.ts`): NFC, path separators, `:*?"<>|`, control and format characters (e.g. RTL override) removed, whitespace → `-`, leading/trailing dots/dashes trimmed, sender capped at 40 characters, `gost` when empty; the full photo id guarantees uniqueness.
- **ZIP library:** `client-zip` 2.5.1 (MIT, no dependencies, ZIP64, streaming `makeZip` from an async iterable). Files are stored without recompression. Originals are fetched one at a time from paginated signed URLs directly from Storage (not through `apiFetch`, so neither the API token nor signed URLs enter diagnostics).
- **Streaming vs fallback:** where the File System Access API exists (desktop Chromium) one archive is piped straight to the chosen file, never buffered. Elsewhere (Safari/Firefox) the fallback builds archives of at most 200 MB one after another (`name-1.zip`, `name-2.zip`, …) — only one batch is in memory at a time. No service worker or third-party stream receiver is used. Downloads above 2 GB show a warning before starting; the modal also explains the batch fallback.

Evidence: 3 integration tests (89 total) — two pages of signed originals whose bytes equal the uploaded files, `Content-Disposition: attachment`, sanitized unique names from a hostile sender name, `approved` vs `all`, `422` for another scope, `401`/foreign `404` for both endpoints and the single download; 4 unit tests for file names; 4 component tests that parse the produced ZIPs — one streamed archive across two pages with original bytes and names and `0…3` progress, the Safari-path fallback splitting three files into two bounded archives, the single download and the modal's size summary, >2 GB warning and progress.

## 2026-11-24 — M4: storage limits under concurrency

**Bug found and fixed:** `complete` compared the photo's actual size with the other photos' usage *without* the event row lock, so two concurrent completions whose declared sizes were tiny could both pass and exceed `storage_limit_bytes` (reproduced: both `200`). The reconcile step now runs in a transaction that takes the same `select … for update` lock on the event as new reservations, and writes the actual `size_bytes` before releasing it; a photo that no longer fits is deleted with its object (`403 storageLimit`). The subsequent derivative/status transition is unchanged.

Evidence: 5 new integration tests (`storage-limits.test.ts`, 86 total) against real Storage — a new event gets 50,000,000 bytes from `EVENT_STORAGE_LIMIT_MB_DEFAULT=50`; the private bucket itself rejects a `text/plain` and a 31 MB PUT on a valid signed URL; 12 parallel batches against a 100,000-byte limit yield exactly 5 × `201` and 7 × `403 storageLimit` with 100,000 bytes reserved; two concurrent completions of under-declared files yield one `200` and one `403`, total ≤ limit, rejected object removed (repeated 3× without flakes); lowering the limit below usage blocks new reservations but keeps the photo row, its listing and all three files, and raising it re-allows uploads. Admin-created accounts use the same `createEvent` default.

## 2026-11-24 — M4: photo grids, enlarged view, big album and guest gallery

Ported from the demo onto the paginated signed lists: `/app/fotografije` (UC-34 – UC-39), `/app/veliki-album` (UC-46 – UC-49), the dashboard "new photos" strip, `/i/:token/galerija` and `/w/:slug/galerija` (UC-14, UC-67 – UC-69), plus the "View gallery" link on the open invitation. Grids, dashboard thumbnails and S/M polaroids use `thumbUrl`; the lightbox, L polaroids and the slideshow use `url` (SPEC §7.3), all through plain lazy `<img>` with intrinsic size and the expiry reload.

Decisions:

- **Server-side filtering:** status tabs, the category filter and the album filter are API queries (with server `counts` for the tab badges) instead of filtering a full client array; the demo's client paging (10/20/50/100 per page) becomes "Load more" over cursor pages of 50. The album loads pages of 60 (the demo's wall step), "Show more N of M" uses `counts.approved`, and the slideshow requests the next page three slides before the end of what is loaded (`n / N+` while more exist). Per-guest stacks group the loaded pages.
- **Moderation refresh:** after approve/hide/bulk/delete the loaded pages are re-fetched (one sign call per page), so counts, tab membership and URLs stay consistent without client-side bookkeeping.
- **Cut features stay cut:** the album's "Uradite ovo za nas" print request and active-request banner (UC-52/UC-53) are not ported and their strings are not copied.
- **Album preferences:** filter/background/size/messages/view stay in `localStorage` like the demo (per-viewer convenience, guarded with try/catch); the board renders after hydration so stored preferences cannot cause a hydration mismatch.
- **Client accent:** the guest gallery computes its accent from the invitation on the client because `@/templates` is a client module; server pages pass only the invitation look.

Evidence: 8 new component tests (53 total, `features/`+`components/` coverage 81 % lines) — thumbnails in grids and web URLs in the lightbox, status tabs/counts and category as API queries, single/bulk/delete moderation calls, "Load more" and re-signing both pages on an image error, album S/M thumbnails vs L/slideshow web URLs, "show more", slideshow prefetch and per-guest stacks, the open/closed/unavailable gallery with total, categories and QR notify, and the dashboard strip. `npm run build` compiles the four new dynamic routes.

## 2026-11-24 — M4: cursor pagination of photo lists and galleries

`GET /api/weddings/:id/photos` and both public gallery endpoints accept `cursor` and `limit` (default 50, values above 100 are capped to 100, `< 1`/non-integers are `422 badRequest`) and return `nextCursor` (SPEC §6.3).

Decisions:

- **Cursor:** base64url JSON `[createdAt, id]` over the stable `(created_at, id)` order. `createdAt` is taken from Postgres with microseconds (`to_char(... 'US')`) because a JS `Date` truncates to milliseconds and would skip or repeat rows created within one millisecond; the comparison is a row-value `(created_at, id) < / > (…)`. The cursor is **validated, not signed** (SPEC allows "signed or otherwise validated"): the shape, timestamp and UUID are checked (`422 badRequest` otherwise), and because the query is already scoped to the event and status, a forged cursor can only move inside rows the caller may see. No new secret is needed.
- **Organizer list:** newest first by default, `order=asc` for the album/slideshow; filters `status` (`pending|approved|hidden|all`, `uploading` is never listed), `category` (`memories|wedding|all`) and `guestId`; the response adds `counts { pending, approved, hidden, all }` for the status tabs (the demo computed these from the full array). Shape: `{ photos, nextCursor, counts }`.
- **Public galleries:** oldest first (as in the prototype), only approved photos, optional `category`; `PublicGallery` gains `total` (approved photos in the category, for "N photos from guests") and `nextCursor`. A closed gallery is `{ total: 0, nextCursor: null, photos: [] }`.
- **Frontend:** `useSignedPages` (replacing the single-list hook) loads the first page, appends pages with `loadMore`, restarts when its filter key changes and re-fetches all loaded pages on refresh/expiry so every URL is re-signed.

Evidence: 4 new integration tests (81 total) with 127 listed photos including 40 identical timestamps and 40 microsecond-apart rows — pages of 50/50/27 equal the database order with no gaps or repeats, the 100 cap, ascending pages of 33, status/category/guest filters, counts, invalid limit/cursor/filter `422`, and public galleries paging 50/50/20 oldest first on both links with `total`; 4 cursor unit tests; component tests for incremental pages, re-signing all loaded pages and restart on a new key.

## 2026-11-24 — M4: signed read URLs in photo lists and galleries

`GET /api/weddings/:id/photos` (UC-34), the moderation responses (`PATCH /photos/:id`, `bulk-status`) and both public galleries now return `url` (web version) and `thumbUrl` signed for one hour (`READ_URL_TTL_SECONDS = 3600`, SPEC §6.3). Originals are never signed in these responses (`originalUrl` is absent); `width`/`height` are added to `PublicGallery.photos[]`.

Decisions:

- **One Storage call per response:** all web/thumb paths of a list are signed with the bulk endpoint `POST /storage/v1/object/sign/photos { expiresIn, paths }`, returned as absolute `${SUPABASE_URL}/storage/v1…` URLs. A path Storage cannot sign is returned as `null` instead of failing the list. URLs are signed per response and never cached server-side.
- **Interim list shape:** `GET /weddings/:id/photos` returns `{ photos }` newest first (`createdAt`, `id` descending), excluding `uploading` reservations, and answers `404 weddingNotFound` for another organizer's event. Cursor/limit/`nextCursor` are the next M4 slice; until then the list is unpaginated.
- **Frontend reload (SPEC §7.3):** `useSignedList` in `apps/web/src/features/photos` loads lists through `apiFetch` and re-signs them by reloading (1) 5 minutes before the hour expires, (2) when a tab becomes visible after that point (throttled timers on sleeping phones), and (3) when an `<img>` fails (`SignedPhoto` `onError`). Simultaneous failures share one reload; after an error-triggered reload further failures are ignored for 30 s so a permanently broken image cannot loop. `SignedPhoto` is a plain lazy/async `<img>` with intrinsic size (not `next/image`, per SPEC §7.3). The grids, enlarged view and slideshow that consume these are the next UI slices.

Evidence: 6 new integration tests (77 total) against real local Storage — signed URLs load without credentials as JPEG web/thumb derivatives with a 3600 s token lifetime, newest-first order without reservations, `401`/foreign `404`, signed moderation responses, approved-only signed photos on the personal and QR galleries while open (empty while closed), and a 1 s URL that stops working after expiry. 7 new component tests for `SignedPhoto`, error-triggered reload with cooldown, proactive/visibility refresh and the loaders.

## 2026-11-22 — M4: photo moderation endpoints

`PATCH /api/photos/:id`, `POST /api/weddings/:id/photos/bulk-status` and `DELETE /api/photos/:id` implement UC-36, UC-37 and UC-39 behind the M2 onboarding guard, with an ownership check on every call.

Decisions:

- **Status values:** only `pending`, `approved` and `hidden` are accepted (`422 badStatus`). `uploading` is an internal state and cannot be set by the organizer.
- **Ownership:** a photo outside the organizer's event answers `404 photoNotFound`; a bulk request for a foreign event answers `404 weddingNotFound`. This mirrors the "not disclosed" rule used elsewhere.
- **Bulk scope (SPEC §6.6 item 1):** the update is constrained to the event id **and** the given ids, so foreign photo ids in the list are silently skipped instead of failing the batch; the response contains only the photos that changed. A non-array or non-string `ids` is `422 badRequest`.
- **Deletion:** the three stored objects (original, web, thumb) are removed before the row; if Storage fails the row stays so the action can be retried. Deleting a foreign photo leaves its row and files untouched.
- **Response shape:** `{ photo }` / `{ photos }` with the photo metadata (`weddingId`, `guestId`, sender, category, message, status, dimensions, size, createdAt). `url`/`thumbUrl` are `null` until the signed-URL slice adds them.

Evidence: 3 new integration tests (71 total) against real Storage: approve/hide/pending with `badStatus`, missing and foreign photos (`404`) and missing token (`401`); bulk updates that change only the event's photos while a foreign id stays `pending`, plus invalid status/ids and a foreign event; deletion that removes all three objects and the row, keeps a foreign photo and its files, and answers `404` on repeat.

## 2026-11-22 — M4: sharp `web`/`thumb` derivatives with EXIF stripping

`complete` now generates the two derivatives from the downloaded original: `web` (long side 1600 px, JPEG q80) and `thumb` (long side 400 px, JPEG q75), stored at `events/{eventId}/web/{photoId}.jpg` and `events/{eventId}/thumb/{photoId}.jpg`. The paths are written on the same atomic `uploading → pending|approved` transition as the metadata, so a photo never becomes visible without its derivatives.

Rules and decisions:

- **Orientation first, metadata last:** the pipeline starts with `.rotate()` (applies EXIF orientation), then resizes with `fit: 'inside'` and `withoutEnlargement`, then writes a fresh JPEG. sharp strips EXIF/GPS/ICC because no `withMetadata()`/`withExif()` is used; tests assert `metadata().exif === undefined` on both outputs and a swapped width/height for an orientation-6 source.
- **Bounded processing:** `limitInputPixels: 50_000_000` and `sequentialRead`, one image per `complete` call. Both derivatives are produced in parallel from `clone()`s of the same pipeline.
- **Failure semantics:** if derivative generation or upload throws, `complete` fails and the photo stays `uploading`, so the client can call `complete` again (the original is already in Storage and uploads use `x-upsert`). The next completion regenerates and overwrites the derivatives.
- **Storage client:** a new service-role `uploadObject` posts the generated buffers with `x-upsert: true`; no signed URL is needed for server-generated files.

Evidence: 3 new API unit tests (43 total) for 1600/400 sizes, stripped EXIF/GPS/ICC, orientation-6 rotation and rejection of unreadable bytes; integration upload tests now assert the derivative paths, real JPEG objects without EXIF, the small-image no-enlargement case and orientation-6 dimensions (68 total).

## 2026-11-22 — M4: signed direct-to-Storage uploads and `complete`

`POST /api/public/invitations/:token/uploads`, `POST /api/public/weddings/:slug/uploads` and `POST /api/public/uploads/:photoId/complete` implement the SPEC §6.3 upload flow. The API never receives the file: it validates the declared files, reserves their bytes, creates `uploading` rows and returns a two-hour signed Storage upload URL plus a secret `uploadKey` per photo; the guest PUTs directly to Storage and then calls `complete`.

Decisions and rules:

- **Upload tickets:** 1–50 files per request (`noFiles`/`tooManyFiles`), only `image/jpeg|png|webp` (`notImage` with the file name), declared size ≤ `MAX_UPLOAD_MB` (`tooLarge`). `senderName` ≤120, message ≤1000, category `memories|wedding`. The path is `events/{eventId}/original/{photoId}.{ext}`; the secret is 32 random bytes (base64url) and only its SHA-256 hex hash is stored.
- **Reservations:** the event row is locked (`select … for update`) in one transaction; the sum of all photo rows (including `uploading` reservations) plus the requested bytes must fit `storage_limit_bytes`, otherwise `403 { code: 'storageLimit' }`. Two concurrent batches cannot both pass (integration test: one `201`, one `403`). Signing happens after the commit; if signing fails the reservation rows are deleted.
- **`complete`:** the key is compared to the stored hash in constant time; a wrong key or unknown photo is `404 photoNotFound`. The object must exist (`422 uploadNotFound`, the row stays so the client can retry the PUT), sharp must decode it (real format/dimensions, 50 MP decompression ceiling) or the object and row are deleted (`422 notImage`), and the actual size must still fit the ceiling (`403 storageLimit`, object and row removed). The moderation status is `approved` when `autoApprovePhotos` is on, else `pending` (SYS-2); repeated calls are idempotent (`{ id, status }`), and an atomic `status = 'uploading'` transition serializes concurrent completions.
- **QR uploads** require `allowGeneralUpload` (`403 qrUploadDisabled`); the personal link always works. Upload-URL requests are rate-limited to `RATE_LIMIT_UPLOADS_PER_10_MIN` (default 20) per token or slug + trusted IP, on top of the public read bucket.
- **Storage client:** the signed URL from Storage is a path relative to the Storage API; it is returned to clients as `${SUPABASE_URL}/storage/v1${url}` so the browser can PUT directly. Batch deletes use the bucket endpoint without a trailing slash (a trailing slash answers 404).
- **Derivatives are the next M4 item:** `complete` currently records the original's real metadata and moderation status; `thumb`/`web` generation, EXIF stripping, signed read URLs, pagination, moderation endpoints and the upload UI follow in the remaining M4 slices.

Evidence: 7 new integration tests (67 total) against the real local Storage: a real JPEG upload and completion (dimensions, size, `uploading` → `pending`, idempotent repeat), wrong key/missing object, an unreadable object deleted with its row, file count/type/size validation, the storage ceiling with an atomic concurrent test, auto-approve, and the QR-disabled `403` while the personal link keeps working.

## 2026-11-22 — M3 complete: organizer and guest UI, E2E S4/S5/S6

M3's remaining work — the product screens for the dashboard, guests, invitation editor and the personal invitation — is done. The port keeps the prototype's copy (locale JSON files copied unchanged from `apps/demo`, plus the celebration overlays), the same CSS classes and the same template components.

Decisions recorded:

- **Client i18n:** `react-i18next` is added to the product. `src/lib/i18n/create.ts` builds one i18next instance per locale and event type (celebration overlays deep-merged from the demo JSON), `LocaleProvider` wraps every client tree with that instance, and server pages keep using `getTranslator()`. No module-level singleton is used, so concurrent SSR of different languages/events cannot leak copy (asserted by `e2e/ssr.spec.ts`).
- **Templates:** the 11 prototype templates are ported to `src/templates` as typed client components. They receive translations through `useTranslation('templates')` and dates through the locale-aware helpers in `src/lib/format.ts`; shared helpers (`inviteInfo`, `MapLink`, `CalendarButton`) take `t`/locale explicitly. The invitation's schedule entries get stable ids for React keys when the stored items have none.
- **Guest page (UC-58 – UC-64):** `/i/[token]` is server-rendered from the same public service the API uses (`getGuestInvitation`), with per-request locale/event overlay, `noindex`, link-preview metadata without guest names/tokens, and the envelope → template → RSVP → notify flow. RSVP/notify/`opened` call the public API from the client. The album card shows the gallery status and the notify form; photo upload/gallery buttons are omitted until M4, because those pages and signed URLs are M4 DoD items. The invalid link renders the localized not-found page with the "back home" action (UC-70).
- **Dashboard (UC-11 – UC-16):** the existing countdown card gains invited/coming/waiting/opened stats from the guest list and quick links to guests and the invitation. Full dashboard widgets (replies, new photos, QR card, notification card) remain with their owning milestones (M4/M5).
- **Guests (UC-17 – UC-26):** `/app/gosti` ports the prototype table with search, side and RSVP filters with counts, page size and paging, add/edit modal (companion none/open/named, manual answer), import (`Ime; broj osoba; telefon`, also comma/tab), CSV export, copy link, WhatsApp message and open-as-guest, and delete confirmation. The manual answer is filtered to the edited companion list before it is sent, so an organizer removing a companion never sends an uninvited name back.
- **Invitation editor (UC-27 – UC-32):** `/app/pozivnica` shows all 11 looks with names/descriptions/accents, the accent palette, names/occasion, date, city, slug, headline, message and the schedule editor, with a live phone-frame preview rendered by the real template components. Save uses `PATCH /weddings/:id` (the SPEC §6.6 validation from the previous slice). Template switching picks the template's first accent when the current colour is not in its palette.
- **Shell:** the M2 header gains Gosti and Pozivnica links and is wrapped in `LocaleProvider`; the phone-required dialog and superadmin redirects are unchanged.
- **`PhoneField` optionality:** the ported field is no longer `required` by default (a guest phone is optional); the phone-required dialog, account settings and admin account form set it explicitly.
- **E2E:** S4 (named companions, 3-row import, look + colour, save and reload), S5 (envelope, invitation with the guest name, RSVP with one named companion, notify email, organizer sees "Dolazi 2/2", "Otvorena", "Čeka"), S6 (companion change trims the answer to `2/2` and `sa: Nikola`), plus an SSR concurrency/locale/event test and the updated seeded-invitation landing test. In dev Next normalizes the guest `Cache-Control` to `no-store`; the exact `private, no-store` stays covered by `spike:check` in a production build.

Evidence: `lint`, `typecheck`, `format:check`, `build`, `build:demo`; unit 79 shared + 40 API; component 37 (new tests render the guests page with API mocks, the editor with 11 templates and the guest RSVP/notify flow; coverage 76.6 % lines / 67.5 % branches); integration 60; Playwright 28 on Chromium and mobile WebKit (S1–S6, S12, S17, landing, SSR, Google callback).

## 2026-11-22 — M3: fixed-window rate limiting (SYS-12)

The public guest API is rate-limited by trusted IP: `GET /public/*` allows 300 requests per minute by default, and `POST …/rsvp`, `POST …/notify` (guest and QR) allow 30 per 10 minutes, on top of the read bucket. `POST /onboarding` and `PATCH /auth/me` allow 30 per 10 minutes per user. Values are environment variables (`RATE_LIMIT_PUBLIC_READ_PER_MIN`, `RATE_LIMIT_PUBLIC_WRITE_PER_10_MIN`, `RATE_LIMIT_AUTHENTICATED_PER_10_MIN`) with those defaults, documented in `.env.example` and `ENVIRONMENT.md`.

Implementation decisions:

- **Atomic fixed windows in `rate_limits`:** one `insert … on conflict (key, window_start) do update set count = count + 1 returning count` per request (SPEC §8.2). The integration test fires five concurrent requests against a limit of two and exactly two pass.
- **No raw identifiers:** the bucket key is `<scope>:<HMAC-SHA256(scope|identifier)>`, keyed by `RATE_LIMIT_SECRET` or, when unset, the server-only service-role key. Tests assert the stored key is a 64-hex hash without the IP.
- **Trusted IP:** `x-real-ip` (set by Vercel) is used; the first `x-forwarded-for` hop is accepted only outside production (local dev/E2E) so a spoofed header cannot bypass production limits. With no IP the bucket is `unknown`, which still limits instead of disabling the check.
- **Fail open with a log:** a database error during the increment logs `rate limit check failed; allowing the request` instead of taking the public site down. The 429 envelope keeps `{ message, code, requestId, traceId }`, is localized (`tooManyRequests`) and adds `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Remaining`.
- **Middleware order matters:** the limiters are registered before `publicRoutes`; otherwise Hono's later routes are not wrapped (found by the first integration run).
- Upload limits (20/10 min per token or slug+IP), Supabase Auth's own limits, `rate_limits` cleanup and rate-limit metrics keep their own M4/M6 items.

Evidence: 2 new API unit tests for window rounding and keyed hashing, and 5 new integration tests (60 total): localized `429` with `Retry-After` and correlation IDs, separate buckets per IP, hashed keys in `rate_limits`, atomic concurrent counting (2 pass / 3 rejected out of 5), the RSVP write bucket, and the per-user `PATCH /auth/me` limit leaving another user unaffected.

## 2026-11-22 — M3: public invitation, RSVP, notify and gallery

The public guest API is in: `GET /api/public/invitations/:token`, `POST …/opened`, `POST …/rsvp`, `POST …/notify`, `GET …/gallery`, `GET /api/public/weddings/:slug`, `GET /api/public/weddings/:slug/gallery` and `POST /api/public/weddings/:slug/notify`. None of them takes an `Authorization` header and none returns organizer contact data, the guest list, tokens of other guests or signed URLs.

Decisions recorded:

- **Response wrappers:** the invitation answers `{ guest, wedding }`, the gallery `{ gallery }`, the public wedding `{ wedding }` and the rest as in API.md (`{ ok: true }`, `{ rsvp }`, `{ notifyEmail }`). The bare `PublicWedding`/`PublicGallery` from the older API.md are wrapped like the other product endpoints; the shape inside is unchanged.
- **PublicWedding** includes `type` and `occasion` (the celebration wording needs them, SYS-8) in addition to the API.md fields, and `gallery = { open, mode, opensAt, viaQr }` computed with the shared `isGalleryOpen`/`galleryOpensAt` in Europe/Belgrade (SYS-3). `settings` exposes only `allowGeneralUpload`.
- **PublicGuest** exposes `prefillEmail = notifyEmail || guest.email`, so the guest form can prefill without revealing anything else.
- **`opened`** stores the first timestamp only; repeat calls keep it.
- **RSVP** uses the shared `parseRsvp` without `manual`, so only `yes|no` is accepted (`pending` → `422 chooseAttendance`), uninvited names → `companionNotInvited`, and the open-person bound → `personsRange`. The note is limited to 1000 characters (`textTooLong`) and `respondedAt` is always set by the server.
- **`notify`** validates the address (`invalidEmail`), stores it, sets `notifyRequestedAt`, and resets `notifySentAt` only when the address changes (SYS-4). `notify_locale` is the request's `Accept-Language` (SYS-13), for future "photos are ready" emails.
- **QR notify** requires `galleryViaQr` (`403 galleryPersonalOnly`) and inserts a `photo_subscribers` row with the request language, ignoring duplicates through the unique `(event_id, email)` index; a repeated email keeps the existing name.
- **Gallery contents:** both gallery endpoints return `{ open, mode, opensAt, photos }`; photos are only approved rows and only while open. `url`/`thumbUrl` are `null` and there is no cursor pagination yet, because signed Storage URLs and pagination are the M4 DoD items (§6.3); the M4 gallery work fills them in. The gallery UI is therefore not rendered in M3.
- **Uploads are not part of this item:** `POST …/photos` (multipart) is replaced by the M4 signed-upload flow and does not exist yet.
- **Archived events (SYS-9) and rate limiting (SYS-12)** are not applied here yet; the archived state and the public-route limits have their own M6/M3 items.

Evidence: 13 new integration tests (55 total) against the local database: public invitation shape with `prefillEmail` and no private fields, unknown token `404`, first `opened` kept, RSVP success/`respondedAt`, `companionNotInvited`/`personsRange`/`chooseAttendance`/`textTooLong`, notify with locale and SYS-4 reset, invalid email, public wedding by slug and `404`, gallery empty while closed and approved-only when `now`, `after_wedding` opening in Europe/Belgrade, manual switch, `galleryViaQr=false` blocking the QR gallery and notify while the personal link keeps working, subscriber dedupe with locale.

## 2026-11-22 — M3: guests (list, create, import, edit, delete)

`GET/POST /api/weddings/:id/guests`, `POST /api/weddings/:id/guests/import`, `PATCH/DELETE /api/guests/:id` cover UC-17 – UC-25 behind the M2 onboarding guard. A guest response uses the prototype's shape: `id, weddingId, name, token, email, phone, side, companions, maxPersons, invitedAt, openedAt, rsvp { status, persons, companions, note, respondedAt }, photoNotify { email, requestedAt, sentAt }`. List/create/patch answer `{ guests }`/`{ guest }` (the wrapper convention used elsewhere); delete answers `{ id }` as in API.md.

Rules and decisions:

- **Ownership:** the event must belong to the organizer, and `PATCH`/`DELETE /guests/:id` resolve the guest's event the same way. A foreign event or guest answers `404` (`weddingNotFound`/`guestNotFound`), so existence is never disclosed.
- **Tokens:** 12 base62 characters from `crypto.randomInt`, unique through the existing index. The integration test checks the format and uniqueness across created guests.
- **Companions** use the shared `parseCompanions` (`named` needs 1–19 names, `open` needs `max` 1–19), `maxPersons` is derived as `1 + allowed companions`, and the default is `none`. Invalid companion input is `422` with the existing shared codes.
- **Validation:** empty name → `guestNameRequired`, name >120 → `textTooLong`, invalid email → `invalidEmail`, invalid non-empty phone → `invalidPhone`, unknown side → `badSide` (new shared message in sr/en/ru, together with `tooManyGuests`). A blank email/phone is stored as `''`.
- **Import (UC-19, SPEC §6.6 item 6):** at most 1000 rows (`422 tooManyGuests`), empty names are skipped, an invalid phone is dropped, an invalid email is dropped, an unknown side becomes `zajednicki`, and `maxPersons > 1` becomes an open companion allowance. Every accepted row is inserted in one statement; the endpoint returns only the new guests.
- **Edit (SYS-5):** changing companions without a new `rsvp` trims an existing "coming" answer — named companions that are no longer invited are removed, open answers are lowered to the new maximum, and `persons` follows. Manual RSVP entry uses the shared `parseRsvp` with `{ manual: true }`, so `pending` is allowed and clears `respondedAt`; `yes`/`no` set it. Uninvited names (`companionNotInvited`) and too many persons (`personsRange`) keep the prototype messages.
- **Delete (UC-25):** only the guest row is deleted; the `photos.guest_id` foreign key is `ON DELETE SET NULL`, so their photos stay and the personal token stops resolving.

Evidence: 12 new integration tests (42 total): authorization/ownership for every route, defaults and token format/uniqueness, all validation codes, named/open `maxPersons`, per-event listing, import normalization/skipping/1000-row cap/empty list, field edits keeping the token, SYS-5 trimming for named and open answers, manual RSVP rules and `respondedAt`, and deletion keeping the photo with `guest_id = null`.

## 2026-11-22 — M3: weddings read/update with the SPEC §6.6 validation

The first M3 slice adds `PATCH /api/weddings/:id` next to the existing `GET /api/weddings/current`. Both run behind the M2 onboarding guard, so an unfinished account still gets `409 onboardingRequired`; a missing token is `401 unauthorized`.

The patch accepts only `slug`, `partner1`, `partner2`, `occasion`, `date`, `rsvpDeadline`, `city`, `invitation` and `settings`. Unknown top-level keys and unknown `invitation` keys answer `422 badRequest`; unknown `settings` keys answer `422 badSettings` (a typo must not be silently stored). A foreign or unknown event id answers `404 weddingNotFound` rather than `403`, so ownership is not disclosed; `type` is not patchable here (the superadmin changes it, UC-73). Invitation and settings are merged with the stored values, not replaced.

Validation follows SPEC §6.6 items 2, 3, 4 and 7:

- slug is trimmed and lowercased, must match `^[a-z0-9-]{3,40}$` and be unique among events (`422 badSlug`); the organizer's own current slug is accepted.
- the 11 prototype template ids are enforced (`klasik, minimal, botanika, romantika, editorijal, noc, rustik, akvarel, zlatna-geometrija, boho, bordo`), not the four in the older API.md (`422 badTemplate`).
- accentColor must be `#RRGGBB` in either case (`422 badColor`); headline ≤200 and message ≤2000 (`422 textTooLong` with `max`).
- schedule: at most 20 items (`422 tooManyScheduleItems`), each with a 24-hour `HH:mm` time and a non-empty title ≤200 (`422 badSchedule`). The prototype's optional `id`, `place` (≤200) and `mapUrl` (http/https ≤500) are preserved; `InvitationDesign.schedule` in the Drizzle schema was extended to those optional fields (JSONB type only, no migration).
- settings: the five known keys only; `galleryOpen` must be `now|after_wedding|manual` (`422 badGalleryMode`), the rest booleans (`422 badSettings`).
- names/city reuse the shared length limits (name/occasion 120, city 120); a wedding cannot lose either name (`namesRequired`), a celebration requires the celebrant (`celebrantRequired`) and may clear `occasion`; `rsvpDeadline` is `null` or a real calendar date (`422 badDeadline`).
- a changed `date` recalculates `purge_at` with the stored retention (SYS-9); `GET /weddings/current` now includes `rsvpDeadline` in the wedding payload.

New shared modules keep the same rules usable by the editor later: `packages/shared/src/invitation.ts` (template ids, color, schedule normalizer, 20-item cap) and `limits.ts` (the SPEC §6.6 text limits, also used by onboarding and admin). Seven new message keys exist in sr/en/ru: `badTemplate`, `badColor`, `badSchedule`, `tooManyScheduleItems`, `badSettings`, `badDeadline`, `textTooLong`.

E2E determinism also changed in this slice. With many parallel workers, several signups hit the local Supabase Send Email Hook at once and GoTrue logged `Request timed out … EOF`; a confirmation link from a rolled-back attempt then answered `otp_expired`, and the S12 click could be lost during hydration. The suite now runs `workers: 2`, warms the API with `/api/health` in `globalSetup` (so the hook route is compiled before the first signup), retries the signup submit while failing fast on a visible form error, and retries the S12 create/deactivate clicks until the expected state appears. Three consecutive full runs are green.

Evidence: 6 new shared unit tests (79 total) for templates, colors, times and schedule normalization, and 7 new integration tests (30 total) against the local database: partial update with invitation/settings merge and unchanged `purge_at`, slug format/uniqueness/own slug, template/color/schedule/length/unknown-key rejections, settings validation, empty/unknown/date/deadline/name/city rejections, foreign and unknown ids (`404`, nothing changed), and celebration fields. `lint`, `typecheck`, `test:unit`, `test:component`, `build`, `build:demo`, `test:integration`, `test:e2e` (20, three consecutive runs) and `format:check` are green.

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
