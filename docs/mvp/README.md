# Uspomena MVP – handoff guide

This folder holds everything the implementation agent needs to turn the prototype into an MVP running in production.

## What to read, in order

1. [`SPEC.md`](SPEC.md): what we build, architecture, data model, API changes, new use cases, non-functional requirements.
2. [`DOD.md`](DOD.md): general DoD, milestones M0 – M8 with checklists, acceptance scenarios S1 – S16, final DoD.
3. `../../USE_CASES.txt`: behavior of every existing feature (UC-01 – UC-76), in Serbian.
4. `../../API.md`: the current HTTP contract, in Serbian.
5. `../../src/mock/server.js`: the reference implementation of the business rules.

The specs are written in English. The app UI itself must support Serbian (default), English and Russian.

## Rules for the agent

- Work on the `specs/mvp` branch (or branches cut from it), one milestone at a time, in the order given in `DOD.md`.
- Commit per task; the message names the milestone and the UC/SYS IDs (e.g. `M3: guests – list import (UC-19)`).
- Tick items in `DOD.md` only once they are shown to work. Append to `PROGRESS.md` after each milestone.
- Do not change scope. If something can't be done as written, record the deviation in `DECISIONS.md` (SPEC §11). A deviation that adds or removes a feature waits for the owner's approval.
- Never weaken or skip tests to make them pass.
- Check current Vercel, Supabase and Resend docs before configuring anything; don't rely on memory.
- The owner provides secrets (Supabase service role, Resend, Google OAuth, `CRON_SECRET`). Never commit them. If you need an account or key you don't have, stop and ask.
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
| Limits | No quotas in MVP |
| Photo extras | Thumbnail + web version (no HEIC, no video) |
| Tests | Full pyramid (unit, integration, component, E2E, coverage thresholds) |
| Privacy | Legal pages, analytics consent, account self-deletion, auto-retention |
| Retention | Configurable by superadmin, default 3 months |
| Analytics | Vercel Web Analytics |
| Events per account | One |
| Spec language | English (app UI stays Serbian, English, Russian) |

Decisions made by the spec author rather than the owner (open to change):

- **Supabase Auth** instead of custom auth (SPEC D4).
- **Hono + Drizzle** (SPEC D2, D3).
- **Direct-to-Storage upload** via signed URLs, because of Vercel function body limits (SPEC D5).
- **Download all originals (ZIP)** added as required because data is auto-deleted after 3 months (UC-85).
- Coverage thresholds: shared 90%, API 80%, web 60%.
