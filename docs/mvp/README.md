# Uspomena MVP – handoff guide

This folder holds everything the implementation agent needs to turn the prototype into an MVP running in production.

## What to read, in order

1. [`SPEC.md`](SPEC.md): what we build, architecture, data model, API changes, new use cases, non-functional requirements.
2. [`DECISIONS.md`](DECISIONS.md): architecture review, accepted corrections, open owner decisions and implementation deviations.
3. [`ENVIRONMENT.md`](ENVIRONMENT.md): variable ownership, local/external setup and canonical command names.
4. [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md): cloud-free M0–M6 setup, deterministic seeds, structured logs and Prometheus/Grafana metrics.
5. [`DOD.md`](DOD.md): general DoD, milestones M0 – M8 with checklists, acceptance scenarios S1 – S17, final DoD.
6. `../../USE_CASES.txt`: behavior of every existing feature (UC-01 – UC-76), in Serbian.
7. `../../API.md`: the current HTTP contract, in Serbian.
8. `../../src/mock/server.js`: the reference implementation of the business rules.

The specs are written in English. The app UI itself must support Serbian (default), English and Russian.

## Running implementation with Pi

The repository root [`AGENTS.md`](../../AGENTS.md) is loaded automatically by Pi and defines the implementation loop and stop conditions. Use a separate session for one unchecked DoD item or a small coherent group; do not ask the model to implement the whole MVP in one run. All sessions work on the **same implementation branch**, with a focused commit per completed task, and produce **one consolidated PR only after M8**. The first-task prompt is included at the bottom of `AGENTS.md`.

The agent must report the checks it actually ran. A faster model should receive narrower tasks and more verification, not weaker acceptance criteria. **M0–M6 must run entirely locally with no cloud credentials**, using local Supabase/Auth/Storage, Inbucket, deterministic seeds and local logs/metrics. The human owner supplies credentials only for M7/M8 external integration and deployment, approves billable/destructive operations and verifies external launch gates.

## Rules for the agent

- Create one implementation branch from the committed `specs/mvp` baseline (for example `feat/mvp`) and complete milestones in `DOD.md` order. Deliver one consolidated PR to `main` after M8, not separate milestone PRs.
- Commit per completed task; the message names the milestone and UC/SYS IDs (e.g. `M3: guests – list import (UC-19)`). Keep commits focused so the large final PR remains reviewable.
- Tick items in `DOD.md` only once they are shown to work. Append to `PROGRESS.md` after each milestone.
- Do not change scope. If something can't be done as written, record the deviation in `DECISIONS.md` (SPEC §11). A deviation that adds or removes a feature waits for the owner's approval.
- Never weaken or skip tests to make them pass.
- Check current Next.js, Vercel, Supabase, Hono and Resend docs before configuring anything; don't rely on memory.
- The owner provides external secrets for M7/M8 (hosted Supabase service role, Resend, Google OAuth, production `CRON_SECRET`). Local CLI keys are generated locally. Never commit secrets. If an external account or key is missing, complete local work first and stop only the affected external task.
- Ask the owner before creating any billable resource (Supabase Pro, a domain).

## Owner decisions (interview, 2026-11-22)

| Topic | Decision |
|---|---|
| Backend | Node + TypeScript API |
| Repo | Monorepo in this repo |
| Hosting | Vercel + managed DB (Supabase Postgres) |
| Photos | Supabase Storage |
| Email | Resend |
| Custom design and album print requests | Cut from MVP |
| Accounts | Public self-signup, no payments; superadmin keeps all powers |
| Auth | Email verification, forgot password, Google sign-in, change email and password |
| Signup | Short form + onboarding wizard |
| Demo | Mock build kept separately |
| Local development | Fully local M0–M6; Supabase CLI + Inbucket, deterministic seeds, no hosted services |
| Observability | Pino correlated/redacted logs and traces; downloadable tester diagnostic JSON; local Prometheus + Grafana dashboard |
| Limits | No payments or commercial quotas; **50 MB/event default**, adjustable per account by the superadmin (UC-88) |
| Photo extras | Thumbnail + web version (no HEIC, no video) |
| Tests | Full pyramid (unit, integration, component, E2E, coverage thresholds) |
| Privacy | Legal pages, analytics consent, account self-deletion, auto-retention |
| Retention | Configurable by superadmin, default 3 months |
| Analytics | Vercel Web Analytics |
| Events per account | One |
| Spec language | English (app UI stays Serbian, English, Russian) |

Decisions made by the spec author rather than the owner (open to change):

- **Next.js for the product + Hono for the API** (SPEC D2, D11, D15). These are complementary choices; M0/M1 prove the mounted adapter, server-only service calls and `sharp` locally, then M7 verifies them on Vercel before launch.
- **Supabase Auth** instead of custom auth (SPEC D4).
- **Hono + Drizzle** (SPEC D2, D3).
- **Direct-to-Storage upload** via signed URLs, because of Vercel function body limits (SPEC D5).
- **Download all originals (ZIP)** added as required because data is auto-deleted after 3 months (UC-85).
- Coverage thresholds: shared 90%, API 80%, web 60%.

The v1.1 review also corrected signup email localization, secure email change, session revocation, photo pagination, notification claiming, UTC scheduling and migration rollout. The storage decision is resolved: **50 MB/event by default**, intentionally low for development and adjustable per account by the superadmin. Legal review (Q3) remains a launch gate.
