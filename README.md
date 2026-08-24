# ELC — Astro Rebuild

Bilingual (EN/AR) rebuild of elc.com.sa, built for SEO, speed, and accessibility.
Static Astro site — no server runtime, deploys as plain HTML/CSS/JS.

Design/SEO plan this implements: see the Google Doc "ELC New Website Plan — Astro
Rebuild (EN/AR)" (source of truth for scope and decisions).

## Status

Lighthouse: **100 / 100 / 100 / 100** (Performance / Accessibility / Best Practices /
SEO) across every page type, both languages, verified locally against a production
build (`npm run build && npm run preview`) and confirmed again in CI.

## Structure

- `src/content.config.ts` — content collections: `courses` (with structured `faqs[]`),
  `blog`. Each is a fully separate `en/` and `ar/` tree under `src/content/<type>/`.
  No `testimonials` collection — reviews come from Google (see below), not the CMS.
- `src/i18n/ui.ts` — translation dictionary + locale-path helpers. No i18n library.
- `src/layouts/Layout.astro` — canonical/hreflang/OG/JSON-LD, shared shell, fonts.
- `src/lib/schema.ts` — JSON-LD builders (Organization+AggregateRating, LocalBusiness,
  Course, Article, FAQPage, Breadcrumb). Several fields are TODO placeholders.
- `src/lib/googleReviews.ts` — build-time fetch of Google Business Profile reviews
  (Places API, New). Returns `null` gracefully if unconfigured; never fabricates data.
- `src/components/Testimonials.astro`, `CourseFilter.astro`, `FaqAccordion.astro` —
  render only real fetched data / are progressive enhancements over plain HTML.
- `src/components/RegistrationExperience.astro` — the `/register` form. No backend:
  submit builds a prefilled `wa.me` link client-side and opens WhatsApp. `/contact`
  is link-only (call/WhatsApp/email), no form. Keeps the site fully static.
- `src/styles/tokens.css` — design tokens (color/type/space), light+dark mode.
- `public/admin/` — Decap CMS scaffold for non-technical staff editing.
- `public/.htaccess` — security headers for Hostinger's Apache.
- `cms-oauth-worker/` — Cloudflare Worker OAuth proxy Decap needs to log in via GitHub.

## Commands

```sh
npm install
npm run dev       # localhost:4321
npm run build     # -> ./dist/
npm run preview   # serve the production build locally
```

Copy `.env.example` to `.env` to test the Google Reviews integration locally.

## Before this goes live — open items

These are tracked inline as `TODO` comments at the relevant file, plus the source
plan doc's own "What's Not Yet Decided" section:

- **Google Business Profile reviews** — `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID`
  aren't set anywhere yet (not locally, not as repo secrets), so the homepage
  testimonials section currently renders nothing. Needs a Places API (New) key and
  this business's real Place ID — same GBP listing that needs the NAP fix below.
- **Decap CMS OAuth** — `cms-oauth-worker/` is written but not deployed; needs your
  Cloudflare login (`npx wrangler login`) plus a GitHub OAuth App, then
  `public/admin/config.yml`'s `base_url` updated to the deployed Worker URL.
- **Hostinger FTP secrets** — `.github/workflows/deploy.yml` needs `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD` repo secrets before it can deploy (currently
  disabled — manual `workflow_dispatch` only).
- **Real NAP/GBP data** — `localBusinessSchema()` in `src/lib/schema.ts` is not wired
  into any page yet; its address/geo/phone fields are empty on purpose (fake
  coordinates would hurt local SEO more than no schema at all). Fill in once the
  "Knowledge Edifice Institute" vs "ELC" GBP mismatch is resolved.
- **Real copy, photography** — all current course/blog content is placeholder text,
  written to exercise the templates, not to publish as-is.

## CI

`.github/workflows/ci.yml` builds the site and runs Lighthouse CI
(`lighthouserc.json`) on every PR — fails if Performance/Best-Practices drop below
95 or Accessibility/SEO drop below 100 on the sampled pages. Branch protection
requiring this check isn't enabled — GitHub Free doesn't allow it on private repos.
