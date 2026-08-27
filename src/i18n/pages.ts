// Per-page, per-locale metadata for the shared `src/pages/[lang]/` routes.
//
// The site used to keep a full copy of every page under src/pages/en/ and
// src/pages/ar/, identical apart from the strings below. Those pairs are now a
// single [lang] route each, and everything that genuinely differs per locale
// lives here.

import { locales, type Locale } from './ui';

export const SITE = 'https://elc.com.sa';

/** getStaticPaths for any `[lang]` route: one build per locale. */
export function localePaths() {
  return locales.map((lang) => ({ params: { lang } }));
}

export interface PageMeta {
  title: string;
  description: string;
  /** Label for this page in a breadcrumb trail. */
  crumb: string;
  /** Present only on pages that render a <PageHero>. */
  hero?: { title: string; subtitle: string };
}

const HOME_CRUMB: Record<Locale, string> = { en: 'Home', ar: 'الرئيسية' };

/**
 * PageHero kicker. The Arabic pages lead with the institute's name above the
 * heading; the English ones don't, since "ELC" is already in the page title.
 */
export const heroKicker: Record<Locale, string | undefined> = {
  en: undefined,
  ar: 'معهد صرح المعرفة',
};

export const pageMeta = {
  home: {
    en: {
      title: 'ELC — English Language Courses in Saudi Arabia',
      description: 'Accredited English courses for kids, adults, and business. Book a free placement test.',
      crumb: 'Home',
    },
    ar: {
      title: 'معهد صرح المعرفة — دورات اللغة الإنجليزية في السعودية',
      description: 'دورات إنجليزية معتمدة للأطفال والكبار والشركات. احجز اختبار تحديد المستوى مجانًا.',
      crumb: 'الرئيسية',
    },
  },
  about: {
    en: {
      title: 'About ELC — Why Learn With Us',
      description:
        'Meet ELC and discover why learners choose our TVTC-accredited programs, qualified teachers, modern classrooms, and goal-focused curricula.',
      crumb: 'About ELC',
    },
    ar: {
      title: 'من نحن ولماذا معهد صرح المعرفة',
      description:
        'تعرّف على معهد صرح المعرفة واكتشف لماذا يختار المتعلمون برامجنا المعتمدة ومدرّبينا المؤهلين وبيئتنا التعليمية الحديثة ومناهجنا المصممة لأهدافهم.',
      crumb: 'من نحن',
    },
  },
  contact: {
    en: {
      title: 'Contact ELC in Jeddah',
      description:
        'Call, WhatsApp, email, or visit ELC in Jeddah for English course information, placement testing, and registration support.',
      crumb: 'Contact',
    },
    ar: {
      title: 'تواصل مع معهد صرح المعرفة في جدة',
      description:
        'اتصل أو تواصل عبر واتساب أو البريد الإلكتروني أو زُر معهد صرح المعرفة في جدة للاستفسار عن دورات الإنجليزية واختبار تحديد المستوى والتسجيل.',
      crumb: 'اتصل بنا',
    },
  },
  register: {
    en: {
      title: 'Register — ELC English Courses in Jeddah',
      description:
        'Enroll at ELC in Jeddah or book a free English placement test. Fast registration for kids, adults, and business English courses.',
      crumb: 'Register',
      hero: { title: 'Register', subtitle: 'Streamlined enrollment — book your spot or a free placement test.' },
    },
    ar: {
      title: 'التسجيل — معهد صرح المعرفة',
      description: 'سجّل في معهد صرح المعرفة أو احجز اختبار تحديد مستوى مجاني.',
      crumb: 'التسجيل',
      hero: { title: 'التسجيل', subtitle: 'تسجيل مبسّط — احجز مكانك أو اختبار تحديد مستوى مجاني.' },
    },
  },
  courses: {
    en: {
      title: 'English Courses in Jeddah — ELC',
      description:
        "Browse ELC's full course catalog: Kids, Adults, Women's General English, Business English, and Exam Prep. See price, duration, and level at a glance.",
      crumb: 'Courses',
      hero: { title: 'Courses', subtitle: 'Find the right course by level, duration, and price.' },
    },
    ar: {
      title: 'الدورات — معهد صرح المعرفة',
      description:
        'تصفّح كتالوج دورات معهد صرح المعرفة الكامل: أطفال، كبار، إنجليزي عام للسيدات، إنجليزي أعمال، وتحضير اختبارات.',
      crumb: 'الدورات',
      hero: { title: 'الدورات', subtitle: 'اختر الدورة المناسبة حسب المستوى والمدة والسعر.' },
    },
  },
  blog: {
    en: {
      title: 'News — English Learning Tips & Updates from ELC',
      description: "Placement test tips, course announcements, and English-learning advice from ELC's team in Jeddah.",
      crumb: 'News',
      hero: { title: 'News', subtitle: 'Articles, tips, and updates from ELC.' },
    },
    ar: {
      title: 'الأخبار — معهد صرح المعرفة',
      description: 'نصائح اختبار تحديد المستوى، وتحديثات الدورات، ونصائح تعلّم الإنجليزية من فريق معهد صرح المعرفة في جدة.',
      crumb: 'الأخبار',
      hero: { title: 'الأخبار', subtitle: 'مقالات ونصائح وتحديثات من معهد صرح المعرفة.' },
    },
  },
  placementTest: {
    en: {
      title: 'Placement Test — ELC English Courses in Jeddah',
      description:
        "Take ELC's free adaptive English placement test online, get your estimated level instantly, and book your oral test slot.",
      crumb: 'Placement Test',
    },
    ar: {
      title: 'اختبار تحديد المستوى — معهد صرح المعرفة',
      description:
        'أجرِ اختبار تحديد المستوى المجاني والتكيفي من معهد صرح المعرفة عبر الإنترنت، واحصل على مستواك التقديري فوراً، ثم احجز موعد الاختبار الشفوي.',
      crumb: 'اختبار تحديد المستوى',
    },
  },
  terms: {
    en: { title: 'Terms & Conditions — ELC', description: "ELC's course terms and conditions.", crumb: 'Terms & Conditions' },
    ar: {
      title: 'الشروط والأحكام — معهد صرح المعرفة',
      description: 'شروط وأحكام الدورات في معهد صرح المعرفة.',
      crumb: 'الشروط والأحكام',
    },
  },
  privacy: {
    en: { title: 'Privacy Policy — ELC', description: 'How ELC collects and uses personal data.', crumb: 'Privacy Policy' },
    ar: {
      title: 'سياسة الخصوصية — معهد صرح المعرفة',
      description: 'كيف يجمع معهد صرح المعرفة البيانات الشخصية ويستخدمها.',
      crumb: 'سياسة الخصوصية',
    },
  },
} satisfies Record<string, Record<Locale, PageMeta>>;

