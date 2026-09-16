import type { Locale } from './ui';

export interface FAQ {
  question: string;
  answer: string;
}

const homeFaqs: Record<Locale, FAQ[]> = {
  en: [
    {
      question: 'How do I know which level to start?',
      answer: 'Take our free placement test. It\'s 15 minutes and gives instant results. Based on your score, we recommend the right level for you.',
    },
    {
      question: 'What\'s the difference between levels?',
      answer: 'A1-A2 (Beginner), B1-B2 (Intermediate), C1-C2 (Advanced). Each level builds on the previous. Most students progress one level every 8-12 weeks.',
    },
    {
      question: 'Can complete beginners join?',
      answer: 'Absolutely! We have courses starting at A1 (complete beginner). No prior English needed.',
    },
    {
      question: 'How much does it cost?',
      answer: 'Prices vary by course. General English starts at SAR 1,500. We offer payment plans and discounts for early enrollment.',
    },
    {
      question: 'When can I start?',
      answer: 'New intakes start every 2 weeks. You can enroll now and join the next available class.',
    },
    {
      question: 'Do you offer online classes?',
      answer: 'Yes! All courses are available online or in-person. Choose what works best for you.',
    },
    {
      question: 'What if I miss a class?',
      answer: 'Classes are recorded and available for 30 days. You can watch and catch up at your pace.',
    },
    {
      question: 'Is there a money-back guarantee?',
      answer: 'Yes! If you complete all classes but don\'t achieve your goal, we offer a free 4 weeks of additional training.',
    },
  ],
  ar: [
    {
      question: 'كيف أعرف المستوى المناسب لي؟',
      answer: 'خذ اختبار تحديد المستوى المجاني. يستغرق 15 دقيقة ويعطيك النتائج فوراً. بناءً على درجتك، نوصيك بالمستوى المناسب.',
    },
    {
      question: 'ما الفرق بين المستويات؟',
      answer: 'A1-A2 (مبتدئ)، B1-B2 (متوسط)، C1-C2 (متقدم). كل مستوى يبني على السابق. معظم الطلاب يرتقون مستوى واحد كل 8-12 أسبوع.',
    },
    {
      question: 'هل يمكن للمبتدئين تماماً الالتحاق؟',
      answer: 'بالتأكيد! لدينا دورات تبدأ من A1 (مبتدئ تماماً). لا تحتاج لأي معرفة بالإنجليزية.',
    },
    {
      question: 'كم تكلفة الدورات؟',
      answer: 'تختلف الأسعار حسب الدورة. الإنجليزي العام يبدأ من 1,500 ريال. نقدم خطط دفع وخصومات للتسجيل المبكر.',
    },
    {
      question: 'متى يمكنني البدء؟',
      answer: 'تبدأ دفعات جديدة كل أسبوعين. يمكنك التسجيل الآن والانضمام للفصل التالي.',
    },
    {
      question: 'هل تقدمون دروساً أونلاين؟',
      answer: 'نعم! جميع الدورات متاحة أونلاين أو حضورياً. اختر ما يناسبك.',
    },
    {
      question: 'ماذا إذا فاتني درس؟',
      answer: 'الدروس مسجلة ومتاحة لمدة 30 يوماً. يمكنك مشاهدتها والمتابعة بسرعتك الخاصة.',
    },
    {
      question: 'هل هناك ضمان استرجاع الرسوم؟',
      answer: 'نعم! إذا أكملت جميع الدروس لكن لم تحقق هدفك، نقدم 4 أسابيع إضافية مجاناً.',
    },
  ],
};

const placementTestFaqs: Record<Locale, FAQ[]> = {
  en: [
    {
      question: 'How long is the placement test?',
      answer: 'About 15 minutes on average. The test adapts to your level, so your time may vary slightly.',
    },
    {
      question: 'Is the placement test free?',
      answer: 'Yes, completely free! No registration required. Take it anytime.',
    },
    {
      question: 'When do I get my results?',
      answer: 'Instantly! Your results appear immediately after completion. You\'ll see your level and recommendations.',
    },
    {
      question: 'What if I score lower than expected?',
      answer: 'You can retake it anytime. We recommend waiting at least 1 week to study before retaking.',
    },
    {
      question: 'Which level should I choose?',
      answer: 'Our algorithm recommends the right level based on your score. You can also discuss with an advisor during your consultation.',
    },
    {
      question: 'Do I need a subscription or account?',
      answer: 'No subscription needed! Just open the test and start. Optional: create an account to save your progress.',
    },
  ],
  ar: [
    {
      question: 'كم يستغرق اختبار تحديد المستوى؟',
      answer: 'حوالي 15 دقيقة بالمتوسط. الاختبار يتكيف مع مستواك، لذا قد يختلف الوقت قليلاً.',
    },
    {
      question: 'هل اختبار تحديد المستوى مجاني؟',
      answer: 'نعم، مجاني تماماً! لا حاجة للتسجيل. خذ الاختبار في أي وقت.',
    },
    {
      question: 'متى أحصل على النتائج؟',
      answer: 'فوراً! النتائج تظهر مباشرة بعد الانتهاء. ستشاهد مستواك والتوصيات.',
    },
    {
      question: 'ماذا إذا كانت درجتي أقل من المتوقع؟',
      answer: 'يمكنك إعادة الاختبار في أي وقت. نوصي بالانتظار أسبوع واحد على الأقل قبل الإعادة.',
    },
    {
      question: 'أي مستوى يجب أن أختار؟',
      answer: 'خوارزميتنا توصي بالمستوى المناسب حسب درجتك. يمكنك أيضاً التحدث مع مستشار خلال استشارتك المجانية.',
    },
    {
      question: 'هل أحتاج إلى حساب أو اشتراك؟',
      answer: 'لا حاجة لاشتراك! افتح الاختبار ابدأ مباشرة. اختياري: أنشئ حساباً لحفظ تقدمك.',
    },
  ],
};

export function getFaqsByPage(page: string, locale: Locale): FAQ[] {
  switch (page) {
    case 'home':
      return homeFaqs[locale];
    case 'placementTest':
      return placementTestFaqs[locale];
    default:
      return [];
  }
}
