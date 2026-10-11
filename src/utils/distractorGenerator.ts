import { WordItem } from '../types';

export type PosCategory =
  | 'verb'
  | 'noun'
  | 'adjective'
  | 'adverb'
  | 'conjunction'
  | 'preposition'
  | 'pronoun'
  | 'number'
  | 'interjection'
  | 'phrase';

/** Strip Hebrew vowel points (Niqqud) for robust matching */
function stripNiqqud(str: string): string {
  return str.replace(/[\u0591-\u05C7]/g, '').trim();
}

/**
 * Categorizes any word or vocabulary entry into a normalized part of speech.
 */
export function getPartOfSpeechCategory(word: {
  partOfSpeech?: string;
  translation: string;
  targetWord?: string;
}): PosCategory {
  const pos = (word.partOfSpeech || '').toLowerCase().trim();
  const trans = (word.translation || '').trim().toLowerCase();
  const rawTarget = (word.targetWord || '').trim();
  const strippedTarget = stripNiqqud(rawTarget);

  // 1. Conjunction detection (explicit pos, known tokens, or Hebrew particles)
  if (
    pos.includes('conj') ||
    pos.includes('conjunction') ||
    pos.includes('voegwoord') ||
    pos.includes('connective') ||
    pos.includes('קישור') ||
    pos.includes('חיבור')
  ) {
    return 'conjunction';
  }

  const KNOWN_CONJUNCTIONS_EN = new Set([
    'but', 'and', 'or', 'because', 'although', 'though', 'while', 'whereas',
    'if', 'unless', 'since', 'however', 'therefore', 'nevertheless', 'furthermore',
    'moreover', 'as well as', 'apart from', 'so that', 'even though', 'as soon as',
    'until', 'as long as', 'in case', 'provided that', 'even if', 'as though', 'yet'
  ]);

  const KNOWN_CONJUNCTIONS_NL = new Set([
    'maar', 'en', 'of', 'omdat', 'want', 'hoewel', 'terwijl', 'indien',
    'als', 'tenzij', 'aangezien', 'echter', 'daarom', 'desondanks', 'bovendien',
    'evenals', 'afgezien van', 'zodat', 'ook al', 'zodra', 'tot', 'voor zover',
    'mits', 'alsof', 'noch', 'hetzij', 'in zoverre'
  ]);

  const KNOWN_CONJUNCTIONS_HE = new Set([
    'אבל', 'כי', 'או', 'אם', 'אלא', 'למרות', 'לכן', 'אף על פי', 'משום ש',
    'הואיל ו', 'מפני ש', 'כדי ש', 'בזמן ש', 'אולם', 'עד', 'כמו גם', 'בעוד',
    'מלבד', 'עם זאת', 'אלא אם כן', 'מכיוון ש', 'מאחר ש', 'כש'
  ]);

  if (
    KNOWN_CONJUNCTIONS_EN.has(trans) ||
    KNOWN_CONJUNCTIONS_NL.has(trans) ||
    KNOWN_CONJUNCTIONS_HE.has(strippedTarget)
  ) {
    return 'conjunction';
  }

  // 2. Preposition detection
  if (
    pos.includes('prep') ||
    pos.includes('preposition') ||
    pos.includes('voorzetsel') ||
    pos.includes('יחס')
  ) {
    return 'preposition';
  }

  const KNOWN_PREPOSITIONS_EN = new Set([
    'in', 'on', 'at', 'from', 'to', 'with', 'by', 'for', 'under', 'over',
    'between', 'among', 'through', 'before', 'after', 'behind', 'without',
    'about', 'against', 'during', 'into', 'onto', 'towards', 'upon',
    'throughout', 'beside', 'across', 'along', 'around', 'beneath', 'underneath',
    'instead of', 'regarding', 'concerning'
  ]);

  const KNOWN_PREPOSITIONS_NL = new Set([
    'in', 'op', 'bij', 'van', 'naar', 'met', 'door', 'voor', 'onder',
    'over', 'tussen', 'tijdens', 'zonder', 'tegen', 'na', 'achter',
    'volgens', 'sinds', 'wegens', 'dankzij', 'binnen', 'buiten', 'rondom',
    'naast', 'ondanks', 'omtrent', 'in plaats van'
  ]);

  const KNOWN_PREPOSITIONS_HE = new Set([
    'ב', 'ל', 'מ', 'על', 'עם', 'אל', 'תחת', 'ליד', 'לפני', 'אחרי',
    'בין', 'בלי', 'בשביל', 'כמו', 'לפי', 'אצל', 'כלפי', 'בתוך', 'מעל',
    'מתחת', 'מסביב', 'במשך', 'בגלל', 'הודות ל'
  ]);

  if (
    KNOWN_PREPOSITIONS_EN.has(trans) ||
    KNOWN_PREPOSITIONS_NL.has(trans) ||
    KNOWN_PREPOSITIONS_HE.has(strippedTarget)
  ) {
    return 'preposition';
  }

  // 3. Number detection
  if (
    pos.includes('num') ||
    pos.includes('number') ||
    pos.includes('telwoord') ||
    pos.includes('מספר')
  ) {
    return 'number';
  }

  const KNOWN_NUMBERS = new Set([
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
    'eighty', 'ninety', 'hundred', 'thousand', 'first', 'second', 'third',
    'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
    'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien',
    'achttien', 'negentien', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig',
    'zeventig', 'tachtig', 'negentig', 'honderd', 'duizend', 'eerste', 'tweede', 'derde'
  ]);

  if (KNOWN_NUMBERS.has(trans)) {
    return 'number';
  }

  // 4. Adverb detection (MUST be evaluated BEFORE verb to prevent 'adverb' matching 'verb')
  if (
    pos === 'adv' ||
    pos === 'adverb' ||
    pos === 'adverbium' ||
    pos === 'bw' ||
    pos === 'bijwoord' ||
    pos.includes('adverb') ||
    pos.includes('bijwoord') ||
    pos.includes('תואר הפועל')
  ) {
    return 'adverb';
  }

  const KNOWN_ADVERBS_EN = new Set([
    'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere',
    'now', 'then', 'soon', 'later', 'already', 'yet', 'still', 'today',
    'tomorrow', 'yesterday', 'tonight', 'always', 'never', 'often',
    'sometimes', 'seldom', 'rarely', 'usually', 'frequently', 'slowly',
    'quickly', 'fast', 'hard', 'well', 'together', 'alone', 'inside',
    'outside', 'upstairs', 'downstairs', 'away', 'back', 'again', 'almost',
    'very', 'quite', 'too', 'enough', 'even', 'perhaps', 'maybe', 'probably',
    'definitely', 'certainly', 'especially', 'actually', 'instead', 'nearby'
  ]);

  const KNOWN_ADVERBS_NL = new Set([
    'hier', 'daar', 'overal', 'nergens', 'ergens',
    'nu', 'toen', 'straks', 'later', 'alvast', 'reeds', 'al', 'nog',
    'vandaag', 'morgen', 'gisteren', 'vanavond', 'vannacht',
    'altijd', 'nooit', 'vaak', 'soms', 'zelden', 'gewoonlijk', 'meestal',
    'langzaam', 'snel', 'vlug', 'hard', 'goed', 'samen', 'alleen',
    'binnen', 'buiten', 'boven', 'beneden', 'weg', 'terug', 'weer',
    'opnieuw', 'bijna', 'zeer', 'heel', 'erg', 'te', 'genoeg', 'zelfs',
    'misschien', 'waarschijnlijk', 'zeker', 'vast', 'vooral', 'eigenlijk', 'dichtbij'
  ]);

  const KNOWN_ADVERBS_HE = new Set([
    'כאן', 'פה', 'שם', 'בכל מקום', 'בשום מקום', 'איפשהו', 'אי שם',
    'עכשיו', 'אז', 'בקרוב', 'אחר כך', 'מאוחר יותר', 'כבר', 'עוד', 'עדיין',
    'היום', 'מחר', 'אתמול', 'הלילה',
    'תמיד', 'אף פעם', 'לעולם', 'לעיתים קרובות', 'לעתים קרובות', 'לפעמים', 'לעיתים רחוקות', 'לרוב', 'בדרך כלל',
    'לאט', 'מהר', 'היטב', 'טוב', 'יחד', 'לבד',
    'בפנים', 'בחוץ', 'למעלה', 'למטה', 'החוצה', 'פנימה', 'חזרה', 'שוב',
    'כמעט', 'מאוד', 'מאד', 'מדי', 'מספיק', 'אפילו',
    'אולי', 'בוודאי', 'בטוח', 'במיוחד', 'באמת'
  ]);

  if (
    KNOWN_ADVERBS_EN.has(trans) ||
    KNOWN_ADVERBS_NL.has(trans) ||
    KNOWN_ADVERBS_HE.has(strippedTarget) ||
    (trans.endsWith('ly') && !trans.includes(' '))
  ) {
    return 'adverb';
  }

  // 5. Verb detection (strictly guarded to never match 'adverb' or 'תואר הפועל')
  const isExplicitVerb =
    (pos.includes('verb') && !pos.includes('adverb')) ||
    (pos.includes('פועל') && !pos.includes('תואר הפועל')) ||
    pos.includes('werkwoord') ||
    pos === 'ww' ||
    pos === 'v' ||
    trans.startsWith('to ') ||
    trans.startsWith('to\t');

  if (isExplicitVerb) {
    return 'verb';
  }

  // 6. Pronoun & Determiner detection
  if (
    pos.includes('pronoun') ||
    pos.includes('determiner') ||
    pos.includes('כינוי') ||
    pos.includes('voornaamwoord')
  ) {
    return 'pronoun';
  }

  const KNOWN_PRONOUNS = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'myself', 'yourself', 'themselves', 'ourselves', 'each other', 'everyone',
    'nobody', 'someone', 'something', 'anything', 'nothing', 'everything', 'this', 'that',
    'ik', 'jij', 'hij', 'zij', 'wij', 'jullie', 'mij', 'jou', 'ons', 'hen', 'hun',
    'iedereen', 'niemand', 'iemand', 'iets', 'niets', 'elkaar', 'degene', 'hetgeen', 'allebei'
  ]);

  if (KNOWN_PRONOUNS.has(trans)) {
    return 'pronoun';
  }

  // 7. Interjection / Greeting detection
  if (
    pos.includes('greet') ||
    pos.includes('interject') ||
    pos.includes('salut') ||
    pos.includes('קריאה') ||
    pos.includes('tussenwerpsel') ||
    trans === 'hello' ||
    trans === 'thank you' ||
    trans === 'please' ||
    trans === 'goodbye' ||
    trans === 'hallo' ||
    trans === 'bedankt' ||
    trans === 'alsjeblieft' ||
    trans === 'tot ziens'
  ) {
    return 'interjection';
  }

  // 8. Idiom / Phrase detection
  if (
    pos.includes('idiom') ||
    pos.includes('phrase') ||
    pos.includes('proverb') ||
    pos.includes('ביטוי') ||
    pos.includes('uitdrukking')
  ) {
    return 'phrase';
  }

  // 9. Adjective detection (strictly guarded to never match 'תואר הפועל')
  if (
    pos.includes('adj') ||
    pos.includes('adjective') ||
    (pos.includes('תואר') && !pos.includes('תואר הפועל')) ||
    pos.includes('bijvoeglijk') ||
    pos === 'bnw'
  ) {
    return 'adjective';
  }

  // 10. Heuristic fallbacks based on translation syntax
  if (
    trans.endsWith('ful') ||
    trans.endsWith('able') ||
    trans.endsWith('ible') ||
    trans.endsWith('ic') ||
    trans.endsWith('ous') ||
    trans.endsWith('ive') ||
    trans.endsWith('isch') ||
    trans.endsWith('baar') ||
    trans.endsWith('loos')
  ) {
    return 'adjective';
  }

  // 11. Noun detection (default for objects, concepts, people)
  return 'noun';
}

