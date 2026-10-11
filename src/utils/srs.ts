import { CEFRLevel, StudyCard, WordCategory, WordItem, WordProgress, UserProfile } from '../types';
import { normalizeTranslationText } from './translationChecker';
import { getVocabularyForCefrBand, getVocabularyForNumericLevel, getLocalizedWordItem } from '../data/vocabularyBank';

export const CATEGORY_ORDER: WordCategory[] = ['red', 'orange', 'yellow', 'green', 'blue'];

export const CATEGORY_DETAILS: Record<WordCategory, {
  name: string;
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeClass: string;
  pillClass: string;
  dotColor: string;
}> = {
  red: {
    name: 'Red',
    label: 'Nieuw',
    description: 'Nieuwe woorden',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-300',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    pillClass: 'bg-rose-500 text-white',
    dotColor: 'bg-rose-500',
  },
  orange: {
    name: 'Orange',
    label: 'Geleerd',
    description: 'Geleerde woorden',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    pillClass: 'bg-sky-500 text-white',
    dotColor: 'bg-sky-500',
  },
  yellow: {
    name: 'Yellow',
    label: 'Geleerd',
    description: 'Geleerde woorden',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    pillClass: 'bg-sky-500 text-white',
    dotColor: 'bg-sky-500',
  },
  green: {
    name: 'Green',
    label: 'Geleerd',
    description: 'Geleerde woorden',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    pillClass: 'bg-sky-500 text-white',
    dotColor: 'bg-sky-500',
  },
  blue: {
    name: 'Blue',
    label: 'Geleerd',
    description: 'Geleerde woorden',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    pillClass: 'bg-sky-600 text-white',
    dotColor: 'bg-sky-500',
  },
};

/**
 * Derives or validates the category of a word
 */
export function getWordCategory(progress?: WordProgress): WordCategory {
  if (!progress) return 'red';
  if (progress.category && CATEGORY_ORDER.includes(progress.category)) {
    return progress.category;
  }
  const cleanCount = progress.cleanSessionsCount ?? progress.consecutiveCorrect ?? 0;
  if (cleanCount >= 4) return 'blue';
  if (cleanCount === 3) return 'green';
  if (cleanCount === 2) return 'yellow';
  if (cleanCount === 1) return 'orange';
  return 'red';
}

/**
 * Returns the next higher category in the hierarchy
 */
export function getNextCategory(current: WordCategory): WordCategory {
  switch (current) {
    case 'red':
      return 'orange';
    case 'orange':
      return 'yellow';
    case 'yellow':
      return 'green';
    case 'green':
      return 'blue';
    case 'blue':
      return 'blue';
    default:
      return 'orange';
  }
}

/**
 * Calculates updated word progress and category promotion according to the rule:
 * All finished words are promoted to the next category in the hierarchy,
 * EXCEPT if they were answered incorrectly more than 3 times (mistakesCount > 3).
 */
export function calculateWordUpdate(
  current: WordProgress | undefined,
  word: WordItem,
  wasFirstTryClean: boolean,
  mistakesCount: number,
  userAnswer?: string,
  sessionHardScore?: number,
  isReviewWord?: boolean
): WordProgress {
  const now = Date.now();
  const currentCategory = current ? getWordCategory(current) : 'red';
  const timesReviewed = (current?.timesReviewed || 0) + 1;
  const isPromoted = mistakesCount <= 3;
  const timesCorrect = (current?.timesCorrect || 0) + (isPromoted ? 1 : 0);
  const timesIncorrect = (current?.timesIncorrect || 0) + (mistakesCount > 0 ? mistakesCount : 0);
  const consecutiveCorrect = isPromoted ? (current?.consecutiveCorrect || 0) + 1 : 0;
  
  // Category transition rule:
  // Words are either 'red' (new / not yet done in a daily session) or 'blue' (learned)!
  // Once a word is practiced in a daily session, it becomes 'blue' (learned).
  const nextCategory: WordCategory = isPromoted ? 'blue' : (currentCategory === 'blue' ? 'blue' : 'red');
  let cleanSessionsCount = (current?.cleanSessionsCount || 0) + (isPromoted ? 1 : 0);
  cleanSessionsCount = Math.min(50, Math.max(0, cleanSessionsCount));

  // Hierarchy 2: Hard difficulty points system
  // Every mistake adds +1 point; clean runs in review subtract points (-2 for review words).
  const historyMistakes = current?.history ? current.history.filter(h => !h.wasCorrect).length : 0;
  const startingHardScore = Math.max(
    current?.hardScore ?? 0,
    current?.timesIncorrect ?? 0,
    historyMistakes,
    current?.isHard ? 2 : 0
  );

  let finalHardScore: number;
  if (mistakesCount > 0) {
    finalHardScore = startingHardScore + mistakesCount;
  } else if (sessionHardScore !== undefined && sessionHardScore > 0) {
    finalHardScore = sessionHardScore;
  } else if (isReviewWord) {
    // Review word done without mistakes: -2 hard points
    finalHardScore = wasFirstTryClean ? Math.max(0, startingHardScore - 2) : startingHardScore;
  } else {
    // New words: no minus points when done cleanly
    finalHardScore = startingHardScore;
  }

  // A word is flagged as Hard if it has accumulated error points in Hierarchy 2
  const isHard = finalHardScore > 0 || mistakesCount > 0;

  // Difficulty score 0 to 10 (higher means harder, needs more frequent review)
  let difficultyScore = current?.difficultyScore ?? 5.0;

  if (!isPromoted || isHard) {
    difficultyScore = Math.min(10, Math.max(difficultyScore + (isPromoted ? 0.5 : 2.0), finalHardScore));
  } else {
    difficultyScore = Math.max(0, difficultyScore - (wasFirstTryClean ? 1.5 : 0.8));
  }

  // Interval in days based on consecutive successes
  let intervalDays = 1;
  if (!isPromoted || isHard) {
    intervalDays = 0.2; // Review again soon
  } else {
    intervalDays = Math.max(3, (consecutiveCorrect + 1) * 3);
  }

  const nextReviewAt = now + intervalDays * 24 * 60 * 60 * 1000;

  const historyEntry = {
    timestamp: now,
    wasCorrect: isPromoted,
    userAnswer: userAnswer || (wasFirstTryClean ? 'Clean 1st try' : `${mistakesCount} mistake(s)`),
  };

  const history = [...(current?.history || []), historyEntry].slice(-20);

  return {
    wordId: word.id,
    targetWord: word.targetWord,
    translation: word.translation,
    alternativeTranslations: word.alternativeTranslations,
    transliteration: word.transliteration,
    partOfSpeech: word.partOfSpeech,
    exampleTarget: word.exampleTarget,
    exampleTranslation: word.exampleTranslation,
    level: word.level,
    numericLevel: word.numericLevel,
    languagePairKey: word.languagePairKey,
    category: nextCategory,
    cleanSessionsCount,
    timesReviewed,
    timesCorrect,
    timesIncorrect,
    consecutiveCorrect,
    isHard,
    hardScore: finalHardScore,
    difficultyScore,
    firstLearnedAt: current?.firstLearnedAt || current?.history?.[0]?.timestamp || now,
    introducedAt: current?.introducedAt || current?.firstLearnedAt || current?.history?.[0]?.timestamp || now,
    lastReviewedAt: now,
    nextReviewAt,
    intervalDays,
    history,
    manuallyLearned: false,
  };
}

