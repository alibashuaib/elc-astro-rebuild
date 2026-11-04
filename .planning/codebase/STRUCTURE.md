---
last_mapped_commit: ac55aef49355220178d0ae075fc1dac4a417ae78
last_mapped_at: 2026-11-04
---
# Codebase Structure

**Analysis Date:** 2026-11-04

## Directory Layout

```
elc-astro-rebuild/
├── src/                      # Astro site source (static build input)
│   ├── assets/               # Images and mascot art (mascots/ has *-prompt.md notes)
│   ├── components/           # Shared .astro components
│   │   └── placement-test/   # Placement test UI (TestRunner, AdminPanel, ...)
│   ├── content/              # Content collections (Markdown)
│   │   ├── blog/{en,ar}/
│   │   └── courses/{en,ar}/
│   ├── content.config.ts     # Collection schemas (zod)
│   ├── i18n/                 # ui.ts (strings), pages.ts (per-page meta)
│   ├── layouts/              # Layout.astro
│   ├── lib/                  # Non-UI TS: placementApi, schema, googleReviews
│   ├── pages/                # File-based routes
│   │   ├── [lang]/           # Shared route for en + ar
│   │   ├── en/legal/, ar/legal/   # Legal pages (per-locale files)
│   │   ├── en/placement-test/admin.astro   # Staff-only admin page
│   │   └── 404.astro
│   └── styles/               # global.css, tokens.css
├── placement-test-worker/    # Cloudflare Worker + D1 (separate package)
│   ├── src/                  # index.ts router, routes/, scoring, kids, db, auth
│   │   ├── routes/           # session, booking, admin, application (+ *.test.ts)
│   │   └── test-utils/       # fakeD1.ts
│   ├── migrations/           # Numbered D1 SQL migrations 0001–0021
│   ├── scripts/              # local-dev.ts, vite.local.config.ts
│   ├── .local-dev/server.mjs # Local dev server
│   └── wrangler.toml
├── cms-oauth-worker/         # GitHub OAuth proxy for Decap CMS
│   ├── src/index.js
│   └── wrangler.toml
├── public/                   # Copied verbatim to dist/ (admin/, images/, fonts/, llms.txt, robots.txt)
├── tests/e2e/                # Playwright specs (application, course-diagram, placement-test)
├── docs/                     # Specs and plans (docs/superpowers/specs, docs/superpowers/plans)
├── .github/workflows/        # ci.yml, deploy.yml
├── .lighthouseci/            # Lighthouse CI output config
├── .agents/ and .claude/skills/   # Agent design skills (not app code)
├── .worktrees/registration-wizard # Git worktree copy of the repo for a feature branch
├── dist/                     # Build output (generated; do not edit)
├── graphify-out/             # Knowledge graph output (generated)
├── test-results/             # Playwright output (generated)
├── astro.config.mjs          # Astro config (i18n, sitemap, redirects)
├── DESIGN.md                 # Design system notes
├── AGENTS.md / CLAUDE.md     # Agent instructions
└── package.json
```

## Directory Purposes

**`src/pages/[lang]/`:**
- Purpose: Every bilingual route. Each file exports `getStaticPaths = localePaths` to build `/en/` and `/ar/`.
- Contains: `index.astro`, `about.astro`, `apply.astro`, `contact.astro`, `register.astro`, `courses/index.astro`, `courses/[slug].astro`, `blog/index.astro`, `blog/[slug].astro`, `placement-test/index.astro`, `search-index.json.ts`.
- Key files: `src/pages/[lang]/courses/[slug].astro`, `src/pages/[lang]/placement-test/index.astro`

**`src/pages/en/` and `src/pages/ar/`:**
- Purpose: Only legal pages and the staff admin page are per-locale files. Do not add new public pages here; use `[lang]/`.
- Key files: `src/pages/en/legal/privacy.astro`, `src/pages/en/legal/terms.astro`, `src/pages/ar/legal/privacy.astro`, `src/pages/ar/legal/terms.astro`, `src/pages/en/placement-test/admin.astro`

