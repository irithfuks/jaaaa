// Intelligent Translation Checking and Normalization Utility
import { getBankAlternativesForWord } from '../data/vocabularyBank';
import { stripDiacriticsAndVowels } from './textNormalization';

export interface TranslationCheckResult {
  isCorrect: boolean;
  verdict: 'correct' | 'incorrect_spelling' | 'incorrect_meaning' | 'incorrect_loose';
  feedback: string;
  matchedSynonym?: string;
  expectedTranslation: string;
  normalizedUserAnswer: string;
}

// Common synonym mapping for high-frequency vocabulary across languages
const SYNONYM_MAP: Record<string, string[]> = {
  // English synonyms
  'plan': ['plan', 'program', 'programme', 'schedule', 'scheme', 'design', 'project', 'curriculum', 'blueprint', 'strategy', 'outline'],
  'program': ['program', 'programme', 'plan', 'schedule', 'curriculum', 'scheme', 'project', 'software', 'course', 'outline'],
  'to plan': ['to plan', 'plan', 'to design', 'design', 'to program', 'program', 'to scheme', 'to map out', 'to outline'],
  'plane': ['plane', 'airplane', 'aeroplane', 'aircraft', 'jet', 'flight'],
  'airplane': ['airplane', 'plane', 'aeroplane', 'aircraft', 'jet'],
  'woman': ['woman', 'wife', 'female', 'lady'],
  'wife': ['wife', 'woman', 'spouse', 'partner'],
  'child': ['child', 'kid', 'boy', 'girl', 'children'],
  'boy': ['boy', 'child', 'kid'],
  'girl': ['girl', 'child', 'daughter', 'young girl'],
  'man': ['man', 'person', 'guy', 'gentleman', 'heer', 'kerel'],
  'big': ['big', 'large', 'great', 'huge'],
  'large': ['large', 'big', 'great', 'huge'],
  'small': ['small', 'little', 'tiny'],
  'little': ['little', 'small', 'tiny'],
  'beautiful': ['beautiful', 'pretty', 'handsome', 'lovely', 'fine'],
  'pretty': ['pretty', 'beautiful', 'lovely', 'cute'],
  'smart': ['smart', 'wise', 'clever', 'intelligent'],
  'wise': ['wise', 'smart', 'clever', 'intelligent'],
  'car': ['car', 'automobile', 'vehicle', 'auto'],
  'vehicle': ['vehicle', 'car', 'automobile'],
  'development': ['development', 'progress', 'advancement', 'evolution', 'growth', 'improvement'],
  'progress': ['progress', 'development', 'advancement', 'growth', 'improvement'],
  'advancement': ['advancement', 'development', 'progress', 'promotion'],
  'answer': ['answer', 'reply', 'response', 'solution', 'to answer', 'to reply', 'to respond'],
  'reply': ['reply', 'answer', 'response', 'solution', 'to reply', 'to answer'],
  'response': ['response', 'answer', 'reply', 'feedback'],
  'question': ['question', 'query', 'inquiry', 'ask'],
  'hello': ['hello', 'hi', 'peace', 'greetings', 'welcome', 'hey'],
  'peace': ['peace', 'tranquility', 'calm', 'serenity', 'hello', 'goodbye'],
  'thank you': ['thank you', 'thanks', 'thank u', 'much obliged', 'many thanks'],
  'thanks': ['thanks', 'thank you', 'many thanks'],
  'house': ['house', 'home', 'residence', 'dwelling'],
  'home': ['home', 'house', 'place', 'residence'],
  'water': ['water', 'aqua'],
  'bread': ['bread', 'loaf'],
  'book': ['book', 'volume', 'text'],
  'yes': ['yes', 'yeah', 'yep', 'aye', 'correct', 'affirmative'],
  'no': ['no', 'nope', 'not', 'negative', 'nay'],
  'day': ['day', 'daytime', 'day time'],
  'night': ['night', 'nighttime', 'evening'],
  'family': ['family', 'relatives', 'household', 'kin'],
  'work': ['work', 'job', 'labor', 'employment', 'occupation', 'to work', 'to labor'],
  'job': ['job', 'work', 'occupation', 'profession', 'career', 'employment', 'position'],
  'to travel': ['to travel', 'travel', 'to ride', 'ride', 'to journey', 'journey', 'to drive', 'drive', 'to commute'],
  'travel': ['travel', 'to travel', 'ride', 'journey', 'trip', 'drive'],
  'store': ['store', 'shop', 'boutique', 'market', 'outlet'],
  'shop': ['shop', 'store', 'boutique', 'market'],
  'to buy': ['to buy', 'buy', 'to purchase', 'purchase'],
  'buy': ['buy', 'to buy', 'purchase', 'to purchase'],
  'weather': ['weather', 'climate', 'forecast'],
  'street': ['street', 'road', 'avenue', 'way', 'lane', 'boulevard'],
  'friend': ['friend', 'pal', 'buddy', 'companion', 'mate', 'peer'],
  'hour': ['hour', 'time', 'hr', 'period'],
  'time': ['time', 'hour', 'moment', 'period', 'clock'],
  'bill': ['bill', 'receipt', 'check', 'invoice', 'account', 'tab'],
  'receipt': ['receipt', 'bill', 'check', 'invoice', 'voucher'],
  'check': ['check', 'cheque', 'bill', 'receipt'],
  'invoice': ['invoice', 'bill', 'receipt'],
  'account': ['account', 'bill', 'ledger', 'calculation'],
  'vacation': ['vacation', 'holiday', 'break', 'trip', 'leave'],
  'holiday': ['holiday', 'vacation', 'break', 'festivity', 'celebration'],
  'to explain': ['to explain', 'explain', 'to clarify', 'clarify', 'to elucidate'],
  'explain': ['explain', 'to explain', 'clarify', 'to clarify', 'make clear'],
  'decision': ['decision', 'choice', 'resolution', 'verdict', 'determination'],
  'opportunity': ['opportunity', 'chance', 'opening', 'occasion'],
  'environment': ['environment', 'surroundings', 'surrounding', 'nature', 'setting', 'habitat'],
  'meaning': ['meaning', 'significance', 'sense', 'definition', 'import'],
  'to succeed': ['to succeed', 'succeed', 'to triumph', 'to prosper', 'to achieve success'],
  'succeed': ['succeed', 'to succeed', 'prosper', 'triumph', 'achieve success'],
  'reality': ['reality', 'actuality', 'truth', 'fact'],
  'influence': ['influence', 'impact', 'effect', 'sway'],
  'impact': ['impact', 'influence', 'effect'],
  'to behave': ['to behave', 'behave', 'to act', 'act'],
  'behave': ['behave', 'to behave', 'act', 'to act'],
  'to share': ['to share', 'share', 'to collaborate', 'to participate'],
  'patience': ['patience', 'tolerance', 'forbearance', 'endurance'],
  'reflection': ['reflection', 'mirroring', 'reflecting', 'image'],
  'complexity': ['complexity', 'intricacy', 'complication', 'depth'],
  'to internalize': ['to internalize', 'internalize', 'to absorb', 'absorb'],
  'principle': ['principle', 'rule', 'fundamental', 'tenet', 'doctrine'],
  'hypothesis': ['hypothesis', 'assumption', 'premise', 'conjecture', 'theory'],
  'to distinguish': ['to distinguish', 'distinguish', 'to notice', 'to discern', 'to perceive'],
  'consistency': ['consistency', 'persistence', 'coherence', 'stability'],
  'contradiction': ['contradiction', 'inconsistency', 'conflict', 'refutation'],
  'to justify': ['to justify', 'justify', 'to substantiate', 'substantiate', 'to give reasons'],
  'importance': ['importance', 'significance', 'prominence', 'value', 'weight'],
  'achievement': ['achievement', 'accomplishment', 'attainment', 'success'],
  'to integrate': ['to integrate', 'integrate', 'to assimilate', 'assimilate', 'to implement'],
  'hardships': ['hardships', 'tribulations', 'troubles', 'trials', 'struggles', 'adversity'],
  'to outline': ['to outline', 'outline', 'to delineate', 'delineate', 'to map out'],
  'specific': ['specific', 'unique', 'intrinsic', 'characteristic', 'distinct'],
  'erratic': ['erratic', 'fickle', 'volatile', 'unpredictable', 'unstable'],
  'to trespass': ['to trespass', 'trespass', 'to encroach', 'encroach', 'to infringe'],
  'abundance': ['abundance', 'profusion', 'plenty', 'wealth', 'overflow'],
  'ignorant': ['ignorant', 'unlearned', 'uncouth', 'illiterate'],
  'heart\'s desire': ['heart\'s desire', 'ultimate aspiration', 'ideal', 'deepest wish', 'aspiration'],
  'to deter': ['to deter', 'deter', 'to discourage', 'discourage', 'to dissuade'],
  'context': ['context', 'framework', 'setting', 'background', 'circumstance'],
  'hatred': ['hatred', 'enmity', 'malice', 'animosity', 'hate'],
  'to remain silent': ['to remain silent', 'to keep quiet', 'to be silent', 'remain silent', 'keep silent'],
  'deception': ['deception', 'gaslighting', 'misrepresentation', 'fraud', 'trickery'],
  'negligible': ['negligible', 'nullified', 'insignificant', 'trivial', 'minor'],
  'utter ruin': ['utter ruin', 'profound desolation', 'complete destruction', 'ruin', 'desolation'],
  'deep anguish': ['deep anguish', 'crushing despair', 'heartbreak', 'agony', 'grief'],
  'prattle': ['prattle', 'idle chatter', 'babble', 'chatter', 'jargon'],
  'dimmed': ['dimmed', 'muted', 'obscured', 'subdued', 'faded'],
  'distress': ['distress', 'tight spot', 'strait', 'dire straits', 'trouble'],
  'sash': ['sash', 'girdle', 'belt'],
  'to launch': ['to launch', 'launch', 'to inaugurate', 'inaugurate', 'to start'],
  'unanimity': ['unanimity', 'consensus', 'complete agreement', 'agreement'],

  // Hebrew synonyms & spelling variations
  'תכנית': ['תכנית', 'תוכנית', 'סדר יום', 'לוח זמנים', 'פרויקט', 'מתווה', 'תכנית עבודה'],
  'תוכנית': ['תוכנית', 'תכנית', 'סדר יום', 'לוח זמנים', 'פרויקט', 'מתווה', 'תוכנית עבודה'],
  'לתכנן': ['לתכנן', 'לעצב', 'להתוות'],
  'מטוס': ['מטוס', 'אווירון', 'כלי טיס'],
  'אווירון': ['אווירון', 'מטוס'],
  'אישה': ['אישה', 'אשה', 'רעיה', 'בת זוג'],
  'אשה': ['אשה', 'אישה', 'רעיה', 'בת זוג'],
  'בוקר': ['בוקר', 'בקר'],
  'בקר': ['בקר', 'בוקר'],
  'צהריים': ['צהריים', 'צהרים'],
  'צהרים': ['צהרים', 'צהריים'],
  'מכונית': ['מכונית', 'רכב', 'אוטו'],
  'רכב': ['רכב', 'מכונית', 'אוטו'],
  'אוטו': ['אוטו', 'מכונית', 'רכב'],
  'תשובה': ['תשובה', 'מענה', 'תגובה'],
  'מענה': ['מענה', 'תשובה', 'תגובה'],
  'שלום': ['שלום', 'היי', 'אהלן'],
  'תודה': ['תודה', 'תודה רבה', 'רוב תודות'],
  'בית': ['בית', 'דירה', 'מעון'],
  'עבודה': ['עבודה', 'תעסוקה', 'משרה'],
  'לנסוע': ['לנסוע', 'לרכוב', 'לנוע', 'לטייל'],
  'חנות': ['חנות', 'מרכול'],
  'חבר': ['חבר', 'ידיד', 'רע'],
  'התפתחות': ['התפתחות', 'התקדמות', 'צמיחה'],
  'החלטה': ['החלטה', 'קביעה', 'מסקנה'],
  'הזדמנות': ['הזדמנות', 'סיכוי'],
  'סביבה': ['סביבה', 'מרחב', 'סביבתנות'],
  'משמעות': ['משמעות', 'חשיבות', 'פשר'],
  'להצליח': ['להצליח', 'לשגשג'],

  // Dutch synonyms & alternate translations
  'auto': ['auto', 'wagen', 'automobiel', 'voertuig'],
  'wagen': ['wagen', 'auto', 'voertuig'],
  'huis': ['huis', 'thuis', 'woning', 'pand'],
  'thuis': ['thuis', 'huis', 'woning'],
  'brood': ['brood'],
  'boek': ['boek', 'bundel'],
  'bedankt': ['bedankt', 'dank je', 'dank u', 'dankjewel', 'hartelijk dank', 'dank'],
  'dank je': ['dank je', 'dank u', 'bedankt', 'dankjewel', 'hartelijk dank'],
  'dank u': ['dank u', 'dank je', 'bedankt', 'dankjewel'],
  'ja': ['ja', 'jawel'],
  'nee': ['nee', 'neen'],
  'werk': ['werk', 'baan', 'arbeid', 'betrekking'],
  'baan': ['baan', 'werk', 'beroep', 'betrekking'],
  'vriend': ['vriend', 'kameraad', 'maat', 'makker'],
  'stad': ['stad', 'woonplaats'],
  'straat': ['straat', 'weg', 'laan'],
  'winkel': ['winkel', 'zaak', 'boetiek', 'shop'],
  'vakantie': ['vakantie', 'verlof', 'reis'],
  'ontwikkeling': ['ontwikkeling', 'vooruitgang', 'groei', 'evolutie'],
  'vooruitgang': ['vooruitgang', 'ontwikkeling', 'groei'],
  'beslissing': ['beslissing', 'besluit', 'keuze'],
  'besluit': ['besluit', 'beslissing', 'keuze'],
  'keuze': ['keuze', 'beslissing', 'selectie'],
  'kans': ['kans', 'gelegenheid', 'mogelijkheid'],
  'gelegenheid': ['gelegenheid', 'kans', 'mogelijkheid'],
  'mogelijkheid': ['mogelijkheid', 'kans', 'optie', 'gelegenheid'],
  'omgeving': ['omgeving', 'milieu', 'natuur', 'habitat'],
  'betekenis': ['betekenis', 'zin', 'belang', 'strekking'],
  'slagen': ['slagen', 'succes hebben', 'lukken'],
  'succes': ['succes', 'welslagen', 'triomf'],
  'vliegtuig': ['vliegtuig', 'toestel'],
  'vrouw': ['vrouw', 'echtgenote', 'dame'],
  'echtgenote': ['echtgenote', 'vrouw', 'partner'],
  'kind': ['kind', 'jongere', 'meisje', 'jongen'],
  'jongen': ['jongen', 'knaap', 'kind'],
  'meisje': ['meisje', 'dochter', 'kind'],
  'groot': ['groot', 'enorm', 'flink'],
  'klein': ['klein', 'mini', 'gering'],
  'mooi': ['mooi', 'prachtig', 'knap', 'fraai', 'leuk'],
  'prachtig': ['prachtig', 'mooi', 'fraai', 'schitterend'],
  'slim': ['slim', 'wijs', 'intelligent', 'verstandig', 'knap'],
  'wijs': ['wijs', 'slim', 'verstandig', 'intelligent'],
  'antwoord': ['antwoord', 'reactie', 'oplossing'],
  'vraag': ['vraag', 'kwestie'],
  'hallo': ['hallo', 'hoi', 'dag', 'goeiedag', 'goededag'],
  'vrede': ['vrede', 'rust', 'kalmte'],
  'reizen': ['reizen', 'rijden', 'een reis maken'],
  'rijden': ['rijden', 'reizen', 'sturen'],
  'kopen': ['kopen', 'aanschaffen', 'investeren in'],
  'uitleggen': ['uitleggen', 'verklaren', 'duidelijk maken', 'toelichten'],
  'duidelijk maken': ['duidelijk maken', 'uitleggen', 'toelichten', 'verduidelijken'],
  'toelichten': ['toelichten', 'uitleggen', 'verduidelijken'],
  'gedrag': ['gedrag', 'optreden', 'houding'],
  'gedragen': ['gedragen', 'zich gedragen', 'handelen'],
  'delen': ['delen', 'meedelen', 'samen delen'],
  'geduld': ['geduld', 'volharding', 'geduldigheid'],
  'begrip': ['begrip', 'inzicht', 'notie'],
  'werkelijkheid': ['werkelijkheid', 'realiteit', 'feit'],
  'realiteit': ['realiteit', 'werkelijkheid', 'waarheid'],
  'invloed': ['invloed', 'impact', 'effect'],
  'effect': ['effect', 'impact', 'gevolg', 'invloed'],
  'moeilijkheid': ['moeilijkheid', 'probleem', 'hinder'],
  'probleem': ['probleem', 'kwestie', 'moeilijkheid'],
  'verscheidenheid': ['verscheidenheid', 'variatie', 'diversiteit'],
  'diversiteit': ['diversiteit', 'verscheidenheid', 'variatie'],
  'uitbreiden': ['uitbreiden', 'vergroten', 'verbreiden'],
  'vergroten': ['vergroten', 'uitbreiden', 'vermeerderen'],
  'oplossing': ['oplossing', 'antwoord', 'uitkomst'],
};