/**
 * Determines whether a word was actually studied/learned through a daily or review session,
 * as opposed to being manually set to blue in the vocab library.
 */
export function isWordLearnedInSession(progress?: WordProgress): boolean {
  if (!progress) return false;
  // If explicitly flagged as manual
  if (progress.manuallyLearned === true) return false;
  // If explicitly flagged as session
  if (progress.manuallyLearned === false) {
    return (progress.timesReviewed ?? 0) > 0 || (progress.history?.length ?? 0) > 0;
  }
  // For legacy data where manuallyLearned is undefined:
  // 1) History entries with actual userAnswer (e.g. "Clean 1st try", "1 mistake(s)", or user typed answer)
  const hasSessionHistory = progress.history?.some((h) => Boolean(h.userAnswer));
  if (hasSessionHistory) return true;

  // 2) Errors made in sessions
  if ((progress.timesIncorrect ?? 0) > 0 || (progress.hardScore ?? 0) > 0 || progress.isHard) {
    return true;
  }

  // 3) Intermediate stages (orange, yellow, green) are only reachable via session progression
  if (progress.category === 'orange' || progress.category === 'yellow' || progress.category === 'green') {
    return true;
  }

  // 4) Multiple reviews or timestamps
  if ((progress.timesReviewed ?? 0) > 1 || (progress.history?.length ?? 0) > 1) {
    return true;
  }

  // If cleanSessionsCount >= 4 and category is blue with single or empty history without userAnswer,
  // it was previously set manually in WordBankView.
  return false;
}

/**
 * Checks whether a level is completed for a user (either exam passed or advanced past the level).
 */
export function isLevelCompleteForUser(profile: UserProfile | null | undefined, levelNumber: number): boolean {
  if (!profile) return false;
  if (profile.passedExams?.[levelNumber]) return true;
  const userNumLevel = profile.numericLevel || 1;
  if (userNumLevel > levelNumber) return true;
  return false;
}

/**
 * Validates whether a word item or progress object belongs to the specified target language.
 * Prevents cross-contamination where words from Hebrew leak into Russian, Dutch, etc.
 */
export function isWordForTargetLanguage(word?: Partial<WordProgress> | Partial<WordItem> | null, targetLang?: string): boolean {
  if (!word) return false;
  const cleanLang = (targetLang || 'he').toLowerCase().trim();

  // 1. Hebrew character script check
  if (cleanLang !== 'he' && word.targetWord && /[\u0590-\u05FF]/.test(word.targetWord)) {
    return false;
  }

  // 2. Cyrillic character script check
  if (cleanLang !== 'ru' && word.targetWord && /[\u0400-\u04FF]/.test(word.targetWord)) {
    return false;
  }

  // 3. languagePairKey check
  if (word.languagePairKey && typeof word.languagePairKey === 'string') {
    const langPrefix = word.languagePairKey.split('-')[0].toLowerCase().trim();
    if (langPrefix && langPrefix !== cleanLang) {
      return false;
    }
  }

  // 4. Word ID prefix check
  const wId = (word as any)?.wordId || (word as any)?.id;
  if (wId && typeof wId === 'string' && wId.includes('-')) {
    const idPrefix = wId.split('-')[0].toLowerCase().trim();
    const knownCodes = ['he', 'ru', 'es', 'fr', 'de', 'nl', 'it', 'ar', 'fa', 'uk', 'pt', 'ja', 'ko'];
    if (knownCodes.includes(idPrefix) && idPrefix !== cleanLang) {
      return false;
    }
  }

  return true;
}

