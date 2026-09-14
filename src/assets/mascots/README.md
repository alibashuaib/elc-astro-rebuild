# ELC course mascots

Prepared from the cover exports supplied in `Desktop/export` using built-in ImageGen. These are reference-based 3D portraits with intentionally distinct characters and course props. The original exports were left intact.

| Asset | Source cover | Course |
| --- | --- | --- |
| kids-boy.png | Human boy matching the homepage hero | kids-general |
| adults.png | ELC_Adults_Deck/01_Adults_Cover.png | adults-general |
| girls.png | ELC_Girls_Deck/01_Girls_Cover.png | womens-general-english |
| pup.png | ELC_PUP_Deck/01_PUP_Cover.png | university-exam-prep |
| step-male.png | Revised as a young college-bound student | step-exam-preparation |
| ielts-male-red.png | Older higher-education learner in IELTS red | ielts-preparation |
| business.png | Generated using pup.png as a style reference | business-english |

The homepage uses `hero-human-kid.png`, a chest-up group portrait of the human boy, adult man and woman. Other image variants are retained as generation references; the active images are selected by imports in `CourseArtwork.astro` and `HomeExperience.astro`.

The girls character accompanies the existing Women's General English course; its published title and course data are unchanged. STEP and IELTS now use male-only mascots: STEP is a young college-bound student, while IELTS is an older learner pursuing higher education. Business English uses a clearly business-focused male professional only. The semantic icon fallback remains available for future courses. Prompts for the generated mascots are recorded in [generation-prompts.md](generation-prompts.md).

## ImageGen prompt set

First pass, per source: isolate the existing character, preserve its identity, face, expression, pose, clothing and colors; remove background, text, logos and surrounding props. For kids, retain the held trophy, shoes and full body. For the other characters, use a centered waist-up portrait with the entire head and folded arms visible. Request a transparent background.

The first pass rendered a checkerboard rather than alpha. Those outputs are not used by the site. The final pass used this prompt on each isolated portrait:

> Edit target: this isolated ELC character. Preserve the character exactly, including face, clothes, colors, expression, pose and any held trophy. Replace ALL the gray checkerboard with one perfectly uniform solid warm ivory background #f8f5ee. OPAQUE ivory, no transparency, no checkerboard, no textures, no lettering, no gradient, no extra props. Zoom out slightly so the character fits inside a landscape 4:3 canvas, centered, head safely 8% below top. Adult/female busts end exactly at the bottom edge. Kids keep entire body and trophy visible. High fidelity character portrait for a website course card.

## Delivery

`CourseArtwork.astro` maps shared course slugs to these source PNGs for both languages and the homepage. Astro generates responsive WebP variants at build time. Artwork is decorative with empty alt text, lazy loading, explicit intrinsic dimensions, and a reserved display area.
