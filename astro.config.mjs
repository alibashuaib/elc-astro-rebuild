// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://elc.com.sa',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ar'],
    routing: {
      prefixDefaultLocale: true, // always /en/ and /ar/, no bare "/"
    },
  },
  build: {
    // static output, keep it lean — Hostinger shared hosting has no server runtime
    format: 'directory',
  },
  compressHTML: true,
  // Static-safe redirect: Astro emits a real HTML file with a meta-refresh + canonical
  // link for "/", since Astro.redirect() would need an SSR adapter we don't want here.
  redirects: {
    '/': '/en/',
  },
});
