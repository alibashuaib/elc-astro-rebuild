---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# Technology Stack

**Analysis Date:** 2026-11-04

## Languages

**Primary:**
- TypeScript - `placement-test-worker/src/**/*.ts`, `src/lib/*.ts`, `src/i18n/ui.ts`
- Astro component syntax (`.astro`) - `src/pages/**`, `src/components/**`, `src/layouts/Layout.astro`

**Secondary:**
- JavaScript (ESM) - `astro.config.mjs`, `cms-oauth-worker/src/index.js`
- SQL (D1/SQLite migrations) - `placement-test-worker/migrations/0001_init.sql` through `0021_application_email_idtype.sql`

## Runtime

**Environment:**
- Node.js >= 22.12.0 (declared in `package.json` `engines`; CI uses Node 22 via `.github/workflows/deploy.yml` and `.github/workflows/ci.yml`)
- Cloudflare Workers runtime for `placement-test-worker` and `cms-oauth-worker` (`compatibility_date` 2026-08-01 and 2024-11-01 respectively)

**Package Manager:**
- npm
- Lockfiles: present - `package-lock.json` (root), `placement-test-worker/package-lock.json`
- Installs run per package: `npm ci` at root and `npm ci --prefix placement-test-worker`

## Frameworks

**Core:**
- Astro ^7.2.4 - static site generator for the marketing site (`astro.config.mjs`, `output` is static, `format: 'directory'`)
- Cloudflare Workers (wrangler) - API backend for placement test and bookings (`placement-test-worker/wrangler.toml`, entry `src/index.ts`)

**Testing:**
- Playwright ^1.62.1 - browser smoke tests (`npm run smoke`, root `devDependencies`)
- Vitest (`latest`) with `@cloudflare/vitest-pool-workers` - worker unit/route tests (`placement-test-worker/package.json`, `npm test`)
- Lighthouse CI 0.13.x via `npx @lhci/cli@0.13.x` - performance budgets (`lighthouserc.json`, `npm run lhci`)

**Build/Dev:**
- Astro CLI (`astro dev`, `astro build`, `astro preview`) - root scripts
- Wrangler (`latest`) - local/remote Worker dev and D1 migrations (`placement-test-worker` scripts `dev`, `db:migrate:local`, `db:migrate:remote`)
- TypeScript - root `tsconfig.json` extends `astro/tsconfigs/strict`; type check via `npx tsc --noEmit` in CI
- Vite (used by `placement-test-worker` `dev:fallback` via `scripts/vite.local.config.ts`)

## Key Dependencies

**Critical:**
- `astro` ^7.2.4 - site framework; `i18n` routing with locales `en` and `ar` (default `en`, always prefixed)
- `@astrojs/sitemap` ^3.7.3 - sitemap generation; filters out `/placement-test/admin`
- `better-sqlite3` ^13.0.3 (dev) - local SQLite backing for D1 tests and local dev (`placement-test-worker/package.json`)
- `bcryptjs` (latest) - password/credential hashing in `placement-test-worker` (imported in `placement-test-worker/src`)
- `@cloudflare/workers-types` (latest) - Worker type definitions

**Infrastructure:**
- `wrangler` (latest) - deploy, dev, and D1 migration tooling
- `@cloudflare/vitest-pool-workers` (latest) - runs Vitest inside the Workers runtime
- `@playwright/test` ^1.62.1 - smoke tests against `SMOKE_BASE_URL`
- `@types/better-sqlite3` ^9.6.0, `@types/node` ^26.3.0, `typescript` (latest), `vitest` (latest)

**Build allowances:**
- `allowScripts` in root `package.json` permits the `esbuild@0.28.2` install script
- `allowScripts` in `placement-test-worker/package.json` permits `better-sqlite3@13.0.3` install script

## Configuration

**Environment:**
- Root `.env` (not committed) - template at `.env.example`. Optional variables: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` (server-side, read via `process.env` in `src/lib/googleReviews.ts`), `PUBLIC_GTM_ID` (client-side, `import.meta.env`), `PUBLIC_PLACEMENT_API_URL` (client-side base URL of the placement-test worker)
- Build still succeeds with all of these unset; the feature is skipped
- Worker secrets and vars (names only): `ADMIN_COOKIE_SECRET` (secret), `ADMIN_SESSION_TTL_SECONDS` (plain var, `43200` in `placement-test-worker/wrangler.toml`), `LOCAL_DEV` (dev flag)
- CMS OAuth worker secrets (names only, set via `wrangler secret put`): `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`

**Build:**
- `astro.config.mjs` - site URL `https://elc.com.sa`, i18n, `inlineStylesheets: 'always'`, `compressHTML: true`, redirect `/` to `/en/`
- `tsconfig.json` - strict Astro preset
- `placement-test-worker/wrangler.toml` - D1 binding `DB` (database `placement-test`), migrations dir `migrations/`
- `cms-oauth-worker/wrangler.toml` - Worker `elc-cms-oauth`
- `lighthouserc.json` - Lighthouse CI config
- `.vscode/launch.json`, `.vscode/extensions.json` - editor config

## Platform Requirements

**Development:**
- Node.js 22.12+ and npm
- Wrangler for the Worker and local D1 (`npm run db:migrate:local --prefix placement-test-worker`)
- Playwright Chromium for smoke tests (`npx playwright install --with-deps chromium`)

**Production:**
- Static site hosted on Hostinger shared hosting, deployed by FTP to `/public_html/` (`.github/workflows/deploy.yml`, `SamKirkland/FTP-Deploy-Action@v4.3.5`)
- Placement-test API on Cloudflare Workers with a D1 database (`placement-test-worker`, deployed URL in `.env.example` pattern `*.workers.dev`)
- CMS OAuth handler on Cloudflare Workers (`cms-oauth-worker`)
- Deploy workflow is currently manual-only (`workflow_dispatch`); push and schedule triggers are commented out pending Hostinger FTP secrets

---

*Stack analysis: 2026-11-04*
