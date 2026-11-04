---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# Coding Conventions

**Analysis Date:** 2026-11-04

The repo has two TypeScript projects plus static content: the Astro site at the root (`src/`, `tests/`) and the Cloudflare Worker at `placement-test-worker/` (its own `package.json`, `tsconfig.json`, and lockfile). `cms-oauth-worker/` is a third, smaller Worker. The conventions below are observed from code, not from a written style guide.

## Naming Patterns

**Files:**
- Astro components are PascalCase: `src/components/Header.astro`, `src/components/CourseCard.astro`, `src/components/placement-test/TestRunner.astro`.
- Astro pages use lowercase route names and bracketed dynamic segments: `src/pages/[lang]/courses/[slug].astro`, `src/pages/[lang]/register.astro`.
- Library modules are camelCase: `src/lib/googleReviews.ts`, `src/lib/placementApi.ts`, `src/lib/schema.ts`. Exception: `src/i18n/ui.ts` and `src/i18n/pages.ts` are lowercase single words.
- Worker modules are camelCase or single words: `placement-test-worker/src/scoring.ts`, `placement-test-worker/src/auth.ts`, `placement-test-worker/src/routes/application.ts`.
- Test files sit next to source with a `.test.ts` suffix (worker: `src/scoring.test.ts`, `src/routes/session.test.ts`). Playwright specs live apart in `tests/e2e/*.spec.ts`.
- Content is Markdown under `src/content/{blog,courses}/{en,ar}/<slug>.md`, with the same slug in both locales (`adults-general`, `ielts-preparation`).

**Functions:**
- camelCase, verb-first: `fetchGoogleReviews` in `src/lib/googleReviews.ts`, `startSession` / `submitAnswer` / `createBooking` in `src/lib/placementApi.ts`, `handleSubmitApplication` in `placement-test-worker/src/routes/application.ts`, `issueSessionCookie` / `verifyAdminSession` in `placement-test-worker/src/auth.ts`.
- Route handlers in the worker are named `handle<Action>` (`handleAdminListApplications`).
- Schema builders are `<thing>Schema` (`organizationSchema`, `localBusinessSchema` in `src/lib/schema.ts`).

**Variables and constants:**
- camelCase for locals. Module-level constants are UPPER_SNAKE_CASE: `BASE` in `src/lib/placementApi.ts`, `ID_TYPES` and `EMAIL_RE` in `placement-test-worker/src/routes/application.ts`, `COOKIE_NAME` in `placement-test-worker/src/auth.ts`, `PLACES_API_BASE` in `src/lib/googleReviews.ts`, `SITE_URL` in `src/lib/schema.ts`.
- Env vars are UPPER_SNAKE_CASE. Client-visible ones carry the `PUBLIC_` prefix (`PUBLIC_PLACEMENT_API_URL`, set in `.github/workflows/ci.yml`). Server-only build secrets are read through `process.env` (`src/lib/googleReviews.ts`).

**Types and interfaces:**
- PascalCase, with `Props` for Astro component props (`src/components/Header.astro`, `src/components/placement-test/TestRunner.astro`). Use `interface` for object shapes (`QuestionPayload`, `DonePayload` in `src/lib/placementApi.ts`; `GoogleReviewsResult` in `src/lib/googleReviews.ts`).
- Discriminated unions use a literal `done: true | false` field (`QuestionPayload` vs `DonePayload`). Follow this pattern for new step/result types.
- Worker env type is `Env` in `placement-test-worker/src/types.ts`. Reuse it; do not redeclare bindings.

**CSS classes:**
- Kebab-case, component-prefixed where scoped: `.hero-headline`, `.hero-animate`, `.course-card`, `.pt-progress-fill`, `.pt-letter-choice` (placement test uses a `pt-` prefix throughout `src/components/placement-test/`).
- Data attributes carry state and data for JS: `data-theme-toggle`, `data-course`, `data-stage`, `data-step`. Prefer a `data-*` hook over a class for JS selection.

## Code Style

**Formatting:**
- No Prettier or Biome config is present (no `.prettierrc*`, `biome.json`). Formatting is by hand and follows the existing look: 2-space indent, single quotes in TypeScript (`src/lib/placementApi.ts`), semicolons on statements, trailing commas mostly omitted in multi-line calls.
- Match the surrounding file rather than reformatting it.
- Keep the Arabic-language strings as their own literals; do not mix Arabic and English in one string.

**Linting:**
- No ESLint config is present. The type checker is the only static gate:
  - Root: `tsconfig.json` extends `astro/tsconfigs/strict`.
  - Worker: `placement-test-worker/tsconfig.json`, checked in CI with `npx tsc --noEmit`.
- Avoid `any`. The codebase has almost none outside tests (`src/i18n/pages.ts`, `src/lib/googleReviews.ts`, `src/lib/schema.ts` match only as substring text). Tests may use `as any` for env stubs (`placement-test-worker/src/auth.test.ts`).

**Styling:**
- Global tokens live in `src/styles/tokens.css`; base rules in `src/styles/global.css`. Use CSS custom properties (`var(--color-border)`, `var(--course-accent)`) instead of hard-coded colors.
- Component-scoped styles use `<style>` (scoped by Astro by default) or `<style is:global>` when the rule must reach dynamically created DOM (`src/components/CourseCard.astro`).
- `!important` is used in `src/components/CourseCard.astro` to win over global rules. Avoid adding more; prefer a more specific selector.
- Dark mode is handled with `data-theme-toggle` plus theme variables (see `src/components/Header.astro`).