/**
  * Sanitizes a word progress object to ensure cleanSessionsCount and other metrics
  * cannot contain corrupted large numbers (e.g. from timestamp differences).
  */
export function sanitizeWordProgress(wp: WordProgress): WordProgress {
  if (!wp) return wp;
  let cleanSessionsCount = wp.cleanSessionsCount ?? 0;
  if (cleanSessionsCount > 50) {
    cleanSessionsCount = wp.category === 'blue' ? 4 : Math.min(4, wp.timesCorrect || 0);
  } else if (cleanSessionsCount < 0) {
    cleanSessionsCount = 0;
  }
  return {
    ...wp,
    cleanSessionsCount,
  };
}

/**
 * Builds a 10-word Study Session adhering to the user's explicit specification:
 * - 4 new words from the RED category (unstudied)
 * - 3 ORANGE words (1 session done)
 * - 2 YELLOW words (2 sessions done)
 * - 1 GREEN word (3+ sessions done)
 * 
 * If a category has fewer words than requested (e.g. brand new user), 
 * it backfills gracefully from earlier tiers (Red or Orange) so the session always contains 10 words.
 */
export function buildStudySessionBatch(
  allCandidateWords: WordItem[],
  userWordsProgress: Record<string, WordProgress>,
  targetTotal = 10,
  targetLanguage = 'he',
  knownLanguage = 'en'
): StudyCard[] {
  const now = Date.now();

  // Helper to compute canonical target word key (stripping vowels/niqqud)
  const getCanonicalKey = (targetWord: string, id: string) => {
    const norm = normalizeTranslationText(targetWord);
    return norm || id.trim().toLowerCase();
  };

  // 1. Group all available candidate words into the 5 categories
  const categoryBuckets: Record<WordCategory, Array<{ word: WordItem; progress?: WordProgress }>> = {
    red: [],
    orange: [],
    yellow: [],
    green: [],
    blue: [],
  };

  // Build lookup of studied words by both wordId and canonical target word
  const studiedMap = new Map<string, WordProgress>();
  const studiedByTarget = new Map<string, WordProgress>();
  Object.values(userWordsProgress || {}).forEach(p => {
    studiedMap.set(p.wordId, p);
    const key = getCanonicalKey(p.targetWord, p.wordId);
    studiedByTarget.set(key, p);
  });

  const seenBucketTargetKeys = new Set<string>();

  // Sort candidate words into buckets, matching any existing progress
  allCandidateWords.forEach(rawWord => {
    const word = getLocalizedWordItem(rawWord, targetLanguage, knownLanguage);
    const key = getCanonicalKey(word.targetWord, word.id);
    if (seenBucketTargetKeys.has(key)) return;
    seenBucketTargetKeys.add(key);

    const progress = studiedMap.get(word.id) || studiedByTarget.get(key);
    if (!progress) {
      // Not yet studied = RED category
      categoryBuckets.red.push({ word, progress: undefined });
    } else {
      const cat = getWordCategory(progress);
      categoryBuckets[cat].push({ word, progress });
    }
  });

  // Sorter for review buckets (Orange, Yellow, Green, Blue):
  // Prioritize hard words, overdue words, and least recently reviewed words
  const sortReviewBucket = (items: Array<{ word: WordItem; progress?: WordProgress }>) => {
    return items.sort((a, b) => {
      const pA = a.progress;
      const pB = b.progress;
      if (!pA || !pB) return 0;

      // 1. Hard words first
      if (pA.isHard !== pB.isHard) return pA.isHard ? -1 : 1;

      // 2. Overdue first
      const overdueA = now - pA.nextReviewAt;
      const overdueB = now - pB.nextReviewAt;
      if (Math.abs(overdueA - overdueB) > 1000 * 60 * 60 * 12) {
        return overdueB - overdueA;
      }

      // 3. Difficulty score
      if (Math.abs(pA.difficultyScore - pB.difficultyScore) > 1) {
        return pB.difficultyScore - pA.difficultyScore;
      }

      // 4. Oldest review
      return pA.lastReviewedAt - pB.lastReviewedAt;
    });
  };

  // Sort each review bucket
  sortReviewBucket(categoryBuckets.orange);
  sortReviewBucket(categoryBuckets.yellow);
  sortReviewBucket(categoryBuckets.green);
  sortReviewBucket(categoryBuckets.blue);

  // Shuffle Red bucket so new words are fresh and randomized
  categoryBuckets.red.sort(() => Math.random() - 0.5);

  const selectedCards: StudyCard[] = [];
  const selectedWordIds = new Set<string>();
  const selectedCanonicalKeys = new Set<string>();

  const pickFromBucket = (category: WordCategory, count: number, forceCategory?: WordCategory) => {
    let picked = 0;
    const bucket = categoryBuckets[category];
    for (const item of bucket) {
      if (picked >= count) break;
      const canonicalKey = getCanonicalKey(item.word.targetWord, item.word.id);
      if (!selectedWordIds.has(item.word.id) && !selectedCanonicalKeys.has(canonicalKey)) {
        selectedWordIds.add(item.word.id);
        selectedCanonicalKeys.add(canonicalKey);
        const cardCategory = forceCategory || (category === 'red' ? 'red' : 'blue');
        const isNew = cardCategory === 'red';
        selectedCards.push({
          word: item.word,
          category: cardCategory,
          isNew,
          progress: item.progress,
        });
        picked++;
      }
    }
    return picked;
  };

  // 4 New words (Red) and 6 Repetition / Learned words (Blue)
  const redTarget = 4;
  const reviewTarget = 6;

  pickFromBucket('red', redTarget, 'red');

  // Pick 6 review words from studied categories (blue, green, yellow, orange)
  const reviewCategories: WordCategory[] = ['blue', 'green', 'yellow', 'orange'];
  for (const cat of reviewCategories) {
    if (selectedCards.length >= targetTotal) break;
    const currentReviewCount = selectedCards.filter(c => !c.isNew).length;
    if (currentReviewCount >= reviewTarget) break;
    const needed = reviewTarget - currentReviewCount;
    pickFromBucket(cat, needed, 'blue');
  }

  // Step 2: Backfill if any category had fewer words than needed
  if (selectedCards.length < targetTotal) {
    pickFromBucket('red', targetTotal - selectedCards.length, 'red');
  }
  for (const cat of reviewCategories) {
    if (selectedCards.length >= targetTotal) break;
    pickFromBucket(cat, targetTotal - selectedCards.length, 'blue');
  }

  // If still fewer than target (e.g. tiny seed dataset), cycle through candidate words
  if (selectedCards.length < targetTotal && allCandidateWords.length > 0) {
    for (const cand of allCandidateWords) {
      if (selectedCards.length >= targetTotal) break;
      const canonicalKey = getCanonicalKey(cand.targetWord, cand.id);
      if (!selectedWordIds.has(cand.id) && !selectedCanonicalKeys.has(canonicalKey)) {
        selectedWordIds.add(cand.id);
        selectedCanonicalKeys.add(canonicalKey);
        const progress = studiedMap.get(cand.id) || studiedByTarget.get(canonicalKey);
        const cat = getWordCategory(progress);
        const hasPriorReview = Boolean(
          progress && (
            (progress.timesReviewed ?? 0) > 0 ||
            (progress.cleanSessionsCount ?? 0) > 0 ||
            (progress.history && progress.history.length > 0)
          )
        );
        selectedCards.push({
          word: cand,
          category: cat,
          isNew: cat === 'red' && !hasPriorReview,
          progress,
        });
      }
    }
  }

  // Order session: Red words first, then Orange, then Yellow, then Green/Blue
  // This gives an intuitive progression from recognition/learning to rapid recall
  const orderWeight: Record<WordCategory, number> = {
    red: 1,
    orange: 2,
    yellow: 3,
    green: 4,
    blue: 5,
  };

  return selectedCards
    .sort((a, b) => (orderWeight[a.category] || 99) - (orderWeight[b.category] || 99))
    .slice(0, targetTotal)
    .map(c => ({
      ...c,
      word: getLocalizedWordItem(c.word, targetLanguage, knownLanguage),
    }));
}