// Curated POS fallback bank per language ensuring strict POS uniformity
const POS_FALLBACK_DISTRACTORS: Record<'en' | 'nl', Record<PosCategory, string[]>> = {
  en: {
    conjunction: [
      'although',
      'because',
      'whereas',
      'unless',
      'provided that',
      'even though',
      'since',
      'as long as',
      'while',
      'therefore',
      'however',
      'nevertheless',
      'furthermore',
      'otherwise',
      'yet',
      'in case',
      'so that',
      'whether',
      'despite the fact that',
      'as soon as',
      'as well as',
      'until',
      'moreover',
      'even if',
      'as though',
    ],
    preposition: [
      'between',
      'throughout',
      'towards',
      'against',
      'during',
      'without',
      'underneath',
      'alongside',
      'beyond',
      'despite',
      'behind',
      'beneath',
      'concerning',
      'regarding',
      'within',
      'among',
      'across',
      'opposite',
      'beside',
      'instead of',
    ],
    number: [
      'twelve',
      'twenty',
      'fifteen',
      'eight',
      'seventy',
      'thousand',
      'hundred',
      'forty',
      'fourteen',
      'nineteen',
      'seventeen',
      'thirty',
      'fifty',
      'sixteen',
      'eleven',
    ],
    verb: [
      'to distinguish',
      'to explain',
      'to consider',
      'to decide',
      'to discover',
      'to establish',
      'to develop',
      'to organize',
      'to recognize',
      'to describe',
      'to improve',
      'to remember',
      'to continue',
      'to produce',
      'to prevent',
      'to support',
      'to require',
      'to achieve',
      'to announce',
      'to investigate',
      'to justify',
      'to internalize',
      'to integrate',
      'to outline',
      'to understand',
      'to discuss',
      'to compare',
      'to observe',
      'to conclude',
      'to connect',
      'to encourage',
      'to create',
      'to maintain',
      'to examine',
      'to identify',
      'to suggest',
      'to demonstrate',
      'to determine',
      'to convince',
      'to express',
      'to respond',
      'to reflect',
      'to adapt',
      'to inspire',
      'to emphasize',
      'to participate',
      'to illustrate',
      'to recommend',
      'to perceive',
    ],
    noun: [
      'opportunity',
      'progress',
      'decision',
      'environment',
      'complexity',
      'principle',
      'hypothesis',
      'consistency',
      'contradiction',
      'importance',
      'achievement',
      'abundance',
      'context',
      'solution',
      'community',
      'influence',
      'experience',
      'purpose',
      'resource',
      'structure',
      'challenge',
      'perspective',
      'knowledge',
      'attitude',
      'consequence',
      'reflection',
      'tradition',
      'foundation',
      'significance',
      'development',
      'relationship',
      'capacity',
      'phenomenon',
      'responsibility',
      'conversation',
      'direction',
      'curiosity',
      'objective',
      'generation',
      'advantage',
    ],
    adjective: [
      'specific',
      'erratic',
      'ignorant',
      'important',
      'complex',
      'necessary',
      'different',
      'natural',
      'central',
      'effective',
      'accurate',
      'flexible',
      'frequent',
      'permanent',
      'crucial',
      'valuable',
      'obvious',
      'consistent',
      'relevant',
      'essential',
      'appropriate',
      'significant',
      'practical',
      'reliable',
      'efficient',
      'fundamental',
      'evident',
      'prominent',
      'remarkable',
      'distinctive',
      'constructive',
      'authentic',
      'innovative',
      'meaningful',
    ],
    adverb: [
      'there',
      'everywhere',
      'nowhere',
      'somewhere',
      'here',
      'inside',
      'outside',
      'upstairs',
      'downstairs',
      'nearby',
      'today',
      'tomorrow',
      'yesterday',
      'now',
      'soon',
      'later',
      'always',
      'never',
      'often',
      'sometimes',
      'rarely',
      'slowly',
      'quickly',
      'frequently',
      'carefully',
      'certainly',
      'usually',
      'suddenly',
      'gradually',
      'clearly',
      'entirely',
      'especially',
      'constantly',
      'precisely',
      'immediately',
      'naturally',
      'actually',
      'completely',
      'regularly',
      'deeply',
      'directly',
      'primarily',
      'initially',
      'readily',
      'together',
      'alone',
      'again',
      'back',
    ],
    pronoun: [
      'everyone',
      'nobody',
      'someone',
      'something',
      'anything',
      'themselves',
      'ourselves',
      'myself',
      'yourself',
      'each other',
      'anyone',
      'everything',
    ],
    interjection: [
      'hello',
      'goodbye',
      'welcome',
      'thank you',
      'please',
      'excuse me',
      'pardon',
      'congratulations',
      'good luck',
      'have a good day',
      'see you soon',
      'my pleasure',
    ],
    phrase: [
      'heart\'s desire',
      'utter ruin',
      'deep anguish',
      'empty vessel',
      'step by step',
      'in other words',
      'matter of fact',
      'peace of mind',
      'point of view',
      'at first glance',
      'common ground',
      'silver lining',
    ],
  },
  nl: {
    conjunction: [
      'omdat',
      'hoewel',
      'terwijl',
      'aangezien',
      'tenzij',
      'mits',
      'zodat',
      'daarom',
      'echter',
      'desondanks',
      'bovendien',
      'anders',
      'toch',
      'voor zover',
      'nadat',
      'voordat',
      'totdat',
      'alsof',
      'zodra',
      'evenals',
      'afgezien van',
      'in zoverre',
      'noch',
      'hetzij',
      'zoals',
    ],
    preposition: [
      'tussen',
      'tijdens',
      'richting',
      'tegen',
      'zonder',
      'onder',
      'boven',
      'naast',
      'voorbij',
      'ondanks',
      'achter',
      'betreffende',
      'binnen',
      'over',
      'tegenover',
      'volgens',
      'wegens',
      'dankzij',
      'rondom',
      'omtrent',
      'in plaats van',
    ],
    number: [
      'twaalf',
      'twintig',
      'vijftien',
      'acht',
      'zeventig',
      'duizend',
      'honderd',
      'veertig',
      'veertien',
      'negentien',
      'zeventien',
      'dertig',
      'vijftig',
      'zestien',
      'elf',
    ],
    verb: [
      'onderscheiden',
      'uitleggen',
      'overwegen',
      'beslissen',
      'ontdekken',
      'vaststellen',
      'ontwikkelen',
      'organiseren',
      'herkennen',
      'beschrijven',
      'verbeteren',
      'herinneren',
      'doorgaan',
      'produceren',
      'voorkomen',
      'ondersteunen',
      'vereisen',
      'bereiken',
      'aankondigen',
      'onderzoeken',
      'rechtvaardigen',
      'integreren',
      'begrijpen',
      'bespreken',
      'vergelijken',
      'waarnemen',
      'concluderen',
      'verbinden',
      'aanmoedigen',
      'creëren',
      'handhaven',
      'voorstellen',
      'demonstreren',
      'bepalen',
      'overtuigen',
      'uitdrukken',
      'reageren',
    ],
    noun: [
      'kans',
      'vooruitgang',
      'beslissing',
      'omgeving',
      'complexiteit',
      'principe',
      'hypothese',
      'consistentie',
      'tegenstrijdigheid',
      'belang',
      'prestatie',
      'overvloed',
      'context',
      'oplossing',
      'gemeenschap',
      'invloed',
      'ervaring',
      'doel',
      'middel',
      'structuur',
      'uitdaging',
      'perspectief',
      'kennis',
      'houding',
      'gevolg',
      'reflectie',
      'traditie',
      'fundament',
      'betekenis',
      'ontwikkeling',
      'relatie',
      'capaciteit',
      'verantwoordelijkheid',
      'gesprek',
      'richting',
      'nieuwsgierigheid',
      'generatie',
      'voordeel',
    ],
    adjective: [
      'specifiek',
      'belangrijk',
      'complex',
      'noodzakelijk',
      'verschillend',
      'natuurlijk',
      'centraal',
      'effectief',
      'nauwkeurig',
      'flexibel',
      'regelmatig',
      'permanent',
      'cruciaal',
      'waardevol',
      'duidelijk',
      'consistent',
      'relevant',
      'essentieel',
      'geschikt',
      'praktisch',
      'betrouwbaar',
      'efficiënt',
      'fundamenteel',
      'opmerkelijk',
      'onderscheidend',
      'constructief',
      'authentiek',
      'innovatief',
      'zinvol',
    ],
    adverb: [
      'daar',
      'overal',
      'nergens',
      'ergens',
      'hier',
      'binnen',
      'buiten',
      'boven',
      'beneden',
      'dichtbij',
      'vandaag',
      'morgen',
      'gisteren',
      'nu',
      'straks',
      'later',
      'altijd',
      'nooit',
      'vaak',
      'soms',
      'zelden',
      'langzaam',
      'snel',
      'regelmatig',
      'voorzichtig',
      'zeker',
      'gewoonlijk',
      'plotseling',
      'geleidelijk',
      'duidelijk',
      'volledig',
      'vooral',
      'voortdurend',
      'precies',
      'onmiddellijk',
      'natuurlijk',
      'werkelijk',
      'diep',
      'direct',
      'aanvankelijk',
      'samen',
      'alleen',
      'opnieuw',
      'weer',
      'terug',
    ],
    pronoun: [
      'iedereen',
      'niemand',
      'iemand',
      'iets',
      'niets',
      'elkaar',
      'degene',
      'hetgeen',
      'allebei',
      'deze',
      'diegene',
    ],
    interjection: [
      'hallo',
      'tot ziens',
      'welkom',
      'dank je wel',
      'alsjeblieft',
      'pardon',
      'sorry',
      'gefeliciteerd',
      'succes',
      'fijne dag',
      'tot snel',
      'graag gedaan',
    ],
    phrase: [
      'hartenwens',
      'stap voor stap',
      'met andere woorden',
      'feitelijk',
      'gemoedsrust',
      'standpunt',
      'op het eerste gezicht',
      'gemeenschappelijke grond',
      'lichtpuntje',
    ],
  },
};

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^to\s+/i, '')
    .replace(/[^a-z0-9\u0590-\u05FF]/gi, '');
}