// Dynamic custom approved translations loaded from backend/Firestore
const DYNAMIC_CUSTOM_TRANSLATIONS: Record<string, string[]> = {};

export function registerCustomApprovedTranslations(map: Record<string, string[]>) {
  if (!map || typeof map !== 'object') return;
  Object.entries(map).forEach(([key, values]) => {
    if (!key || !Array.isArray(values)) return;
    const cleanKey = normalizeTranslationText(key);
    const existing = DYNAMIC_CUSTOM_TRANSLATIONS[cleanKey] || [];
    const merged = Array.from(new Set([...existing, ...values.map(v => normalizeTranslationText(v))]));
    DYNAMIC_CUSTOM_TRANSLATIONS[cleanKey] = merged;
  });
}

/**
 * Strips bracketed/parenthetical content from a string:
 * - Parentheses: "Orange (fruit)" -> "Orange"
 * - Square brackets: "bank [finance]" -> "bank"
 * - Curly braces: "lead {metal}" -> "lead"
 * If the entire string is bracketed e.g. "(apple)", returns the inside content "apple".
 */
export function stripBracketedContent(text: string): string {
  if (!text) return '';
  const stripped = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length > 0) {
    return stripped;
  }
  return text.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts any content inside brackets/parentheses, e.g. "Orange (fruit)" -> ["fruit"]
 */
