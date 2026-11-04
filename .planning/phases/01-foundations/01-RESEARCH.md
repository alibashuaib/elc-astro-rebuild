# Phase 1: Foundations - Research

**Researched:** 2026-11-04
**Domain:** Reproducible installs, real-D1 worker tests (workerd), Playwright smoke orchestration, git hygiene (Windows 11 dev box, Ubuntu CI)
**Confidence:** HIGH (every key claim below was run on this machine in a scratch copy; tracked repo files were not modified)

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists (user chose to continue without discussion). No locked decisions, no deferred ideas. Everything below is Claude's discretion; follow `mode: mvp` and the user's "simplest thing that works" preference. Treat the milestone-level decisions in `.planning/STATE.md` and `ROADMAP.md` as constraints (e.g. MOB-01 lands in Phase 1; `feature/registration-wizard` merges in Phase 3).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Exact pins in root, `placement-test-worker`, `cms-oauth-worker`; `.npmrc save-exact=true` | Current ranges listed below; `check-pins` script design; per-package `.npmrc` |
| FND-02 | Worker tests on real local D1 via `@cloudflare/vitest-plugin`, all migrations replayed on empty DB | **Works on this machine.** 136 existing tests pass unchanged on real D1; config + setup file below |
| FND-03 | Malformed JSON gives 400 not 500 (shared `readJson()`) | 9 call sites listed; prototype passes (145 tests incl. 9 new table-driven) |
| FND-04 | Smoke tests create their own future slot | Playwright `globalSetup` inserting a `+30 days` slot; verified 13/13 smoke green on an empty DB |
| FND-05 | `.gitattributes` fixes CRLF; `preview.log`/`preview.pid`/`.dev.vars` ignored | Clean-clone experiment: `* text=auto eol=lf` produces zero renormalize diff; ignore lines listed |
| FND-06 | One command runs worker tests + Playwright smoke green | `npm run test:all` design; 3 Windows traps found (orphaned `astro preview`, MAX_PATH, stale port) |
| MOB-01 | Commit the pending mobile tweaks | Exact diff of the 3 user-edited files described below; commit procedure |
</phase_requirements>

## Summary

The phase is mostly mechanical, and the big unknown is resolved: **workerd runs on this Windows 11 machine.** `wrangler d1 migrations apply --local` replays all 21 migrations, `wrangler dev` serves requests, and `@cloudflare/vitest-plugin` 1.5.1 + vitest 4.1.12 + wrangler 4.157.0 runs the whole existing worker suite against a real local D1. The old `fakeD1.ts` header ("workerd crashes in this sandbox") is only half true today: `wrangler dev` prints "The Workers runtime crashed unexpectedly and is being restarted (crash #1)" twice at startup, but the worker then restarts itself and answers requests (`GET /api/slots` returned `{"slots":[]} HTTP 200`). The warning is cosmetic here; do not treat it as a failure.

Because the plugin keeps rows between tests in one file (isolation is per test file, not per test), the one real change to the tests is a global `beforeEach` that empties every table except the seeded question bank. With a 5-line shim that keeps the export name `createFakeD1` but returns the real `env.DB`, **zero test files need editing** (136/136 pass). That matters because `feature/registration-wizard` edits the same test files and is merged in Phase 3.

For smoke, the CI recipe (manual `curl` wait loops, a hard-coded `2027-01-01` slot inserted by a shell step) is replaced by one `playwright.config.ts`: a `webServer` for the worker (migrate then `wrangler dev`), and a `globalSetup` that builds the site, serves it with Astro's in-process `preview()` API, and inserts a slot 30 days in the future via `wrangler d1 execute --local`. The same config serves local and CI. **Do not use `astro preview` through Playwright's `webServer` on Windows**: Astro 7's launcher spawns a detached `--json` child that Playwright cannot kill, so port 4322 stays bound after every run (reproduced).

**Primary recommendation:** Pin exactly, swap `fakeD1` internals for real D1 via the plugin (keep `createFakeD1` as a thin alias), add `src/http.ts` with `readJson()` + `BadRequestError` caught once in `index.ts`, move smoke orchestration into `playwright.config.ts` + `tests/e2e/global-setup.ts`, add `.gitattributes`/ignores, and commit the 3 user files last as MOB-01 with explicit paths.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pin enforcement (`check-pins`) | Repo tooling (node script + CI) | npm config (`.npmrc`) | Static check on `package.json` files; no runtime tier involved |
| Worker tests on real D1 | API / Backend (worker under workerd) | Database / Storage (local D1) | Handlers + SQL run inside workerd against migrated D1 |
| Malformed-JSON 400 | API / Backend (`index.ts` catch + `http.ts`) | — | One choke point; handlers just call `readJson` |
| Smoke slot creation | Database / Storage (local D1 via wrangler) | Test harness (Playwright globalSetup) | Test data must live in the DB the worker serves |
| Site serving for smoke | Frontend Server (Astro preview, in-process) | CDN / Static (built `dist/`) | Static build served locally |
| Line endings / ignores | Repo tooling (git) | — | No runtime impact |

## Standard Stack