export const DONT_KNOW_OPTION = "I don't know";
export const DONT_KNOW_OPTION_NL = "Ik weet het niet";

export function getDontKnowOption(knownLanguage?: string): string {
  return knownLanguage === 'nl' ? DONT_KNOW_OPTION_NL : DONT_KNOW_OPTION;
}

/** Detect if the target answer language is Dutch or English */
function resolveLanguage(targetWord: WordItem, knownLanguage?: string): 'en' | 'nl' {
  if (knownLanguage === 'nl') return 'nl';
  if (knownLanguage === 'en') return 'en';
  if (targetWord.languagePairKey?.endsWith('-nl')) return 'nl';
  if (targetWord.languagePairKey?.endsWith('-en')) return 'en';
  const trans = (targetWord.translation || '').toLowerCase().trim();
  const dutchTokens = ['het', 'de', 'een', 'maar', 'omdat', 'want', 'hoewel', 'alsjeblieft', 'bedankt', 'niet', 'geen', 'ervaring'];
  if (dutchTokens.some(t => trans === t || trans.startsWith(t + ' ') || trans.endsWith(' ' + t))) {
    return 'nl';
  }
  return 'en';
}

/**
 * Generates 4 strictly unique multiple choice options:
 * - 1 correct primary translation
 * - 2 distractors of the EXACT SAME part of speech (conjunction->conjunctions, noun->nouns, verb->verbs, etc.)
 * - 1 "I don't know" option
 * - Never includes any word from the current study session as a distractor
 * - Never re-uses distractors already shown in the session
 */
