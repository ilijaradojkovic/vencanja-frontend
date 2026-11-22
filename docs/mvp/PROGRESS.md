# MVP progress

One entry per completed milestone: what was done, what wasn't, known issues. Tasks and their evidence live in [`DOD.md`](DOD.md); deviations and tooling decisions live in [`DECISIONS.md`](DECISIONS.md).

## M0 – Monorepo, architecture spike and tooling (complete)

**Done**

- The frozen Vite prototype moved unchanged (rename-only history) to `apps/demo`; root scripts `dev`, `dev:demo`, `build`, `build:demo`, `preview` work. The demo's production output is unchanged apart from build hashes.
- npm-workspaces monorepo: `@uspomena/web` (Next.js 16 App Router, TypeScript strict), `@uspomena/demo`, `@uspomena/api`, `@uspomena/shared`, one root lockfile and one `npm install`.
- `packages/shared`: product/API enums, gallery (SYS-3, Europe/Belgrade), companion, RSVP (incl. SYS-5 trimming), phone and slug rules, and sr/en/ru messages (SYS-6), covered by 73 Vitest tests at 100% lines / 98.5% branches (threshold 90%).
- Architecture spike passed in a production Next.js build: Hono mounted at `/api` for GET/POST/PUT/PATCH/DELETE on the Node runtime, a server component calling the API's `server-only` service (client import fails the build), per-request guest HTML with cookie locale metadata and `Cache-Control: private, no-store`, and `sharp` running natively. `npm run spike:check` repeats it.
- Tooling: root ESLint (flat config, `--max-warnings=0`), Prettier, `lint`/`format`/`typecheck` scripts, Vitest + Testing Library in `apps/web` with coverage thresholds, GitHub Actions CI (install → lint → typecheck → unit → component → build → build:demo) on Node 24 from `.nvmrc`.
- The demo Docker image builds from the repository root and serves the static demo; the demo was also checked by hand (sign-in, guest RSVP, QR/personal upload, photo approval, celebration and admin accounts).

**Not done / deferred**

- The CI workflow has not run on GitHub yet: it triggers on pushes to this branch (`specs/mvp`) or pull requests to `main`. Everything it runs was executed locally from a clean `npm ci`.
- No deployment, hosted service or cloud credential is involved in M0; the architecture spike is re-verified on Vercel Preview in M7.
- Integration and E2E jobs are added in M1, together with the local Supabase stack.

**Known issues**

- The root layout reads the `lang` cookie, so every route currently renders dynamically. Correct for guest pages; static/public pages are revisited when performance is measured in M7.
- `/api/spike/*`, the `/i/[token]` placeholder page, the guest fixture service and `spike:check` are M0 scaffolding and are replaced by the real routes and services in M1/M3.
- `npm audit` reports one high and three moderate advisories in the frozen demo's dependency tree (React 18/Vite 5 era). They are not in the product's dependency tree; upgrading the demo would violate its frozen state, and the production dependency audit gate belongs to M7.
- The demo's bundle hashes changed slightly because React 19 is now hoisted to the root for the product's test tooling and the demo resolves its own React 18. Same versions, same behaviour.
