/**
 * Approved Smart Mode response templates (PIE spec §6 "Answer composition"), English and Arabic.
 *
 * Rules: templates never contain a fact about the owner. Facts come only from approved records,
 * quoted verbatim (English evidence stays in English inside Arabic answers — no machine
 * translation of claims). Template sentences may state only (a) what the assistant can or cannot
 * do, (b) that something is not verified, or (c) where to navigate.
 */
export type Lang = 'en' | 'ar';

const q = (lang: Lang, text: string) => (lang === 'ar' ? `«${text}»` : `“${text}”`);
const list = (lang: Lang, items: string[]) => {
  if (items.length <= 1) return items.join('');
  const sep = lang === 'ar' ? '، ' : ', ';
  const and = lang === 'ar' ? ' و' : ' and ';
  return `${items.slice(0, -1).join(sep)}${and}${items.at(-1)}`;
};
const or = (lang: Lang, items: string[]) => {
  if (items.length <= 1) return items.join('');
  const sep = lang === 'ar' ? '، ' : ', ';
  return `${items.slice(0, -1).join(sep)}${lang === 'ar' ? ' أو ' : ' or '}${items.at(-1)}`;
};

export const T = {
  quote: q,
  list,

  noEvidence: (lang: Lang) =>
    lang === 'ar'
      ? 'لا تتوفر لدي معلومات موثّقة عن ذلك بعد. يمكنك تصفّح المشاريع أو التواصل مع إسلام.'
      : "I don't have verified information on that yet. You can browse the projects or contact Islam.",

  cannotConfirm: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني تأكيد ذلك — لا توجد معلومات موثّقة عنه في محتوى الموقع المعتمد.'
      : "I can't confirm that — there's no verified information about it in the approved portfolio content.",

  partlySupported: (lang: Lang) =>
    lang === 'ar'
      ? 'هذا ما يقوله المحتوى المعتمد بالضبط، ولا يمكنني تأكيد ما هو أكثر منه:'
      : "Here is exactly what the approved content says — I can't confirm more than this:",

  injection: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني اتباع تعليمات تغيّر طريقة عملي. أجيب فقط عن أسئلة حول أعمال إسلام من المحتوى المعتمد.'
      : "I can't follow instructions that change how I work. I only answer questions about Islam's portfolio from approved content.",

  confidential: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني المساعدة في مواد سرّية أو داخلية أو بيانات اعتماد. أستخدم فقط محتوى البورتفوليو العام المعتمد.'
      : "I can't help with confidential or internal material or credentials. I only use approved public portfolio content.",

  compensation: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني مشاركة تفاصيل خاصة مثل الراتب أو الأسعار. لمناقشة فرصة عمل يمكنك التواصل مع إسلام مباشرة.'
      : "I can't share private details such as salary or rates. To discuss an opportunity, you can contact Islam directly.",

  personal: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني مشاركة تفاصيل شخصية كهذه. يمكنك التواصل مع إسلام من خلال صفحة التواصل.'
      : "I can't share personal details like that. You can reach Islam through the contact page.",

  outOfScope: (lang: Lang) =>
    lang === 'ar'
      ? 'أجيب فقط عن أسئلة تخص بورتفوليو إسلام — عمله ومشاريعه ومهاراته وخبرته وطرق التواصل معه.'
      : "I only answer questions about Islam's portfolio — his work, projects, skills, experience and how to contact him.",

  greeting: (lang: Lang) =>
    lang === 'ar'
      ? 'أهلاً! أجيب عن أسئلة حول عمل إسلام باستخدام محتوى الموقع المعتمد فقط. جرّب أحد الاقتراحات.'
      : "Hello! I answer questions about Islam's work using approved portfolio content only. Try one of the suggestions.",

  thanks: (lang: Lang) =>
    lang === 'ar'
      ? 'العفو! هل تريد معرفة شيء آخر عن عمل إسلام؟'
      : "You're welcome! Anything else about Islam's work?",

  empty: (lang: Lang) =>
    lang === 'ar' ? 'اكتب سؤالاً عن عمل إسلام.' : "Type a question about Islam's work.",

  // ── Profile ──
  overviewLead: (lang: Lang) => (lang === 'ar' ? 'هذا ما يقوله الموقع عن إسلام:' : ''),
  inHisWords: (lang: Lang, text: string) =>
    lang === 'ar' ? `وبكلماته: ${q(lang, text)}` : `In his words: ${q(lang, text)}`,
  portfolio: (lang: Lang, text: string) =>
    lang === 'ar' ? `عن هذا الموقع: ${q(lang, text)}` : `About this portfolio: ${q(lang, text)}`,

  // ── Contact ──
  contactLead: (lang: Lang) => (lang === 'ar' ? 'للتواصل مع إسلام:' : 'You can reach Islam'),
  contactEmail: (lang: Lang, email: string) =>
    lang === 'ar' ? `البريد الإلكتروني: ${email}` : `by email at ${email}`,
  contactProfiles: (lang: Lang, names: string[]) =>
    lang === 'ar'
      ? `أو عبر ${or(lang, names)} (الروابط أدناه).`
      : `or through ${or(lang, names)} (links below).`,
  emailOnly: (lang: Lang, email: string) =>
    lang === 'ar' ? `البريد الإلكتروني العام لإسلام: ${email}` : `Islam's public email is ${email}.`,
  profileOnly: (lang: Lang, name: string, url: string) =>
    lang === 'ar' ? `حساب إسلام على ${name}: ${url}` : `Islam's ${name} profile: ${url}`,
  contactInvitation: (lang: Lang, text: string) =>
    lang === 'ar' ? `ويقول قسم التواصل: ${q(lang, text)}` : `His contact section says: ${q(lang, text)}`,

  // ── Résumé, reel ──
  resume: (lang: Lang, text: string) => (lang === 'ar' ? `عن السيرة الذاتية: ${q(lang, text)}` : text),
  reel: (lang: Lang, text: string) => (lang === 'ar' ? `عن الفيديو التعريفي: ${q(lang, text)}` : text),

  // ── Pending sections ──
  projectsPending: (lang: Lang) =>
    lang === 'ar'
      ? 'تفاصيل مشاريع إسلام ما زالت بانتظار توثيقه، لذلك لا يمكنني وصفها بعد. يمكنك فتح صفحاتها من الروابط أدناه.'
      : "Islam's project details are still awaiting his verification, so I can't describe them yet. You can open their pages from the links below.",
  projectPending: (lang: Lang, title: string) =>
    lang === 'ar'
      ? `لمشروع ${title} صفحة على الموقع، لكن تفاصيله لم تُوثَّق بعد، لذلك لن أصفه. يمكنك فتح صفحته.`
      : `${title} has a page on this site, but its details haven't been verified yet, so I won't describe it. You can open its page.`,
  projectApproved: (lang: Lang, title: string, text: string) =>
    lang === 'ar' ? `عن ${title}: ${q(lang, text)}` : `About ${title}: ${q(lang, text)}`,
  clarifyProject: (lang: Lang, titles: string[]) =>
    lang === 'ar'
      ? `أي مشروع تقصد؟ يمكنك السؤال عن ${or(lang, titles)}.`
      : `Which project do you mean? You can ask about ${or(lang, titles)}.`,
  clarifyGeneric: (lang: Lang) =>
    lang === 'ar'
      ? 'لست متأكداً مما تقصده. هل تسأل عن المشاريع أم الخبرة أم المهارات أم التواصل؟'
      : 'I’m not sure what you mean. Are you asking about projects, experience, skills or contact?',

  skillsPending: (lang: Lang) =>
    lang === 'ar'
      ? 'تفاصيل المهارات والتقنيات ما زالت بانتظار التوثيق.'
      : 'Detailed skills and technologies are still awaiting verification.',
  techUnconfirmed: (lang: Lang, terms: string[]) =>
    lang === 'ar'
      ? `لا يمكنني تأكيد ${list(lang, terms)} — تفاصيل التقنيات ما زالت بانتظار التوثيق.`
      : `I can't confirm ${list(lang, terms)} — specific technologies are still awaiting verification.`,
  techMentioned: (lang: Lang, terms: string[], text: string) =>
    lang === 'ar'
      ? `يذكر الموقع ${list(lang, terms)}: ${q(lang, text)}`
      : `The portfolio mentions ${list(lang, terms)}: ${q(lang, text)}`,
  capabilitiesHeading: (lang: Lang, text: string) =>
    lang === 'ar'
      ? `عنوان قسم القدرات: ${q(lang, text)}`
      : `The capabilities section is titled ${q(lang, text)}`,

  experiencePending: (lang: Lang) =>
    lang === 'ar'
      ? 'الخبرة المهنية لإسلام ما زالت بانتظار التوثيق، لذلك لا يمكنني ذكر الأدوار أو الشركات أو التواريخ بعد.'
      : "Islam's experience timeline is still awaiting verification, so I can't list roles, employers or dates yet.",
  journeyHeading: (lang: Lang, text: string) =>
    lang === 'ar'
      ? `عنوان قسم الرحلة المهنية: ${q(lang, text)}`
      : `The journey section is titled ${q(lang, text)}`,

  educationMissing: (lang: Lang) =>
    lang === 'ar'
      ? 'لا تتوفر لدي معلومات موثّقة عن تعليم إسلام أو شهاداته بعد.'
      : "I don't have verified information on Islam's education or certifications yet.",
  locationMissing: (lang: Lang) =>
    lang === 'ar'
      ? 'لا تتوفر لدي معلومات موثّقة عن مكان إقامة إسلام أو عمله.'
      : "I don't have verified information on where Islam is based.",
  availabilityUnverified: (lang: Lang) =>
    lang === 'ar'
      ? 'لا يمكنني تأكيد مدى توفّر إسلام حالياً — هذه المعلومة غير موثّقة.'
      : "I can't confirm Islam's current availability — it isn't verified.",

  // ── Open-ended search ──
  evidenceSummary: (lang: Lang) =>
    lang === 'ar' ? 'هذا ما وجدته في المحتوى المعتمد:' : 'Here is what the approved portfolio content says:',
  moreOn: (lang: Lang) => (lang === 'ar' ? 'المزيد من المحتوى المعتمد:' : 'More from the approved content:'),
  nothingMore: (lang: Lang) =>
    lang === 'ar'
      ? 'هذا كل ما هو موثّق حالياً حول هذا الموضوع.'
      : "That's everything verified on this topic so far.",
} as const;

