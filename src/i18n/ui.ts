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
  en: { kids: 'Kids', adults: 'Adults', women: 'Women', business: 'Business', 'exam-prep': 'Exam Prep' },
  ar: { kids: 'أطفال', adults: 'كبار', women: 'سيدات', business: 'أعمال', 'exam-prep': 'تحضير امتحانات' },
};

export const ui = {
  en: {
    'nav.courses': 'Courses',
    'nav.about': 'About',
    'nav.blog': 'News',
    'nav.contact': 'Contact',
    'nav.register': 'Register',
    'nav.lms': 'Portal',
    'nav.menu': 'Menu',
    'theme.toggle': 'Toggle dark mode',
    'search.toggle': 'Search',
    'search.placeholder': 'Search courses and news…',
    'search.noResults': 'No results found.',
    'hero.cta': 'Book a Placement Test',
    'skip.content': 'Skip to content',
    'courses.title': 'Courses',
    'courses.subtitle': 'Find the right course by level, duration, and price.',
    'courses.weeks': 'weeks',
    'courses.hoursPerWeek': 'hrs/week',
    'courses.price': 'Price',
    'courses.weeksPerLevel': 'Weeks / level',
    'courses.monthlyHours': 'Hours / month',
    'courses.varies': 'Varies',
    'courses.contactDetails': 'Contact us for schedule and pricing',
    'courses.viewCourse': 'View course',
    'courses.enroll': 'Enroll',
    'courses.filterAll': 'All courses',
    'courses.noResults': 'No courses match this filter yet.',
    'testimonials.title': 'What students say',
    'testimonials.googleReviews': 'Google Reviews',
    'testimonials.basedOn': 'based on',
    'testimonials.reviews': 'reviews',
    'testimonials.onGoogle': 'reviews on Google',
    'testimonials.viewAll': 'See all reviews on Google',
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
    'consent.message': 'We use essential cookies to run this site. With your consent, we also use analytics and advertising cookies to understand how visitors use it and measure how they find us — nothing beyond what’s necessary is turned on until you choose Accept.',
    'consent.accept': 'Accept',
    'consent.reject': 'Reject',
    'consent.link': 'Privacy Notice',
    'placementTest.heading': 'Placement Test',
    'placementTest.subtitle': 'Answer a few adaptive questions to find your level, then book your oral test slot.',
    'placementTest.formName': 'Full name',
    'placementTest.formPhone': 'WhatsApp number',
    'placementTest.formDob': 'Date of birth',
    'placementTest.formGuardian': 'Guardian name',
    'placementTest.formSubmit': 'Start test',
    'placementTest.questionOf': 'Question',
    'placementTest.resultHeading': 'Your estimated level',
    'placementTest.bookingHeading': 'Choose a time for your oral test',
    'placementTest.bookingConfirm': 'Confirm booking',
    'placementTest.whatsappConfirm': 'Send confirmation on WhatsApp',
  },
  ar: {
    'nav.courses': 'الدورات',
    'nav.about': 'من نحن',
    'nav.blog': 'الأخبار',
    'nav.contact': 'اتصل بنا',
    'nav.register': 'سجل الآن',
    'nav.lms': 'البوابة',
    'nav.menu': 'القائمة',
    'theme.toggle': 'تبديل الوضع الداكن',
    'search.toggle': 'بحث',
    'search.placeholder': 'ابحث في الدورات والأخبار…',
    'search.noResults': 'لا توجد نتائج.',
    'hero.cta': 'احجز اختبار تحديد المستوى',
    'skip.content': 'تخطَّ إلى المحتوى',
    'courses.title': 'الدورات',
    'courses.subtitle': 'اختر الدورة المناسبة حسب المستوى والمدة والسعر.',
    'courses.weeks': 'أسابيع',
    'courses.hoursPerWeek': 'ساعة/أسبوع',
    'courses.price': 'السعر',
    'courses.weeksPerLevel': 'أسابيع / مستوى',
    'courses.monthlyHours': 'ساعات / شهر',
    'courses.varies': 'متغير',
    'courses.contactDetails': 'تواصل معنا لمعرفة الجدول والسعر',
    'courses.viewCourse': 'عرض الدورة',
    'courses.enroll': 'سجّل الآن',
    'courses.filterAll': 'كل الدورات',
    'courses.noResults': 'لا توجد دورات مطابقة لهذا الفلتر بعد.',
    'testimonials.title': 'ماذا يقول طلابنا',
    'testimonials.googleReviews': 'تقييمات Google',
    'testimonials.basedOn': 'استناداً إلى',
    'testimonials.reviews': 'تقييم',
    'testimonials.onGoogle': 'تقييم على Google',
    'testimonials.viewAll': 'شاهد كل التقييمات على Google',
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
    'whyElc.title': 'لماذا معهد صرح المعرفة',
    'blog.title': 'الأخبار',
    'blog.readMore': 'اقرأ المزيد',
    'legal.terms': 'الشروط والأحكام',
    'legal.privacy': 'سياسة الخصوصية',
    'footer.terms': 'الشروط',
    'footer.privacy': 'الخصوصية',
    'consent.message': 'نستخدم ملفات تعريف ارتباط أساسية لتشغيل هذا الموقع. بموافقتك، نستخدم أيضاً ملفات تعريف ارتباط للتحليلات والإعلانات لفهم كيفية استخدام الزوار للموقع وقياس كيفية وصولهم إلينا — لا يتم تفعيل أي شيء غير ضروري حتى توافق.',
    'consent.accept': 'موافق',
    'consent.reject': 'رفض',
    'consent.link': 'إشعار الخصوصية',
    'placementTest.heading': 'اختبار تحديد المستوى',
    'placementTest.subtitle': 'أجب عن بضعة أسئلة تكيفية لتحديد مستواك، ثم احجز موعد الاختبار الشفوي.',
    'placementTest.formName': 'الاسم الكامل',
    'placementTest.formPhone': 'رقم الواتساب',
    'placementTest.formDob': 'تاريخ الميلاد',
    'placementTest.formGuardian': 'اسم ولي الأمر',
    'placementTest.formSubmit': 'ابدأ الاختبار',
    'placementTest.questionOf': 'السؤال',
    'placementTest.resultHeading': 'مستواك التقديري',
    'placementTest.bookingHeading': 'اختر موعداً للاختبار الشفوي',
    'placementTest.bookingConfirm': 'تأكيد الحجز',
    'placementTest.whatsappConfirm': 'إرسال التأكيد عبر واتساب',
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
