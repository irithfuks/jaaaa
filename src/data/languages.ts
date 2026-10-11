import { CEFRLevel, Language, WordItem } from '../types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', voiceLang: 'en-US' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', voiceLang: 'nl-NL' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', voiceLang: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', voiceLang: 'fr-FR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', voiceLang: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', voiceLang: 'pt-PT' },
  { code: 'he', name: 'Hebrew', nativeName: 'עִבְרִית', flag: '🇮🇱', rtl: true, voiceLang: 'he-IL', script: 'Hebrew' },
  { code: 'ar', name: 'Arabic', nativeName: 'العَرَبِيَّة', flag: '🇸🇦', rtl: true, voiceLang: 'ar-SA', script: 'Arabic' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', rtl: true, voiceLang: 'fa-IR', script: 'Persian' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', voiceLang: 'uk-UA' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', voiceLang: 'ru-RU' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', voiceLang: 'ja-JP', script: 'Japanese' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', voiceLang: 'ko-KR', script: 'Korean' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', voiceLang: 'de-DE' },
];

export const KNOWN_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', voiceLang: 'en-US' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', voiceLang: 'nl-NL' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', voiceLang: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', voiceLang: 'fr-FR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', voiceLang: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', voiceLang: 'pt-PT' },
  { code: 'he', name: 'Hebrew', nativeName: 'עִבְרִית', flag: '🇮🇱', rtl: true, voiceLang: 'he-IL' },
  { code: 'ar', name: 'Arabic', nativeName: 'العَرَبِيَّة', flag: '🇸🇦', rtl: true, voiceLang: 'ar-SA' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', rtl: true, voiceLang: 'fa-IR' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', voiceLang: 'uk-UA' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', voiceLang: 'ru-RU' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', voiceLang: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', voiceLang: 'ko-KR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', voiceLang: 'de-DE' },
];

/**
 * Latin languages and Dutch: These languages follow the article rule (with articles)
 * and have mutual cross-language answer options alongside English.
 */
export const LATIN_AND_NL_LANGUAGES = ['nl', 'es', 'fr', 'it', 'pt'] as const;

export function isLatinOrDutch(langCode: string): boolean {
  return LATIN_AND_NL_LANGUAGES.includes(langCode as any);
}

/**
 * Returns available answer languages depending on the target language being learned:
 * - If learning a Latin language or Dutch (nl, es, fr, it, pt):
 *   Options: English ('en') PLUS the other Latin languages and Dutch (excluding the target language itself).
 * - If learning any other language intended without articles (he, ar, ru, fa, ja, ko, uk, etc.):
 *   Options: ALL languages (excluding the target language itself).
 * Default is always English ('en').
 */
export function getAvailableAnswerLanguages(targetLanguage: string): Language[] {
  if (isLatinOrDutch(targetLanguage)) {
    const validCodes = ['en', ...LATIN_AND_NL_LANGUAGES.filter(c => c !== targetLanguage)];
    return KNOWN_LANGUAGES.filter(lang => validCodes.includes(lang.code));
  }
  return KNOWN_LANGUAGES.filter(lang => lang.code !== targetLanguage);
}

export const LANGUAGE_NAMES_BY_LOCALE: Record<string, Record<string, string>> = {
  en: {
    en: 'English',
    nl: 'Dutch',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
    de: 'German',
    he: 'Hebrew',
    ar: 'Arabic',
    fa: 'Persian',
    uk: 'Ukrainian',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
  },
  nl: {
    en: 'Engels',
    nl: 'Nederlands',
    es: 'Spaans',
    fr: 'Frans',
    it: 'Italiaans',
    pt: 'Portugees',
    de: 'Duits',
    he: 'Hebreeuws',
    ar: 'Arabisch',
    fa: 'Perzisch',
    uk: 'Oekraïens',
    ru: 'Russisch',
    ja: 'Japans',
    ko: 'Koreaans',
  },
  es: {
    en: 'Inglés',
    nl: 'Holandés',
    es: 'Español',
    fr: 'Francés',
    it: 'Italiano',
    pt: 'Portugués',
    de: 'Alemán',
    he: 'Hebreo',
    ar: 'Árabe',
    fa: 'Persa',
    uk: 'Ucraniano',
    ru: 'Ruso',
    ja: 'Japonés',
    ko: 'Coreano',
  },
  fr: {
    en: 'Anglais',
    nl: 'Néerlandais',
    es: 'Espagnol',
    fr: 'Français',
    it: 'Italien',
    pt: 'Portugais',
    de: 'Allemand',
    he: 'Hébreu',
    ar: 'Arabe',
    fa: 'Persan',
    uk: 'Ukrainien',
    ru: 'Russe',
    ja: 'Japonais',
    ko: 'Coréen',
  },
  de: {
    en: 'Englisch',
    nl: 'Niederländisch',
    es: 'Spanisch',
    fr: 'Französisch',
    it: 'Italienisch',
    pt: 'Portugiesisch',
    de: 'Deutsch',
    he: 'Hebräisch',
    ar: 'Arabisch',
    fa: 'Persisch',
    uk: 'Ukrainisch',
    ru: 'Russisch',
    ja: 'Japanisch',
    ko: 'Koreanisch',
  },
  it: {
    en: 'Inglese',
    nl: 'Olandese',
    es: 'Spagnolo',
    fr: 'Francese',
    it: 'Italiano',
    pt: 'Portoghese',
    de: 'Tedesco',
    he: 'Ebraico',
    ar: 'Arabo',
    fa: 'Persiano',
    uk: 'Ucraino',
    ru: 'Russo',
    ja: 'Giapponese',
    ko: 'Coreano',
  },
  pt: {
    en: 'Inglês',
    nl: 'Holandês',
    es: 'Espanhol',
    fr: 'Francês',
    it: 'Italiano',
    pt: 'Português',
    de: 'Alemão',
    he: 'Hebraico',
    ar: 'Árabe',
    fa: 'Persa',
    uk: 'Ucraniano',
    ru: 'Russo',
    ja: 'Japonês',
    ko: 'Coreano',
  },
  he: {
    en: 'אנגלית',
    nl: 'הולנדית',
    es: 'ספרדית',
    fr: 'צרפתית',
    it: 'איטלקית',
    pt: 'פורטוגזית',
    de: 'גרמנית',
    he: 'עברית',
    ar: 'ערבית',
    fa: 'פרסית',
    uk: 'אוקראינית',
    ru: 'רוסית',
    ja: 'יפנית',
    ko: 'קוריאנית',
  },
  ar: {
    en: 'الإنجليزية',
    nl: 'الهولندية',
    es: 'الإسبانية',
    fr: 'الفرنسية',
    it: 'الإيطالية',
    pt: 'البرتغالية',
    de: 'الألمانية',
    he: 'العبرية',
    ar: 'العربية',
    fa: 'الفارسية',
    uk: 'الأوكرانية',
    ru: 'الروسية',
    ja: 'اليابانية',
    ko: 'الكورية',
  },
  fa: {
    en: 'انگلیسی',
    nl: 'هلندی',
    es: 'اسپانیایی',
    fr: 'فرانسوی',
    it: 'ایتالیایی',
    pt: 'پرتغالی',
    de: 'آلمانی',
    he: 'عبری',
    ar: 'عربی',
    fa: 'فارسی',
    uk: 'اوکراینی',
    ru: 'روسی',
    ja: 'ژاپنی',
    ko: 'کره‌ای',
  },
  uk: {
    en: 'Англійська',
    nl: 'Нідерландська',
    es: 'Іспанська',
    fr: 'Французька',
    it: 'Італійська',
    pt: 'Португальська',
    de: 'Німецька',
    he: 'Іврит',
    ar: 'Арабська',
    fa: 'Перська',
    uk: 'Українська',
    ru: 'Російська',
    ja: 'Японська',
    ko: 'Корейська',
  },
  ru: {
    en: 'Английский',
    nl: 'Нидерландский',
    es: 'Испанский',
    fr: 'Французский',
    it: 'Итальянский',
    pt: 'Португальский',
    de: 'Немецкий',
    he: 'Иврит',
    ar: 'Арабский',
    fa: 'Персидский',
    uk: 'Украинский',
    ru: 'Русский',
    ja: 'Японский',
    ko: 'Корейский',
  },
  ja: {
    en: '英語',
    nl: 'オランダ語',
    es: 'スペイン語',
    fr: 'フランス語',
    it: 'イタリア語',
    pt: 'ポルトガル語',
    de: 'ドイツ語',
    he: 'ヘブライ語',
    ar: 'アラビア語',
    fa: 'ペルシア語',
    uk: 'ウクライナ語',
    ru: 'ロシア語',
    ja: '日本語',
    ko: '韓国語',
  },
  ko: {
    en: '영어',
    nl: '네덜란드어',
    es: '스페인어',
    fr: '프랑스어',
    it: '이탈리아어',
    pt: '포르투갈어',
    de: '독일어',
    he: '히브리어',
    ar: '아랍어',
    fa: '페르시아어',
    uk: '우크라이나어',
    ru: '러시아어',
    ja: '일본어',
    ko: '한국어',
  },
};

