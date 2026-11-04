---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# External Integrations

**Analysis Date:** 2026-11-04

## APIs & External Services

**Google Places API (New):**
- Used to fetch Google Business Profile reviews at build time
- Implementation: `src/lib/googleReviews.ts` (`fetchGoogleReviews(locale)`, base `https://places.googleapis.com/v1/places`)
- Auth: env var `GOOGLE_PLACES_API_KEY` (restricted to Places API New)
- Place identity: env var `GOOGLE_PLACE_ID`
- Returns null when either var is unset; caller renders nothing
- Also referenced in `src/lib/schema.ts` (AggregateRating/Review schema, only when real reviews exist)

**Google Tag Manager / Consent Mode v2:**
- Client-side loader, Consent Mode v2 defaults to denied until visitor accepts
- Implementation: `src/components/ConsentHead.astro`, `src/components/ConsentBanner.astro`
- Auth/config: `PUBLIC_GTM_ID` (`import.meta.env`); nothing loads until set

**GitHub OAuth (Decap CMS backend):**
- OAuth proxy for Decap CMS login, Worker `elc-cms-oauth`
- Implementation: `cms-oauth-worker/src/index.js` (authorize URL `https://github.com/login/oauth/authorize`, token URL `https://github.com/login/oauth/access_token`)
- Auth: secrets `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- Callback: `https://<worker-subdomain>.workers.dev/callback`

**WhatsApp (click-to-chat links):**
- Plain `https://wa.me/...` links, no SDK
- Implementation: `src/components/WhatsAppButton.astro`, `src/components/ContactExperience.astro`, `src/components/RegistrationExperience.astro`, `src/components/placement-test/ResultBooking.astro`

**Social profiles (outbound links only):**
- YouTube, Instagram, X/Twitter, Snapchat, LinkedIn, Facebook, GitHub - link references in site components and `src/lib/schema.ts`
- No API calls

**Maps:**
- `maps.app.goo.gl` short links referenced for business location in site content

## Data Storage

**Databases:**
- Cloudflare D1 (SQLite) - database `placement-test`, binding `DB`
  - Config: `placement-test-worker/wrangler.toml`
  - Migrations: `placement-test-worker/migrations/` (0001 to 0021), applied with `wrangler d1 migrations apply`
  - Client: raw D1 binding in `placement-test-worker/src` (no ORM detected)
  - Local tests: `createFakeD1()` in `placement-test-worker/src/test-utils/fakeD1.ts`, plus `better-sqlite3`
- Tables seen in migrations and CI seed: `slots` (`starts_at`, `capacity`, `booked_count`), student applications (`0019_student_applications.sql`), placement questions and reading passages

**File Storage:**
- Not used for uploads. An R2 bucket `elc-application-documents` was removed; `placement-test-worker/wrangler.toml` notes it must be deleted manually if it exists
- Static assets are bundled in the Astro build (`astro:assets`)

**Caching:**
- None detected at application level. Static HTML served by Hostinger

## Authentication & Identity

**Admin auth (placement test):**
- Custom session cookie auth in `placement-test-worker`
- Implementation: `ADMIN_COOKIE_SECRET` secret, `ADMIN_SESSION_TTL_SECONDS` = 43200
- Passwords/credentials hashed with `bcryptjs`
- Staff admin UI: `src/pages/en/placement-test/admin.astro` (excluded from sitemap, noindex)

**CMS auth:**
- GitHub OAuth via `cms-oauth-worker` for Decap CMS (see above)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Wrangler console output (`wrangler dev`); CI writes `/tmp/wrangler.log` and `/tmp/preview.log` on smoke failure, uploaded as artifacts

**Performance:**
- Lighthouse CI via `lighthouserc.json`, run in `.github/workflows/ci.yml` with the Google Places env vars passed through

## CI/CD & Deployment

**Hosting:**
- Marketing site: Hostinger shared hosting, `/public_html/`
- Workers: Cloudflare (`*.workers.dev` for placement-test and CMS OAuth)

**CI Pipeline:**
- GitHub Actions, `.github/workflows/ci.yml`: install, `npx tsc --noEmit`, `npm test`, build, Lighthouse CI, local wrangler dev, Playwright smoke tests (`npm run smoke`)
- Deploy: `.github/workflows/deploy.yml`, `workflow_dispatch` only. Runs `npm run build`, then `SamKirkland/FTP-Deploy-Action@v4.3.5` to Hostinger using `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` secrets
- Push, repository_dispatch, and cron triggers are commented out

## Environment Configuration

**Required env vars:**
- None strictly required. Optional: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `PUBLIC_GTM_ID`, `PUBLIC_PLACEMENT_API_URL`
- Worker: `ADMIN_COOKIE_SECRET` (secret), `ADMIN_SESSION_TTL_SECONDS`

**Secrets location:**
- Local root `.env` (gitignored, template `.env.example`)
- GitHub repo secrets for CI and deploy (`GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `FTP_*`)
- Cloudflare Worker secrets via `wrangler secret put`
- Values are intentionally not recorded in this document

## Webhooks & Callbacks

**Incoming:**
- `cms-oauth-worker` `/callback` - GitHub OAuth redirect
- `placement-test-worker` HTTP API (routes under `placement-test-worker/src/routes/`: booking, application, session, admin, slots). Base URL is `PUBLIC_PLACEMENT_API_URL` on the client

**Outgoing:**
- None detected. The CMS-to-deploy webhook is planned but not wired (see the commented triggers in `deploy.yml`)
- Outbound calls: Google Places API (build time only)

---

*Integration audit: 2026-11-04*
