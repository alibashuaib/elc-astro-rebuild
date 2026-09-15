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
      title: 'English Courses in Jeddah | Kids, Adults, IELTS | 15,000+ Learners | ELC',
      description: '✓ Accredited English courses ✓ Certified instructors ✓ Free placement test ✓ A1-C2 levels ✓ SAR 1,500+ ✓ Mon-Fri 9-9, Sat 9-5 • +966591799917',
      crumb: 'Home',
    },
    ar: {
      title: 'دورات اللغة الإنجليزية في جدة | معهد صرح المعرفة | معتمد من TVTC',
      description: '✓ دورات معتمدة من المؤسسة العامة للتدريب ✓ مدرّبون مؤهلون ✓ اختبار تحديد مستوى مجاني ✓ من A1 إلى C2 ✓ من 1,500 ريال ✓ 15,000+ متدرب',
      crumb: 'الرئيسية',
    },
  },
  about: {
    en: {
      title: 'About ELC | Accredited English School | Est. 2010 | Jeddah, Saudi Arabia',
      description: '✓ TVTC-accredited ✓ 14+ years experience ✓ 15,000+ trained learners ✓ Qualified instructors ✓ Modern classrooms ✓ Money-back guarantee • Learn more',
      crumb: 'About ELC',
    },
    ar: {
      title: 'معهد صرح المعرفة | معتمد من TVTC | منذ 2010 | جدة',
      description: '✓ معتمد من المؤسسة العامة للتدريب ✓ 14+ سنة خبرة ✓ 15,000+ متدرب ✓ مدرّبون مؤهلون ✓ بيئة تعليمية حديثة ✓ ضمان استرجاع الرسوم',
      crumb: 'من نحن',
    },
  },
  contact: {
    en: {
      title: 'Contact ELC Jeddah | English Courses | Phone, WhatsApp, Email | Saudi Arabia',
      description: '📞 +966591799917 | 💬 WhatsApp: +966546656000 | 📧 info@elc.com.sa | Hours: Mon-Fri 9-9, Sat 9-5 | Abdullah Al-Suleiman St, Jeddah',
      crumb: 'Contact',
    },
    ar: {
      title: 'تواصل مع معهد صرح المعرفة | جدة | هاتف، واتساب، بريد إلكتروني',
      description: '📞 +966591799917 | 💬 واتساب: +966546656000 | 📧 info@elc.com.sa | الساعات: الاثنين-الجمعة 9 صباحًا-9 مساءً، السبت 9-5',
      crumb: 'اتصل بنا',
    },
  },
  register: {
    en: {
      title: 'Enroll Now | English Courses in Jeddah | Free Placement Test | ELC',
      description: '✓ Easy registration ✓ Next intake: Sept 25 ✓ Free placement test ✓ Money-back guarantee ✓ Payment plans available • Enroll today',
      crumb: 'Register',
      hero: { title: 'Register', subtitle: 'Streamlined enrollment — book your spot or a free placement test.' },
    },
    ar: {
      title: 'التسجيل الآن | دورات إنجليزية في جدة | اختبار مستوى مجاني | معهد صرح المعرفة',
      description: '✓ تسجيل سهل ✓ الدفعة القادمة: سبتمبر 25 ✓ اختبار مستوى مجاني ✓ ضمان استرجاع الرسوم ✓ خطط دفع متاحة',
      crumb: 'التسجيل',
      hero: { title: 'التسجيل', subtitle: 'تسجيل مبسّط — احجز مكانك أو اختبار تحديد مستوى مجاني.' },
    },
  },
  courses: {
    en: {
      title: 'English Courses | Kids, Adults, IELTS, Business, STEP | A1-C2 Levels | ELC Jeddah',
      description: '✓ 7 courses available ✓ A1-C2 proficiency levels ✓ From SAR 1,500 ✓ 6-8 students per class ✓ Certified instructors ✓ Free placement test',
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
      title: 'English Learning Tips | IELTS Guide | Course News | ELC Blog',
      description: '✓ IELTS tips & strategies ✓ English grammar lessons ✓ Course announcements ✓ Student stories ✓ Free resources • ELC blog',
      crumb: 'News',
      hero: { title: 'News', subtitle: 'Articles, tips, and updates from ELC.' },
    },
    ar: {
      title: 'نصائح تعلّم الإنجليزية | نصائح IELTS | أخبار الدورات | مدونة معهد صرح المعرفة',
      description: '✓ نصائح IELTS ✓ دروس القواعد ✓ تحديثات الدورات ✓ قصص النجاح ✓ موارد مجانية',
      crumb: 'الأخبار',
      hero: { title: 'الأخبار', subtitle: 'مقالات ونصائح وتحديثات من معهد صرح المعرفة.' },
    },
  },
  placementTest: {
    en: {
      title: 'Free English Placement Test | Instant Results | Adaptive Test | ELC',
      description: '✓ Free online test ✓ 15 minutes ✓ Instant results ✓ Personalized level ✓ No registration needed ✓ Next step: Book consultation',
      crumb: 'Placement Test',
    },
    ar: {
      title: 'اختبار اللغة الإنجليزية المجاني | نتائج فورية | اختبار متكيف | معهد صرح المعرفة',
      description: '✓ اختبار مجاني ✓ 15 دقيقة فقط ✓ نتائج فورية ✓ مستوى مخصص ✓ لا تسجيل مطلوب ✓ الخطوة التالية: احجز استشارة',
      crumb: 'اختبار تحديد المستوى',
    },
  },
  apply: {
    en: {
      title: 'Enroll Now | Complete Your Application | ELC English Courses',
      description: '✓ Quick application ✓ Secure payment ✓ Payment plans available ✓ Money-back guarantee ✓ Start date: Sept 25',
      crumb: 'Apply',
      hero: { title: 'Apply', subtitle: 'Confirm your course and finish your enrollment application.' },
    },
    ar: {
      title: 'التسجيل النهائي | أكمل طلبك | معهد صرح المعرفة',
      description: '✓ تطبيق سريع ✓ دفع آمن ✓ خطط دفع متاحة ✓ ضمان استرجاع الرسوم ✓ تاريخ البدء: سبتمبر 25',
      crumb: 'التقديم',
      hero: { title: 'التقديم', subtitle: 'أكّد دورتك وأكمل طلب التسجيل.' },
    },
  },
  terms: {
    en: { title: 'Terms & Conditions | ELC English Courses', description: '✓ Course policies ✓ Refund policy ✓ Payment terms ✓ Student rights', crumb: 'Terms & Conditions' },
    ar: {
      title: 'الشروط والأحكام | معهد صرح المعرفة',
      description: '✓ سياسات الدورات ✓ سياسة الاسترجاع ✓ شروط الدفع ✓ حقوق الطالب',
      crumb: 'الشروط والأحكام',
    },
  },
  privacy: {
    en: { title: 'Privacy Policy | Data Protection | ELC', description: '✓ Data privacy ✓ How we use information ✓ Security ✓ Your rights', crumb: 'Privacy Policy' },
    ar: {
      title: 'سياسة الخصوصية | حماية البيانات | معهد صرح المعرفة',
      description: '✓ خصوصية البيانات ✓ كيفية استخدام المعلومات ✓ الأمان ✓ حقوقك',
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
    crumbs.push({ name: pageMeta[page][locale].crumb, url: `${SITE}/${locale}/${PATHS[page]}` });
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
  apply: 'apply',
  terms: 'legal/terms',
  privacy: 'legal/privacy',
};