export function getLanguageName(targetCode: string, inLanguage: string = 'en'): string {
  const locale = (inLanguage || 'en').toLowerCase().trim();
  const translations = LANGUAGE_NAMES_BY_LOCALE[locale];
  if (translations && translations[targetCode]) {
    return translations[targetCode];
  }
  // Fallback to English
  if (LANGUAGE_NAMES_BY_LOCALE['en'] && LANGUAGE_NAMES_BY_LOCALE['en'][targetCode]) {
    return LANGUAGE_NAMES_BY_LOCALE['en'][targetCode];
  }
  const found = SUPPORTED_LANGUAGES.find(l => l.code === targetCode) || KNOWN_LANGUAGES.find(l => l.code === targetCode);
  return found?.name || targetCode.toUpperCase();
}

export interface LevelInfo {
  level: CEFRLevel;
  title: string;
  subtitle: string;
  description: string;
  targetVocabSize: string;
  badgeColor: string;
  numericRange: { min: number; max: number };
}

export const CEFR_LEVELS: LevelInfo[] = [
  {
    level: 'A1',
    title: 'Beginner',
    subtitle: 'Everyday Essentials',
    description: 'Basic greetings, numbers, common food, everyday objects, and simple survival phrases.',
    targetVocabSize: '1,000 words (Levels 1–10)',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    numericRange: { min: 1, max: 10 },
  },
  {
    level: 'A2',
    title: 'Elementary',
    subtitle: 'Routine Situations',
    description: 'Simple communication about shopping, family, local geography, and personal routines.',
    targetVocabSize: '1,000 words (Levels 11–20)',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    numericRange: { min: 11, max: 20 },
  },
  {
    level: 'B1',
    title: 'Intermediate',
    subtitle: 'Independent Expression',
    description: 'Conversations about work, travel, school, leisure, expressing opinions, and plans.',
    targetVocabSize: '1,000 words (Levels 21–30)',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    numericRange: { min: 21, max: 30 },
  },
  {
    level: 'B2',
    title: 'Upper Intermediate',
    subtitle: 'Nuanced Discussions',
    description: 'Complex texts, technical discussions in your field, abstract concepts, and fluent dialogue.',
    targetVocabSize: '1,000 words (Levels 31–40)',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    numericRange: { min: 31, max: 40 },
  },
  {
    level: 'C1',
    title: 'Advanced',
    subtitle: 'Professional & Academic',
    description: 'Demanding longer texts, implicit meanings, flexible use in social, academic, and work contexts.',
    targetVocabSize: '1,000 words (Levels 41–50)',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    numericRange: { min: 41, max: 50 },
  },
  {
    level: 'C2',
    title: 'Mastery',
    subtitle: 'Native-like Mastery',
    description: 'Idiomatic expressions, literary nuances, rapid summarization, and subtle shades of meaning.',
    targetVocabSize: '1,000 words (Levels 51–60)',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    numericRange: { min: 51, max: 60 },
  },
];

/**
 * Returns the corresponding CEFR level for any numeric level (1-60).
 */
