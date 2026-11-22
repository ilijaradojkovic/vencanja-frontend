# MVP environment and command contract

This is the implementation checklist for configuration names and ownership. It contains no secrets. M0/M1 create the corresponding `.env.example` files and root scripts; update this document whenever they change.

## 1. Environments

| Environment | Web/API | Supabase | Email/data policy |
|---|---|---|---|
| Local | `npm run dev` | Local CLI stack: Postgres + Auth + Storage | SMTP/Inbucket; disposable seeded data only; no cloud credentials |
| Preview (M7+) | Vercel Preview | Shared staging project, with controlled migrations | Resend allow-listed recipients only; no production personal data |
| Production | Vercel Production | Production project | Verified domain; real data |
| Demo | `npm run dev:demo` / `build:demo` | None | Existing Vite mock/localStorage only |

Never point Preview or local development at production. **M0–M6, CI and local E2E require no hosted Supabase, Vercel, Resend, Google or analytics account.** Do not expose privileged Preview environment variables to untrusted fork PRs; require approval for those deployments. Secrets must be entered through local ignored files or provider secret settings, never written into documentation or committed. See [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) for bootstrap, seeds and observability.

The existing root Vite `.env*` files describe the prototype/demo. They are not the product configuration and should move with it unchanged; the product uses `apps/web/.env.example` and ignored local/provider-specific values.

## 2. Product variables

| Name | Visibility | Required | Purpose/default |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | M1/M2 | Supabase project URL; safe to expose |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | M1/M2 | Publishable/anon key; safe to expose, not the service-role key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | M1/M2 | API DB/Storage/Auth administration; never prefix with `NEXT_PUBLIC_` |
| `DATABASE_URL` | **Server only** | M1 | Runtime Postgres transaction-pooler URL, with the required pooler/prepare configuration |
| `DIRECT_URL` | **Server only** | M1 | Direct/session Postgres connection used by migrations, not runtime transaction pooling |
| `APP_URL` | Server | M1/M2 | Canonical origin with no trailing slash; email links, callbacks and metadata |
| `NEXT_PUBLIC_DEMO_URL` | Browser | M7 | Separate demo origin used by landing-page links |
| `RESEND_API_KEY` | **Server only** | M7 Preview/M8 Production | Resend sending; not used locally |
| `EMAIL_FROM` | Server | M2 | Verified sender, default `Uspomena <noreply@uspomena.rs>` until Q1 changes; local sender can use a `.test` equivalent |
| `EMAIL_DRIVER` | Server | M1/M2 | `smtp` locally/test, `resend` in Preview/Production; unknown values fail closed |
| `SMTP_URL` | **Server only** | Local/M2 | Inbucket SMTP, default `smtp://127.0.0.1:54325`; no real local email delivery |
| `EMAIL_ALLOWLIST` | **Server only** | M7 Preview | Comma-separated permitted Preview recipients; production behavior must not silently discard mail |
| `SUPABASE_AUTH_HOOK_SECRET` | **Server only** | M1 local spike/M2 full flows | Standard Webhooks verification for the raw Send Email Hook body |
| `CRON_SECRET` | **Server only** | M6 | Bearer secret for Vercel Cron and manual authorized runs |
| `RETENTION_MONTHS_DEFAULT` | Server | M1/M2 | New-event retention default `3`; stored per event thereafter |
| `EVENT_STORAGE_LIMIT_MB_DEFAULT` | Server | M1/M4 | New-event limit `50`; stored per event and superadmin-adjustable thereafter |
| `MAX_UPLOAD_MB` | Server | M4 | Per-file maximum `30`; bucket restriction must match |
| `METRICS_ENABLED` | Server | M1 | `true` locally; `false` by default in production |
| `METRICS_TOKEN` | **Server only** | M1 | Bearer token for `/api/metrics` and local Prometheus scrape configuration |
| `DIAGNOSTICS_ENABLED` | **Server only** | M1 | `true` only for local trace/log support-bundle export; hard-disabled and `404` outside local development |
| `NEXT_PUBLIC_DIAGNOSTICS_ENABLED` | Browser | M1 | Shows copy-ID/download-report controls for local/Preview testers; contains no secret |
| `ALLOW_LOCAL_RESET` | Server CLI only | Destructive local reset only | Must be explicitly `1`; combined with local URL allow-listing, never stored as a production setting |