export function extractBracketedContent(text: string): string[] {
  if (!text) return [];
  const results: string[] = [];
  const matches = text.matchAll(/\(([^)]+)\)|\[([^\]]+)\]|\{([^}]+)\}/g);
  for (const m of matches) {
    const inside = (m[1] || m[2] || m[3] || '').trim();
    if (inside.length > 0) {
      results.push(inside);
    }
  }
  return results;
}

/**
 * Normalizes text by removing trailing/leading punctuation, 
 * treating misplaced commas as harmless whitespace, 
 * removing Hebrew, Arabic, Persian diacritics/vowels/nikkud, and cleaning spaces.
 */
export function normalizeTranslationText(input: string): string {
  if (!input) return '';
  return stripDiacriticsAndVowels(input)
    .toLowerCase()
    // Replace commas, semicolons, dashes, slashes, periods, quotes with space
    .replace(/[,;—–/\\.\'"״׳!?:()\[\]{}]/g, ' ')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string contains Hebrew characters.
 */
export function isHebrewText(str: string): boolean {
  return /[\u0590-\u05FF]/.test(str || '');
}

/**
 * Expands Hebrew text to all valid orthographic variants:
 * 1. Base consonantal form with all nikkud/diacritics removed.
 * 2. Ktiv Male (full spelling):
 *    - In Hebrew, the 'o' sound can be written as the holam diacritic (dot above the letter: \u05B9, \u05BA,
 *      or kamats katan: \u05C7, hataf kamats: \u05B3) or as the letter vav ('ו').
 *    - Also kubuts (\u05BB, 'u' vowel) is written as vav ('ו') in ktiv male.
 *    - Whenever any of these marks is present, writing a 'ו' in place of the mark (or after that consonant)
 *      is 100% valid modern Hebrew spelling and must be accepted!
 * 3. Ktiv Chaser (defective spelling without internal single vavs representing 'o' or 'u').
 */
export function expandHebrewVariants(input: string): string[] {
  if (!input) return [];
  const results = new Set<string>();

  const rawClean = input
    .toLowerCase()
    .replace(/[,;—–/\\.\'"״׳!?:()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawClean) return [];

  // 1. Raw stripped of all nikkud / ta'amim
  const stripped = rawClean.replace(/[\u0591-\u05C7]/g, '').trim();
  if (stripped) results.add(stripped);

  // 2. Convert holam / cholam / kamats katan / qubuts into vav ("ו")
  // Unicode holam: \u05B9, \u05BA; kamats katan: \u05C7; hataf kamats: \u05B3; qubuts: \u05BB
  const withVavForO = rawClean
    // Normalize any vav with holam (וֹ) -> just ו
    .replace(/\u05D5[\u0591-\u05C7]*/g, '\u05D5')
    // Replace any non-vav Hebrew consonant + diacritics with holam/o-sound/qubuts -> letter + vav
    .replace(/([\u05D0-\u05D4\u05D6-\u05EA])([^\u05D0-\u05EA\s]*?)([\u05B9\u05BA\u05C7\u05B3\u05BB])/g, (_match, letter) => letter + '\u05D5')
    .replace(/[\u0591-\u05C7]/g, '')
    .trim();

  if (withVavForO) results.add(withVavForO);

  // 3. Generate ktiv chaser form by dropping internal single vavs (representing o/u vowels)
  // E.g. בוקר -> בקר, תוכנית -> תכנית, לכתוב -> לכתב, חודש -> חדש, כול -> כל, שלום -> שלם
  // Do NOT drop double vav (וו) which is the consonant v / w (e.g. תקווה, צוות)
  // and only drop if inside a word (>2 letters, not at the beginning or end)
  const words = stripped.split(' ');
  const droppedVavWords = words.map(w => {
    if (w.length <= 2) return w;
    return w.replace(/(?<!^|\u05D5)\u05D5(?!\u05D5|$)/g, '');
  }).join(' ');

  if (droppedVavWords) results.add(droppedVavWords);

  return Array.from(results).filter(Boolean);
}

/**
 * Determines if two Hebrew strings match, taking into account:
 * - Direct equality (with or without nikkud)
 * - Holam vs. Vav ('ו') equivalence (user wrote 'ו' where holam was, or vice-versa)
 * - Ktiv Male vs. Ktiv Chaser (single internal vav for 'o' or 'u')
 */
export function areHebrewTextsEquivalent(userAnswer: string, expectedAnswer: string): boolean {
  if (!userAnswer || !expectedAnswer) return false;
  if (!isHebrewText(userAnswer) && !isHebrewText(expectedAnswer)) return false;

  const userClean = normalizeTranslationText(userAnswer);
  const expectedClean = normalizeTranslationText(expectedAnswer);

  if (userClean === expectedClean) return true;

  const userVariants = new Set(expandHebrewVariants(userAnswer));
  const expectedVariants = new Set(expandHebrewVariants(expectedAnswer));

  // Check if any variant of the user's answer matches any variant of the expected answer
  for (const u of userVariants) {
    if (expectedVariants.has(u)) return true;
  }

  // Also check if both without internal single vavs are identical
  const stripInternalVav = (s: string) => 
    s.split(' ').map(w => w.length > 2 ? w.replace(/(?<!^|\u05D5)\u05D5(?!\u05D5|$)/g, '') : w).join(' ');

  if (stripInternalVav(userClean) === stripInternalVav(expectedClean)) {
    return true;
  }

  return false;
}

/**
 * Strips English articles ('a ', 'an ', 'the ') and infinitive marker ('to ')
 * and Hebrew prefixes for fuzzy matching.
 */
export function stripGrammarMarkers(text: string): string {
  return text
    .replace(/^(to\s+|a\s+|an\s+|the\s+)/i, '')
    .replace(/(\s+to\s+|\s+a\s+|\s+an\s+|\s+the\s+)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein Distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Smart Client-Side Translation Checker
 * Evaluates whether the user's translation is valid:
 * 1. Accepts primary expected translation and all accepted alternatives/synonyms.
 * 2. If the user types any valid alternative (e.g. 'advancement' or 'progress' for 'development'), it is counted as correct.
 * 3. Ignores punctuation, misplaced commas, slashes, case, and Hebrew nikkud.
 * 4. Rejects true spelling mistakes (e.g. 'answr').
 * 5. Rejects inaccurate/unrelated words (e.g. 'question' for 'answer').
 */
export function checkTranslationLocal(
  userAnswer: string,
  expectedTranslation: string,
  promptWord?: string,
  alternativeTranslations?: string[]
): TranslationCheckResult {
  const rawUser = (userAnswer || '').trim();
  const rawExpected = (expectedTranslation || '').trim();

  if (!rawUser) {
    return {
      isCorrect: false,
      verdict: 'incorrect_meaning',
      feedback: 'No answer provided.',
      expectedTranslation: rawExpected,
      normalizedUserAnswer: '',
    };
  }

  // Quick 1: Exact case-insensitive match on raw trimmed input
  if (rawUser.toLowerCase() === rawExpected.toLowerCase()) {
    return {
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Spot on! Correct answer.',
      matchedSynonym: rawUser,
      expectedTranslation: rawExpected,
      normalizedUserAnswer: rawUser,
    };
  }

  // Quick 1b: Brackets equivalence (e.g. "Orange (fruit)" vs "Orange")
  // If the actual translation has something in brackets like 'Orange (fruit)',
  // always also count it correct without the thing in the brackets.
  const userNoBrackets = stripBracketedContent(rawUser);
  const expectedNoBrackets = stripBracketedContent(rawExpected);
  if (userNoBrackets && expectedNoBrackets) {
    if (userNoBrackets.toLowerCase() === expectedNoBrackets.toLowerCase()) {
      return {
        isCorrect: true,
        verdict: 'correct',
        feedback: 'Spot on! Correct answer.',
        matchedSynonym: userNoBrackets,
        expectedTranslation: rawExpected,
        normalizedUserAnswer: rawUser,
      };
    }
  }

  const cleanUser = normalizeTranslationText(rawUser);
  const cleanExpected = normalizeTranslationText(rawExpected);
  const userStripped = stripGrammarMarkers(cleanUser);
  const expectedStripped = stripGrammarMarkers(cleanExpected);

  const cleanUserNoB = normalizeTranslationText(userNoBrackets);
  const cleanExpectedNoB = normalizeTranslationText(expectedNoBrackets);
  const userNoBStripped = stripGrammarMarkers(cleanUserNoB);
  const expectedNoBStripped = stripGrammarMarkers(cleanExpectedNoB);

  // Quick 2: Exact normalized match (ignoring nikkud, punctuation, extra spaces, brackets)
  if (
    cleanUser === cleanExpected || 
    userStripped === expectedStripped ||
    (cleanUserNoB && cleanExpectedNoB && (cleanUserNoB === cleanExpectedNoB || userNoBStripped === expectedNoBStripped))
  ) {
    return {
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Spot on! Correct translation.',
      matchedSynonym: userNoBrackets || rawUser,
      expectedTranslation: rawExpected,
      normalizedUserAnswer: cleanUser,
    };
  }

  // Quick 3: Hebrew orthographic equivalence (Cholam 'o' vs Vav 'ו', Ktiv Male / Chaser)
  if (
    areHebrewTextsEquivalent(rawUser, rawExpected) || 
    (userNoBrackets && expectedNoBrackets && areHebrewTextsEquivalent(userNoBrackets, expectedNoBrackets))
  ) {
    return {
      isCorrect: true,
      verdict: 'correct',
      feedback: `Spot on! "${rawUser}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
      matchedSynonym: rawUser,
      expectedTranslation: rawExpected,
      normalizedUserAnswer: cleanUser,
    };
  }

  // Build the list of all acceptable base strings (from expected + alternativeTranslations + dictionary)
  const baseAcceptableStrings: string[] = [rawExpected];
  if (expectedNoBrackets && expectedNoBrackets !== rawExpected) {
    baseAcceptableStrings.push(expectedNoBrackets);
  }
  const extractedExpected = extractBracketedContent(rawExpected);
  extractedExpected.forEach(inside => {
    if (inside.length > 1 && !['m', 'v', 'n', 'f', 'noun', 'verb', 'adj', 'adv', 'formal', 'informal', 'slang', 'lit.'].includes(inside.toLowerCase())) {
      baseAcceptableStrings.push(inside);
    }
  });

  if (alternativeTranslations && Array.isArray(alternativeTranslations)) {
    alternativeTranslations.forEach(alt => {
      if (!alt) return;
      baseAcceptableStrings.push(alt);
      const altNoB = stripBracketedContent(alt);
      if (altNoB && altNoB !== alt) {
        baseAcceptableStrings.push(altNoB);
      }
      const insideAlts = extractBracketedContent(alt);
      insideAlts.forEach(inside => {
        if (inside.length > 1 && !['m', 'v', 'n', 'f', 'noun', 'verb', 'adj', 'adv', 'formal', 'informal', 'slang', 'lit.'].includes(inside.toLowerCase())) {
          baseAcceptableStrings.push(inside);
        }
      });
    });
  }

  // Also query the comprehensive bilingual vocabulary bank for prompt word and expected word
  if (promptWord) {
    const promptAlts = getBankAlternativesForWord(promptWord);
    if (promptAlts && promptAlts.length > 0) {
      baseAcceptableStrings.push(...promptAlts);
    }
  }
  const expectedAlts = getBankAlternativesForWord(rawExpected);
  if (expectedAlts && expectedAlts.length > 0) {
    baseAcceptableStrings.push(...expectedAlts);
  }

  // Also support legacy slash/comma-separated strings in case any exist
  const expandedParts: string[] = [];
  baseAcceptableStrings.forEach(str => {
    str.split(/[/,;|]/).forEach(p => {
      const trimmed = p.trim();
      if (trimmed.length > 0) {
        expandedParts.push(trimmed);
        const pNoB = stripBracketedContent(trimmed);
        if (pNoB && pNoB !== trimmed) {
          expandedParts.push(pNoB);
        }
      }
    });
  });

  const referenceOptions: string[] = [];
  expandedParts.forEach(part => {
    const norm = normalizeTranslationText(part);
    if (norm) {
      referenceOptions.push(norm);
      const stripped = stripGrammarMarkers(norm);
      if (stripped) referenceOptions.push(stripped);
      if (isHebrewText(part)) {
        expandHebrewVariants(part).forEach(v => {
          referenceOptions.push(v);
        });
      }
    }
  });

  // Collect all valid synonyms for all reference options
  const allAcceptedCandidates = new Set<string>();

  referenceOptions.forEach(opt => {
    allAcceptedCandidates.add(opt);
    const bareOpt = stripGrammarMarkers(opt);
    allAcceptedCandidates.add(bareOpt);
    if (isHebrewText(opt)) {
      expandHebrewVariants(opt).forEach(v => {
        allAcceptedCandidates.add(v);
        allAcceptedCandidates.add(stripGrammarMarkers(v));
      });
    }

    // Look up in synonym map
    if (SYNONYM_MAP[bareOpt]) {
      SYNONYM_MAP[bareOpt].forEach(syn => {
        const normSyn = normalizeTranslationText(syn);
        allAcceptedCandidates.add(normSyn);
        allAcceptedCandidates.add(stripGrammarMarkers(normSyn));
      });
    }
    if (SYNONYM_MAP[opt]) {
      SYNONYM_MAP[opt].forEach(syn => {
        const normSyn = normalizeTranslationText(syn);
        allAcceptedCandidates.add(normSyn);
        allAcceptedCandidates.add(stripGrammarMarkers(normSyn));
      });
    }
  });

  // Check dynamic custom translations approved by administrator
  const cleanPrompt = normalizeTranslationText(promptWord);
  const promptStripped = stripGrammarMarkers(cleanPrompt);
  const dynamicAlts = [
    ...(DYNAMIC_CUSTOM_TRANSLATIONS[cleanPrompt] || []),
    ...(DYNAMIC_CUSTOM_TRANSLATIONS[promptStripped] || []),
    ...(DYNAMIC_CUSTOM_TRANSLATIONS[cleanExpected] || []),
    ...(DYNAMIC_CUSTOM_TRANSLATIONS[expectedStripped] || []),
  ];
  dynamicAlts.forEach(dyn => {
    const normDyn = normalizeTranslationText(dyn);
    if (normDyn) {
      allAcceptedCandidates.add(normDyn);
      allAcceptedCandidates.add(stripGrammarMarkers(normDyn));
      if (isHebrewText(dyn)) {
        expandHebrewVariants(dyn).forEach(v => {
          allAcceptedCandidates.add(v);
          allAcceptedCandidates.add(stripGrammarMarkers(v));
        });
      }
    }
  });

  // Check if the user answer itself (or stripped or bracket-free) is in the accepted candidates
  const userForms = new Set<string>();
  if (cleanUser) userForms.add(cleanUser);
  if (userStripped) userForms.add(userStripped);
  if (cleanUserNoB) userForms.add(cleanUserNoB);
  if (userNoBStripped) userForms.add(userNoBStripped);

  for (const uf of userForms) {
    if (allAcceptedCandidates.has(uf)) {
      return {
        isCorrect: true,
        verdict: 'correct',
        feedback: `Accepted! "${rawUser}" is an accurate translation for ${promptWord ? `"${promptWord}"` : 'this word'}.`,
        matchedSynonym: rawUser,
        expectedTranslation: rawExpected,
        normalizedUserAnswer: cleanUser,
      };
    }
  }

  // Hebrew variant verification (e.g. writing 'ו' for cholam/o-sound, ktiv male/chaser)
  if (isHebrewText(rawUser) || isHebrewText(cleanExpected)) {
    const userVars = expandHebrewVariants(rawUser);
    for (const uv of userVars) {
      if (allAcceptedCandidates.has(uv)) {
        return {
          isCorrect: true,
          verdict: 'correct',
          feedback: `Accepted! "${rawUser}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
          matchedSynonym: rawUser,
          expectedTranslation: rawExpected,
          normalizedUserAnswer: cleanUser,
        };
      }
    }
    for (const candidate of Array.from(allAcceptedCandidates)) {
      if (areHebrewTextsEquivalent(rawUser, candidate)) {
        return {
          isCorrect: true,
          verdict: 'correct',
          feedback: `Accepted! "${rawUser}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
          matchedSynonym: candidate,
          expectedTranslation: rawExpected,
          normalizedUserAnswer: cleanUser,
        };
      }
    }
  }

  // Also check if any sub-part of the user's input matches
  const rawUserParts = rawUser
    .split(/[/,;|]/)
    .map(p => normalizeTranslationText(p))
    .filter(p => p.length > 0);

  for (const userPart of rawUserParts) {
    const strippedPart = stripGrammarMarkers(userPart);
    if (allAcceptedCandidates.has(userPart) || allAcceptedCandidates.has(strippedPart)) {
      return {
        isCorrect: true,
        verdict: 'correct',
        feedback: `Accepted! "${rawUser}" includes the valid translation "${userPart}".`,
        matchedSynonym: userPart,
        expectedTranslation: rawExpected,
        normalizedUserAnswer: cleanUser,
      };
    }
  }

  // Check multi-word phrase contains or sub-word exact match
  for (const candidate of Array.from(allAcceptedCandidates)) {
    if (candidate.length >= 3 && (cleanUser === candidate || userStripped === candidate)) {
      return {
        isCorrect: true,
        verdict: 'correct',
        feedback: `Accepted! "${rawUser}" matches accepted translation "${candidate}".`,
        matchedSynonym: candidate,
        expectedTranslation: rawExpected,
        normalizedUserAnswer: cleanUser,
      };
    }
  }

  // Check for Spelling Mistakes (Must be rejected as wrong!)
  let suspectedSpellingTarget: string | null = null;
  for (const candidate of Array.from(allAcceptedCandidates)) {
    // If words match when bracketed text is omitted, it is 100% correct, never a spelling error!
    const candNoB = stripBracketedContent(candidate);
    if (userNoBrackets && candNoB) {
      const cleanCandNoB = normalizeTranslationText(candNoB);
      if (
        userNoBrackets.toLowerCase() === candNoB.toLowerCase() ||
        cleanUserNoB === cleanCandNoB ||
        userNoBStripped === stripGrammarMarkers(cleanCandNoB)
      ) {
        return {
          isCorrect: true,
          verdict: 'correct',
          feedback: `Spot on! Correct answer.`,
          matchedSynonym: userNoBrackets,
          expectedTranslation: rawExpected,
          normalizedUserAnswer: cleanUser,
        };
      }
    }

    // If words are Hebrew equivalents (e.g. writing 'ו' for holam/o-sound), NEVER flag as spelling error!
    if (isHebrewText(rawUser) && areHebrewTextsEquivalent(rawUser, candidate)) {
      return {
        isCorrect: true,
        verdict: 'correct',
        feedback: `Accepted! "${rawUser}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
        matchedSynonym: candidate,
        expectedTranslation: rawExpected,
        normalizedUserAnswer: cleanUser,
      };
    }

    const dist = getLevenshteinDistance(userStripped, stripGrammarMarkers(candidate));
    if (dist > 0 && dist <= (candidate.length >= 6 ? 2 : 1)) {
      suspectedSpellingTarget = candidate;
      break;
    }
  }

  if (suspectedSpellingTarget) {
    return {
      isCorrect: false,
      verdict: 'incorrect_spelling',
      feedback: `Spelling error: "${rawUser}" is misspelled (expected "${suspectedSpellingTarget}"). Spelling mistakes count as incorrect.`,
      expectedTranslation: rawExpected,
      normalizedUserAnswer: cleanUser,
    };
  }

  // Reject Loose or Inaccurate translations
  return {
    isCorrect: false,
    verdict: 'incorrect_meaning',
    feedback: `Incorrect translation. Expected: "${rawExpected}". "${rawUser}" is not an accurate translation.`,
    expectedTranslation: rawExpected,
    normalizedUserAnswer: cleanUser,
  };
}

/**
 * Async Smart Translation Checker (Calls server AI endpoint with local fallback)
 */
export async function verifyTranslationSmart(params: {
  userTranslation: string;
  expectedTranslation: string;
  alternativeTranslations?: string[];
  promptWord?: string;
  targetWord?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  knownLanguage?: string;
  direction?: 'target_to_known' | 'known_to_target';
  level?: string;
}): Promise<TranslationCheckResult> {
  const promptWord = params.promptWord || params.targetWord || '';
  const sourceLang = params.sourceLanguage || (params.direction === 'known_to_target' ? params.knownLanguage : params.targetLanguage) || 'target';
  const targetLang = params.targetLanguage || params.knownLanguage || 'known';

  const localResult = checkTranslationLocal(
    params.userTranslation,
    params.expectedTranslation,
    promptWord,
    params.alternativeTranslations
  );

  // If local check already recognized a spot-on exact or synonym match, we can return it immediately or verify with backend
  if (localResult.isCorrect) {
    return localResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);

    const response = await fetch('/api/check-translation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        targetWord: promptWord,
        expectedTranslation: params.expectedTranslation,
        alternativeTranslations: params.alternativeTranslations,
        userTranslation: params.userTranslation,
        targetLanguage: sourceLang,
        knownLanguage: targetLang,
        direction: params.direction || 'target_to_known',
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.isCorrect === 'boolean') {
        return {
          isCorrect: data.isCorrect,
          verdict: data.verdict || (data.isCorrect ? 'correct' : 'incorrect_meaning'),
          feedback: data.feedback || localResult.feedback,
          matchedSynonym: data.matchedSynonym || (data.isCorrect ? params.userTranslation : undefined),
          expectedTranslation: params.expectedTranslation,
          normalizedUserAnswer: normalizeTranslationText(params.userTranslation),
        };
      }
    }
  } catch (err) {
    console.warn('Backend translation verification fallback to local:', err);
  }

  return localResult;
}

