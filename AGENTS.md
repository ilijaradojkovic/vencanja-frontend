# Repository instructions for Pi

These instructions apply to MVP implementation. Pi loads this file automatically when run from this repository.

## 1. Establish context before editing

1. Run `git status --short` and inspect the current tree. Never discard or overwrite existing user changes.
2. Read `docs/mvp/README.md`, `docs/mvp/SPEC.md`, `docs/mvp/DOD.md`, `docs/mvp/DECISIONS.md`, `docs/mvp/ENVIRONMENT.md` and `docs/mvp/LOCAL_DEVELOPMENT.md`.
3. Read only the UC/API sections and demo source files relevant to the assigned task. `USE_CASES.txt`, `API.md` and the frozen demo are references, not permission to rewrite unrelated behavior.
4. Confirm the exact milestone/task and its acceptance tests. Implement **one unchecked DoD item or one small coherent group per run**, not the entire MVP or an entire large milestone by default. All runs use the same implementation branch; make a focused commit per completed task and open **one consolidated PR to `main` only after M8**, with no milestone PRs.
5. Check current official Next.js, Supabase, Hono, Vercel and Resend documentation before framework/service integration. Pin dependencies and record consequential documentation differences in `DECISIONS.md`.

## 2. Non-negotiable boundaries

- Product: `apps/web` (Next.js + TypeScript). API: `packages/api` (Hono + TypeScript). Shared product/API rules: `packages/shared`.
- Demo: `apps/demo` is the moved Vite prototype and is frozen. Do not add product features, API changes, shared imports or refactors to it.
- Preserve retained routes, UI copy, translations and behavior unless SPEC explicitly changes them.
- Do not add/remove scope, introduce another framework/service, weaken security or change public contracts without recording the decision; scope changes require owner approval first.
- Browser code never reads the DB or uses the service-role key. Protected API routes enforce role and ownership; Next redirects are only UX.
- Never commit secrets or real personal data. Do not create billable resources or deploy production without owner approval.
- M0–M6 must work entirely locally without cloud credentials. Use Supabase CLI Postgres/Auth/Storage, local SMTP/Inbucket and deterministic local seeds. Do not ask for hosted Supabase/Resend/Vercel/Google credentials to complete a local task; real external delivery checks belong to M7/M8.
- Keep `dev:bootstrap`, local-only reset/seed guards, redacted request logs/traces, downloadable tester diagnostic reports and local Prometheus/Grafana metrics working as local development evolves. Never point local reset/seed scripts at shared or production data.
- Do not replace required real DB/Storage integration tests with mocks. Email is doubled only at the documented `EmailSender` boundary.
- Do not delete, skip or weaken tests, lower coverage, suppress TypeScript/ESLint errors or use `@ts-ignore`/`any` to silence a design problem.

## 3. Implementation loop

For the assigned task:

1. **Baseline:** run the smallest relevant existing checks. If they fail before the change, stop and report rather than masking the failure.
2. **Implement vertically:** schema/contract → service/route → UI where applicable → tests. Keep the diff focused.
3. **Verify:** run relevant tests plus the required root checks once they exist:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run build:demo`
   - the relevant `test:unit`, `test:integration`, `test:component` and/or `test:e2e` scripts
4. Add/adjust tests for success, validation, authorization and failure paths as required by `DOD.md`; integration tests use local Supabase.
5. Update `.env.example` files and `docs/mvp/ENVIRONMENT.md` when configuration changes. Apply schema changes only through migrations.
6. Tick a DoD checkbox only after its evidence exists. Do not tick a milestone or acceptance scenario merely because code was written.
7. Review `git diff --check`, `git diff` and `git status --short`. Record deviations in `docs/mvp/DECISIONS.md`; append milestone progress only when a milestone is complete. Push the implementation branch for CI when required without opening a milestone PR; do not squash away the task history.

## 4. Stop and ask instead of guessing

Stop with a concise report when:

- the requested task is ambiguous or changes scope;
- required credentials, accounts, legal/business details or owner approval are missing **for an M7/M8 external task** (missing cloud credentials never justify mocking or stopping M0–M6 local work);
- the M0/M1 architecture spike fails;
- a migration could destroy data or production rollout is unsafe;
- current service documentation makes the specified approach invalid;
- verification cannot be run or remains red. For a reproducible product failure, attach or request the sanitized diagnostic JSON and its trace/request IDs rather than pasting secrets or raw personal data.

Local development can proceed with draft legal pages and the 50 MB/event default. Public launch still requires legal review and production configuration.

## 5. Response format

Report only: what changed, files touched, commands/tests actually run and their results, DoD items evidenced, and remaining blockers/deviations. Never claim a deploy, email, OAuth flow, mobile check or external integration was verified without running it.

## 6. First-task prompt

Use a separate Pi session per focused task. Initial prompt:

> Implement only the first unchecked M0 item in `docs/mvp/DOD.md`. Follow `AGENTS.md`; inspect the existing tree and preserve existing changes. Read the MVP documents and relevant source first. Run the available baseline/build checks, make the smallest focused change, verify it, commit only this task, and stop. Do not implement later M0 items or product features, and do not open a PR. If credentials, an architectural decision or a failing baseline blocks you, stop and report instead of guessing.
