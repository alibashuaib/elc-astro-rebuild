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
3. `npm run db:migrate:remote` — creates tables and loads the real 89-question
   bank (see "Question bank" below). Do **not** run `0003_seed_admin.sql`
   (it isn't a real migration); instead bootstrap the admin account directly:
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

## Question bank

`migrations/0002_seed_questions.sql` inserts 72 clearly-labeled placeholder
items (kept for migration history). Three migrations layer real content and
schema on top of it:

- **`0003_real_questions.sql`** deletes the placeholders and inserts 50 real
  adult questions (40 grammar/situational + 10 reading-comprehension, from
  two short articles) plus an initial 13 kids questions (8 grammar/vocab MCQ
  + 5 true/false reading items) — everything from the paper tests that fit a
  plain 4-option multiple-choice format.
- **`0004_add_text_question_type.sql`** adds a `type` ('mcq' | 'text') and
  `expected_answer` column to `questions`, so the engine can also serve
  free-text-answer items (handwriting, fill-in-the-blank, counting) — see
  `src/routes/session.ts`'s `handleAnswer` for the grading branch (exact
  match after whitespace normalization; deliberately **case-sensitive**,
  since some items test capitalization itself) and `TestRunner.astro` for the
  text-input UI. `responses.answer_text` stores what was typed;
  `responses.selected_index` stores the documented `-1` sentinel for those
  rows since it's still `NOT NULL` for mcq-row backward compatibility.
- **`0005_kids_text_and_vocab_questions.sql`** replaces the kids bank (adults
  untouched) with 39 questions: the original 13 plus 6 capital-letter + 6
  lowercase-letter handwriting items, 4 missing-number counting items, 5
  room-vocabulary fill-in-the-blank items, and 5 vocab sentence-completion
  items (previously missed in 0003) — all `type: 'text'`. The vocab items are
  `text`, not `mcq`: the source is one shared 5-word bank (climbing, flying,
  playing, riding, throwing) across all 5 sentences, not a 4-option MCQ per
  sentence — forcing it into 4 options would mean inventing a distractor
  that isn't in the source, so the full word bank is shown in the prompt and
  the student types the word instead.

**Still out of scope:** the kids paper test's picture-matching section
(match Book/Pen/Car/Tree/Apple to pictures) has no digital equivalent
without the source images, which weren't brought into this schema/UI. That
part of the kids test still needs to be administered on paper, or the
schema extended with image asset support.

- **`0006_fixed_sequential_order.sql`** adds a `sequence` column and switches
  the engine from adaptive CEFR-level-jumping to a fixed, sequential
  walk-through per track, matching the exact question order in the source
  paper tests. `src/db.ts`'s `pickNextQuestion` now serves `ORDER BY
  sequence ASC` per track, ignoring `level` entirely for selection --
  `level` is kept only as descriptive metadata (and still drives the
  session's own CEFR-style scoring/estimated-level output in `scoring.ts`,
  which is otherwise unchanged).
- **`0007_elc_level_ladders.sql`** relabels `questions.level` (and
  `scoring.ts`'s `LEVELS_BY_TRACK`) from the generic 6-tier CEFR scale
  (A1-C2) to ELC's own level ladders, sourced from the "Adults Structure"
  and "General English for Kids" curricular-structure diagrams -- neither
  track actually spans A1-C2 in ELC's real curriculum:
  - **adults:** A0, A1, A2, B1, B2, C1 (no C2)
  - **kids:** -A1, A1, A1+, A2, A2+, B1 (only reaches B1, with an extra
    sub-level between A1 and A2, matching Super Minds 1-6 / Cambridge YLE)

  Same bucket assignment/order as 0003/0005 (position-based, see below) --
  only the label per bucket changes, not which questions are in which
  bucket. This required rebuilding the `questions` table (SQLite can't
  ALTER an existing CHECK constraint), with the relabel done inline in the
  rebuild's `INSERT ... SELECT` rather than as a separate pass, since
  neither the old nor the new CHECK constraint allows both label sets at
  once.

**CEFR/ELC levels are an approximation.** Neither paper test tags its
questions with a level — 0003 and 0005 assign levels by each question's
position in the source document (paper placement tests are conventionally
ordered easiest-to-hardest), split into roughly even buckets, then 0007
relabels those buckets to ELC's real level names. Review the level
assignments before relying on them pedagogically; adjust with
`UPDATE questions SET level = ... WHERE id = ...` or a follow-up migration.

To add more questions later, either use the admin page's question form
(mcq only for now) or write a new SQL migration file the same way as 0003/0005.

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