const CEFR_HIERARCHY_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Hiërarchie 1 = Cirkel van woorden die je lange tijd niet meer hebt geoefend.
 * Per level gerangschikt op welke woorden het langst niet zijn overhoord.
 * Levels die je hebt geskipt tellen ook mee.
 * Ronde-opbouw (cirkel):
 * 1. Het woord van A1 dat je het langst niet hebt overhoort,
 * 2. Het woord van A2 dat je het langst niet hebt overhoort,
 * 3. Het woord van B1 dat je het langst niet hebt overhoort (indien onder jouw niveau),
 * ... etc. voor alle levels onder jouw niveau.
 * Dan het 2e woord van A1, 2e woord van A2, etc. in een doorlopende cirkel.
 */
export function getRustyRecencyHierarchy(
  targetLanguage: string,
  userLevel: CEFRLevel,
  userWordsProgress: Record<string, WordProgress>,
  knownLanguage: string = 'en'
): WordItem[] {
  const userIdx = CEFR_HIERARCHY_ORDER.indexOf(userLevel);
  // Alleen de levels onder jouw niveau.
  // Indien user op A1 zit (userIdx === 0), zijn er geen lagere levels, dus nemen we ['A1'].
  const eligibleLevels: CEFRLevel[] = userIdx > 0 
    ? CEFR_HIERARCHY_ORDER.slice(0, userIdx) 
    : ['A1'];

  // Map of user progress for fast lookup
  const progressMap = new Map<string, WordProgress>();
  const progressByWord = new Map<string, WordProgress>();
  Object.values(userWordsProgress || {}).forEach(p => {
    progressMap.set(p.wordId, p);
    const key = normalizeTranslationText(p.targetWord) || p.targetWord.toLowerCase().trim();
    progressByWord.set(key, p);
  });

  // For each eligible level, retrieve all words in that CEFR band and sort by longest time not reviewed
  const levelWordLists: WordItem[][] = eligibleLevels.map(lvl => {
    const bandWords = getVocabularyForCefrBand(targetLanguage, lvl, knownLanguage);

    // Also include any user-studied words belonging to this level
    const userWordsForLevel = Object.values(userWordsProgress || {}).filter(p => p.level === lvl);
    const combinedMap = new Map<string, WordItem>();

    bandWords.forEach(w => {
      const localized = getLocalizedWordItem(w, targetLanguage, knownLanguage);
      combinedMap.set(localized.id, localized);
    });

    userWordsForLevel.forEach(p => {
      if (!combinedMap.has(p.wordId)) {
        const localized = getLocalizedWordItem({
          id: p.wordId,
          targetWord: p.targetWord,
          translation: p.translation,
          alternativeTranslations: p.alternativeTranslations,
          transliteration: p.transliteration,
          partOfSpeech: p.partOfSpeech,
          exampleTarget: p.exampleTarget,
          exampleTranslation: p.exampleTranslation,
          level: p.level,
          numericLevel: p.numericLevel,
          languagePairKey: p.languagePairKey,
          category: p.category,
        }, targetLanguage, knownLanguage);
        combinedMap.set(p.wordId, localized);
      }
    });

    const words = Array.from(combinedMap.values());

    // Sort: words longest not reviewed come FIRST (lastReviewedAt = 0 or undefined first, then older timestamps)
    words.sort((a, b) => {
      const pA = progressMap.get(a.id) || progressByWord.get(normalizeTranslationText(a.targetWord) || a.targetWord.toLowerCase().trim());
      const pB = progressMap.get(b.id) || progressByWord.get(normalizeTranslationText(b.targetWord) || b.targetWord.toLowerCase().trim());

      const reviewedA = pA && (pA.timesReviewed ?? 0) > 0 ? (pA.lastReviewedAt || 0) : 0;
      const reviewedB = pB && (pB.timesReviewed ?? 0) > 0 ? (pB.lastReviewedAt || 0) : 0;

      if (reviewedA !== reviewedB) {
        return reviewedA - reviewedB; // 0 or oldest timestamp first
      }

      return a.id.localeCompare(b.id);
    });

    return words;
  });

  // Circular round-robin interleave across the eligible levels:
  // [A1[0], A2[0], B1[0], A1[1], A2[1], B1[1], ...]
  const circularResult: WordItem[] = [];
  const maxWordsInAnyLevel = Math.max(...levelWordLists.map(list => list.length), 0);
  const seenKeys = new Set<string>();

  for (let i = 0; i < maxWordsInAnyLevel; i++) {
    for (let l = 0; l < levelWordLists.length; l++) {
      const word = levelWordLists[l][i];
      if (word) {
        const key = normalizeTranslationText(word.targetWord) || word.targetWord.toLowerCase().trim();
        if (!seenKeys.has(key) && !seenKeys.has(word.id)) {
          seenKeys.add(key);
          seenKeys.add(word.id);
          circularResult.push(getLocalizedWordItem(word, targetLanguage, knownLanguage));
        }
      }
    }
  }

  return circularResult;
}