### Core (all versions confirmed with `npm view` on 2026-11-04)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cloudflare/vitest-plugin` | 1.5.1 | Run vitest inside workerd with real D1 | Official successor of the deprecated pool; `npm view @cloudflare/vitest-pool-workers deprecated` → "has been renamed to @cloudflare/vitest-plugin" [VERIFIED: npm registry] |
| `vitest` | 4.1.12 | Test runner | Plugin peer range `^4.1.0 \|\| ^5.0.0` [VERIFIED: npm registry] |
| `wrangler` | 4.157.0 | Dev server, D1 migrations | **Must equal 4.157.0**: plugin's own `dependencies` pin `"wrangler": "4.157.0"` (avoids a duplicate copy) [VERIFIED: node_modules/@cloudflare/vitest-plugin/package.json] |
| `@cloudflare/workers-types` | 5.20261104.1 | Worker typings | Current tag [VERIFIED: npm registry] |
| `typescript` | 7.0.2 | Typecheck | Already the locked version in the worker lockfile; `tsc --noEmit` ran clean under TS 7 [VERIFIED: ran it] |
| `bcryptjs` | 3.0.3 | Password hash | Already locked; hashing ran inside workerd in the plugin run [VERIFIED: ran it] |
| `@playwright/test` | 1.64.1 | Smoke | Project research choice; current tag [VERIFIED: npm registry] |
| `@types/node` | 26.3.0 | Node typings for vitest config | Keep the worker's currently locked version (26.6.6 exists; not needed) |

### Root project
| Library | Pin to | Note |
|---------|--------|------|
| `astro` | `7.2.4` | This is what `package-lock.json` resolves today; `node_modules` actually holds 7.3.2 (out of sync with the lock) and npm shows 7.4.5 as latest. Pin to the **lockfile** version so `npm ci` reproduces what is committed; bumping is Phase-by-phase work, not Phase 1. [VERIFIED: package-lock.json packages["node_modules/astro"]] |
| `@astrojs/sitemap` | `3.7.3` | lockfile version [VERIFIED: package-lock.json] |

### Remove from `placement-test-worker`
`better-sqlite3`, `@types/better-sqlite3` (only `fakeD1.ts` and the dead `scripts/local-dev.ts` used them), `@cloudflare/vitest-pool-workers` (deprecated), and the `allowScripts` block for `better-sqlite3`.

**Installation (worker):**
```bash
cd placement-test-worker
# edit package.json to exact versions first, then regenerate lock:
npm install --save-exact
npm ci   # must succeed from a clean node_modules
```
Verified shape (resolved cleanly, 87 packages, 0 vulnerabilities):
```json
"devDependencies": {
  "@cloudflare/vitest-plugin": "1.5.1",
  "@cloudflare/workers-types": "5.20261104.1",
  "@types/node": "26.3.0",
  "typescript": "7.0.2",
  "vitest": "4.1.12",
  "wrangler": "4.157.0"
},
"dependencies": { "bcryptjs": "3.0.3" }
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plugin on real D1 | Keep `fakeD1` (better-sqlite3) | Only needed if workerd failed; it does not. Phase 6 needs real-D1 `db.batch()` atomicity tests, which fakeD1 cannot give |
| `cross-env`/shell scripts for orchestration | Playwright `webServer` + `globalSetup` | Zero new deps, identical on Windows and CI |
| `zod` etc. for `readJson` | 10 lines of plain TS | No new dependency for one guard |

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm ...` on 2026-11-04.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @cloudflare/vitest-plugin | npm | created 2026-08-20 | ~1.9M/wk | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Flagged, see note |
| vitest | npm | years | ~173M/wk | github.com/vitest-dev/vitest | SUS (`too-new`) | Flagged, see note |
| wrangler | npm | years | ~39.8M/wk | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Flagged, see note |
| @cloudflare/workers-types | npm | years | ~19M/wk | github.com/cloudflare/workerd | SUS (`too-new`) | Flagged, see note |
| @playwright/test | npm | years | ~107M/wk | microsoft/playwright | SUS (`too-new`) | Flagged, see note |
| astro | npm | years | ~11M/wk | withastro/astro | SUS (`too-new`) | Not changed (pin to existing lock version) |
| bcryptjs | npm | years | ~19.8M/wk | — | OK | Approved |
| typescript | npm | years | ~407M/wk | microsoft/TypeScript | OK | Approved |
| @astrojs/sitemap | npm | years | ~5.4M/wk | withastro/astro | OK | Approved |

**Note on SUS:** the only reason code in every SUS row is `too-new`, i.e. the *latest version* was published within days (publishedAt 2026-11-02 to 2026-11-04). All are first-party packages from Cloudflare, Vitest and Microsoft with millions of weekly downloads, a source repo, `postinstall: null`, and none deprecated (except the old pool, which is being removed). This is a recency false positive, not a slopsquat signal. The planner should still add **one** `checkpoint:human-verify` before the first `npm install` of these versions (the user already approved these exact versions in project-level research, so the checkpoint is a quick confirm, not a blocker). [VERIFIED: gsd-tools package-legitimacy]
**Packages removed due to [SLOP]:** none. **Removed on purpose:** `better-sqlite3`, `@types/better-sqlite3`, `@cloudflare/vitest-pool-workers`.

## Architecture Patterns

### System Architecture Diagram (the one command, `npm run test:all`)

```
npm run test:all
  |
  +--(1) node scripts/check-pins.mjs ---------> reads package.json in ., placement-test-worker, cms-oauth-worker(if exists)
  |                                             fails on latest | ^ | ~ | non-exact
  +--(2) npm test --prefix placement-test-worker
  |        vitest + cloudflareTest plugin
  |          setup file: applyD1Migrations(env.DB, TEST_MIGRATIONS)   <- replays 0001..N on an EMPTY per-file D1
  |          global beforeEach: DELETE FROM every table except questions/passages/d1_migrations
  |          tests: worker.fetch(Request, env) -> handlers -> real D1 (workerd)
  |        + tsc --noEmit
  +--(3) playwright test
           webServer[0]: `npm run db:migrate:local && npm run dev` (wrangler dev :8787, local D1 in .wrangler/)
           globalSetup (runs AFTER webServer is up):
              a) astro build  (PUBLIC_PLACEMENT_API_URL=http://localhost:8787)   [execFileSync of astro.mjs]
              b) preview() from 'astro' in-process on :4322   (no orphan process)
              c) wrangler d1 execute --local: delete + insert slot 'e2e-slot' at now+30 days
              d) return teardown -> server.stop()
           specs (tests/e2e/*.spec.ts) -> browser -> :4322 -> :8787 -> local D1
```

