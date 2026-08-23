# ELC — Astro Rebuild

Bilingual (EN/AR) rebuild of elc.com.sa, built for SEO, speed, and accessibility.
Static Astro site — no server runtime, deploys as plain HTML/CSS/JS.

Design/SEO plan this implements: see the Google Doc "ELC New Website Plan — Astro
Rebuild (EN/AR)" (source of truth for scope and decisions).

## Status

Lighthouse: **100 / 100 / 100 / 100** (Performance / Accessibility / Best Practices /
SEO) across every page type, both languages, verified locally against a production
build (`npm run build && npm run preview`).

## Structure

- `src/content.config.ts` — content collections: `courses`, `blog`, `testimonials`.
  Each is a fully separate `en/` and `ar/` tree under `src/content/<type>/`.
- `src/i18n/ui.ts` — translation dictionary + locale-path helpers. No i18n library.
- `src/layouts/Layout.astro` — canonical/hreflang/OG/JSON-LD, shared shell.
- `src/lib/schema.ts` — JSON-LD builders (Organization, LocalBusiness, Course, Article,
  Breadcrumb). Several fields are TODO placeholders — see inline comments.
- `src/styles/tokens.css` — design tokens (color/type/space), light+dark mode.
- `public/admin/` — Decap CMS scaffold for non-technical staff editing.

## Commands

```sh
npm install
npm run dev       # localhost:4321
npm run build     # -> ./dist/
npm run preview   # serve the production build locally
```

## Before this goes live — open items

These are tracked inline as `TODO` comments at the relevant file, plus the source
plan doc's own "What's Not Yet Decided" section:

- **GitHub repo + Decap CMS OAuth provider** — `public/admin/config.yml` has a
  placeholder `repo:`/`base_url:`; CMS login won't work until both exist.
- **Hostinger FTP secrets** — `.github/workflows/deploy.yml` needs `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD` repo secrets before it can deploy.
- **Real NAP/GBP data** — `localBusinessSchema()` in `src/lib/schema.ts` is not wired
  into any page yet; its address/geo/phone fields are empty on purpose (fake
  coordinates would hurt local SEO more than no schema at all). Fill in once the
  "Knowledge Edifice Institute" vs "ELC" GBP mismatch is resolved.
- **Contact/Register form endpoints** — currently POST to `/api/contact` and
  `/api/register`, which don't exist yet. Needs a small serverless handler.
- **Real copy, photography, testimonials** — all current course/blog content is
  placeholder text, written to exercise the templates, not to publish as-is.

## CI

`.github/workflows/ci.yml` builds the site and runs Lighthouse CI
(`lighthouserc.json`) on every PR — fails if Performance/Best-Practices drop below
95 or Accessibility/SEO drop below 100 on the sampled pages.