**`src/components/`:**
- Purpose: Reusable `.astro` components, mostly one per page section.
- Contains: Chrome (`Header.astro`, `Footer.astro`, `SearchOverlay.astro`, `WhatsAppButton.astro`), consent (`ConsentBanner.astro`, `ConsentHead.astro`), page experiences (`HomeExperience.astro`, `AboutExperience.astro`, `ContactExperience.astro`, `NewsExperience.astro`, `ArticleExperience.astro`, `RegistrationExperience.astro`), course pieces (`CourseCard.astro`, `CourseFilter.astro`, `CourseContentPanel.astro`, `CourseArtwork.astro`, `FaqAccordion.astro`), and small helpers (`AnimatedNumber.astro`, `Icon.astro`, `PageHero.astro`, `Testimonials.astro`).
- Placement subfolder: `src/components/placement-test/` holds `RegistrationForm.astro`, `TestRunner.astro`, `ResultBooking.astro`, `ApplicationForm.astro`, `AdminPanel.astro`.

**`src/lib/`:**
- Purpose: Non-visual TypeScript modules.
- Key files: `placementApi.ts` (worker client and payload types), `schema.ts` (JSON-LD builders), `googleReviews.ts` (build-time reviews fetch).

**`src/i18n/`:**
- Purpose: Translation dictionary and per-page metadata.
- Key files: `ui.ts` (`locales`, `localeDir`, `categoryLabels`, `ui`, `useTranslations`), `pages.ts` (`localePaths`, `meta`, `trail`, `pageMeta`, `heroKicker`, `SITE`).

**`src/content/`:**
- Purpose: Markdown content for courses and blog posts, one folder per locale.
- Key files: `src/content/courses/en/ielts-preparation.md` (slug matches `src/pages/[lang]/courses/[slug].astro`), `src/content/blog/en/placement-test-tips.md`.
- Courses present: adults-general, business-english, ielts-preparation, kids-general, special-courses, step-exam-preparation, university-exam-prep, womens-general-english (both locales).

**`src/styles/`:**
- Purpose: Global CSS. `tokens.css` holds design tokens and `global.css` imports them. `Layout.astro` imports `global.css`.

**`placement-test-worker/src/`:**
- Purpose: API logic. Keep route handlers in `routes/`, pure rules in top-level modules (`scoring.ts`, `bands.ts`, `kids.ts`), and DB access in `db.ts`.
- Tests: Co-located `*.test.ts` files (for example `scoring.test.ts`, `routes/booking.test.ts`).

**`placement-test-worker/migrations/`:**
- Purpose: Ordered D1 schema and seed changes. Add the next number (`0022_...sql`); never edit an applied migration.
- Run with `npm run db:migrate:local` or `:remote` in the worker (wrangler `migrations_dir = "migrations"`).

**`tests/e2e/`:**
- Purpose: Playwright end-to-end specs. Config is `playwright.config.ts` at repo root; run with `npm run smoke`.

**`public/`:**
- Purpose: Static assets served as-is. Contains `admin/` (Decap CMS entry), `images/`, `fonts/`, `llms.txt`, `robots.txt`, `favicon-*.png`.

## Key File Locations

**Entry Points:**
- `astro.config.mjs`: Astro config (site URL, i18n, sitemap filter, redirects)
- `src/layouts/Layout.astro`: Base page shell used by every route
- `placement-test-worker/src/index.ts`: Worker fetch handler and route table
- `cms-oauth-worker/src/index.js`: CMS OAuth worker

**Configuration:**
- `package.json`: Scripts (`dev`, `build`, `preview`, `lhci`, `smoke`); Node `>=22.12.0`
- `tsconfig.json`: TypeScript config for the site
- `placement-test-worker/wrangler.toml`: D1 binding `DB`, migrations dir, vars
- `cms-oauth-worker/wrangler.toml`: Worker name and secret names (values not stored)
- `lighthouserc.json`, `playwright.config.ts`: Test and audit configs
- `.env.example`: Documents required env variables such as `PUBLIC_PLACEMENT_API_URL`. A `.env` file exists at the root; its contents are not recorded here.

**Core Logic:**
- `src/lib/placementApi.ts`: Browser-side API client
- `placement-test-worker/src/routes/session.ts`, `routes/booking.ts`, `routes/admin.ts`, `routes/application.ts`: Endpoint handlers
- `placement-test-worker/src/scoring.ts`, `bands.ts`, `kids.ts`: Placement rules
- `placement-test-worker/src/db.ts`: D1 queries
- `src/lib/schema.ts`: Structured data