/**
 * Hiërarchie 2 = De lastigste woorden (Hard hiërarchie).
 * Houdt met punten bij hoe vaak de student een woord niet weet
 * (alle drie de rondes - multiple choice / engels / hebreeuws meegeteld).
 * Fout beantwoord = +1 punt in de hard hiërarchie.
 * Goed beantwoord = -1 punt (minimaal 0).
 * Het woord dat het vaakst 'fout' beantwoord wordt staat bovenaan de hiërarchie.
 */
export function getHardDifficultyHierarchy(
  userWordsProgress: Record<string, WordProgress>
): WordProgress[] {
  const allProgress = Object.values(userWordsProgress || {});

  // Calculate net hardScore for each word
  const withPoints = allProgress.map(p => {
    const historyMistakes = p.history ? p.history.filter(h => !h.wasCorrect).length : 0;
    const points = Math.max(
      p.hardScore ?? 0,
      p.timesIncorrect ?? 0,
      historyMistakes,
      p.isHard ? 2 : 0
    );
    return {
      progress: p,
      points,
    };
  });

  // Filter words that have difficulty points > 0 or are flagged hard
  const hardCandidates = withPoints.filter(item => item.points > 0 || item.progress.isHard || (item.progress.timesIncorrect ?? 0) > 0);

  // Sort descending: highest points at the top of the hierarchy!
  hardCandidates.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points; // Highest error points first
    }
    const mistakesDiff = (b.progress.timesIncorrect || 0) - (a.progress.timesIncorrect || 0);
    if (mistakesDiff !== 0) return mistakesDiff;

    // Tie-breaker: most recently reviewed
    return (b.progress.lastReviewedAt || 0) - (a.progress.lastReviewedAt || 0);
  });

  return hardCandidates.map(c => c.progress);
}

/**
 * Builds a "Review Rusty Words" session using the dual hierarchies:
 * - Hierarchy 1: Rusty recency circle per level (levels below user level)
 * - Hierarchy 2: Hard difficulty points hierarchy (most error points first)
 *
 * For e.g. 10 words: top 5 from Hierarchy 1 and top 5 from Hierarchy 2.
 * Strictly interleaved "om en om":
 * 1. Het woord dat je lang niet meer hebt gedaan (Rusty #1)
 * 2. Het woord dat je het vaakst fout doet (Hard #1)
 * 3. Het twee na langst niet gedaane woord (Rusty #2)
 * 4. Het twee na vaakst fout gedaane woord (Hard #2)
 * ... etc.
 */