### Recommended file layout (additions only)
```
.gitattributes                      # new
.npmrc                              # new: save-exact=true   (also placement-test-worker/.npmrc; cms-oauth-worker/.npmrc in Phase 5)
scripts/check-pins.mjs              # new, ~20 lines
playwright.config.ts                # edited: webServer + globalSetup
tests/e2e/global-setup.ts           # new
placement-test-worker/
  vitest.config.ts                  # new
  env.d.ts                          # new (Cloudflare.Env augmentation)
  test/apply-migrations.ts          # new (setup file)
  src/http.ts                       # new (readJson, BadRequestError)
  src/malformed.test.ts             # new (table-driven 400 test)
  src/test-utils/fakeD1.ts          # rewritten as a 4-line alias to env.DB
  tsconfig.json                     # include: add test, env.d.ts, vitest.config.ts; types: add "@cloudflare/vitest-plugin/types"
```

### Pattern 1: vitest config + migrations (verified: 145/145 green)
```ts
// placement-test-worker/vitest.config.ts   (Source: Cloudflare vitest-integration docs, adapted; ran on this machine)
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
      return {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, ADMIN_COOKIE_SECRET: 'test-secret' } },
      };
    }),
  ],
  test: { setupFiles: ['./test/apply-migrations.ts'] },
});
```
Use `import.meta.dirname`, not `__dirname` (vite warns about `__dirname` under native config loader).

```ts
// placement-test-worker/test/apply-migrations.ts   (generic reset: survives new tables in 0022/0023)
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach } from 'vitest';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Real D1 keeps rows between tests in a file. Empty every table except the seeded
// question bank (and migration bookkeeping) so each test starts clean.
const KEEP = ['questions', 'passages', 'd1_migrations'];
beforeEach(async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  ).all<{ name: string }>();
  const tables = results.map((r) => r.name).filter((n) => !KEEP.includes(n));
  await env.DB.batch([
    env.DB.prepare('PRAGMA defer_foreign_keys = true'),
    ...tables.map((t) => env.DB.prepare(`DELETE FROM "${t}"`)),
  ]);
});
```
```ts
// placement-test-worker/env.d.ts
declare namespace Cloudflare {
  interface Env { DB: D1Database; TEST_MIGRATIONS: import('@cloudflare/vitest-plugin').D1Migration[]; }
}
```
```ts
// placement-test-worker/src/test-utils/fakeD1.ts   (keeps the old export so no test file changes -> no wizard-branch conflicts)
import { env } from 'cloudflare:workers';
// Name kept so existing tests (and feature/registration-wizard's) import unchanged. Returns the real local D1.
export function createFakeD1(): D1Database { return env.DB; }
```
Observed facts: `d1_migrations` held 21 rows and `questions` 94 rows after setup, i.e. every migration replayed on an empty DB [VERIFIED: ran it]. Storage is isolated **per test file** (second file saw `{c: 0}` after the first inserted a slot, sequential run) but **shared across tests inside a file** (inserted slot visible in the next test) [VERIFIED: ran it]. `import { env } from 'cloudflare:test'` is deprecated in the types; use `cloudflare:workers`. `exports.default.fetch` has no typing without extra augmentation; keep the existing `worker.fetch(req, env as any)` style instead.

### Pattern 2: `readJson` + single catch (verified: 9 new table-driven tests green)
```ts
// placement-test-worker/src/http.ts
export class BadRequestError extends Error {}

/** Parses the body as a JSON object; anything else is a 400, never a 500. */
export async function readJson<T>(req: Request): Promise<T> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new BadRequestError('invalid_json'); }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestError('invalid_json');
  return body as T;
}
```
In `index.ts` `fetch()`, first line of the existing `catch (err)`:
```ts
if (err instanceof BadRequestError) return respond(new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'content-type': 'application/json' } }));
```
Why not just catch `SyntaxError`: valid-but-wrong JSON (`null`, `[]`, `"s"`) makes the `const { a } = await req.json()` destructuring throw a `TypeError` → still 500. The `readJson` object check covers both.

