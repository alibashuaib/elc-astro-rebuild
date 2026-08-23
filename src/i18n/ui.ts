// Minimal i18n dictionary + helpers.
// Kept as plain objects (no i18n library) — zero runtime JS cost, everything resolved at build time.

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeDir: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.about': 'About',
    'nav.compare': 'Why ELC',
    'nav.blog': 'News',
    'nav.contact': 'Contact',
    'nav.register': 'Register',
    'nav.lms': 'Student Portal',
    'nav.menu': 'Menu',
    'hero.cta': 'Book a Placement Test',
    'skip.content': 'Skip to content',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.courses': 'الدورات',
    'nav.about': 'من نحن',
    'nav.compare': 'لماذا ELC',
    'nav.blog': 'الأخبار',
    'nav.contact': 'اتصل بنا',
    'nav.register': 'سجل الآن',
    'nav.lms': 'بوابة الطالب',
    'nav.menu': 'القائمة',
    'hero.cta': 'احجز اختبار تحديد المستوى',
    'skip.content': 'تخطَّ إلى المحتوى',
  },
} as const;

export function useTranslations(locale: Locale) {
  return function t(key: keyof (typeof ui)['en']): string {
    return ui[locale][key] ?? ui[defaultLocale][key];
  };
}

/** Build a path prefixed with the given locale, e.g. localizePath('ar', '/courses') -> '/ar/courses' */
export function localizePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '' : clean}`;
}

/** Given the current locale, return the equivalent path in the other locale (for the language switcher). */
export function alternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ar' : 'en';
}