export function buildRustyReviewBatchWithHierarchies(
  targetLanguage: string,
  userLevel: CEFRLevel,
  userWordsProgress: Record<string, WordProgress>,
  targetTotal: number = 10,
  knownLanguage: string = 'en'
): StudyCard[] {
  const quota1 = Math.ceil(targetTotal / 2);
  const quota2 = targetTotal - quota1;

  // 1. Get ordered lists for both hierarchies
  const rustyList = getRustyRecencyHierarchy(targetLanguage, userLevel, userWordsProgress, knownLanguage);
  const hardList = getHardDifficultyHierarchy(userWordsProgress);

  const selectedWordIds = new Set<string>();
  const selectedCanonicalKeys = new Set<string>();

  const getCanonicalKey = (w: string, id: string) => {
    const norm = normalizeTranslationText(w);
    return norm || id.trim().toLowerCase();
  };

  // 2. Pick top unique words from Hierarchy 1 (Rusty recency circle)
  const pickedRusty: WordItem[] = [];
  for (const word of rustyList) {
    if (pickedRusty.length >= quota1) break;
    const key = getCanonicalKey(word.targetWord, word.id);
    if (!selectedWordIds.has(word.id) && !selectedCanonicalKeys.has(key)) {
      selectedWordIds.add(word.id);
      selectedCanonicalKeys.add(key);
      pickedRusty.push(getLocalizedWordItem(word, targetLanguage, knownLanguage));
    }
  }

  // 3. Pick top unique words from Hierarchy 2 (Hard difficulty points)
  const pickedHard: WordItem[] = [];
  for (const p of hardList) {
    if (pickedHard.length >= quota2) break;
    const key = getCanonicalKey(p.targetWord, p.wordId);
    if (!selectedWordIds.has(p.wordId) && !selectedCanonicalKeys.has(key)) {
      selectedWordIds.add(p.wordId);
      selectedCanonicalKeys.add(key);
      const localizedHard = getLocalizedWordItem({
        id: p.wordId,
        targetWord: p.targetWord,
        translation: p.translation,
        alternativeTranslations: p.alternativeTranslations,
        transliteration: p.transliteration,
        partOfSpeech: p.partOfSpeech,
        exampleTarget: p.exampleTarget,
        exampleTranslation: p.exampleTranslation,
        level: p.level,
        numericLevel: p.numericLevel,
        languagePairKey: p.languagePairKey,
        category: p.category,
      }, targetLanguage, knownLanguage);
      pickedHard.push(localizedHard);
    }
  }

  // 4. If Hard list had fewer items than quota (e.g. beginner with < 5 hard words),
  // backfill the remaining quota from Hierarchy 1:
  if (pickedRusty.length + pickedHard.length < targetTotal) {
    for (const word of rustyList) {
      if (pickedRusty.length + pickedHard.length >= targetTotal) break;
      const key = getCanonicalKey(word.targetWord, word.id);
      if (!selectedWordIds.has(word.id) && !selectedCanonicalKeys.has(key)) {
        selectedWordIds.add(word.id);
        selectedCanonicalKeys.add(key);
        pickedRusty.push(getLocalizedWordItem(word, targetLanguage, knownLanguage));
      }
    }
  }

  // 5. Interleave strictly "om en om":
  // Index 0: Rusty #1
  // Index 1: Hard #1
  // Index 2: Rusty #2
  // Index 3: Hard #2
  // ...
  const interleavedWords: WordItem[] = [];
  let rIdx = 0;
  let hIdx = 0;

  while (interleavedWords.length < targetTotal && (rIdx < pickedRusty.length || hIdx < pickedHard.length)) {
    if (rIdx < pickedRusty.length) {
      interleavedWords.push(pickedRusty[rIdx++]);
    }
    if (interleavedWords.length < targetTotal && hIdx < pickedHard.length) {
      interleavedWords.push(pickedHard[hIdx++]);
    }
  }

  // 6. Fallback if still under targetTotal: pull from active level band
  if (interleavedWords.length < targetTotal) {
    const currentBand = getVocabularyForCefrBand(targetLanguage, userLevel, knownLanguage);
    for (const w of currentBand) {
      if (interleavedWords.length >= targetTotal) break;
      const key = getCanonicalKey(w.targetWord, w.id);
      if (!selectedWordIds.has(w.id) && !selectedCanonicalKeys.has(key)) {
        selectedWordIds.add(w.id);
        selectedCanonicalKeys.add(key);
        interleavedWords.push(getLocalizedWordItem(w, targetLanguage, knownLanguage));
      }
    }
  }

  // 7. Map to StudyCard array
  return interleavedWords.slice(0, targetTotal).map(rawWord => {
    const word = getLocalizedWordItem(rawWord, targetLanguage, knownLanguage);
    const progress = userWordsProgress[word.id] || Object.values(userWordsProgress || {}).find(p => p.targetWord === word.targetWord);
    const cat = getWordCategory(progress);
    return {
      word,
      category: cat,
      isNew: !progress || (progress.timesReviewed ?? 0) === 0,
      progress,
    };
  });
}

/**
 * Builds a "Review Rusty Words" session:
 * Delegates directly to buildRustyReviewBatchWithHierarchies using dual hierarchies.
 */
