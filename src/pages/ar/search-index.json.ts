import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { categoryLabels } from '../../i18n/ui';

// Build-time search index — static JSON, no backend, no client-side content
// duplication across every page. Courses + blog only (title/summary/category
// are all real, structured content already; nothing invented for search).
export const GET: APIRoute = async () => {
  const courses = await getCollection('courses', (e) => e.id.startsWith('ar/') && !e.data.draft);
  const posts = await getCollection('blog', (e) => e.id.startsWith('ar/') && !e.data.draft);

  const items = [
    ...courses.map((c) => {
      const slug = c.id.replace(/^ar\//, '');
      return {
        type: 'course' as const,
        title: c.data.title,
        summary: c.data.summary,
        tag: categoryLabels.ar[c.data.category] ?? c.data.category,
        url: `/ar/courses/${slug}/`,
      };
    }),
    ...posts.map((p) => {
      const slug = p.id.replace(/^ar\//, '');
      return {
        type: 'post' as const,
        title: p.data.title,
        summary: p.data.summary,
        tag: 'الأخبار',
        url: `/ar/blog/${slug}/`,
      };
    }),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