export type PageKey = keyof typeof pageMeta;

export function meta(page: PageKey, locale: Locale): PageMeta {
  return pageMeta[page][locale];
}

/**
 * Absolute breadcrumb trail for a page, always rooted at the locale's home.
 * Pass the pages between home and the current one, deepest last; `extra`
 * appends a leaf that has no pageMeta entry (an individual course or article).
 */
export function trail(
  locale: Locale,
  pages: PageKey[],
  extra?: { name: string; path: string }
): Array<{ name: string; url: string }> {
  const crumbs = [{ name: HOME_CRUMB[locale], url: `${SITE}/${locale}/` }];
  for (const page of pages) {
    crumbs.push({ name: pageMeta[page][locale].crumb, url: `${SITE}/${locale}/${pagePath(page)}` });
  }
  if (extra) crumbs.push({ name: extra.name, url: `${SITE}/${locale}${extra.path}` });
  return crumbs;
}

const PATHS: Record<PageKey, string> = {
  home: '',
  about: 'about',
  contact: 'contact',
  register: 'register',
  courses: 'courses',
  blog: 'blog',
  placementTest: 'placement-test/',
  terms: 'legal/terms',
  privacy: 'legal/privacy',
};

function pagePath(page: PageKey): string {
  return PATHS[page];
}
