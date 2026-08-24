import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Courses are structured fields, not free text — this is what makes Course/Offer
// schema.org output automatic and complete on every save (per the rebuild plan, §7).
// Each locale is a fully separate content tree: content/courses/en/*.md, content/courses/ar/*.md
const courseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.enum(['kids', 'adults', 'women', 'business', 'exam-prep']),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  price: z.number().optional(),
  currency: z.string().default('SAR'),
  durationWeeks: z.number().optional(),
  hoursPerWeek: z.number().optional(),
  hoursPerMonth: z.string().optional(),
  hoursPerDay: z.number().optional(),
  scheduleDays: z.string().optional(),
  classTimes: z.array(z.object({ label: z.string(), start: z.string(), end: z.string(), meridiem: z.string() })).optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(), // required in practice via CMS field config — see admin/config.yml
  // Structured FAQs, not markdown headings — lets the page render a real accordion
  // AND emit FAQPage schema from the same data, so they can never drift apart.
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
  draft: z.boolean().default(false),
});

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
  schema: courseSchema,
});

const postSchema = z.object({
  title: z.string(),
  summary: z.string(),
  publishDate: z.date(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: postSchema,
});

// No manual "testimonials" collection: reviews are pulled live from the Google
// Business Profile at build time instead (see lib/googleReviews.ts), so there's
// never a staff-editable path to a fabricated quote.

export const collections = { courses, blog };
