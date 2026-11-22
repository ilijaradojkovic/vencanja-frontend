# Local development, seeds and observability

Local development is a first-class requirement, not a best-effort fallback. **M0–M6 and their tests must run without hosted Supabase, Vercel, Resend, Google or analytics accounts.** Cloud integrations are verified from M7 onward; only the real external behavior that cannot exist locally is deferred.

## 1. Local topology

```text
Browser / Playwright
        │
        ▼
Next.js + mounted Hono API  ───────────────► stdout JSON/pretty logs + /api/metrics
  │  │  │  │                                            ▲
  │  │  │  └─ Auth/Storage/Postgres ─► Supabase CLI     │
  │  │  │       (all local Docker containers)            │ scrape
  │  │  └───────────────────────────► Prometheus ─► Grafana
  │  └─ SMTP ─► Inbucket (Supabase CLI)
  └─ server-only services use the same local DB/Storage

Supabase Auth Send Email Hook ─► host machine Next.js API ─► local SMTP/Inbucket
```

- Next.js runs on the host with `npm run dev`; Hono is mounted in the same process.
- The pinned Supabase CLI supplies local Postgres, Auth, Storage, Studio and Inbucket. No hosted Supabase project is needed.
- Local email uses an SMTP `EmailSender` pointed at Inbucket. Production uses the Resend implementation behind the same interface. Local development never silently sends real email.
- Google’s real hosted redirect and Vercel Analytics delivery are external-integration checks in M7/M8. Local tests cover callback/state handling with local Auth identities/test fixtures and verify that analytics makes no request without consent; they must not claim real Google/Vercel delivery.
- Cron is invoked locally through the authenticated endpoint with injected time. Vercel scheduling itself is checked in M7/M8.

Expected default URLs (configurable when ports conflict):

