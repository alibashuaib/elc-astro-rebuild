import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Courses are structured fields, not free text — this is what makes Course/Offer
// schema.org output automatic and complete on every save (per the rebuild plan, §7).
// Each locale is a fully separate content tree: content/courses/en/*.md, content/courses/ar/*.md
const courseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.enum(['kids', 'adults', 'business', 'exam-prep']),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  price: z.number(),
  currency: z.string().default('SAR'),
  durationWeeks: z.number(),
  hoursPerWeek: z.number(),
  image: z.string().optional(),
  imageAlt: z.string().optional(), // required in practice via CMS field config — see admin/config.yml
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

const testimonialSchema = z.object({
  authorName: z.string(),
  courseTaken: z.string().optional(),
  rating: z.number().min(1).max(5),
  quote: z.string(),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: testimonialSchema,
});

export const collections = { courses, blog, testimonials };
