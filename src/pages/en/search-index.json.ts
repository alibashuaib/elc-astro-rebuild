import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { categoryLabels } from '../../i18n/ui';

// Build-time search index — static JSON, no backend, no client-side content
// duplication across every page. Courses + blog only (title/summary/category
// are all real, structured content already; nothing invented for search).
export const GET: APIRoute = async () => {
  const courses = await getCollection('courses', (e) => e.id.startsWith('en/') && !e.data.draft);
  const posts = await getCollection('blog', (e) => e.id.startsWith('en/') && !e.data.draft);

  const items = [
    ...courses.map((c) => {
      const slug = c.id.replace(/^en\//, '');
      return {
        type: 'course' as const,
        title: c.data.title,
        summary: c.data.summary,
        tag: categoryLabels.en[c.data.category] ?? c.data.category,
        url: `/en/courses/${slug}/`,
      };
    }),
    ...posts.map((p) => {
      const slug = p.id.replace(/^en\//, '');
      return {
        type: 'post' as const,
        title: p.data.title,
        summary: p.data.summary,
        tag: 'News',
        url: `/en/blog/${slug}/`,
      };
    }),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