**Every call site to change** (current text is `await req.json<...>()`; change to `await readJson<...>(req)`) [VERIFIED: grep of `src` this session]:
`routes/admin.ts` (login line 15, createSlot 29, createQuestion 49, setQuestionActive 69), `routes/application.ts` (submit 13, setStatus 56), `routes/booking.ts` (create 14), `routes/session.ts` (start 105, answer 128). That is 9 sites; `cms-oauth-worker` has no request-body parsing (`index.js` only calls `tokenRes.json()` on GitHub's response, line 71 — out of scope).

Table-driven test shape (route list + bodies `'{bad'`, `'null'`, `'[]'`, `'"s"'`; admin routes use `issueSessionCookie(env,'a1')` for the cookie). Note `POST /api/session/:id/answer` returns **404 first** for an unknown session before it reads the body, so use that expectation for that one row (the prototype did). Auth runs before the handler, so admin rows need a valid cookie or they return 401.

### Pattern 3: Smoke orchestration (verified: 13/13 green, cold and warm, on an empty DB)
```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

const WORKER = 'http://localhost:8787';
const SITE = 'http://localhost:4322';
const external = !!process.env.SMOKE_BASE_URL;   // Phase 8 live smoke: no local servers, no local D1 writes

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: external ? undefined : './tests/e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: process.env.SMOKE_BASE_URL ?? SITE, trace: 'retain-on-failure' },
  webServer: external ? undefined : {
    command: 'npm run db:migrate:local --prefix placement-test-worker && npm run dev --prefix placement-test-worker',
    url: `${WORKER}/api/slots`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```
```ts
// tests/e2e/global-setup.ts   (preview() verified in-process; build + d1 execute verified)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { preview } from 'astro';

export default async function globalSetup() {
  const root = process.cwd();
  const worker = path.join(root, 'placement-test-worker');

  // Build the site against the local Worker (same as CI did by hand).
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PUBLIC_PLACEMENT_API_URL: 'http://localhost:8787' },
  });

  // Own future slot: never depends on a hard-coded date.
  const sql = [
    "DELETE FROM bookings WHERE slot_id = 'e2e-slot'",
    "DELETE FROM slots WHERE id = 'e2e-slot'",
    "INSERT INTO slots (id, starts_at, capacity, booked_count) VALUES ('e2e-slot', strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days'), 5, 0)",
  ].join(';');
  execFileSync(process.execPath, [path.join(worker, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'd1', 'execute', 'placement-test', '--local', '--command', sql], { cwd: worker, stdio: 'inherit' });

  // In-process server: stopping it frees the port (astro preview via webServer does not, on Windows).
  const server = await preview({ root, server: { port: 4322 } });
  return () => server.stop();
}
```
Honesty note: the exact combined `global-setup.ts` above was assembled from pieces that were each run (CLI build with the env var and `wrangler.js d1 execute` inside a Playwright `globalSetup`: 13/13 green; in-process `preview()` + `server.stop()` in a separate minimal Playwright run: port freed after two consecutive runs). The assembled file itself has not been run once end to end; the first execution task should do that and then run the suite twice in a row.

Facts behind it:
- `webServer` starts before `globalSetup`, so migrations are applied (by the webServer command) before the slot INSERT [VERIFIED: ran it; INSERT would have failed with "no such table" otherwise].
- A second process (`wrangler d1 execute --local`) can write the local D1 while `wrangler dev` runs; the running worker saw the slot [VERIFIED: ran it, booking step passed].
- The slot id/format matches `listOpenSlots`' string comparison: `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` — the same format the code comments say it needs [VERIFIED: placement-test-worker/src/db.ts comment read this session].
- `execFileSync` with `shell: true` mangles SQL containing spaces on Windows (arguments concatenated); use the `node wrangler.js` form above [VERIFIED: failure reproduced].
- `tests/e2e/application.spec.ts` needs **no edit**: it clicks `#pt-slots button` first button. This also avoids a conflict with the wizard branch, which edits that spec.
- Building takes ~25-30 s each run; total `playwright test` was 35-55 s [VERIFIED: ran it].

### Pattern 4: `check-pins`
```js
// scripts/check-pins.mjs
import { readFileSync, existsSync } from 'node:fs';
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
let bad = 0;
for (const dir of ['.', 'placement-test-worker', 'cms-oauth-worker']) {
  const file = `${dir}/package.json`;
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      if (!EXACT.test(range)) { console.error(`${file}: ${section}.${name} = "${range}" is not an exact version`); bad++; }
    }
  }
}
process.exit(bad ? 1 : 0);
```
Skips `cms-oauth-worker` until it gets a `package.json` (Phase 5), then covers it automatically. Do not scan `engines` (root has `">=22.12.0"` on purpose). Prove it with a deliberate-failure check (temporarily set a range to `latest`, expect exit 1) as the verify step.

### Anti-Patterns to Avoid
- **`astro preview` as a Playwright `webServer`** on Windows: leaves a detached server on the port after the run; the next run then fails with "is already used" or "exited early" (reproduced). Use the in-process `preview()` API.
- **`reuseExistingServer: true` for the site server:** would serve whatever stale build/process is on the port.
- **Deleting rows from `questions`/`passages` in the reset:** they are seeded by migrations and the test applies migrations once per file.
- **Renaming `createFakeD1` or editing the three big test files now:** guaranteed merge conflicts with `feature/registration-wizard` (it changes `session.test.ts` by ~225 lines, `application.test.ts`, `index.test.ts`).
- **Rewriting the working tree to LF (`git rm --cached -r . && git reset --hard`):** would destroy the user's uncommitted edits. Not needed: see FND-05.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Replay migrations in tests | A migration runner / the old fake | `readD1Migrations` + `applyD1Migrations` | Same files `wrangler d1 migrations apply` uses; also fills `d1_migrations` |
| Start worker + wait for ready | `curl` loops, bash `&` | Playwright `webServer` (`url` wait) | Cross-platform, killed on exit |
| Test slot with a future date | A fixed ISO string | SQLite `strftime(..., 'now', '+30 days')` | No date bomb, no JS date formatting drift |
| Line-ending normalisation | Scripts that rewrite files | `.gitattributes` | Git does it |
| Exact-pin enforcement | A custom npm wrapper | 20-line `check-pins.mjs` + `save-exact=true` | Smallest thing that fails on `^`/`~`/`latest` |

**Key insight:** every piece already exists in Cloudflare/Playwright/git; the work is wiring plus three Windows-specific traps.

## Current State (as found)

**package.json ranges** [VERIFIED: cat of the three files this session]
- Root: `"@astrojs/sitemap": "^3.7.3"`, `"astro": "^7.2.4"`, `"@playwright/test": "^1.62.1"`; `allowScripts: {"esbuild@0.28.2": true}`; `engines.node ">=22.12.0"`.
- `placement-test-worker`: `"@cloudflare/vitest-pool-workers": "latest"`, `"@cloudflare/workers-types": "latest"`, `"typescript": "latest"`, `"vitest": "latest"`, `"wrangler": "latest"`, `"bcryptjs": "latest"`, plus carets `"@types/better-sqlite3": "^9.6.0"`, `"@types/node": "^26.3.0"`, `"better-sqlite3": "^13.0.3"`.
- `cms-oauth-worker`: no `package.json`, no lockfile (only `README.md`, `src/index.js`, `wrangler.toml`). Phase 1 only needs the pin check to tolerate its absence (it is created in Phase 5; create `cms-oauth-worker/.npmrc` then).
- Lockfiles: root `package-lock.json` and `placement-test-worker/package-lock.json` exist (lockfileVersion 3). Lock-resolved worker versions today: vitest 4.1.11, wrangler 4.125.0, workers-types 5.20260825.1, vitest-pool-workers 0.22.0.
- `.npmrc`: none anywhere. npm reads the project-level `.npmrc` next to each `package.json`, so create one in root and in `placement-test-worker` (each containing `save-exact=true`). [ASSUMED: project `.npmrc` is read only from the package root, not parent directories; harmless to add both]

**Tests today**
- Worker: 9 test files, 136 tests (counts by the run), all via `createFakeD1()` (better-sqlite3, `:memory:`, replays every `migrations/*.sql` in sorted order). No `vitest.config.*` exists. CI runs `npx tsc --noEmit` then `npm test`.
- Smoke: `tests/e2e/{application,course-diagram,placement-test}.spec.ts` (13 tests). `playwright.config.ts` has no `webServer`, no projects; `baseURL` defaults to `http://localhost:4321`.
- CI `placement-test-smoke` job starts everything by hand. Hard-coded date, quoted verbatim from `.github/workflows/ci.yml`: `INSERT INTO slots (id, starts_at, capacity, booked_count) VALUES ('e2e-smoke-slot', '2027-01-01T10:00:00.000Z', 5, 0)`. After 2027-01-01 `listOpenSlots` (requires `starts_at > now`) returns nothing and the booking step fails.
- Migrations locally: `npm run db:migrate:local` = `wrangler d1 migrations apply placement-test --local`; `wrangler.toml` has `migrations_dir = "migrations"` and `database_id = "00000000-0000-0000-0000-000000000000"` (fine for local). Files are `0001_init.sql` … `0021_application_email_idtype.sql`, flat folder, `NNNN_name.sql`, which is exactly what `readD1Migrations` expects. [VERIFIED: ls + wrangler output "0021_application_email_idtype.sql ✅"]
- Dead code: `scripts/local-dev.ts` (script `dev:fallback`) calls `createFakeD1(migrations)` with an argument the function does not accept and omits `0016`; `scripts/vite.local.config.ts` uses `vite`, which is not a dependency. `scripts/` is excluded from tsc (`"include": ["src"]`), so nobody noticed. Delete both and the `dev:fallback` script; update the stale "Testing Setup" section of `placement-test-worker/README.md` (it still says the suite uses fakeD1 and that workerd would not start).

**Line endings** [VERIFIED: `git ls-files --eol`, `git config core.autocrlf`]
- `core.autocrlf=true`; no `.gitattributes`. Index: 155 `i/lf w/crlf`, 61 `i/lf w/lf`, 13 `i/lf w/mixed` (incl. `placement-test-worker/src/index.ts`, which mixes CRLF and LF). Repo content in the index is already LF everywhere.
- Experiment in a fresh clone: adding `.gitattributes` with `* text=auto eol=lf` and running `git add --renormalize .` changed **nothing** except the new file. So `.gitattributes` alone is the whole fix; no mass rewrite commit.
- Current `git status`: only the 3 user-modified files + untracked `preview.log`, `preview.pid`. There are no CRLF-only diffs right now; the warning "LF will be replaced by CRLF" on those three comes from `autocrlf` and disappears with `eol=lf`. The risk is future CRLF noise from Windows editors, which `.gitattributes` prevents.
- Mixed-ending files are the trap for scripted edits: a Perl/sed regex anchored on `\n` silently failed on `index.ts` in the prototype (`CRLF, LF` mixed). Executors should use the Edit tool, not regex one-liners, for `index.ts`.

**Ignores** [VERIFIED: cat .gitignore]: root `.gitignore` lacks `preview.log`, `preview.pid`, `.dev.vars`; `placement-test-worker/.gitignore` already ignores `.dev.vars`, `.wrangler/`, `node_modules/`. Add to root: `preview.log`, `preview.pid`, `.dev.vars` (the bare pattern matches in any directory). Do **not** delete the two preview files (user's artifacts; ignoring makes them disappear from status).

## MOB-01: the pending user edits (do not touch until the commit task)

`git diff` of the three files [VERIFIED: ran it, 15 insertions, 4 deletions]:
1. `src/components/CourseContentPanel.astro` (**course `h3`**): adds `.course-prose :global(> h3) { grid-column: 1 / -1; margin: 1.15rem 0 0; color: var(--color-navy); font-size: clamp(1rem, 2vw, 1.2rem); }` and includes `h3` in the mobile `grid-column: 1` rule.
2. `src/components/WhatsAppButton.astro` (**WhatsApp button**): adds `@media (max-width: 560px)` shrinking the FAB to `3rem`, `inset-inline-end: 1rem`, `bottom: max(1rem, env(safe-area-inset-bottom))`, svg 25px.
3. `src/pages/[lang]/courses/[slug].astro` (**course title**): inside `@media (max-width: 620px)` adds `.course-intro h1 { font-size: clamp(2.15rem, 10vw, 3.15rem); } :global(:lang(ar)) .course-intro h1 { line-height: 1.35; }`. **Also** changes two selectors from `.course-detail .view-all-btn :global(svg)` to `.course-detail .view-all-btn svg` (and the `[aria-expanded="true"]` one). The roadmap text names only three tweaks; this fourth change is in the same file, so it will ride along. Executor should mention it in the commit message body; no need to ask the user (it is their edit), but do check `astro build` passes and the course page's "view all intakes" chevron still rotates (it is a visual check for Phase 7, not a gate).

The wizard branch does **not** touch any of these three files [VERIFIED: `git diff main...feature/registration-wizard --name-only`, 22 files, none of them these], so committing them first is conflict-free.

**Commit procedure:** commit `.gitattributes` first (so the three files commit LF with no warning), then `git add -- <the three paths explicitly>` and a separate commit `fix(mobile): ...`. Never `git add -A`/`.` in this repo while those edits are unstaged-by-design. The Phase 1 commits should go in this order so the tree is clean when each lands: (1) `.gitattributes`+`.gitignore`, (2) MOB-01 files, (3) pins, (4) real-D1 tests, (5) readJson, (6) smoke orchestration + CI.

## Conflicts with `feature/registration-wizard` (merged in Phase 3)

Branch merge-base `d60144f`; 22 files changed. It does **not** touch `package.json`, `package-lock.json`, `playwright.config.ts`, `.github/`, `.gitignore`, `wrangler.toml`, `src/index.ts`, `fakeD1.ts`, `vitest` config.

| Phase 1 change | Wizard branch also changes | Conflict? | Mitigation |
|----------------|---------------------------|-----------|------------|
| `src/test-utils/fakeD1.ts` rewrite | not touched; but tests import `createFakeD1` | No | Keep the export name |
| Test files (`session.test.ts`, `application.test.ts`, `index.test.ts`) | all three modified (225 / 67 / 3 lines) | **None if Phase 1 does not edit them** | Prototype needed zero edits to them |
| New `src/malformed.test.ts` | branch adds `test-utils/fixtures.ts`, no same-name file | No | — |
| `readJson` edits in `routes/application.ts`, `routes/session.ts` | branch modifies both (29 and 50 lines) | **Possible small textual conflicts** at the 1-line `req.json<...>()` changes (application.ts line 13, session.ts lines 105/128) | Keep each edit to the single token change; resolve in Phase 3 (re-apply `await readJson<...>(req)`) |
| Delete `scripts/local-dev.ts` | branch changes it by 1 line (adds `'0022_registration_fields.sql'`) | **Modify/delete conflict** | Trivial: `git rm` it during the Phase 3 merge. Alternative: leave `scripts/` untouched in Phase 1 (but then `better-sqlite3` must stay or the file is more broken). Recommended: delete in Phase 1, note it |
| `tests/e2e/application.spec.ts` | branch modifies (+23 lines) | **None**: slot creation lives in `global-setup.ts`; the spec is not edited | — |
| `playwright.config.ts`, CI, package files | not touched | No | — |
| `.gitattributes`, `.gitignore` | not touched | No | — |

Bonus check [VERIFIED: ran it]: the branch's `0022_registration_fields.sql` (contains `ALTER TABLE ... DROP COLUMN`) applies cleanly on a fresh local D1 after 0001-0021 with wrangler 4.157.0. It has not been run on a copy of existing data; Phase 3 still must.

## Common Pitfalls

### Pitfall 1: Orphaned `astro preview` on Windows
**What goes wrong:** After a Playwright run, port 4322 (or any port) stays LISTENING; the next run fails with "http://... is already used" or "Process from config.webServer exited early".
**Why:** Astro 7's `astro.mjs preview` launcher starts a detached child (`... astro.mjs preview --port N --json`); Playwright kills the launcher/shell, not that child. Reproduced three times, including with `node astro.mjs` directly and with `gracefulShutdown: SIGINT`.
**How to avoid:** serve with the in-process `preview()` API from `astro` in `globalSetup`; return `server.stop()`. After the change, run the suite twice in a row and confirm `netstat -ano | findstr :4322` is empty.
**Warning signs:** a `node.exe ... astro.mjs preview ... --json` process surviving after the run. Kill only that PID (`taskkill /F /PID <n> /T`), never `taskkill /IM node.exe` (it also kills Claude Code and other tools).

### Pitfall 2: Windows MAX_PATH hits wrangler's local D1
**What goes wrong:** `wrangler d1 migrations apply --local` fails with `internal error; reference = ...` with no useful log.
**Why:** In a scratch checkout under a 132-character path, the same command failed with both wrangler 4.125.0 and 4.157.0; the identical files at a short path succeeded. The real repo path `C:\Users\aliba\elc-astro-rebuild` is short and works. [Cause inferred from the pass/fail difference at different path lengths: MEDIUM, not proven]
**How to avoid:** keep the checkout (and any worktree/scratch copy) on a short path; don't run the suite from deep temp dirs. The executor should run from the real repo, not a copy.

### Pitfall 3: "Workers runtime crashed ... (crash #1)" on `wrangler dev`
**What goes wrong:** The warning appears twice at startup and looks like the failure mode `fakeD1.ts` describes.
**Reality:** the runtime restarts and the Worker answers (`HTTP 200`); the Playwright `url` wait succeeds and all 13 smoke tests pass. Do not add retry loops or treat the log line as an error. [VERIFIED: ran it, with wrangler 4.125.0 and 4.157.0]
**Keep written down:** README/`fakeD1.ts` header must say workerd runs on this machine and the warning is expected, replacing the old "crashes in this sandbox" claim.

### Pitfall 4: Rows leak between tests inside one test file
Real D1 under the plugin is shared across tests in a file. Without the global `beforeEach` reset, slot-count and uniqueness assertions break. The reset must not be per-file hand-picked tables (drift: Phase 4 adds `admin_sessions`/`login_attempts`); the generic `sqlite_master` version in Pattern 1 covers them, and `PRAGMA defer_foreign_keys = true` removes any delete-order concern.

### Pitfall 5: Stale processes make the next run "exit early"
My own earlier manual `wrangler dev` runs left processes holding 8787 and produced "Process from config.webServer exited early". Before debugging a failing `webServer`, check `netstat -ano | findstr "8787 4322"`.

### Pitfall 6: `npm ci` vs the installed tree
Root `node_modules` has astro 7.3.2 / playwright 1.63.0 while `package-lock.json` says 7.2.4 / 1.62.1; the worker's tree has wrangler 4.125.0. Verify pinning with a clean `npm ci` (delete `node_modules` first or use a fresh clone), not with the existing tree. After bumping Playwright to 1.64.1, run `npx playwright install chromium` (installed browser builds `chromium-1234`/`chromium-1243` may not match). [ASSUMED: 1.64.1 needs a newer Chromium build than those installed]

### Pitfall 7: npm 12 `allowScripts`
Local npm is 12.0.1 and blocks install scripts not listed in `allowScripts` (observed warning for `esbuild` and `workerd`; everything still worked because Windows ships the `workerd` binary as an optional dependency). CI uses Node 22 (npm 10), which ignores `allowScripts`. No change required; just don't rely on `allowScripts` entries for correctness, and keep `esbuild@0.28.2` in the root block matching the pinned version when astro changes.

### Pitfall 8: `.dev.vars` and tests
`placement-test-worker/.dev.vars` exists locally (ignored). The plugin passes explicit `miniflare.bindings`, which take precedence; keep `ADMIN_COOKIE_SECRET: 'test-secret'` in the config so tests never depend on a developer's secret.

## Code Examples

See Patterns 1-4 above (all executed). Extra: `.gitattributes` content [VERIFIED: clean-clone experiment, zero renormalize diff]:
```
* text=auto eol=lf
```
(Binary files such as PNG/ICO/fonts are auto-detected: `git ls-files --eol` reported 52 `-text` files; adding `*.png binary` etc. is optional and not required.)

CI changes (all in `.github/workflows/ci.yml`): in the `placement-test-smoke` job delete the steps "Create the local D1 database", "Seed a bookable slot...", "Start the Worker", "Build and serve the site" (webServer/globalSetup now do those); keep `npm ci`, `npm ci --prefix placement-test-worker`, `npx playwright install --with-deps chromium`, and run `npm run smoke` (no `SMOKE_BASE_URL`); keep the artifact upload; the "Worker log on failure" step reads `/tmp/wrangler.log` which no longer exists, so drop it (or capture via Playwright's `stdout: 'pipe'`). Add a `npm run check:pins` step. The worker job (`npm ci`, `npx tsc --noEmit`, `npm test`) stays as is. Optional lean follow-up: the Lighthouse step uses `npx @lhci/cli@0.13.x` (a floating range outside `package.json`, not covered by FND-01's check); leave it, note it.

Root scripts to add:
```json
"check:pins": "node scripts/check-pins.mjs",
"test:worker": "npm test --prefix placement-test-worker && npm run typecheck --prefix placement-test-worker",
"test:all": "npm run check:pins && npm run test:worker && npm run smoke"
```
(add `"typecheck": "tsc --noEmit"` to the worker). Existing `smoke` script is `playwright test`.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@cloudflare/vitest-pool-workers` (`defineWorkersConfig`) | `@cloudflare/vitest-plugin` with `cloudflareTest()` Vite plugin | Pool package deprecated; new one is the only one receiving updates |
| `import { env, SELF } from 'cloudflare:test'` | `import { env } from 'cloudflare:workers'` | `cloudflare:test` `env`/`SELF` typed `@deprecated` |
| Hand-started worker/preview in CI | Playwright `webServer` + `globalSetup` | Same command locally and in CI |

**Deprecated/outdated here:** `fakeD1.ts` header claims; `dev:fallback`; README "Testing Setup"; CI manual seed with `2027-01-01`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | npm reads project `.npmrc` only from the package root (so each package needs its own) | Current State | Low: an extra `.npmrc` is harmless |
| A2 | Playwright 1.64.1 needs a Chromium build not currently installed | Pitfall 6 | Low: only decides whether `npx playwright install chromium` is required; the command is idempotent |
| A3 | Wrangler local-D1 failure at long paths is due to MAX_PATH | Pitfall 2 | Low: affects only scratch copies; real path works |
| A4 | Programmatic `build()` from `astro` would also work; the research uses the CLI build via `execFileSync` instead, which was tested | Pattern 3 | None (CLI path is the verified one) |
| A5 | CI (Ubuntu, Node 22) behaves like the local run for `preview()`, plugin and webServer | Pattern 3 | Medium: first CI run is the check; plugin and wrangler are cross-platform, `preview()` is plain Node |

## Open Questions

1. **Delete `scripts/local-dev.ts` + `dev:fallback` in Phase 1?**
   - Known: already broken (wrong arity, missing 0016, `vite` not installed); the branch edits it by one line.
   - Recommendation: delete it now; accept a one-file modify/delete resolution in Phase 3. If the user wants zero Phase 3 friction, leave the files and keep `better-sqlite3`. Planner should pick the delete.
2. **Pin astro/sitemap to lock versions (7.2.4 / 3.7.3) or bump to current?**
   - Recommendation: lock versions now. Dependabot already has open PRs (`astro-7.2.8`) for later.
3. **First CI run of the new smoke job is untested on Ubuntu.** Plan a task that watches the first PR run; fallback if `preview()` misbehaves there is none needed on Linux (the `webServer` with `astro preview` works on Linux), but keep the Windows-safe path as default.
4. **Playwright projects (mobile Chromium/WebKit, AR/EN)** belong to Phase 7 (MOB-02); do not add them now. Keep the config extensible only by not hard-coding a single project name.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v24.18.0 (CI: 22) | — |
| npm | installs | yes | 12.0.1 (CI: npm 10) | — |
| workerd via wrangler | FND-02, FND-04 | yes | workerd 2026-11-03 with wrangler 4.157.0 [VERIFIED: `npx workerd --version`] | `fakeD1` not needed |
| Playwright Chromium | FND-06 | yes (builds 1234/1243 present) | — | `npx playwright install chromium` after the 1.64.1 bump |
| git | FND-05, MOB-01 | yes | `core.autocrlf=true` | — |
| Network (npm registry, browser download) | installs | yes | — | — |

No blocking missing dependency.

## Security Domain

`security_enforcement` is on (ASVS level 1). This phase adds no auth or data features; relevant controls:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `readJson()` rejects malformed/non-object JSON with a 400 (FND-03); field-level validation is Phases 3-4 |
| V14 Configuration / supply chain | yes | Exact pins, committed lockfiles, `npm ci`, `check-pins`; `.dev.vars` ignored |
| V2/V3/V4 Auth, session, access | no | Phase 4 |
| V6 Cryptography | no | `ADMIN_COOKIE_SECRET: 'test-secret'` is test-only, never a real secret |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Floating `latest` pulling a compromised release | Tampering | Exact pins + lockfile + `npm ci` + CI `check-pins` |
| Secret file committed | Information disclosure | `.dev.vars` ignored at root and worker; do not read `.env`/`.dev.vars` contents in tasks |
| Error body leaks internals on 500 | Information disclosure | Already `internal_error` unless `LOCAL_DEV=true`; `readJson` returns fixed `invalid_json` |
| Local test data in smoke | — | Fixed fake identities only (`Smoke Test`, `0500000000`, `smoke-test@example.com`, ID `1234567890`) per TESTING.md |

(Validation Architecture section omitted: `workflow.nyquist_validation` is `false` in `.planning/config.json`.)

## Project Constraints (from CLAUDE.md)

- `./CLAUDE.md` is `AGENTS.md`: start Astro dev with `astro dev --background` (manage via `astro dev stop|status|logs`); Phase 1 does not need a dev server; Playwright's `globalSetup` builds and previews itself.
- graphify rules: use `graphify query "<question>"` for codebase orientation when `graphify-out/graph.json` exists; run `graphify update .` after modifying code (AST-only, no cost). Add that as the last step after code edits.
- `.claude/CLAUDE.md` only registers the `/graphify` skill.
- Project skills in `.agents/skills/` are design/frontend skills (brandkit, design-taste-frontend, image-to-code, ...); none applies to this phase.
- User preferences (from the invocation): simplest solution that works; no new abstractions beyond what requirements need; do not stage/commit/revert the user's three edited files except in the explicit MOB-01 task; `feature/registration-wizard` is merged in Phase 3, not here.

## Sources

### Primary (HIGH confidence)
- Ran on this machine, 2026-11-04 (scratch copies only): `wrangler d1 migrations apply --local` (21/21), vitest + plugin full existing suite (136) + new malformed-JSON suite (145), `tsc --noEmit` under TS 7.0.2, Playwright smoke 13/13 cold and warm, git clone + `.gitattributes` renormalize experiment, orphan-process reproductions.
- `node_modules/@cloudflare/vitest-plugin/package.json`, `types/cloudflare-test.d.ts`, `dist/pool/index.d.mts` (exports `cloudflareTest`, `readD1Migrations`; `applyD1Migrations` in `cloudflare:test`).
- Repo files read: `package.json` (x2), `package-lock.json` (x2), `.github/workflows/ci.yml`, `deploy.yml`, `wrangler.toml` (x2), `fakeD1.ts`, `index.ts`, `routes/*.ts`, `db.ts` (booking/slot code), `playwright.config.ts`, `tests/e2e/*.ts`, `.gitignore` (x2), `.planning/*`.
- `npm view` for all versions and the deprecation notice.
- [CITED: developers.cloudflare.com/workers/testing/vitest-integration/configuration/] — `cloudflareTest`, `readD1Migrations`, `miniflare.bindings`, `setupFiles` example.

### Secondary (MEDIUM)
- `gsd-tools package-legitimacy check` output (heuristic; `too-new` flags are recency only).

### Tertiary (LOW)
- None relied upon.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from registry; combination executed locally.
- Architecture: HIGH — each pattern run end to end here.
- Pitfalls: HIGH for the orphan-process and workerd behaviour (reproduced); MEDIUM for the MAX_PATH cause.

**Research date:** 2026-11-04
**Valid until:** 2026-11-18 (fast-moving: wrangler/vitest ship near-daily; re-run `npm view` for the pins at install time and keep the plugin/wrangler pairing exact)