/** Assistant self-descriptions (site behaviour), localized. The English text is the record. */
export const ASSISTANT_AR: Record<string, string> = {
  'faq-assistant-modes':
    'الوضع الذكي يجيب فوراً بالبحث في محتوى البورتفوليو العام المعتمد داخل متصفحك. الذكاء الاصطناعي المحلي اختياري: بعد موافقتك على تنزيل نموذج لغوي صغير، تُولَّد الإجابات على جهازك باستخدام المحتوى المعتمد نفسه.',
  'faq-assistant-privacy':
    'تتم الإجابة على الأسئلة داخل متصفحك. لا يُرسل أي شيء تكتبه إلى خادم أو إلى واجهة استدلال، ولا تُحفظ المحادثات.',
  'faq-assistant-sources':
    'تعتمد الإجابات فقط على محتوى البورتفوليو الذي وثّقه صاحبه ووافق على استخدامه في المساعد. أي شيء غير موثّق يُستبعد بدلاً من تخمينه.',
};

export const SUGGESTIONS: Record<Lang, Record<string, string>> = {
  en: {
    overview: 'What does Islam work on?',
    contact: 'How can I contact him?',
    resume: 'Can I see his résumé?',
    projects: 'Which projects can I explore?',
    assistant: 'How does this assistant work?',
    privacy: 'Are my questions stored?',
    status: 'What is still being verified?',
    reel: 'Is there an introduction video?',
  },
  ar: {
    overview: 'إسلام بيشتغل في إيه؟',
    contact: 'إزاي أتواصل معاه؟',
    resume: 'فين السيرة الذاتية؟',
    projects: 'وريني مشاريعه',
    assistant: 'المساعد ده بيشتغل إزاي؟',
    privacy: 'هل أسئلتي بتتحفظ؟',
    status: 'إيه اللي لسه بيتوثق؟',
    reel: 'فيه فيديو تعريفي؟',
  },
};