export function generateStrictMultipleChoiceOptions(
  targetWord: WordItem,
  candidatePool: WordItem[] = [],
  sessionCardsWords: WordItem[] = [],
  alreadyUsedDistractors: Set<string> = new Set(),
  knownLanguage?: string
): { options: string[]; usedDistractors: string[] } {
  const lang = resolveLanguage(targetWord, knownLanguage);
  const correctRaw = targetWord.translation.trim();
  const targetCategory = getPartOfSpeechCategory(targetWord);
  const isVerb = targetCategory === 'verb';
  const isEnglish = lang === 'en';
  const targetStartsWithTo = correctRaw.toLowerCase().startsWith('to ');

  // Clean canonical correct translation
  let correctAnswer = correctRaw;
  if (isVerb && isEnglish && !targetStartsWithTo) {
    correctAnswer = `to ${correctRaw}`;
  }

  // Build exclusion list of forbidden words:
  // 1. Correct translation + all synonyms & alternatives of targetWord
  // 2. All words in the current study session (so no session word is ever a distractor!)
  // 3. All distractors already used during this study session
  const excludedNormalized = new Set<string>();
  excludedNormalized.add(normalizeText(correctAnswer));
  excludedNormalized.add(normalizeText(targetWord.translation));
  excludedNormalized.add(normalizeText(DONT_KNOW_OPTION));
  excludedNormalized.add(normalizeText(DONT_KNOW_OPTION_NL));

  if (targetWord.alternativeTranslations) {
    targetWord.alternativeTranslations.forEach(alt => {
      excludedNormalized.add(normalizeText(alt));
    });
  }

  targetWord.translation.split(/[/,;|]/).forEach(part => {
    excludedNormalized.add(normalizeText(part));
  });

  // Exclude all words belonging to the current session batch
  sessionCardsWords.forEach(w => {
    excludedNormalized.add(normalizeText(w.translation));
    excludedNormalized.add(normalizeText(w.targetWord));
    if (w.alternativeTranslations) {
      w.alternativeTranslations.forEach(alt => {
        excludedNormalized.add(normalizeText(alt));
      });
    }
  });

  // Exclude distractors already displayed in this study session
  alreadyUsedDistractors.forEach(d => {
    excludedNormalized.add(normalizeText(d));
  });

  const selectedDistractors: string[] = [];
  const selectedNormalized = new Set<string>();
  selectedNormalized.add(normalizeText(correctAnswer));

  // Helper to test and add a distractor
  const tryAddDistractor = (rawText: string) => {
    let candidate = rawText.trim();
    if (!candidate) return false;

    // Take only first part if slash-delimited
    if (candidate.includes('/')) {
      candidate = candidate.split('/')[0].trim();
    }
    if (candidate.includes(',')) {
      candidate = candidate.split(',')[0].trim();
    }

    // Format English verbs consistently with 'to'
    if (isVerb && isEnglish) {
      if (!candidate.toLowerCase().startsWith('to ')) {
        candidate = `to ${candidate}`;
      }
    } else if (!isVerb && candidate.toLowerCase().startsWith('to ')) {
      candidate = candidate.replace(/^to\s+/i, '').trim();
    }

    const norm = normalizeText(candidate);
    if (!norm) return false;

    if (excludedNormalized.has(norm) || selectedNormalized.has(norm)) {
      return false;
    }

    selectedDistractors.push(candidate);
    selectedNormalized.add(norm);
    return true;
  };

  // 1. First pass: candidates from outside the session matching the EXACT same part of speech
  const shuffledPool = [...candidatePool].sort(() => Math.random() - 0.5);

  const rawTrans = correctRaw.toLowerCase().trim();
  const strippedTarget = stripNiqqud(targetWord.targetWord || '');
  const PLACE_ADVERB_SET = new Set([
    'hier', 'daar', 'overal', 'nergens', 'ergens', 'binnen', 'buiten', 'boven', 'beneden', 'weg', 'terug', 'dichtbij', 'ver',
    'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere', 'inside', 'outside', 'upstairs', 'downstairs', 'away', 'nearby',
    'כאן', 'פה', 'שם', 'בכל מקום', 'בשום מקום', 'איפשהו', 'אי שם', 'בפנים', 'בחוץ', 'למעלה', 'למטה'
  ]);
  const isPlaceAdverb = targetCategory === 'adverb' && (PLACE_ADVERB_SET.has(rawTrans) || PLACE_ADVERB_SET.has(strippedTarget));

  // If the word is a place/location adverb (e.g., 'hier', 'here', 'כאן'), prioritize matching place adverbs like 'daar'
  if (isPlaceAdverb) {
    // A. Direct opposites/counterparts (e.g. hier -> daar, here -> there)
    const directOpposites: Record<string, string[]> = {
      hier: ['daar', 'overal', 'nergens', 'ergens'],
      daar: ['hier', 'overal', 'nergens', 'ergens'],
      here: ['there', 'everywhere', 'nowhere', 'somewhere'],
      there: ['here', 'everywhere', 'nowhere', 'somewhere'],
      binnen: ['buiten', 'boven', 'beneden'],
      buiten: ['binnen', 'boven', 'beneden'],
      inside: ['outside', 'upstairs', 'downstairs'],
      outside: ['inside', 'upstairs', 'downstairs'],
    };

    const pairedList = directOpposites[rawTrans] || [];
    for (const pairedWord of pairedList) {
      if (selectedDistractors.length >= 2) break;
      tryAddDistractor(pairedWord);
    }

    // B. Place adverbs from the active candidate pool
    for (const candidateWord of shuffledPool) {
      if (selectedDistractors.length >= 2) break;
      if (candidateWord.id === targetWord.id) continue;
      if (stripNiqqud(candidateWord.targetWord) === strippedTarget) continue;
      const cTrans = (candidateWord.translation || '').trim().toLowerCase();
      if (PLACE_ADVERB_SET.has(cTrans)) {
        tryAddDistractor(candidateWord.translation);
      }
    }

    // C. Curated fallback place adverbs
    const placeFallbacks = lang === 'nl'
      ? ['daar', 'overal', 'nergens', 'ergens', 'binnen', 'buiten', 'boven', 'beneden', 'dichtbij']
      : ['there', 'everywhere', 'nowhere', 'somewhere', 'inside', 'outside', 'upstairs', 'downstairs', 'nearby'];
    const shuffledPlaceFallbacks = [...placeFallbacks].sort(() => Math.random() - 0.5);
    for (const fbItem of shuffledPlaceFallbacks) {
      if (selectedDistractors.length >= 2) break;
      tryAddDistractor(fbItem);
    }
  }

  for (const candidateWord of shuffledPool) {
    if (selectedDistractors.length >= 2) break;
    if (candidateWord.id === targetWord.id) continue;
    if (stripNiqqud(candidateWord.targetWord) === stripNiqqud(targetWord.targetWord)) continue;

    const candidateCat = getPartOfSpeechCategory(candidateWord);
    if (candidateCat === targetCategory) {
      tryAddDistractor(candidateWord.translation);
    }
  }

  // 2. Second pass: use the POS-specific fallback bank for this exact category
  const fallbackDict = POS_FALLBACK_DISTRACTORS[lang] || POS_FALLBACK_DISTRACTORS.en;
  const categoryFallbackList = fallbackDict[targetCategory] || fallbackDict.noun;
  const shuffledFallback = [...categoryFallbackList].sort(() => Math.random() - 0.5);

  for (const fbItem of shuffledFallback) {
    if (selectedDistractors.length >= 2) break;
    tryAddDistractor(fbItem);
  }

  // 3. Fallback: if still under 2 (rare edge case), draw from alternate language POS list of the EXACT SAME category
  if (selectedDistractors.length < 2) {
    const altLang = lang === 'en' ? 'nl' : 'en';
    const altFallbackList = POS_FALLBACK_DISTRACTORS[altLang][targetCategory] || [];
    for (const altItem of altFallbackList) {
      if (selectedDistractors.length >= 2) break;
      tryAddDistractor(altItem);
    }
  }

  // Shuffle the 3 translation choices (1 correct + 2 distractors)
  const translationChoices = [correctAnswer, ...selectedDistractors.slice(0, 2)].sort(() => Math.random() - 0.5);

  // 4th option is always "I don't know" placed at the end with distinctive treatment
  const dontKnowText = getDontKnowOption(lang);
  const finalOptions = [...translationChoices, dontKnowText];

  return {
    options: finalOptions,
    usedDistractors: selectedDistractors,
  };
}