export function buildRustyReviewBatch(
  allCandidateWords: WordItem[],
  userWordsProgress: Record<string, WordProgress>,
  targetTotal = 10,
  userLevel: CEFRLevel = 'A1',
  targetLanguage: string = 'he',
  knownLanguage: string = 'en'
): StudyCard[] {
  // Infer language and level from candidate words if not explicitly passed
  const detectedLevel = userLevel || (allCandidateWords[0]?.level as CEFRLevel) || 'A1';
  const detectedLang = targetLanguage || allCandidateWords[0]?.languagePairKey?.split('-')[0] || 'he';

  return buildRustyReviewBatchWithHierarchies(
    detectedLang,
    detectedLevel,
    userWordsProgress,
    targetTotal,
    knownLanguage
  );
}

/**
 * Calculates level progress and 5-color distribution statistics for the user's active level
 */
export function getLevelProgressStats(
  levelWords: WordItem[],
  userWordsProgress: Record<string, WordProgress>
) {
  const categoryCounts: Record<WordCategory, number> = {
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
  };

  const totalWords = Math.max(levelWords.length, 1);
  const studiedMap = new Map<string, WordProgress>();
  Object.values(userWordsProgress || {}).forEach(p => studiedMap.set(p.wordId, p));

  let unstudiedCount = 0;
  let studiedCount = 0;

  levelWords.forEach(w => {
    const p = studiedMap.get(w.id);
    const cat = getWordCategory(p);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    if (!p || (p.timesReviewed ?? 0) === 0) {
      unstudiedCount += 1;
    } else {
      studiedCount += 1;
    }
  });

  const masteredCount = categoryCounts.blue;
  const inProgressCount = categoryCounts.orange + categoryCounts.yellow + categoryCounts.green + categoryCounts.red;

  // Level progress calculation: learned words / total words
  const maxPossibleLevelPoints = totalWords;
  const earnedLevelPoints = studiedCount;
  const masteryPercentage = totalWords > 0 ? Math.round((studiedCount / totalWords) * 100) : 0;

  const remainingToMaster = Math.max(0, totalWords - studiedCount);
  const pureBlueMasteryPercentage = masteryPercentage;
  const activePercentage = masteryPercentage;

  // Global total learned words across entire account (The User's Score)
  const globalBlueScore = Object.values(userWordsProgress || {}).filter(
    p => (p.timesReviewed ?? 0) > 0 || (p.history && p.history.length > 0) || p.category === 'blue'
  ).length;

  return {
    totalWords,
    categoryCounts,
    masteredCount,
    inProgressCount,
    unstudiedCount,
    studiedCount,
    remainingToMaster,
    masteryPercentage,
    pureBlueMasteryPercentage,
    earnedLevelPoints,
    maxPossibleLevelPoints,
    activePercentage,
    globalBlueScore,
    percentages: {
      blue: (categoryCounts.blue / totalWords) * 100,
      green: (categoryCounts.green / totalWords) * 100,
      yellow: (categoryCounts.yellow / totalWords) * 100,
      orange: (categoryCounts.orange / totalWords) * 100,
      red: (categoryCounts.red / totalWords) * 100,
      unstudied: (unstudiedCount / totalWords) * 100,
    },
  };
}

/**
 * Checks if a specific numeric level (1-60) is completed by the user.
 * A level is complete if all of its words have been studied and promoted out of 'red' (cleanSessionsCount >= 1 or category !== 'red').
 */
export function isNumericLevelCompleted(
  levelWords: WordItem[],
  userWords: Record<string, WordProgress>
): boolean {
  if (!levelWords || levelWords.length === 0) return false;
  let completedCount = 0;
  for (const w of levelWords) {
    const p = userWords[w.id];
    if (p && ((p.cleanSessionsCount || 0) >= 1 || (p.category && p.category !== 'red') || (p.timesCorrect || 0) >= 1)) {
      completedCount++;
    }
  }
  return completedCount >= levelWords.length;
}

/**
 * Determines whether a word progress item is in the 'Geleerd' category (blue dot),
 * either studied through a daily/review session or manually marked as learned.
 */
export function isWordLearned(progress?: WordProgress): boolean {
  if (!progress) return false;
  if (progress.category === 'red') return false;
  return (
    progress.manuallyLearned === true ||
    isWordLearnedInSession(progress) ||
    progress.category === 'blue' ||
    progress.category === 'green' ||
    progress.category === 'yellow' ||
    progress.category === 'orange'
  );
}

/**
 * Calculates how many words the user has learned through completed daily practice / review sessions.
 */