export function getCefrForNumericLevel(numLevel: number): CEFRLevel {
  const clean = Math.max(1, Math.min(60, Math.round(numLevel || 1)));
  if (clean <= 10) return 'A1';
  if (clean <= 20) return 'A2';
  if (clean <= 30) return 'B1';
  if (clean <= 40) return 'B2';
  if (clean <= 50) return 'C1';
  return 'C2';
}

/**
 * Returns the base starting numeric level for a CEFR tier (A1=1, A2=11, B1=21, B2=31, C1=41, C2=51).
 */
export function getBaseNumericLevelForCefr(cefr: CEFRLevel): number {
  switch (cefr) {
    case 'A1': return 1;
    case 'A2': return 11;
    case 'B1': return 21;
    case 'B2': return 31;
    case 'C1': return 41;
    case 'C2': return 51;
    default: return 1;
  }
}

/**
 * Returns detailed metadata for any level 1 to 60.
 */
export function getNumericLevelInfo(numLevel: number) {
  const clean = Math.max(1, Math.min(60, Math.round(numLevel || 1)));
  const cefr = getCefrForNumericLevel(clean);
  const cefrInfo = CEFR_LEVELS.find(l => l.level === cefr) || CEFR_LEVELS[0];
  const subLevel = ((clean - 1) % 10) + 1; // 1 to 10 within that CEFR tier

  return {
    numLevel: clean,
    cefr,
    subLevel,
    formatted: `Level ${clean} (${cefr}.${subLevel})`,
    shortName: `Lvl ${clean} • ${cefr}`,
    title: `${cefrInfo.title} Stage ${subLevel}`,
    subtitle: cefrInfo.subtitle,
    badgeColor: cefrInfo.badgeColor,
    minLevel: cefrInfo.numericRange.min,
    maxLevel: cefrInfo.numericRange.max,
  };
}

