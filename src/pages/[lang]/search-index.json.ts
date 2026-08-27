import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { categoryLabels, locales, useTranslations, type Locale } from '../../i18n/ui';

export const getStaticPaths: GetStaticPaths = () => locales.map((lang) => ({ params: { lang } }));

// Build-time search index — static JSON, no backend, no client-side content
// duplication across every page. Courses + blog only (title/summary/category
// are all real, structured content already; nothing invented for search).
export const GET: APIRoute = async ({ params }) => {
  const locale = params.lang as Locale;
  const t = useTranslations(locale);
  const prefix = `${locale}/`;

  const courses = await getCollection('courses', (e) => e.id.startsWith(prefix) && !e.data.draft);
  const posts = await getCollection('blog', (e) => e.id.startsWith(prefix) && !e.data.draft);

  const items = [
    ...courses.map((c) => ({
      type: 'course' as const,
      title: c.data.title,
      summary: c.data.summary,
      tag: categoryLabels[locale][c.data.category] ?? c.data.category,
      url: `/${locale}/courses/${c.id.slice(prefix.length)}/`,
    })),
    ...posts.map((p) => ({
      type: 'post' as const,
      title: p.data.title,
      summary: p.data.summary,
      tag: t('blog.title'),
      url: `/${locale}/blog/${p.id.slice(prefix.length)}/`,
    })),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
