# placement-test-worker

Cloudflare Worker + D1 backend for the remote placement test and oral-test
booking flow. See `docs/superpowers/specs/2026-08-25-placement-test-design.md`
in the main repo for the full design.

## Testing Setup

**Important:** This project's test suite (`npm test` inside `placement-test-worker/`)
uses `src/test-utils/fakeD1.ts`, an in-memory SQLite shim, instead of
`@cloudflare/vitest-pool-workers` or Miniflare. This is because the sandboxed
environment where this project was built could not run the native Cloudflare
`workerd` runtime (`wrangler dev` crashed with "The Workers runtime crashed
unexpectedly" on every attempt).

The in-memory shim tests are still meaningful — they exercise real SQL against
the real schema — but we recommend that whoever deploys this for real **also do
one manual pass with `wrangler dev` in a normal (non-sandboxed) environment
before going live** to confirm real D1 and `workerd` behavior matches the shim's.

**Recommendation (future improvement, not required for launch):** the admin
session cookie currently has to use `SameSite=None; Secure` because the Worker
is deployed on the default `*.workers.dev` subdomain, a different origin than
`elc.com.sa`. Routing this Worker at `elc.com.sa/api/*` via a Cloudflare
[custom route](https://developers.cloudflare.com/workers/configuration/routing/routes/)
instead would make the admin panel same-site with its API, which is
architecturally cleaner — a `SameSite=Lax`/`Strict` cookie would work, and the
`ALLOWED_ORIGINS` CORS allowlist in `src/index.ts` would no longer be needed.

## First-time deploy

1. `npm install`
2. `npx wrangler d1 create placement-test` — copy the printed `database_id`
   into `wrangler.toml`.
3. `npm run db:migrate:remote` — creates tables and loads the 72 placeholder
   questions. Do **not** run `0003_seed_admin.sql` (it isn't a real
   migration); instead bootstrap the admin account directly:
   ```
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'your-real-password'
   npx wrangler d1 execute placement-test --remote --command "INSERT INTO admin_users (id, username, password_hash) VALUES ('admin-1','staff','<PASTE_HASH>')"
   ```
4. `npx wrangler secret put ADMIN_COOKIE_SECRET` — paste a long random string.
5. `npx wrangler deploy` — note the printed `*.workers.dev` URL (or configure
   a custom route/domain in `wrangler.toml` first).
6. In the main Astro project, set `PUBLIC_PLACEMENT_API_URL` (as a repo
   secret for CI builds, and in local `.env`) to that URL.
7. In `src/index.ts`, add the deployed site's real origin to
   `ALLOWED_ORIGINS` if it differs from `https://elc.com.sa`.

## Replacing the placeholder question bank

The seed migration (`migrations/0002_seed_questions.sql`) inserts 72
clearly-labeled placeholder items. To replace them with real content:

```
npx wrangler d1 execute placement-test --remote --command "DELETE FROM questions"
```

then insert the real bank either via the admin page's question form
(Task 10) or a new SQL file run the same way as the seed migration.

## Local development

```
npm run db:migrate:local   # first time only
npx wrangler dev           # serves the Worker on localhost:8787
npm test                   # runs the Vitest suite against a local D1
```

## Known pre-launch follow-up

**Fallback UI for Worker/D1 downtime:** The design spec calls for a fallback
WhatsApp contact link on the registration form when the Worker or D1 backend is
unreachable (e.g., during downtime). This ensures the registration funnel never
dead-ends. However, this error path was not implemented as part of the 11-task
launch plan — the registration form (`src/components/placement-test/RegistrationForm.astro`
in the main Astro project) currently has no try/catch around the `startSession`
call and does not show a fallback UI on failure.

**Recommendation:** Before going live, add a try/catch wrapper around the
`startSession` call in the registration form with a static WhatsApp link fallback
(use the existing pattern from `ResultBooking.astro` in the same component).