## Import Organization

**Order (observed):**
1. Framework and Astro built-ins (`import { Image } from 'astro:assets';`, `import type { CollectionEntry } from 'astro:content';`)
2. Static assets (`import logoFull from '../assets/logo-elc-full.png';`)
3. Local components (`import Icon from './Icon.astro';`)
4. Local lib and i18n (`import { useTranslations, localizePath } from '../i18n/ui';`)

- Use `import type` for type-only imports (`src/components/Header.astro`, `placement-test-worker/src/routes/application.ts`).
- Worker code imports `Env` and row types from `../types` and `../db`; the route modules do not reach into each other.

**Path Aliases:**
- None configured. Use relative paths (`../../i18n/ui`).

## Error Handling

**Worker (`placement-test-worker/`):**
- Routes return JSON errors with a fixed helper: `function json(data, status = 200)` in `placement-test-worker/src/routes/application.ts`, mirrored in `routes/admin.ts`.
- Error bodies are `{ error: '<snake_case_code>' }` (`invalid_email`, `invalid_id_type`, `session_not_completed`, `already_applied`, `unauthorized`). Some older messages are sentences (`'sessionId, course, idNumber and email are required'`). For new code, use the snake_case code form.
- Validate input at the top of the handler and return early with 400, then check state (404/409), then do the write.
- Status codes carry meaning: 401 for auth, 409 for conflicts (slot filled, already applied, slot has bookings).
- Unhandled exceptions are caught at the router and logged with `console.error('placement API request failed', err)` (`placement-test-worker/src/index.ts`).
- Secrets and config fail closed. `issueSessionCookie` in `placement-test-worker/src/auth.ts` throws on a missing or non-positive `ADMIN_SESSION_TTL_SECONDS` rather than issuing a non-expiring cookie. Keep this pattern for any config value that gates security.

**Site (`src/`):**
- Build-time data fetches never fail the build. `fetchGoogleReviews` in `src/lib/googleReviews.ts` returns `null` when env is unset or the request fails, logs `console.warn('[googleReviews] ...')`, and the caller renders nothing. Use the same shape for optional integrations.
- Client fetch wrapper `request<T>()` in `src/lib/placementApi.ts` throws `Error('placement API <path> failed: <status>')` for non-OK responses, except statuses listed in `expectedErrors`. Expected business outcomes such as 409 on booking are returned to the caller, not thrown:
  ```typescript
  createBooking(...) // expectedErrors: [409] -> caller renders "slot filled"
  ```

## Logging

**Framework:** `console` only. No logger library.

**Patterns:**
- Prefix build-time and integration logs with a bracketed module tag: `console.warn('[googleReviews] ...')`.
- Use `console.error` for unexpected failures in the Worker and `console.warn` for degraded but recoverable states.
- Do not log request bodies, emails, phone numbers, or ID numbers. The application route handles these fields; keep them out of logs.

## Comments

**When to Comment:**
- Explain the why, especially for past failures and constraints. Existing comments record incidents and rules, for example the NaN-expiry fix in `placement-test-worker/src/auth.ts` and the build-time-only rule in `src/lib/googleReviews.ts`.
- Name the plan section or spec when a rule comes from one (`(§5)` in `src/lib/googleReviews.ts`).
- Do not narrate what the next line does.

**JSDoc/TSDoc:**
- Used on exported helpers that have a non-obvious contract: `request<T>()` in `src/lib/placementApi.ts`, `organizationSchema` parameters in `src/lib/schema.ts`.
- Plain `//` line comments are the norm elsewhere; `/** */` is for exported API docs.

## Function Design

**Size:** Route handlers and session logic are kept as single functions with early returns. Large files exist (`src/components/placement-test/TestRunner.astro`, `placement-test-worker/src/scoring.ts`); prefer adding a helper in the same module over growing a handler past one screen.

**Parameters:**
- Pass `env: Env` explicitly to worker functions (`insertApplication(env, {...})`). Do not read globals.
- Use an options object for three or more fields (`StartSessionInput`, `insertApplication(env, { ... })`).

**Return Values:**
- Worker handlers return `Response`. Helpers return typed values or throw.
- Astro-side API helpers return typed promises (`Promise<SessionStep>`).

## Module Design

**Exports:** Named exports only. Default exports appear only for Astro components.

**Barrel Files:** Not used. Import from the module file directly.

**Server vs client:**
- `src/lib/googleReviews.ts` and `src/lib/schema.ts` run at build time only; keep server-only secrets out of anything client-facing.
- Client scripts are in `<script>` tags inside `.astro` files (for example `src/components/placement-test/TestRunner.astro`). Read config from `data-*` attributes filled from the i18n dictionary, not from hard-coded strings.

## Internationalization

- Locales: `en` and `ar` (`src/i18n/ui.ts`). Arabic is RTL (`localeDir`).
- All UI strings come from `ui[locale]` via `useTranslations(locale)`. Add a key to both `en` and `ar` at the same time.
- Route helpers: `localizePath(locale, '/courses')` in `src/i18n/ui.ts`. Use it for every internal link so the locale prefix is kept.
- Course categories use `categoryLabels` in `src/i18n/ui.ts`.

---

*Convention analysis: 2026-11-04*