// Seed vocabulary for Hebrew to English across all CEFR levels
export const SEED_HEBREW_VOCAB: WordItem[] = [
  // A1 (Beginner)
  { id: 'he-a1-1', targetWord: 'שָׁלוֹם', translation: 'peace', alternativeTranslations: ['hello', 'goodbye', 'hi'], transliteration: 'shalom', partOfSpeech: 'noun / greeting', exampleTarget: 'שָׁלוֹם, מָה נִשְׁמָע?', exampleTranslation: 'Hello, what\'s up?', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-2', targetWord: 'תּוֹדָה', translation: 'thank you', alternativeTranslations: ['thanks', 'thank u'], transliteration: 'toda', partOfSpeech: 'interjection', exampleTarget: 'תּוֹדָה רַבָּה עַל הָעֶזְרָה.', exampleTranslation: 'Thank you very much for the help.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-3', targetWord: 'בַּיִת', translation: 'house', alternativeTranslations: ['home', 'residence', 'dwelling'], transliteration: 'bayit', partOfSpeech: 'noun', exampleTarget: 'אֲנִי הוֹלֵךְ הַבַּיְתָה.', exampleTranslation: 'I am going home.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-4', targetWord: 'מַיִם', translation: 'water', alternativeTranslations: ['aqua'], transliteration: 'mayim', partOfSpeech: 'noun', exampleTarget: 'אֶפְשָׁר כּוֹס מַיִם, בְּבַקָּשָׁה?', exampleTranslation: 'Can I have a glass of water, please?', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-5', targetWord: 'לֶחֶם', translation: 'bread', alternativeTranslations: ['loaf'], transliteration: 'lechem', partOfSpeech: 'noun', exampleTarget: 'הַלֶּחֶם הַזֶּה טָרִי מְאוֹד.', exampleTranslation: 'This bread is very fresh.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-6', targetWord: 'סֵפֶר', translation: 'book', alternativeTranslations: ['volume', 'text'], transliteration: 'sefer', partOfSpeech: 'noun', exampleTarget: 'אֲנִי קוֹרֵא סֵפֶר מְעַנְיֵן.', exampleTranslation: 'I am reading an interesting book.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-7', targetWord: 'כֵּן', translation: 'yes', alternativeTranslations: ['yeah', 'yep', 'correct', 'affirmative'], transliteration: 'ken', partOfSpeech: 'adverb', exampleTarget: 'כֵּן, אֲנִי מֵבִין.', exampleTranslation: 'Yes, I understand.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-8', targetWord: 'לֹא', translation: 'no', alternativeTranslations: ['not', 'nope', 'nay', 'negative'], transliteration: 'lo', partOfSpeech: 'adverb', exampleTarget: 'לֹא, תּוֹדָה.', exampleTranslation: 'No, thank you.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-9', targetWord: 'יוֹם', translation: 'day', alternativeTranslations: ['daytime'], transliteration: 'yom', partOfSpeech: 'noun', exampleTarget: 'יוֹם טוֹב לְךָ!', exampleTranslation: 'Have a good day!', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-10', targetWord: 'לַיְלָה', translation: 'night', alternativeTranslations: ['nighttime', 'evening'], transliteration: 'layla', partOfSpeech: 'noun', exampleTarget: 'לַיְלָה טוֹב וַחֲלוֹמוֹת נְעִימִים.', exampleTranslation: 'Good night and sweet dreams.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-11', targetWord: 'בְּבַקָּשָׁה', translation: 'please', alternativeTranslations: ['you are welcome', 'welcome', 'you\'re welcome'], transliteration: 'bevakasha', partOfSpeech: 'interjection', exampleTarget: 'תֵּן לִי אֶת זֶה בְּבַקָּשָׁה.', exampleTranslation: 'Give me that please.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-12', targetWord: 'אוֹכֶל', translation: 'food', alternativeTranslations: ['meal', 'dish'], transliteration: 'ochel', partOfSpeech: 'noun', exampleTarget: 'הָאוֹכֶל הַזֶּה טָעִים מְאוֹד.', exampleTranslation: 'This food is very tasty.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-13', targetWord: 'תְּשׁוּבָה', translation: 'answer', alternativeTranslations: ['reply', 'response', 'solution'], transliteration: 'tshuva', partOfSpeech: 'noun', exampleTarget: 'זֹאת הַתְּשׁוּבָה הַנְּכוֹנָה.', exampleTranslation: 'This is the right answer.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-14', targetWord: 'שְׁאֵלָה', translation: 'question', alternativeTranslations: ['query', 'inquiry'], transliteration: 'she\'ela', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ לִי שְׁאֵלָה פְּשׁוּטָה.', exampleTranslation: 'I have a simple question.', level: 'A1', languagePairKey: 'he-en' },
  { id: 'he-a1-15', targetWord: 'יָפֶה', translation: 'beautiful', alternativeTranslations: ['pretty', 'nice', 'handsome', 'good-looking'], transliteration: 'yafe', partOfSpeech: 'adjective', exampleTarget: 'הַיּוֹם מְזֶג הָאֲוִיר יָפֶה מְאוֹד.', exampleTranslation: 'The weather is very nice today.', level: 'A1', languagePairKey: 'he-en' },

  // A2 (Elementary)
  { id: 'he-a2-1', targetWord: 'מִשְׂפָּחָה', translation: 'family', alternativeTranslations: ['household', 'relatives', 'kin'], transliteration: 'mishpacha', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ לִי מִשְׂפָּחָה גְּדוֹלָה.', exampleTranslation: 'I have a large family.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-2', targetWord: 'עֲבוֹדָה', translation: 'work', alternativeTranslations: ['job', 'labor', 'employment', 'occupation'], transliteration: 'avoda', partOfSpeech: 'noun', exampleTarget: 'אֲנִי מַתְחִיל עֲבוֹדָה חֲדָשָׁה.', exampleTranslation: 'I am starting a new job.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-3', targetWord: 'לִנְסוֹעַ', translation: 'to travel', alternativeTranslations: ['to drive', 'to ride', 'to journey', 'travel', 'drive', 'ride'], transliteration: 'linso\'a', partOfSpeech: 'verb', exampleTarget: 'אֲנַחְנוּ נוֹסְעִים לִירוּשָׁלַיִם מָחָר.', exampleTranslation: 'We are traveling to Jerusalem tomorrow.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-4', targetWord: 'חֲנוּת', translation: 'store', alternativeTranslations: ['shop', 'market', 'boutique'], transliteration: 'chanut', partOfSpeech: 'noun', exampleTarget: 'הַחֲנוּת פְּתוּחָה עַד שְׁמוֹנֶה.', exampleTranslation: 'The shop is open until eight.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-5', targetWord: 'לִקְנוֹת', translation: 'to buy', alternativeTranslations: ['to purchase', 'buy', 'purchase'], transliteration: 'liknot', partOfSpeech: 'verb', exampleTarget: 'אֲנִי רוֹצֶה לִקְנוֹת מַתָּנָה.', exampleTranslation: 'I want to buy a gift.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-6', targetWord: 'מְזֶג אֲוִיר', translation: 'weather', alternativeTranslations: ['climate', 'forecast'], transliteration: 'mezeg avir', partOfSpeech: 'noun phrase', exampleTarget: 'הַמְּזֶג אֲוִיר נִפְלָא הַיּוֹם.', exampleTranslation: 'The weather is wonderful today.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-7', targetWord: 'רְחוֹב', translation: 'street', alternativeTranslations: ['road', 'avenue', 'lane', 'boulevard'], transliteration: 'rekhov', partOfSpeech: 'noun', exampleTarget: 'הֵם גָּרִים בָּרְחוֹב הַזֶּה.', exampleTranslation: 'They live on this street.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-8', targetWord: 'חָבֵר', translation: 'friend', alternativeTranslations: ['companion', 'pal', 'buddy', 'mate'], transliteration: 'chaver', partOfSpeech: 'noun', exampleTarget: 'פָּגַשְׁתִּי חָבֵר טוֹב בַּקָּפֶה.', exampleTranslation: 'I met a good friend at the café.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-9', targetWord: 'שָׁעָה', translation: 'hour', alternativeTranslations: ['time', 'clock'], transliteration: 'sha\'a', partOfSpeech: 'noun', exampleTarget: 'מָה הַשָּׁעָה עַכְשָׁו?', exampleTranslation: 'What time is it now?', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-10', targetWord: 'חֻפְשָׁה', translation: 'vacation', alternativeTranslations: ['holiday', 'break', 'leave'], transliteration: 'chufsha', partOfSpeech: 'noun', exampleTarget: 'אֲנַחְנוּ יוֹצְאִים לְחֻפְשָׁה קְצָרָה.', exampleTranslation: 'We are going on a short vacation.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-11', targetWord: 'לִפְגּוֹשׁ', translation: 'to meet', alternativeTranslations: ['to encounter', 'meet', 'encounter', 'to see'], transliteration: 'lifgosh', partOfSpeech: 'verb', exampleTarget: 'אֲנִי אֶפְגֹּשׁ אוֹתְךָ שָׁם.', exampleTranslation: 'I will meet you there.', level: 'A2', languagePairKey: 'he-en' },
  { id: 'he-a2-12', targetWord: 'עִיר', translation: 'city', alternativeTranslations: ['town', 'municipality'], transliteration: 'ir', partOfSpeech: 'noun', exampleTarget: 'תֵּל אָבִיב הִיא עִיר לְלֹא הַפְסָקָה.', exampleTranslation: 'Tel Aviv is a non-stop city.', level: 'A2', languagePairKey: 'he-en' },

  // B1 (Intermediate)
  { id: 'he-b1-1', targetWord: 'הִתְפַּתְּחוּת', translation: 'development', alternativeTranslations: ['progress', 'advancement', 'evolution', 'growth'], transliteration: 'hitpatchut', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ הִתְפַּתְּחוּת חֲדָשָׁה בַּפְּרוֹיֶקְט.', exampleTranslation: 'There is a new development in the project.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-2', targetWord: 'לְהַסְבִּיר', translation: 'to explain', alternativeTranslations: ['to clarify', 'to elucidate', 'explain', 'clarify'], transliteration: 'lehasbir', partOfSpeech: 'verb', exampleTarget: 'הַאִם תּוּכַל לְהַסְבִּיר אֶת הַנְּקֻדָּה הַזֹּאת?', exampleTranslation: 'Could you explain this point?', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-3', targetWord: 'הַחְלָטָה', translation: 'decision', alternativeTranslations: ['resolution', 'choice', 'verdict', 'determination'], transliteration: 'hachlata', partOfSpeech: 'noun', exampleTarget: 'קִבַּלְנוּ הַחְלָטָה חֲשׁוּבָה מְאוֹד.', exampleTranslation: 'We made a very important decision.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-4', targetWord: 'לְהִתְנַהֵג', translation: 'to behave', alternativeTranslations: ['to act', 'to conduct oneself', 'behave', 'act'], transliteration: 'lehitnaheg', partOfSpeech: 'verb', exampleTarget: 'חָשׁוּב לְהִתְנַהֵג בְּכָבוֹד.', exampleTranslation: 'It is important to behave with respect.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-5', targetWord: 'הִזְדַּמְּנוּת', translation: 'opportunity', alternativeTranslations: ['chance', 'opening', 'occasion'], transliteration: 'hizdamnut', partOfSpeech: 'noun', exampleTarget: 'זֹאת הִזְדַּמְּנוּת מְצוּיֶנֶת לִלְמֹד.', exampleTranslation: 'This is an excellent opportunity to learn.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-6', targetWord: 'סְבִיבָה', translation: 'environment', alternativeTranslations: ['surroundings', 'neighborhood', 'vicinity', 'habitat'], transliteration: 'sviva', partOfSpeech: 'noun', exampleTarget: 'שְׁמִירָה עַל הַסְּבִיבָה חִיּוּנִית לְכֻלָּנוּ.', exampleTranslation: 'Protecting the environment is essential for all of us.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-7', targetWord: 'מַשְׁמָעוּת', translation: 'meaning', alternativeTranslations: ['significance', 'sense', 'import', 'definition'], transliteration: 'mashma\'ut', partOfSpeech: 'noun', exampleTarget: 'מָה הַמַּשְׁמָעוּת שֶׁל הַמִּלָּה הַזֹּאת?', exampleTranslation: 'What is the meaning of this word?', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-8', targetWord: 'לְהַצְלִיחַ', translation: 'to succeed', alternativeTranslations: ['to prosper', 'to triumph', 'succeed', 'prosper', 'to achieve success'], transliteration: 'lehatzli\'ach', partOfSpeech: 'verb', exampleTarget: 'עִם הַתְמָדָה, אַתָּה תַּצְלִיחַ.', exampleTranslation: 'With perseverance, you will succeed.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-9', targetWord: 'מְצִיאוּת', translation: 'reality', alternativeTranslations: ['actuality', 'truth', 'fact'], transliteration: 'metzi\'ut', partOfSpeech: 'noun', exampleTarget: 'לִפְעָמִים הַמְּצִיאוּת מַפְתִּיעָה.', exampleTranslation: 'Sometimes reality is surprising.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-10', targetWord: 'הַשְׁפָּעָה', translation: 'influence', alternativeTranslations: ['impact', 'effect', 'sway'], transliteration: 'hashpa\'a', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ לְכָךְ הַשְׁפָּעָה עֲמֻקָּה.', exampleTranslation: 'This has a profound impact.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-11', targetWord: 'לְשַׁתֵּף', translation: 'to share', alternativeTranslations: ['to collaborate', 'to participate', 'share', 'to include'], transliteration: 'leshatef', partOfSpeech: 'verb', exampleTarget: 'אֲנִי רוֹצֶה לְשַׁתֵּף אֶתְכֶם בָּרַעְיוֹן שֶׁלִּי.', exampleTranslation: 'I want to share my idea with you.', level: 'B1', languagePairKey: 'he-en' },
  { id: 'he-b1-12', targetWord: 'סַבְלָנוּת', translation: 'patience', alternativeTranslations: ['tolerance', 'forbearance', 'endurance'], transliteration: 'savlanut', partOfSpeech: 'noun', exampleTarget: 'לִמּוּד שָׂפָה דּוֹרֵשׁ סַבְלָנוּת רַבָּה.', exampleTranslation: 'Learning a language requires a lot of patience.', level: 'B1', languagePairKey: 'he-en' },

  // B2 (Upper Intermediate)
  { id: 'he-b2-1', targetWord: 'הִשְׁתַּקְּפוּת', translation: 'reflection', alternativeTranslations: ['mirroring', 'reflecting', 'echoing'], transliteration: 'hishtakfut', partOfSpeech: 'noun', exampleTarget: 'הִשְׁתַּקְּפוּת הָעֵצִים בַּמַּיִם הָיְתָה יְפֵהפִיָּה.', exampleTranslation: 'The reflection of the trees in the water was beautiful.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-2', targetWord: 'מֻרְכָּבוּת', translation: 'complexity', alternativeTranslations: ['intricacy', 'sophistication'], transliteration: 'murkavut', partOfSpeech: 'noun', exampleTarget: 'הַמֻּרְכָּבוּת שֶׁל הַסֻּגְיָה דּוֹרֶשֶׁת מַחְשָׁבָה.', exampleTranslation: 'The complexity of the issue requires thought.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-3', targetWord: 'לְהַפְנִים', translation: 'to internalize', alternativeTranslations: ['to absorb', 'internalize', 'absorb'], transliteration: 'lehafneem', partOfSpeech: 'verb', exampleTarget: 'לָקַח לִי זְמַן לְהַפְנִים אֶת הַמַּצָּב.', exampleTranslation: 'It took me time to internalize the situation.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-4', targetWord: 'עִקָּרוֹן', translation: 'principle', alternativeTranslations: ['fundamental rule', 'tenet', 'doctrine', 'rule'], transliteration: 'ikaron', partOfSpeech: 'noun', exampleTarget: 'הוּא פָּעַל לְפִי עֶקְרוֹנוֹת מוּסָרִיִּים.', exampleTranslation: 'He acted according to moral principles.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-5', targetWord: 'הַשְׁעָרָה', translation: 'hypothesis', alternativeTranslations: ['assumption', 'premise', 'conjecture', 'guess'], transliteration: 'hash\'ara', partOfSpeech: 'noun', exampleTarget: 'זֹאת הַשְׁעָרָה שֶׁדּוֹרֶשֶׁת אִמּוּת מַדָּעִי.', exampleTranslation: 'This is a hypothesis requiring scientific verification.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-6', targetWord: 'לְהַבְחִין', translation: 'to distinguish', alternativeTranslations: ['to notice', 'to discern', 'to perceive', 'distinguish', 'discern'], transliteration: 'lehavchin', partOfSpeech: 'verb', exampleTarget: 'קַל לְהַבְחִין בַּהֶבְדֵּל בֵּין הַשְּׁנַיִם.', exampleTranslation: 'It is easy to distinguish the difference between the two.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-7', targetWord: 'עֲקָבִיּוּת', translation: 'consistency', alternativeTranslations: ['persistence', 'coherence'], transliteration: 'akaviyut', partOfSpeech: 'noun', exampleTarget: 'עֲקָבִיּוּת הִיא הַמַּפְתֵּחַ לְהַצְלָחָה.', exampleTranslation: 'Consistency is the key to success.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-8', targetWord: 'סְתִירָה', translation: 'contradiction', alternativeTranslations: ['inconsistency', 'conflict', 'refutation'], transliteration: 'stira', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ סְתִירָה בֵּין שְׁתֵּי הַטְּעָנוֹת.', exampleTranslation: 'There is a contradiction between the two claims.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-9', targetWord: 'לְנַמֵּק', translation: 'to justify', alternativeTranslations: ['to substantiate', 'to give reasons', 'justify', 'substantiate'], transliteration: 'lenamek', partOfSpeech: 'verb', exampleTarget: 'עָלֶיךָ לְנַמֵּק אֶת תְּשׁוּבָתְךָ.', exampleTranslation: 'You must justify your answer.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-10', targetWord: 'חֲשִׁיבוּת', translation: 'importance', alternativeTranslations: ['significance', 'value', 'weight', 'prominence'], transliteration: 'chashivut', partOfSpeech: 'noun', exampleTarget: 'אֵין לְהַפְחִית מֵחֲשִׁיבוּת הָעִנְיָן.', exampleTranslation: 'One should not diminish the importance of the matter.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-11', targetWord: 'הֶשֵּׂג', translation: 'achievement', alternativeTranslations: ['accomplishment', 'attainment'], transliteration: 'heseg', partOfSpeech: 'noun', exampleTarget: 'זֶהוּ הֶשֵּׂג מַרְשִׁים בְּיוֹתֵר.', exampleTranslation: 'This is a most impressive achievement.', level: 'B2', languagePairKey: 'he-en' },
  { id: 'he-b2-12', targetWord: 'לְהַטְמִיעַ', translation: 'to integrate', alternativeTranslations: ['to assimilate', 'to implement', 'integrate', 'assimilate'], transliteration: 'lehatmia', partOfSpeech: 'verb', exampleTarget: 'הֵם הִטְמִיעוּ טֶכְנוֹלוֹגְיָה חֲדָשָׁה.', exampleTranslation: 'They integrated new technology.', level: 'B2', languagePairKey: 'he-en' },

  // C1 (Advanced)
  { id: 'he-c1-1', targetWord: 'תְּלָאוֹת', translation: 'hardships', alternativeTranslations: ['tribulations', 'trials', 'troubles', 'adversity'], transliteration: 'tela\'ot', partOfSpeech: 'noun (plural)', exampleTarget: 'הֵם עָבְרוּ תְּלָאוֹת רַבּוֹת בְּדַרְכָּם.', exampleTranslation: 'They endured many tribulations on their journey.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-2', targetWord: 'לְהַתְווֹת', translation: 'to outline', alternativeTranslations: ['to delineate', 'to map out', 'outline', 'delineate'], transliteration: 'lehatvot', partOfSpeech: 'verb', exampleTarget: 'הַמַּנְהִיג הִתְוָה אֶת הַדֶּרֶךְ לֶעָתִיד.', exampleTranslation: 'The leader outlined the path for the future.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-3', targetWord: 'סְגֻלִּי', translation: 'specific', alternativeTranslations: ['unique', 'intrinsic', 'characteristic'], transliteration: 'seguli', partOfSpeech: 'adjective', exampleTarget: 'יֵשׁ לוֹ מִשְׁקָל סְגֻלִּי מַשְׁמָעוּתִי בַּתַּהֲלִיךְ.', exampleTranslation: 'It has significant intrinsic weight in the process.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-4', targetWord: 'הֲפַכְפַּךְ', translation: 'erratic', alternativeTranslations: ['fickle', 'volatile', 'unpredictable'], transliteration: 'hafachpach', partOfSpeech: 'adjective', exampleTarget: 'מְזֶג הָאֲוִיר הָיָה הֲפַכְפַּךְ כָּל הַשָּׁבוּעַ.', exampleTranslation: 'The weather was erratic all week long.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-5', targetWord: 'לְהַשִּׂיג (גְּבוּל)', translation: 'to trespass', alternativeTranslations: ['to encroach', 'to infringe', 'trespass', 'encroach'], transliteration: 'lehasig gvul', partOfSpeech: 'verb phrase', exampleTarget: 'אָסוּר לְהַשִּׂיג אֶת גְּבוּל הַזּוּלַת.', exampleTranslation: 'It is forbidden to encroach on another\'s boundaries.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-6', targetWord: 'שִׁפְעָה', translation: 'abundance', alternativeTranslations: ['profusion', 'plenty', 'wealth', 'overflow'], transliteration: 'shif\'a', partOfSpeech: 'noun', exampleTarget: 'הַטֶּבַע הִרְעִיף שִׁפְעָה שֶׁל צְבָעִים.', exampleTranslation: 'Nature showered an abundance of colors.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-7', targetWord: 'נִבְעָר', translation: 'ignorant', alternativeTranslations: ['unlearned', 'uncouth', 'illiterate'], transliteration: 'niv\'ar', partOfSpeech: 'adjective', exampleTarget: 'הִתְנַהֲגוּת כָּזֹאת מְעִידָה עַל אָדָם נִבְעָר.', exampleTranslation: 'Such behavior indicates an ignorant person.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-8', targetWord: 'מַשְׂאַת נֶפֶשׁ', translation: 'heart\'s desire', alternativeTranslations: ['ultimate aspiration', 'ideal', 'deepest wish'], transliteration: 'mas\'at nefesh', partOfSpeech: 'idiom', exampleTarget: 'הַשָּׁלוֹם הָיָה מַשְׂאַת נַפְשָׁם שֶׁל הַדּוֹרוֹת.', exampleTranslation: 'Peace was the heart\'s desire of generations.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-9', targetWord: 'לְהַרְתִּיעַ', translation: 'to deter', alternativeTranslations: ['to discourage', 'to dissuade', 'deter', 'discourage'], transliteration: 'lehartia', partOfSpeech: 'verb', exampleTarget: 'הַקְּשָׁיִים לֹא הִרְתִּיעוּ אוֹתוֹ מִלְּהַמְשִׁיךְ.', exampleTranslation: 'The difficulties did not deter him from continuing.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-10', targetWord: 'הֶקְשֵׁר', translation: 'context', alternativeTranslations: ['framework', 'setting', 'background'], transliteration: 'heksher', partOfSpeech: 'noun', exampleTarget: 'יֵשׁ לְהָבִין אֶת הַדְּבָרִים בְּהֶקְשֵׁרָם הַנָּכוֹן.', exampleTranslation: 'One must understand the statements in their proper context.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-11', targetWord: 'מַשְׂטֵמָה', translation: 'hatred', alternativeTranslations: ['enmity', 'malice', 'animosity'], transliteration: 'mastema', partOfSpeech: 'noun', exampleTarget: 'לֹא הָיָה מָקוֹם לְמַשְׂטֵמָה בְּלִבּוֹ.', exampleTranslation: 'There was no room for malice in his heart.', level: 'C1', languagePairKey: 'he-en' },
  { id: 'he-c1-12', targetWord: 'לְהַחְרִישׁ', translation: 'to remain silent', alternativeTranslations: ['to keep quiet', 'to be silent', 'remain silent'], transliteration: 'lehachrish', partOfSpeech: 'verb', exampleTarget: 'בְּרֶגַע מַכְרִיעַ זֶה לֹא נוּכַל לְהַחְרִישׁ.', exampleTranslation: 'At this decisive moment we cannot remain silent.', level: 'C1', languagePairKey: 'he-en' },

  // C2 (Proficiency)
  { id: 'he-c2-1', targetWord: 'גְּנֵבַת דַּעַת', translation: 'deception', alternativeTranslations: ['gaslighting', 'misrepresentation', 'fraud'], transliteration: 'gnevath da\'at', partOfSpeech: 'noun phrase', exampleTarget: 'הַמַּהֲלָךְ הַזֶּה נֶחְשַׁב לִגְנֵבַת דַּעַת מֻבְהֶקֶת.', exampleTranslation: 'This move was considered outright deception.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-2', targetWord: 'בָּטֵל בְּשִׁשִּׁים', translation: 'negligible', alternativeTranslations: ['nullified', 'insignificant', 'trivial'], transliteration: 'batel be-shishim', partOfSpeech: 'idiom', exampleTarget: 'הַהֶבְדֵּל הַכַּסְפִּי בָּטֵל בְּשִׁשִּׁים לְעֻמַּת הָעֵרֶךְ.', exampleTranslation: 'The monetary difference is negligible compared to the value.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-3', targetWord: 'אִסְטְרָא בְּלַגִינָא', translation: 'empty vessel makes the most noise', alternativeTranslations: ['loud ignoramus', 'all bark no bite'], transliteration: 'istara belagina', partOfSpeech: 'proverb', exampleTarget: 'דְּבָרָיו הָיוּ כְּאִסְטְרָא בְּלַגִינָא קִישׁ קִישׁ קָרְיָא.', exampleTranslation: 'His words were like a coin rattling loudly in an empty jar.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-4', targetWord: 'לְהִתְפַּלְפֵּל', translation: 'to debate casuistically', alternativeTranslations: ['to hair-split philosophically', 'to debate deeply', 'to philosophize'], transliteration: 'lehitpalpel', partOfSpeech: 'verb', exampleTarget: 'הֵם נָהֲגוּ לְהִתְפַּלְפֵּל בִּשְׁאֵלוֹת מוּסָר מֻרְכָּבוֹת.', exampleTranslation: 'They used to engage in intricate philosophical debates on moral questions.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-5', targetWord: 'חֻרְבָּה מֻפְלֶגֶת', translation: 'utter ruin', alternativeTranslations: ['profound desolation', 'complete destruction'], transliteration: 'churba mufleget', partOfSpeech: 'noun phrase', exampleTarget: 'הַמָּקוֹם עָמַד בְּחֻרְבָּה מֻפְלֶגֶת מִזֶּה שָׁנִים.', exampleTranslation: 'The place had stood in profound desolation for years.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-6', targetWord: 'שִׁבְרוֹן מָתְנַיִם', translation: 'deep anguish', alternativeTranslations: ['crushing despair', 'heartbreak', 'agony'], transliteration: 'shivron motnayim', partOfSpeech: 'idiom', exampleTarget: 'הַבְּשׂוֹרָה הֵבִיאָה עָלָיו שִׁבְרוֹן מָתְנַיִם.', exampleTranslation: 'The news brought upon him crushing anguish.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-7', targetWord: 'לַהַג', translation: 'prattle', alternativeTranslations: ['idle chatter', 'babble', 'jargon'], transliteration: 'lahag', partOfSpeech: 'noun', exampleTarget: 'דִּבְרֵי הַבִּקֹּרֶת שֶׁלּוֹ הָיוּ לַהַג חֲסַר פֵּשֶׁר.', exampleTranslation: 'His critical remarks were meaningless prattle.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-8', targetWord: 'מוּעָם', translation: 'dimmed', alternativeTranslations: ['muted', 'obscured', 'subdued'], transliteration: 'mu\'am', partOfSpeech: 'adjective', exampleTarget: 'הָאוֹר הַמּוּעָם שִׁוָּה לַחֶדֶר אֲוִירָה מִסְתּוֹרִית.', exampleTranslation: 'The muted light gave the room a mysterious atmosphere.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-9', targetWord: 'מֵצַר', translation: 'distress', alternativeTranslations: ['tight spot', 'strait', 'dire straits'], transliteration: 'metzar', partOfSpeech: 'noun', exampleTarget: 'מִן הַמֵּצַר קָרָאתִי יָּהּ.', exampleTranslation: 'Out of the depths and distress I called.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-10', targetWord: 'אַבְּנֵט', translation: 'sash', alternativeTranslations: ['girdle', 'belt'], transliteration: 'avnet', partOfSpeech: 'noun', exampleTarget: 'הוּא חָגַר אַבְּנֵט מְשֻׁזָּר זָהָב.', exampleTranslation: 'He wore a sash interwoven with gold.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-11', targetWord: 'לְהַשִּׁיק', translation: 'to launch', alternativeTranslations: ['to inaugurate', 'to touch', 'launch', 'inaugurate'], transliteration: 'lehashik', partOfSpeech: 'verb', exampleTarget: 'הַחֶבְרָה תַּשִּׁיק אֶת הַמֻּצָּר הַחָדָשׁ בְּקָרוֹב.', exampleTranslation: 'The company will launch the new product soon.', level: 'C2', languagePairKey: 'he-en' },
  { id: 'he-c2-12', targetWord: 'תְּמִימוּת דֵּעִים', translation: 'unanimity', alternativeTranslations: ['consensus', 'complete agreement'], transliteration: 'tmimut de\'ot', partOfSpeech: 'noun phrase', exampleTarget: 'הָיְתָה תְּמִימוּת דֵּעִים בְּקֶרֶב כָּל הַחֲבֵרִים.', exampleTranslation: 'There was unanimity among all members.', level: 'C2', languagePairKey: 'he-en' },
];

// Seed vocabulary for Spanish to English
export const SEED_SPANISH_VOCAB: WordItem[] = [
  { id: 'es-a1-1', targetWord: 'hola', translation: 'hello', alternativeTranslations: ['hi', 'greetings', 'hey'], transliteration: 'hola', partOfSpeech: 'greeting', exampleTarget: '¡Hola! ¿Cómo estás?', exampleTranslation: 'Hello! How are you?', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-2', targetWord: 'gracias', translation: 'thank you', alternativeTranslations: ['thanks', 'thank u'], transliteration: 'gracias', partOfSpeech: 'interjection', exampleTarget: 'Muchas gracias por tu ayuda.', exampleTranslation: 'Thank you very much for your help.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-3', targetWord: 'casa', translation: 'house', alternativeTranslations: ['home', 'dwelling'], transliteration: 'casa', partOfSpeech: 'noun', exampleTarget: 'Voy a mi casa.', exampleTranslation: 'I am going to my house.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-4', targetWord: 'agua', translation: 'water', alternativeTranslations: ['aqua'], transliteration: 'agua', partOfSpeech: 'noun', exampleTarget: '¿Puedo tener un vaso de agua?', exampleTranslation: 'Can I have a glass of water?', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-5', targetWord: 'pan', translation: 'bread', alternativeTranslations: ['loaf'], transliteration: 'pan', partOfSpeech: 'noun', exampleTarget: 'El pan está delicioso.', exampleTranslation: 'The bread is delicious.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-6', targetWord: 'libro', translation: 'book', alternativeTranslations: ['volume', 'text'], transliteration: 'libro', partOfSpeech: 'noun', exampleTarget: 'Leo un libro interesante.', exampleTranslation: 'I am reading an interesting book.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-7', targetWord: 'respuesta', translation: 'answer', alternativeTranslations: ['reply', 'response'], transliteration: 'respuesta', partOfSpeech: 'noun', exampleTarget: 'Esa es la respuesta correcta.', exampleTranslation: 'That is the correct answer.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-8', targetWord: 'pregunta', translation: 'question', alternativeTranslations: ['query', 'inquiry'], transliteration: 'pregunta', partOfSpeech: 'noun', exampleTarget: 'Tengo una pregunta.', exampleTranslation: 'I have a question.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-9', targetWord: 'amigo', translation: 'friend', alternativeTranslations: ['companion', 'pal', 'buddy'], transliteration: 'amigo', partOfSpeech: 'noun', exampleTarget: 'Él es mi mejor amigo.', exampleTranslation: 'He is my best friend.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-10', targetWord: 'tiempo', translation: 'time', alternativeTranslations: ['weather', 'duration', 'hour'], transliteration: 'tiempo', partOfSpeech: 'noun', exampleTarget: 'No tengo mucho tiempo.', exampleTranslation: 'I don\'t have much time.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-11', targetWord: 'ciudad', translation: 'city', alternativeTranslations: ['town'], transliteration: 'ciudad', partOfSpeech: 'noun', exampleTarget: 'Madrid es una ciudad hermosa.', exampleTranslation: 'Madrid is a beautiful city.', level: 'A1', languagePairKey: 'es-en' },
  { id: 'es-a1-12', targetWord: 'trabajo', translation: 'work', alternativeTranslations: ['job', 'labor', 'employment'], transliteration: 'trabajo', partOfSpeech: 'noun', exampleTarget: 'Me gusta mi nuevo trabajo.', exampleTranslation: 'I like my new job.', level: 'A1', languagePairKey: 'es-en' },
];

import { getVocabularyForNumericLevel, getVocabularyForCefrBand, getAllVocabularyForLanguage } from './vocabularyBank';

/**
 * Returns a robust array of vocabulary for any language and level combination (~100 words per sub-level).
 */
export function getSeedVocabularyForLanguageAndLevel(
  targetLanguage: string,
  level: CEFRLevel,
  knownLanguage: string = 'en',
  numericLevel?: number
): WordItem[] {
  const numLevel = numericLevel || getBaseNumericLevelForCefr(level);
  return getVocabularyForNumericLevel(targetLanguage, numLevel, knownLanguage);
}

export { getVocabularyForNumericLevel, getVocabularyForCefrBand, getAllVocabularyForLanguage };

// Helper to get language metadata
export function getLanguage(code: string, inLanguage?: string): Language {
  const found = SUPPORTED_LANGUAGES.find(l => l.code === code) || KNOWN_LANGUAGES.find(l => l.code === code);
  const baseName = found ? found.name : code.toUpperCase();
  const name = inLanguage ? getLanguageName(code, inLanguage) : baseName;
  if (found) {
    return { ...found, name };
  }
  return { code, name, nativeName: code.toUpperCase(), flag: '🌐' };
}