**Testing:**
- `placement-test-worker/src/**/*.test.ts`: Unit and route tests (run inside the worker package)
- `placement-test-worker/src/test-utils/fakeD1.ts`: In-memory D1 stand-in
- `tests/e2e/*.spec.ts`: Browser tests

## Naming Conventions

**Files:**
- Astro components and pages: PascalCase components (`CourseCard.astro`, `TestRunner.astro`), kebab-case or lowercase routes (`register.astro`, `placement-test/index.astro`).
- Dynamic routes: bracket syntax, `[lang]`, `[slug]`.
- Worker modules: lowercase single words (`session.ts`, `scoring.ts`, `db.ts`).
- Tests: `<name>.test.ts` next to the source, or `tests/e2e/<feature>.spec.ts`.
- Migrations: `NNNN_snake_description.sql` (four-digit zero-padded).
- Content: lowercase kebab-case slug in `src/content/<collection>/<locale>/<slug>.md`. The slug must match between `en` and `ar` for the language switcher.

**Directories:**
- Route and locale folders: lowercase (`[lang]`, `en`, `ar`, `legal`).
- Component subfolders by feature: `placement-test/`.

**Identifiers:**
- Question IDs use `<track>-<level>-<n>` (for example `kids-A1-1`) in `placement-test-worker/src/kids.ts`.
- Translation keys are dotted (`placementTest.heading`).

## Where to Add New Code

**New public page:**
- Route: `src/pages/[lang]/<name>.astro` using `getStaticPaths = localePaths`
- Page metadata: add an entry to `pageMeta` in `src/i18n/pages.ts` for both `en` and `ar`
- Strings: add keys to both locales in `src/i18n/ui.ts`
- Breadcrumb trail: extend `trail()` in `src/i18n/pages.ts` if the page should appear in breadcrumbs

**New legal or staff-only page:** Follow `src/pages/en/legal/*` or `src/pages/en/placement-test/admin.astro`, and pass `noindex` to `Layout` for staff pages.

**New component:**
- Shared section: `src/components/<Name>.astro`
- Placement feature: `src/components/placement-test/<Name>.astro`

**New course or blog post:**
- Add `src/content/courses/en/<slug>.md` and `src/content/courses/ar/<slug>.md` with the frontmatter required by `src/content.config.ts` (`title`, `summary`, `category`, plus optional fields). `faqs` defaults to an empty array.

**New shared TypeScript helper (non-UI):** `src/lib/<name>.ts`

**New API endpoint:**
- Handler: `placement-test-worker/src/routes/<area>.ts`
- Register in the `ROUTES` table in `placement-test-worker/src/index.ts`; set `admin: true` for staff-only endpoints
- Client wrapper: add a function in `src/lib/placementApi.ts`
- Tests: `placement-test-worker/src/routes/<area>.test.ts`

**New database change:** Add `placement-test-worker/migrations/0022_<description>.sql`. Do not renumber existing files.

**New end-to-end test:** `tests/e2e/<feature>.spec.ts`

**Utilities:**
- Site helpers: `src/lib/`
- Worker helpers: top level of `placement-test-worker/src/` (rules) or `src/test-utils/` (test doubles)

## Special Directories

**`dist/`:**
- Purpose: Astro build output (directory-format HTML, `_astro/` assets, `admin/`, `fonts/`, `images/`)
- Generated: Yes
- Committed: No (ignored by `.gitignore`)

**`graphify-out/`:**
- Purpose: Knowledge graph (`graph.json`, `GRAPH_REPORT.md`, `wiki/` when present)
- Generated: Yes
- Committed: Treated as generated; excluded from this mapping

**`placement-test-worker/.wrangler/`:**
- Purpose: Local Miniflare state (D1, R2, observability sqlite) and bundles
- Generated: Yes
- Committed: No

**`placement-test-worker/.dev.vars`:**
- Purpose: Local worker secrets for development. Contents not recorded here.
- Generated: No
- Committed: No

**`.worktrees/registration-wizard/`:**
- Purpose: Full secondary checkout of the repo for an in-flight feature branch. Its `src/` mirrors the main tree, so search results may appear twice. Exclude it when searching for code.
- Generated: Yes (git worktree)
- Committed: No

**`test-results/`:**
- Purpose: Playwright artifacts
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning artifacts, including this `codebase/` map
- Generated: Yes
- Committed: Per project workflow

---

*Structure analysis: 2026-11-04*
