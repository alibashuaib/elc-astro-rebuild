// Minimal i18n dictionary + helpers.
// Kept as plain objects (no i18n library) — zero runtime JS cost, everything resolved at build time.

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeDir: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export const categoryLabels: Record<Locale, Record<string, string>> = {
  en: { kids: 'Kids', adults: 'Adults', business: 'Business', 'exam-prep': 'Exam Prep' },
  ar: { kids: 'أطفال', adults: 'كبار', business: 'أعمال', 'exam-prep': 'تحضير امتحانات' },
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
    'courses.title': 'Courses',
    'courses.subtitle': 'Find the right course by level, duration, and price.',
    'courses.weeks': 'weeks',
    'courses.hoursPerWeek': 'hrs/week',
    'courses.viewCourse': 'View course',
    'courses.enroll': 'Enroll',
    'about.title': 'About ELC',
    'contact.title': 'Contact',
    'contact.form.name': 'Name',
    'contact.form.email': 'Email',
    'contact.form.message': 'Message',
    'contact.form.submit': 'Send message',
    'register.title': 'Register',
    'register.form.name': 'Full name',
    'register.form.email': 'Email',
    'register.form.phone': 'Phone / WhatsApp',
    'register.form.course': 'Course',
    'register.form.submit': 'Submit registration',
    'whyElc.title': 'Why ELC',
    'blog.title': 'News',
    'blog.readMore': 'Read more',
    'legal.terms': 'Terms & Conditions',
    'legal.privacy': 'Privacy Policy',
    'footer.terms': 'Terms',
    'footer.privacy': 'Privacy',
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
    'courses.title': 'الدورات',
    'courses.subtitle': 'اختر الدورة المناسبة حسب المستوى والمدة والسعر.',
    'courses.weeks': 'أسابيع',
    'courses.hoursPerWeek': 'ساعة/أسبوع',
    'courses.viewCourse': 'عرض الدورة',
    'courses.enroll': 'سجّل الآن',
    'about.title': 'من نحن',
    'contact.title': 'اتصل بنا',
    'contact.form.name': 'الاسم',
    'contact.form.email': 'البريد الإلكتروني',
    'contact.form.message': 'الرسالة',
    'contact.form.submit': 'إرسال الرسالة',
    'register.title': 'التسجيل',
    'register.form.name': 'الاسم الكامل',
    'register.form.email': 'البريد الإلكتروني',
    'register.form.phone': 'الهاتف / واتساب',
    'register.form.course': 'الدورة',
    'register.form.submit': 'إرسال التسجيل',
    'whyElc.title': 'لماذا ELC',
    'blog.title': 'الأخبار',
    'blog.readMore': 'اقرأ المزيد',
    'legal.terms': 'الشروط والأحكام',
    'legal.privacy': 'سياسة الخصوصية',
    'footer.terms': 'الشروط',
    'footer.privacy': 'الخصوصية',
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