Additional rate-limit variables introduced under SPEC §8.2 must use explicit names, validated positive integer parsing and entries here and in `.env.example`. Missing/invalid server configuration must fail at startup or route initialization with a clear server log, not silently select an insecure default. Only locale, retention, storage and similar explicitly documented non-secret defaults may fall back.

Do not put `SUPABASE_SERVICE_ROLE_KEY`, database passwords, Resend keys, hook/cron secrets or OAuth client secrets in browser variables. Google OAuth client credentials are configured in Supabase, not exposed to Next.js browser code.

## 3. Local setup sequence after M1

1. Install the pinned Node major and Docker, then run `npm ci` from the repository root.
2. Run `npm run dev:bootstrap`: it starts the pinned Supabase CLI and local Prometheus/Grafana, applies migrations, creates the private bucket, loads deterministic seeds and prints local URLs/credentials.
3. Run `npm run dev` in a separate terminal; verify `/api/health`, a seeded login and a seeded guest invitation.
4. Confirm email through Inbucket, inspect structured request logs and open the Grafana dashboard. Trigger a validation error and use **Download diagnostic report** to verify the shared trace ID and matching client/server events. No cloud credentials or real email are involved.
5. Use `dev:services` for subsequent starts, `dev:reset` only for disposable local data and `dev:teardown` to stop services.

Exact generated local values come from the Supabase CLI, not from committed examples. `apps/web/.env.example` contains names and safe placeholders only. Reset/seed scripts validate local DB/Auth targets; reset additionally requires `ALLOW_LOCAL_RESET=1`; they refuse Preview/Production URLs.

## 4. External service checklist (M7/M8, not local prerequisites)

- **Supabase Auth:** Site URL, callback allow-list for local/Preview/Production, email verification, Secure Email Change, Google provider and Send Email Hook.
- **Supabase Storage:** private `photos` bucket, 30 MB file limit and JPEG/PNG/WebP allow-list.
- **Resend:** test/allow-listed Preview behavior; verified production domain, SPF and DKIM.
- **Vercel:** correct root/app directory, locked Node major, environment separation, controlled migration job and UTC cron `0 1 * * *`.

## 5. Canonical root scripts

M0/M1 establish these names so prompts, CI and developers do not invent different commands:

| Script | Purpose |
|---|---|
| `dev`, `dev:demo` | Next.js product; frozen Vite demo |
| `dev:bootstrap`, `dev:services`, `dev:teardown` | Start/verify local Supabase + observability, migrate/seed; restart services; stop services |
| `dev:reset` | Guarded local-only reset + migrate + seed |
| `db:seed` | Idempotently maintain documented local fixtures only |
| `build`, `build:demo`, `preview` | Product build; demo build; product preview |
| `lint`, `typecheck` | Repository checks, including web/api/shared TypeScript |
| `lint:fix`, `format`, `format:check` | ESLint autofix; Prettier write/check (frozen demo and specs excluded) |
| `test:unit`, `test:component` | Vitest suites with configured coverage thresholds |
| `test:integration` | API tests against real local Supabase DB/Storage |
| `test:e2e` | Playwright against the local stack |
| `db:migrate` | Apply forward-only migrations using `DIRECT_URL` |
| `supabase:start`, `supabase:stop` | Manage the pinned local Supabase CLI stack |
| `admin:create` | Create a superadmin in the explicitly selected non-production or approved production environment |

A task runs the relevant focused tests first, then the General DoD checks. A missing script required by the current milestone is implemented in that milestone, not silently skipped.

Workspaces are `@uspomena/web`, `@uspomena/demo`, `@uspomena/api` and `@uspomena/shared`; a single `npm install` at the repository root installs all of them and produces one root `package-lock.json`.
