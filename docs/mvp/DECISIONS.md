# MVP decisions and deviations

This file records architecture decisions, spec corrections and implementation deviations. Scope changes still require owner approval.

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