| Service | URL |
|---|---|
| Product | `http://localhost:3000` |
| Supabase API/Auth/Storage | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Inbucket | `http://127.0.0.1:54324` |
| Inbucket SMTP | `127.0.0.1:54325` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3001` |

When Supabase containers call the host-run Next.js hook, use the documented host alias for the current OS/Docker runtime (normally `host.docker.internal`); do not use container-local `localhost`. The hook still verifies a local-only Standard Webhooks secret.

## 2. One-command lifecycle

M1 establishes these root scripts:

| Command | Behavior |
|---|---|
| `npm run dev:bootstrap` | Check Docker/Node prerequisites, start Supabase and observability, migrate, seed and print local URLs/credentials |
| `npm run dev` | Start Next.js + API after bootstrap |
| `npm run dev:services` | Start local Supabase and observability without resetting data |
| `npm run db:seed` | Idempotently create/update only the documented local seed fixtures |
| `npm run dev:reset` | **Local-only** reset, migrate and reseed; refuses non-local targets |
| `npm run dev:teardown` | Stop project-owned local services; does not delete volumes unless explicitly requested |

A fresh clone requires only the pinned Node version, npm, Docker and `npm ci`, followed by `dev:bootstrap` and `dev` in separate terminals. Missing optional cloud credentials must not block these commands. Setup scripts give actionable errors for unavailable Docker or occupied ports.

`dev:reset` and seed scripts reject non-local DB/Auth URLs. Destructive reset additionally requires `ALLOW_LOCAL_RESET=1` supplied to that command. They must not infer safety merely from `NODE_ENV`; hostname/port allow-listing plus the confirmation guard are required. Preview/production are never seeded or reset by these commands.

## 3. Deterministic development seeds

Implement seeds as maintained TypeScript/SQL fixtures under `supabase/` or `scripts/`, using local Supabase Admin APIs for Auth users rather than inventing password hashes. Fixed UUIDs/tokens are acceptable **only locally**. Seeds are idempotent, do not send email and print useful invitation/upload/gallery links after completion.

Required fixture set:

| Fixture | Required state |
|---|---|
| Superadmin | Verified local admin; can manage accounts, retention and storage limits |
| Wedding organizer | Verified, onboarded; invitation, guests in different RSVP/companion states and default 50 MB storage |
| Celebration organizer | Verified, onboarded; celebration wording and slug/side examples |
| New organizer | Verified but no event, for onboarding |
| Unconfirmed organizer | Exercises confirmation/resend UI through Inbucket |
| Google-linked organizer | Local identity fixture for provider-specific UI/state, explicitly not a real Google OAuth test |
| Guests | Pending/yes/no, open/named/no companions, notification pending/sent and deterministic local personal links |
| Photos | Real small JPEG/PNG/WebP fixtures in local Storage with uploading/pending/approved/hidden rows and valid original/web/thumb variants |
| Subscribers | QR subscribers in pending/sent states |
| Retention | Events due for 30-day/7-day warnings, unfinished upload cleanup and an already archived event |
| Storage limit | A local event near its small configured limit for `storageLimit` testing |
| Inactive account | Deactivated organizer for auth/authorization testing |

Use safe `.test` addresses and documented local-only passwords; never production personal data. Example organizers are `couple@uspomena.test`, `celebration@uspomena.test` and `admin@uspomena.test`. Do not reuse demo passwords shorter than Supabase’s configured minimum.

General E2E tests create isolated records and clean them up rather than depending on mutable seed state. A small smoke suite may use the seeds to verify the developer journey. Seed fixtures and translations evolve in the same task as the relevant feature.

## 4. Structured logging

Use **Pino** (or an equivalent small JSON logger if documented in `DECISIONS.md`) shared by Next server code and Hono services:

- Local output uses `pino-pretty`; CI/Preview/Production output is newline-delimited JSON to stdout.
- Generate a cryptographic `requestId` per incoming request and propagate a validated W3C `traceparent` trace ID across all calls belonging to one browser action; return `x-request-id` and `x-trace-id`, and pass both explicitly into service/error logs. If the header is absent/invalid, generate a new trace rather than trusting it.
- Include timestamp, level, message, request ID, method, normalized route template, status and duration. Include error cause/stack in local logs; public responses never expose stack traces.
- Never log authorization/cookie headers, passwords, access/refresh/guest/upload/reset/hook/cron tokens, raw IPs, email bodies, invitation messages or signed URL query strings.
- Do not log raw parameterized paths such as invitation tokens. Redaction is covered by unit tests, and API errors include the request ID shown in the response/log correlation.
- Avoid a `console.log` side channel. Third-party/library logs must not leak sensitive request data.

## 5. Tester diagnostic export

A tester must be able to attach a single **schema-versioned JSON support bundle** to a bug report. Error details and the local developer/testing menu provide **Copy diagnostic ID** and **Download diagnostic report**. Error responses include `{ message, code, requestId, traceId }`; normal toasts may remain short, but the IDs stay accessible in error details until dismissed.

### Correlation and capture

- A browser action (form submit, RSVP, upload batch, moderation action, download, etc.) starts a trace. Axios/fetch instrumentation sends its W3C `traceparent` on every related API call; retries preserve the trace but receive distinct request IDs and spans. Direct Storage uploads and Supabase browser operations are recorded as sanitized client/network spans even though they do not pass through Hono.
- Direct server-rendered page loads start a server trace. API/server spans cover normalized route, service operation and own DB, Storage, email, image-processing and cron steps. Each span records `traceId`, `spanId`, optional `parentSpanId`, `requestId`, start timestamp, duration, outcome and stable error code. For Supabase Auth email hooks that cannot receive the browser header, propagate a validated diagnostic trace ID through the auth redirect metadata where supported; otherwise record a client-only provider operation and an explicit missing-server-link warning.
- The browser keeps a bounded diagnostic ring (most recent 200 sanitized events/errors and recent route templates) in memory/IndexedDB for the current testing session. Nothing is uploaded automatically, and analytics consent is irrelevant. Export happens only after the tester's explicit action.
- Local Pino logs and spans also go to bounded, git-ignored JSONL files under `.logs/` (maximum 7 days/100 MB, with bootstrap cleanup). Product behavior must not depend on these files; export notes any unavailable/truncated portion.

### Support bundle contents

`uspomena-diagnostic-<traceId>.json` contains:

- `schemaVersion`, export time, app version/commit, environment, browser/platform, language and event type
- trace ID, all related request IDs and the current normalized route
- ordered browser events and network outcomes (method, normalized route, status, duration, retry/attempt), including failures with no HTTP response
- matching local backend spans and redacted logs, with local error stack/cause
- explicit `warnings` for missing client/server portions and a `redactions` summary

It must **not** contain authorization/cookie values, passwords, access/refresh/guest/upload/reset/hook/cron tokens, raw invitation tokens, signed URLs/query strings, email addresses, personal names/phone numbers, filenames, invitation/photo message bodies, request/response payloads or real personal media. Use route templates and stable field/error names only. The export UI warns the tester to review before sharing despite automated redaction.

Local `POST /api/diagnostics/export` combines the submitted sanitized browser events with matching server traces/logs and returns the JSON download. It accepts only the versioned schema, a valid trace ID and a body of at most 256 KB; it cannot execute arbitrary log queries. It exists only when `DIAGNOSTICS_ENABLED=true` in local development and otherwise returns `404`; it is never a production log-reading API. Preview/Production still support a client-only report containing trace/request IDs and sanitized browser events, with a warning that backend events must be looked up in provider logs.

A failed upload, thrown service error or rejected form must therefore be reconstructable as, for example: `upload button → POST uploads 201 → Storage PUT failed → retry 1 → complete 500 → image.decode error`, with timestamps/durations and matching server logs. No raw file or guest data is needed for that reconstruction.

## 6. Local metrics

Use **`prom-client`** in the Node runtime, with committed Prometheus and Grafana configuration under `infra/observability/` (Docker Compose is used for this required local observability stack; Supabase remains CLI-managed).

Minimum instrumented metrics:

- `http_requests_total` and `http_request_duration_seconds` by method, normalized route and status/class
- `http_errors_total` by normalized route and stable error code
- `photo_uploads_total{outcome}` and `photo_processing_duration_seconds`
- `rate_limit_hits_total{route}` and storage-limit rejections
- `emails_sent_total{kind,outcome}`
- `cron_runs_total{job,outcome}` and `cron_job_duration_seconds`
- Standard Node process/runtime metrics where useful locally

Labels must never contain raw paths, IDs, tokens, IPs, emails or other unbounded/sensitive values. Grafana provisions a Prometheus datasource and a small dashboard for request rate/p95/errors, upload processing, email outcomes and cron runs. Metrics tests cover registration and label redaction rather than scraping screenshots alone.

Expose `/api/metrics` only when `METRICS_ENABLED=true` and require `METRICS_TOKEN`, including locally. The committed Prometheus scrape configuration reads the local token from an ignored environment file. In production this endpoint is disabled by default: in-memory counters in ephemeral Vercel functions are not a globally accurate production metrics system. Production MVP observability uses structured Vercel/Supabase/Resend logs and provider metrics; a hosted OTel/metrics backend is a later, explicit decision.

## 7. Definition of locally ready

A developer/agent can, without cloud credentials:

1. Bootstrap from a fresh clone and open seeded organizer/admin/guest flows.
2. Sign up, confirm/reset email through Inbucket, onboard and exercise authorization.
3. Upload real local fixtures, process them, moderate, view paginated galleries and download originals.
4. Send gallery emails locally, invoke retention/cleanup jobs and inspect results.
5. Run unit, integration, component and E2E suites entirely locally.
6. Correlate a failing request by trace/request ID in logs and Grafana, then export one redacted diagnostic JSON with matching browser and backend events.

Real Google OAuth, real Resend delivery, Vercel Cron/Analytics and production/Preview deployment remain explicitly labeled external checks in M7/M8; local doubles are not presented as proof that those services work.