export function calculateLearnedWordsFromJourney(profile?: UserProfile): number {
  if (!profile || !profile.words) return 0;
  const userWords = profile.words as Record<string, WordProgress>;
  const userWordsList = Object.values(userWords);
  if (userWordsList.length === 0) return 0;

  const levelsToCheck = new Set<number>();
  levelsToCheck.add(1);
  if (profile.numericLevel) levelsToCheck.add(profile.numericLevel);
  if (profile.maxUnlockedNumericLevel) levelsToCheck.add(profile.maxUnlockedNumericLevel);
  for (const w of userWordsList) {
    if (w.numericLevel && w.numericLevel >= 1 && w.numericLevel <= 60) {
      levelsToCheck.add(w.numericLevel);
    }
  }

  const wordsByTargetAndLevel = new Map<string, WordProgress>();
  for (const p of userWordsList) {
    if (p.targetWord) {
      const trimmedTarget = p.targetWord.trim().toLowerCase();
      if (p.numericLevel) {
        wordsByTargetAndLevel.set(`${p.numericLevel}_${trimmedTarget}`, p);
      }
      if (!wordsByTargetAndLevel.has(`any_${trimmedTarget}`)) {
        wordsByTargetAndLevel.set(`any_${trimmedTarget}`, p);
      }
    }
  }

  const targetLang = profile.targetLanguage || 'he';
  const knownLang = profile.knownLanguage || 'nl';

  let sessionLearnedCount = 0;

  for (const lvl of Array.from(levelsToCheck).sort((a, b) => a - b)) {
    const lvlWords = getVocabularyForNumericLevel(targetLang, lvl, knownLang);
    if (!lvlWords || lvlWords.length === 0) continue;

    for (const rawWord of lvlWords) {
      const word = getLocalizedWordItem(rawWord, targetLang, knownLang);
      const targetWordLevel = word.numericLevel || lvl;

      let rawProgress: WordProgress | undefined = userWords[word.id] || userWords[rawWord.id];
      if (
        rawProgress &&
        rawProgress.numericLevel &&
        targetWordLevel &&
        rawProgress.numericLevel !== targetWordLevel &&
        rawProgress.wordId !== word.id &&
        rawProgress.wordId !== rawWord.id
      ) {
        rawProgress = undefined;
      }

      if (!rawProgress) {
        const trimmed = (word.targetWord || '').trim().toLowerCase();
        rawProgress = wordsByTargetAndLevel.get(`${targetWordLevel}_${trimmed}`) || wordsByTargetAndLevel.get(`any_${trimmed}`);
      }

      if (rawProgress && isWordLearnedInSession(rawProgress) && rawProgress.category !== 'red') {
        sessionLearnedCount++;
      }
    }
  }

  if (sessionLearnedCount > 0) {
    return sessionLearnedCount;
  }

  // Fallback: calculate from completed daily session buttons if individual words are not yet mapped
  const btns = profile.journeyProgress?.completedSessionsByButton || {};
  let allDailySessions = 0;
  for (const [key, count] of Object.entries(btns)) {
    const parts = key.split('_');
    if (parts.length === 2) {
      const btnIdx = parseInt(parts[1], 10);
      if (btnIdx % 2 === 0) {
        const c = typeof count === 'number' ? count : 0;
        allDailySessions += c;
      }
    }
  }

  return allDailySessions * 4;
}

/**
 * Calculates the total number of words the user knows (words in the 'Geleerd' category with a blue dot,
 * across all levels, exactly matching the per-level blue dot count in the Vocab Library).
 * This dynamically updates whenever words move to 'Geleerd' (daily sessions or manual shifts).
 */
export function calculateTotalKnownWords(profile?: UserProfile): number {
  if (!profile || !profile.words) return 0;
  const userWords = profile.words as Record<string, WordProgress>;
  const userWordsList = Object.values(userWords);
  if (userWordsList.length === 0) return 0;

  // Determine all levels to evaluate (levels with user activity, plus current and unlocked levels)
  const levelsToCheck = new Set<number>();
  levelsToCheck.add(1);
  if (profile.numericLevel) levelsToCheck.add(profile.numericLevel);
  if (profile.maxUnlockedNumericLevel) levelsToCheck.add(profile.maxUnlockedNumericLevel);

  // Add any level found on stored word progress
  for (const w of userWordsList) {
    if (w.numericLevel && w.numericLevel >= 1 && w.numericLevel <= 60) {
      levelsToCheck.add(w.numericLevel);
    }
  }

  // Pre-index user progress for fast O(1) lookup
  const wordsByTargetAndLevel = new Map<string, WordProgress>();
  for (const p of userWordsList) {
    if (p.targetWord) {
      const trimmedTarget = p.targetWord.trim().toLowerCase();
      if (p.numericLevel) {
        wordsByTargetAndLevel.set(`${p.numericLevel}_${trimmedTarget}`, p);
      }
      if (!wordsByTargetAndLevel.has(`any_${trimmedTarget}`)) {
        wordsByTargetAndLevel.set(`any_${trimmedTarget}`, p);
      }
    }
  }

  const targetLang = profile.targetLanguage || 'he';
  const knownLang = profile.knownLanguage || 'nl';

  let totalLearnedCount = 0;

  for (const lvl of Array.from(levelsToCheck).sort((a, b) => a - b)) {
    const lvlWords = getVocabularyForNumericLevel(targetLang, lvl, knownLang);
    if (!lvlWords || lvlWords.length === 0) continue;

    for (const rawWord of lvlWords) {
      const word = getLocalizedWordItem(rawWord, targetLang, knownLang);
      const targetWordLevel = word.numericLevel || lvl;

      // Match strictly by ID first
      let rawProgress: WordProgress | undefined = userWords[word.id] || userWords[rawWord.id];
      if (
        rawProgress &&
        rawProgress.numericLevel &&
        targetWordLevel &&
        rawProgress.numericLevel !== targetWordLevel &&
        rawProgress.wordId !== word.id &&
        rawProgress.wordId !== rawWord.id
      ) {
        rawProgress = undefined;
      }

      // Fallback matching by targetWord
      if (!rawProgress) {
        const trimmed = (word.targetWord || '').trim().toLowerCase();
        rawProgress = wordsByTargetAndLevel.get(`${targetWordLevel}_${trimmed}`) || wordsByTargetAndLevel.get(`any_${trimmed}`);
      }

      if (isWordLearned(rawProgress)) {
        totalLearnedCount++;
      }
    }
  }

  return totalLearnedCount;
}
