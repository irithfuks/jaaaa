import {
  UserProfile,
  WordItem,
  WordProgress,
  StudyCard,
  TokenDirection,
  SessionType,
  WordCategory,
} from '../types';
import {
  getVocabularyForNumericLevel,
  getLanguage,
} from '../data/languages';
import { getLocalizedWordItem } from '../data/vocabularyBank';
import { getWordCategory, isWordLearnedInSession, isWordLearned } from './srs';

export interface HierarchyToken {
  tokenKey: string;
  wordId: string;
  targetWord: string;
  translation: string;
  transliteration?: string;
  direction: TokenDirection;
  level: number;
  category: WordCategory;
  hardPoints: number;
  oldPoints: number;
  lastSeenAt?: number;
  wordItem: WordItem;
}

/**
 * Creates unique token key for word + translation direction
 * e.g. "word123:to_target" (translating into language you learn)
 *      "word123:from_target" (translating to familiar language)
 */
export function createTokenKey(wordId: string, direction: TokenDirection): string {
  return `${wordId}:${direction}`;
}

/**
 * Parses token key back into wordId and direction
 */
export function parseTokenKey(tokenKey: string): { wordId: string; direction: TokenDirection } {
  const parts = tokenKey.split(':');
  const direction: TokenDirection = parts[1] === 'from_target' ? 'from_target' : 'to_target';
  return { wordId: parts[0], direction };
}

/**
 * Calculates effective old points for a word token:
 * "Every day a word gets +1 if you have not seen the word in a session.
 * Once you have seen that word, it goes back to 0."
 */
export function calculateEffectiveOldPoints(
  storedOldPoints: number = 0,
  lastSeenAt?: number,
  fallbackBaseTimestamp?: number
): number {
  const now = Date.now();
  if (lastSeenAt && lastSeenAt > 0) {
    const daysSinceSeen = Math.floor((now - lastSeenAt) / (24 * 60 * 60 * 1000));
    return Math.max(0, storedOldPoints + daysSinceSeen);
  }

  if (fallbackBaseTimestamp && fallbackBaseTimestamp > 0) {
    const daysSinceBase = Math.floor((now - fallbackBaseTimestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, storedOldPoints + Math.min(60, daysSinceBase));
  }

  return storedOldPoints;
}

/**
 * Scope 1: Rusty Review Hierarchy
 * "Review Rusty words is a hierarchy of words, all the words you have ‘mastered’ are part of it."
 * Direction tokens are treated separately: to_target & from_target
 */
export function getRustyReviewTokens(
  profile: UserProfile,
  targetLangCode?: string,
  knownLangCode?: string
): HierarchyToken[] {
  const tLang = targetLangCode || profile.targetLanguage || 'he';
  const kLang = knownLangCode || profile.knownLanguage || 'en';
  const userWords = profile.words || {};
  const rustyStore = profile.reviewHierarchies?.rustyReview?.tokens || {};

  // All words that the user has learned in any level / daily session
  const candidateProgressList = Object.values(userWords).filter((p) => {
    if (!p || !p.wordId) return false;
    // Exclude words from locked levels beyond what user has reached
    const maxUnlocked = Math.max(profile.numericLevel || 1, profile.maxUnlockedNumericLevel || 1);
    if (p.numericLevel && p.numericLevel > maxUnlocked) return false;
    if (p.level && ['B1', 'B2', 'C1', 'C2'].includes(p.level) && maxUnlocked <= 10) return false;

    // Unlearned words (category 'red') NEVER count in the ranking
    if (p.category === 'red') return false;

    // A word only counts if it has actually been learned!
    // Specification: "in ranking horen alleen woorden te staan die ik via daily sessies heb geleerd, of die ik handmatig naar 'geleerd' heb verplaatst"
    const isLearned =
      p.manuallyLearned === true ||
      isWordLearnedInSession(p) ||
      isWordLearned(p) ||
      p.category === 'blue';

    return Boolean(isLearned);
  });

  const result: HierarchyToken[] = [];
  const processedTokens = new Set<string>();

  const addWordToTokens = (
    wordId: string,
    targetWord: string,
    translation: string,
    transliteration: string | undefined,
    lvl: number,
    cat: WordCategory,
    item: WordItem,
    prog?: WordProgress
  ) => {
    const directions: TokenDirection[] = ['to_target', 'from_target'];

    for (const dir of directions) {
      const key = createTokenKey(wordId, dir);
      if (processedTokens.has(key)) continue;
      processedTokens.add(key);

      const scoreEntry = rustyStore[key];
      const historyMistakes = prog?.history ? prog.history.filter((h) => !h.wasCorrect).length : 0;
      const progMistakes = Math.max(prog?.timesIncorrect ?? 0, prog?.hardScore ?? 0, historyMistakes);
      const hardPts = scoreEntry?.hardPoints !== undefined
        ? Math.max(scoreEntry.hardPoints, progMistakes)
        : progMistakes;
      const oldPts = calculateEffectiveOldPoints(
        scoreEntry?.oldPoints ?? 0,
        scoreEntry?.lastSeenAt,
        scoreEntry?.firstIntroducedAt || profile.createdAt
      );

      result.push({
        tokenKey: key,
        wordId,
        targetWord,
        translation,
        transliteration,
        direction: dir,
        level: lvl,
        category: cat,
        hardPoints: hardPts,
        oldPoints: oldPts,
        lastSeenAt: scoreEntry?.lastSeenAt,
        wordItem: item,
      });
    }
  };

  for (const prog of candidateProgressList) {
    const item: WordItem = {
      id: prog.wordId,
      targetWord: prog.targetWord,
      translation: prog.translation,
      alternativeTranslations: prog.alternativeTranslations,
      transliteration: prog.transliteration,
      partOfSpeech: prog.partOfSpeech,
      level: prog.level || 'A1',
      numericLevel: prog.numericLevel || 1,
      languagePairKey: prog.languagePairKey || `${tLang}-${kLang}`,
      category: prog.category || 'blue',
    };
    const loc = getLocalizedWordItem(item, tLang, kLang);
    addWordToTokens(
      prog.wordId,
      loc.targetWord,
      loc.translation,
      loc.transliteration,
      prog.numericLevel || 1,
      prog.category || 'blue',
      loc,
      prog
    );
  }

  // NOTE: In the ranking, only words learned via daily sessions or manually moved to 'geleerd' are shown.
  // Never backfill with unlearned seed words!

  return result;
}

/**
 * Scope 2: Recent Review Hierarchy
 * "This is a session with the hardest and oldest words from the current level and the previous level.
 * You are doing exactly the same as during rusty review, only the scope is a lot smaller...
 * So you are making again 2 hierarchies (Hard & old). The same rules apply only the scope is the current level and the previous level."
 */
export function getRecentReviewTokens(
  profile: UserProfile,
  targetLangCode?: string,
  knownLangCode?: string,
  sessionLevel?: number,
  allowFallbackForSession: boolean = false
): HierarchyToken[] {
  const tLang = targetLangCode || profile.targetLanguage || 'he';
  const kLang = knownLangCode || profile.knownLanguage || 'en';
  const userWords = profile.words || {};
  const currentLvl = sessionLevel || profile.numericLevel || 1;
  const prevLvl = Math.max(1, currentLvl - 1);
  const recentStore = profile.reviewHierarchies?.recentReview?.tokens || {};

  const wordsMap = new Map<string, WordItem>();

  const isLearned = (prog?: WordProgress) => {
    if (!prog) return false;
    if (prog.category === 'red') return false;
    return (
      prog.manuallyLearned === true ||
      isWordLearnedInSession(prog) ||
      isWordLearned(prog) ||
      prog.category === 'blue'
    );
  };

  // 1. First add learned words directly from user profile for currentLvl and prevLvl
  const userWordsList = Object.values(userWords);
  userWordsList.forEach((prog) => {
    const lvl = prog.numericLevel || 1;
    if ((lvl === currentLvl || lvl === prevLvl) && isLearned(prog)) {
      if (!wordsMap.has(prog.wordId)) {
        wordsMap.set(prog.wordId, {
          id: prog.wordId,
          targetWord: prog.targetWord,
          translation: prog.translation,
          alternativeTranslations: prog.alternativeTranslations,
          transliteration: prog.transliteration,
          partOfSpeech: prog.partOfSpeech,
          exampleTarget: prog.exampleTarget,
          exampleTranslation: prog.exampleTranslation,
          level: prog.level,
          numericLevel: prog.numericLevel,
          languagePairKey: prog.languagePairKey,
        });
      }
    }
  });

  // 2. Words learned from current level
  const currentWords = getVocabularyForNumericLevel(tLang, currentLvl, kLang);
  currentWords.forEach((w) => {
    const prog = userWords[w.id] || userWordsList.find(p => p.wordId === w.id || (p.numericLevel === currentLvl && p.targetWord === w.targetWord));
    if (isLearned(prog) && !wordsMap.has(w.id)) {
      wordsMap.set(w.id, getLocalizedWordItem(w, tLang, kLang));
    }
  });

  // Words learned from previous level (if distinct)
  if (prevLvl !== currentLvl) {
    const prevWords = getVocabularyForNumericLevel(tLang, prevLvl, kLang);
    prevWords.forEach((w) => {
      const prog = userWords[w.id] || userWordsList.find(p => p.wordId === w.id || (p.numericLevel === prevLvl && p.targetWord === w.targetWord));
      if (isLearned(prog) && !wordsMap.has(w.id)) {
        wordsMap.set(w.id, getLocalizedWordItem(w, tLang, kLang));
      }
    });
  }

  // Fallback ONLY during practice session card generation if user has not yet learned words
  if (wordsMap.size === 0 && allowFallbackForSession) {
    currentWords.slice(0, 10).forEach((w) => {
      wordsMap.set(w.id, getLocalizedWordItem(w, tLang, kLang));
    });
  }

  const result: HierarchyToken[] = [];
  const processedTokens = new Set<string>();

  for (const [wordId, loc] of wordsMap.entries()) {
    const prog = userWords[wordId];
    const cat = getWordCategory(prog);
    const directions: TokenDirection[] = ['to_target', 'from_target'];

    for (const dir of directions) {
      const key = createTokenKey(wordId, dir);
      if (processedTokens.has(key)) continue;
      processedTokens.add(key);

      const scoreEntry = recentStore[key];
      const progMistakes = Math.max(prog?.timesIncorrect ?? 0, prog?.hardScore ?? 0);
      const hardPts = scoreEntry?.hardPoints !== undefined
        ? Math.max(scoreEntry.hardPoints, progMistakes)
        : progMistakes;
      const oldPts = calculateEffectiveOldPoints(
        scoreEntry?.oldPoints ?? 0,
        scoreEntry?.lastSeenAt,
        scoreEntry?.firstIntroducedAt || profile.createdAt
      );

      result.push({
        tokenKey: key,
        wordId,
        targetWord: loc.targetWord,
        translation: loc.translation,
        transliteration: loc.transliteration,
        direction: dir,
        level: loc.numericLevel || currentLvl,
        category: cat,
        hardPoints: hardPts,
        oldPoints: oldPts,
        lastSeenAt: scoreEntry?.lastSeenAt,
        wordItem: loc,
      });
    }
  }

  return result;
}

export interface RankedWordItem {
  wordId: string;
  targetWord: string;
  translation: string;
  transliteration?: string;
  level: number;
  category: WordCategory;
  hardPoints: number;
  oldPoints: number;
  reason: 'hard' | 'old';
  token: HierarchyToken;
  wordItem: WordItem;
}

/**
 * Builds a deduplicated, alternating ranking of unique words.
 * Each word appears EXACTLY ONCE.
 * Both 'hard' and 'oud' rankings are computed across all unique words.
 * The word is placed at whichever position it ranks highest in the alternating queue.
 */
export function buildDeduplicatedWordRanking(tokens: HierarchyToken[]): RankedWordItem[] {
  if (tokens.length === 0) return [];

  // 1. Group tokens by unique wordId to collapse multiple direction tokens (e.g. to_target & from_target)
  const wordMap = new Map<
    string,
    {
      wordId: string;
      targetWord: string;
      translation: string;
      transliteration?: string;
      level: number;
      category: WordCategory;
      hardPoints: number;
      oldPoints: number;
      primaryToken: HierarchyToken;
      wordItem: WordItem;
    }
  >();

  for (const tok of tokens) {
    const existing = wordMap.get(tok.wordId);
    if (!existing) {
      wordMap.set(tok.wordId, {
        wordId: tok.wordId,
        targetWord: tok.targetWord,
        translation: tok.translation,
        transliteration: tok.transliteration,
        level: tok.level,
        category: tok.category,
        hardPoints: tok.hardPoints || 0,
        oldPoints: tok.oldPoints || 0,
        primaryToken: tok,
        wordItem: tok.wordItem,
      });
    } else {
      // Aggregate: take maximum points across directions
      const maxHard = Math.max(existing.hardPoints, tok.hardPoints || 0);
      const maxOld = Math.max(existing.oldPoints, tok.oldPoints || 0);
      // Prefer token with higher hardPoints for practicing mistakes
      const preferThis = (tok.hardPoints || 0) > existing.hardPoints;
      wordMap.set(tok.wordId, {
        ...existing,
        hardPoints: maxHard,
        oldPoints: maxOld,
        primaryToken: preferThis ? tok : existing.primaryToken,
        wordItem: preferThis ? tok.wordItem : existing.wordItem,
      });
    }
  }

  const uniqueCandidates = Array.from(wordMap.values());
  const totalWords = uniqueCandidates.length;

  // Stable pseudo-random tie breaker
  const getTieBreaker = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 10007;
    }
    return hash;
  };

  // 2. Sort Hard hierarchy descending
  const hardRanked = [...uniqueCandidates].sort((a, b) => {
    if (b.hardPoints !== a.hardPoints) {
      return b.hardPoints - a.hardPoints;
    }
    return getTieBreaker(a.wordId) - getTieBreaker(b.wordId);
  });

  // 3. Sort Old hierarchy descending
  const oldRanked = [...uniqueCandidates].sort((a, b) => {
    if (b.oldPoints !== a.oldPoints) {
      return b.oldPoints - a.oldPoints;
    }
    return getTieBreaker(b.wordId) - getTieBreaker(a.wordId);
  });

  const result: RankedWordItem[] = [];
  const placedWordIds = new Set<string>();
  let hIdx = 0;
  let oIdx = 0;

  // 4. Alternating pick: Hard #1, Old #1, Hard #2, Old #2...
  // Each word is placed where it ranks highest, and once placed, is skipped later.
  while (result.length < totalWords && (hIdx < hardRanked.length || oIdx < oldRanked.length)) {
    // Pick next unplaced from Hard (only words with actual hardPoints > 0)
    while (hIdx < hardRanked.length) {
      const candidate = hardRanked[hIdx++];
      if (candidate.hardPoints > 0 && !placedWordIds.has(candidate.wordId)) {
        placedWordIds.add(candidate.wordId);
        result.push({
          wordId: candidate.wordId,
          targetWord: candidate.targetWord,
          translation: candidate.translation,
          transliteration: candidate.transliteration,
          level: candidate.level,
          category: candidate.category,
          hardPoints: candidate.hardPoints,
          oldPoints: candidate.oldPoints,
          reason: 'hard',
          token: candidate.primaryToken,
          wordItem: candidate.wordItem,
        });
        break;
      }
    }

    if (result.length >= totalWords) break;

    // Pick next unplaced from Old
    while (oIdx < oldRanked.length) {
      const candidate = oldRanked[oIdx++];
      if (!placedWordIds.has(candidate.wordId)) {
        placedWordIds.add(candidate.wordId);
        result.push({
          wordId: candidate.wordId,
          targetWord: candidate.targetWord,
          translation: candidate.translation,
          transliteration: candidate.transliteration,
          level: candidate.level,
          category: candidate.category,
          hardPoints: candidate.hardPoints,
          oldPoints: candidate.oldPoints,
          reason: 'old',
          token: candidate.primaryToken,
          wordItem: candidate.wordItem,
        });
        break;
      }
    }
  }

  // 5. Clean drain: if remaining words have 0 hardPoints and weren't placed, place them by Old ranking
  while (oIdx < oldRanked.length && result.length < totalWords) {
    const candidate = oldRanked[oIdx++];
    if (!placedWordIds.has(candidate.wordId)) {
      placedWordIds.add(candidate.wordId);
      result.push({
        wordId: candidate.wordId,
        targetWord: candidate.targetWord,
        translation: candidate.translation,
        transliteration: candidate.transliteration,
        level: candidate.level,
        category: candidate.category,
        hardPoints: candidate.hardPoints,
        oldPoints: candidate.oldPoints,
        reason: 'old',
        token: candidate.primaryToken,
        wordItem: candidate.wordItem,
      });
    }
  }

  return result;
}

/**
 * Core Algorithm: Interleaves Hard and Old hierarchy tokens
 * 1. Hard hierarchy highest points
 * 2. Old hierarchy highest points
 * 3. Hard hierarchy second highest points
 * 4. Old hierarchy third highest points
 * 5. Etc.
 * "If certain words have the same amount of points, just pick one randomly. The other one will go next session."
 */
export function buildInterleavedReviewTokens(
  tokens: HierarchyToken[],
  targetCount: number = 10
): {
  selectedTokens: HierarchyToken[];
  hardRanked: HierarchyToken[];
  oldRanked: HierarchyToken[];
} {
  if (tokens.length === 0) {
    return { selectedTokens: [], hardRanked: [], oldRanked: [] };
  }

  // Stable pseudo-random tie breaker based on tokenKey
  const getTieBreaker = (tokenKey: string) => {
    let hash = 0;
    for (let i = 0; i < tokenKey.length; i++) {
      hash = (hash * 31 + tokenKey.charCodeAt(i)) % 10007;
    }
    return hash;
  };

  // 1. Sort Hard hierarchy descending by hardPoints, breaking ties with hash
  const hardRanked = [...tokens].sort((a, b) => {
    if (b.hardPoints !== a.hardPoints) {
      return b.hardPoints - a.hardPoints;
    }
    return getTieBreaker(a.tokenKey) - getTieBreaker(b.tokenKey);
  });

  // 2. Sort Old hierarchy descending by oldPoints, breaking ties with hash
  const oldRanked = [...tokens].sort((a, b) => {
    if (b.oldPoints !== a.oldPoints) {
      return b.oldPoints - a.oldPoints;
    }
    return getTieBreaker(b.tokenKey) - getTieBreaker(a.tokenKey);
  });

  const selectedTokens: HierarchyToken[] = [];
  const selectedWordIds = new Set<string>();

  let hIdx = 0;
  let oIdx = 0;

  // Interleave alternating: Hard #1, Old #1, Hard #2, Old #2...
  while (selectedTokens.length < targetCount && (hIdx < hardRanked.length || oIdx < oldRanked.length)) {
    // Pick from Hard
    while (hIdx < hardRanked.length) {
      const candidate = hardRanked[hIdx++];
      if (!selectedWordIds.has(candidate.wordId)) {
        selectedWordIds.add(candidate.wordId);
        selectedTokens.push(candidate);
        break;
      }
    }

    if (selectedTokens.length >= targetCount) break;

    // Pick from Old
    while (oIdx < oldRanked.length) {
      const candidate = oldRanked[oIdx++];
      if (!selectedWordIds.has(candidate.wordId)) {
        selectedWordIds.add(candidate.wordId);
        selectedTokens.push(candidate);
        break;
      }
    }
  }

  // If still below targetCount and more words exist (allow different direction tokens if distinct words exhausted)
  if (selectedTokens.length < targetCount) {
    const selectedTokenKeys = new Set(selectedTokens.map((t) => t.tokenKey));
    for (const t of hardRanked) {
      if (selectedTokens.length >= targetCount) break;
      if (!selectedTokenKeys.has(t.tokenKey)) {
        selectedTokenKeys.add(t.tokenKey);
        selectedTokens.push(t);
      }
    }
  }

  return {
    selectedTokens,
    hardRanked,
    oldRanked,
  };
}

/**
 * Builds study cards for a Rusty Review session (10 words)
 */
export function buildRustyReviewSessionCards(
  profile: UserProfile,
  targetCount: number = 10,
  direction?: 'both' | 'target' | 'known',
  selectedLevels?: number[]
): StudyCard[] {
  let tokens = getRustyReviewTokens(profile);
  if (direction === 'target') {
    tokens = tokens.filter((t) => t.direction === 'to_target');
  } else if (direction === 'known') {
    tokens = tokens.filter((t) => t.direction === 'from_target');
  }
  if (selectedLevels && selectedLevels.length > 0) {
    tokens = tokens.filter((t) => {
      const lvl = t.wordItem?.numericLevel || profile.words?.[t.wordId]?.numericLevel || 1;
      return selectedLevels.includes(lvl);
    });
  }
  const ranked = buildDeduplicatedWordRanking(tokens);
  const selected = ranked.slice(0, targetCount);

  return selected.map((item) => {
    const prog = profile.words?.[item.wordId];
    return {
      word: item.wordItem,
      category: 'blue',
      isNew: false,
      progress: prog,
      hierarchyDirection: direction === 'target' ? 'to_target' : direction === 'known' ? 'from_target' : undefined,
    };
  });
}

/**
 * Builds study cards for a Recent Review session (10 words)
 * Scope: current level and previous level
 */
export function buildRecentReviewSessionCards(
  profile: UserProfile,
  targetCount: number = 10
): StudyCard[] {
  const tokens = getRecentReviewTokens(profile);
  const ranked = buildDeduplicatedWordRanking(tokens);
  const selected = ranked.slice(0, targetCount);

  return selected.map((item) => {
    const prog = profile.words?.[item.wordId];
    return {
      word: item.wordItem,
      category: item.category || 'yellow',
      isNew: false,
      progress: prog,
      hasYellowBall: true, // Recent review words are "in progress"
      isRecentReviewHierarchy: true,
      hierarchyDirection: undefined, // Test both directions!
    };
  });
}

/**
 * Builds study cards for a New Words session:
 * "New words:
 * * 4 new words from red
 * * 6 words that are part of the recent review, same rules apply as recent review.
 * The words that are part of recent review hierarchy have a yellow ball, which means ‘in progress’.
 * * So if you make a mistake, it adds up +1 in the ‘hard hierarchy’ in the recent review
 * and in the ‘hard hierarchy’ of the rusty review’. No minus points are given."
 */
export function buildNewWordsSessionCards(
  profile: UserProfile,
  level: number,
  sessionIndexInLevel: number = 0
): StudyCard[] {
  const tLang = profile.targetLanguage || 'he';
  const kLang = profile.knownLanguage || 'en';
  const levelWords = getVocabularyForNumericLevel(tLang, level, kLang);
  const userWords = profile.words || {};

  // 1. Identify 4 new red words for this session
  // Exclude words that are already mastered (category blue or cleanSessionsCount >= 4)
  const unmasteredInLevel = levelWords.filter((w) => {
    const p = userWords[w.id];
    return !(p?.category === 'blue' || (p?.cleanSessionsCount ?? 0) >= 4);
  });

  // Filter words that have not been studied yet (timesReviewed === 0 or undefined)
  const unstudiedInLevel = unmasteredInLevel.filter((w) => {
    const p = userWords[w.id];
    return !p || (p.timesReviewed ?? 0) === 0;
  });

  // Calculate slice offset based on sessionIndexInLevel
  const newWordsCount = 4;
  const startIndex = Math.min(
    Math.max(0, sessionIndexInLevel * newWordsCount),
    Math.max(0, unmasteredInLevel.length - newWordsCount)
  );
  
  let newWordsSlice: WordItem[] = unstudiedInLevel.slice(0, newWordsCount);
  if (newWordsSlice.length < newWordsCount) {
    // If fewer than 4 completely unstudied, pick next available from unmasteredInLevel
    newWordsSlice = unmasteredInLevel.slice(startIndex, startIndex + newWordsCount);
  }

  const newCards: StudyCard[] = newWordsSlice.map((w) => {
    const loc = getLocalizedWordItem(w, tLang, kLang);
    const prog = userWords[w.id];
    return {
      word: loc,
      category: 'red',
      isNew: true,
      progress: prog,
    };
  });

  // 2. Identify 6 review words from recent review (current level and previous level):
  // User: "Graag top 4 met de hoogste hard score uit recent review en een top 2 uit 'oud ranking' van recent review.
  // Hard: Dus de woorden van mijn huidige level en het level daarvoor die de hoogste hard punten hebben."
  const recentTokens = getRecentReviewTokens(profile, tLang, kLang, level, true);
  const newCardWordIds = new Set(newCards.map((c) => c.word.id));
  const newCardTargets = new Set(newCards.map((c) => c.word.targetWord));

  // Exclude words that are part of the 4 new words
  const eligibleTokens = recentTokens.filter(
    (tok) => !newCardWordIds.has(tok.wordId) && !newCardTargets.has(tok.targetWord)
  );

  interface ReviewCandidate {
    wordId: string;
    targetWord: string;
    wordItem: WordItem;
    hardScore: number;
    oldScore: number;
    lastSeenAt?: number;
  }
  const candidateMap = new Map<string, ReviewCandidate>();

  eligibleTokens.forEach((tok) => {
    const existing = candidateMap.get(tok.wordId);
    if (!existing) {
      candidateMap.set(tok.wordId, {
        wordId: tok.wordId,
        targetWord: tok.targetWord,
        wordItem: tok.wordItem,
        hardScore: tok.hardPoints || 0,
        oldScore: tok.oldPoints || 0,
        lastSeenAt: tok.lastSeenAt,
      });
    } else {
      existing.hardScore = Math.max(existing.hardScore, tok.hardPoints || 0);
      existing.oldScore = Math.max(existing.oldScore, tok.oldPoints || 0);
    }
  });

  const allReviewCandidates = Array.from(candidateMap.values());

  // 1. Top 4 with the highest hard score from recent review
  const sortedByHard = [...allReviewCandidates].sort((a, b) => {
    if (b.hardScore !== a.hardScore) return b.hardScore - a.hardScore;
    return b.oldScore - a.oldScore;
  });
  const top4Hard = sortedByHard.slice(0, 4);
  const selectedWordIds = new Set(top4Hard.map((c) => c.wordId));

  // 2. Top 2 from 'oud ranking' of recent review (excluding the 4 already picked)
  const remainingForOld = allReviewCandidates.filter((c) => !selectedWordIds.has(c.wordId));
  const sortedByOld = remainingForOld.sort((a, b) => {
    if (b.oldScore !== a.oldScore) return b.oldScore - a.oldScore;
    return b.hardScore - a.hardScore;
  });
  const top2Old = sortedByOld.slice(0, 2);
  top2Old.forEach((c) => selectedWordIds.add(c.wordId));

  const selectedReviewWords = [...top4Hard, ...top2Old];

  // If fewer than 6, fill up from remaining candidates
  if (selectedReviewWords.length < 6) {
    for (const c of sortedByHard) {
      if (selectedReviewWords.length >= 6) break;
      if (!selectedWordIds.has(c.wordId)) {
        selectedWordIds.add(c.wordId);
        selectedReviewWords.push(c);
      }
    }
  }

  const reviewCards: StudyCard[] = selectedReviewWords.map((cand) => {
    const prog = userWords[cand.wordId];
    return {
      word: cand.wordItem,
      category: 'blue',
      isNew: false,
      progress: prog,
      hasYellowBall: false,
      isRecentReviewHierarchy: true,
      hierarchyDirection: undefined,
    };
  });

  return [...newCards, ...reviewCards].slice(0, 10);
}

/**
 * Point update on mistake:
 * "Every time you do a word wrong (multiple choice don’t count) the word gets a +1 in the hard hierarchy.
 * Treat translating into the language you are learning and translating from the language you are learning
 * to your familiar language as separate tokens. Keep count of them separately.
 * When you get that hard word in the rusty review, and you still do it wrong, it still adds up points."
 *
 * "During recent review session, you keep counting the +1 every time you make a mistake,
 * those add up in the rusty ánd the recent review ‘hard hierarchy’."
 *
 * "New words: So if you make a mistake, it adds up +1 in the ‘hard hierarchy’ in the recent review
 * and in the ‘hard hierarchy’ of the rusty review’. No minus points are given."
 */
export function applyReviewMistakePoints(
  profile: UserProfile,
  wordId: string,
  direction: TokenDirection,
  sessionType: SessionType
): UserProfile {
  const cleanWordId = wordId.includes('__dir__') ? wordId.split('__dir__')[0] : wordId;
  const tokenKey = createTokenKey(cleanWordId, direction);
  const now = Date.now();

  const prevReview = profile.reviewHierarchies || {};
  const prevRusty = prevReview.rustyReview?.tokens || {};
  const prevRecent = prevReview.recentReview?.tokens || {};

  const isRustySession = sessionType === 'rusty_review' || sessionType === 'rusty';
  const isRecentOrNewSession =
    sessionType === 'recent_review' ||
    sessionType === 'new_words' ||
    sessionType === 'daily' ||
    sessionType === 'exam';

  // 1. Rusty review hard hierarchy: +1 for mistakes in rusty, recent, new_words, or exam sessions
  const currentRustyToken = prevRusty[tokenKey] || { hardPoints: 0, oldPoints: 0 };
  const updatedRustyTokens = {
    ...prevRusty,
    [tokenKey]: {
      ...currentRustyToken,
      hardPoints: (currentRustyToken.hardPoints || 0) + 1,
      firstIntroducedAt: currentRustyToken.firstIntroducedAt || now,
    },
  };

  // 2. Recent review hard hierarchy: +1 for mistakes in recent, new_words, or exam sessions
  let updatedRecentTokens = prevRecent;
  if (isRecentOrNewSession) {
    const currentRecentToken = prevRecent[tokenKey] || { hardPoints: 0, oldPoints: 0 };
    updatedRecentTokens = {
      ...prevRecent,
      [tokenKey]: {
        ...currentRecentToken,
        hardPoints: (currentRecentToken.hardPoints || 0) + 1,
        firstIntroducedAt: currentRecentToken.firstIntroducedAt || now,
      },
    };
  }

  // 3. Track mistake count per token direction
  // "Treat answering in the language you are learning and answering in the familiar language as 2 separate tokens, and keep track of them separately."
  const prevMistakeCounts = profile.tokenMistakeCounts || {};
  const updatedMistakeCounts = {
    ...prevMistakeCounts,
    [tokenKey]: (prevMistakeCounts[tokenKey] || 0) + 1,
  };

  return {
    ...profile,
    tokenMistakeCounts: updatedMistakeCounts,
    reviewHierarchies: {
      rustyReview: { tokens: updatedRustyTokens },
      recentReview: { tokens: updatedRecentTokens },
    },
  };
}

/**
 * Point update on completing word in session:
 * "During a rusty review session, you get -5 after having done that word.
 * If a word is in your rusty review session because of the hard hierarchy,
 * it automatically also goes to 0 in the old hierarchy, since you have done that word again."
 *
 * "After completing the word in recent review, you receive -5 points ONLY in the recent review hierarchy.
 * So NOT in the Rusty review hierarchy.
 * When a word shows up in the recent review session, it goes to 0 in the rusty review ‘old hierarchy’
 * en in the recent review ‘old hierarchy’."
 *
 * "New words: No minus points are given. Words that are part of recent review hierarchy go to 0 in old hierarchy."
 */
export function applySessionWordCompletion(
  profile: UserProfile,
  completedTokens: Array<{ wordId: string; direction: TokenDirection; wasClean?: boolean; isNew?: boolean }>,
  sessionType: SessionType
): UserProfile {
  if (completedTokens.length === 0) return profile;

  const now = Date.now();
  const prevReview = profile.reviewHierarchies || {};
  let updatedRustyTokens = { ...(prevReview.rustyReview?.tokens || {}) };
  let updatedRecentTokens = { ...(prevReview.recentReview?.tokens || {}) };

  const isRustySession = sessionType === 'rusty_review' || sessionType === 'rusty';
  const isRecentSession = sessionType === 'recent_review';
  const isNewWordsSession = sessionType === 'new_words' || sessionType === 'daily';

  for (const token of completedTokens) {
    const { wordId, direction, wasClean, isNew } = token;
    const cleanWordId = wordId.includes('__dir__') ? wordId.split('__dir__')[0] : wordId;
    const tokenKey = createTokenKey(cleanWordId, direction);

    if (isRustySession) {
      // Rusty session: -5 hard points, reset old hierarchy to 0
      const currentRusty = updatedRustyTokens[tokenKey] || { hardPoints: 0, oldPoints: 0 };
      updatedRustyTokens[tokenKey] = {
        ...currentRusty,
        hardPoints: Math.max(0, (currentRusty.hardPoints || 0) - 5),
        oldPoints: 0,
        lastSeenAt: now,
      };
    } else if (isRecentSession) {
      // Recent review session: -5 hard points ONLY in recent review
      // Old hierarchy goes to 0 in BOTH recent review and rusty review
      const currentRecent = updatedRecentTokens[tokenKey] || { hardPoints: 0, oldPoints: 0 };
      updatedRecentTokens[tokenKey] = {
        ...currentRecent,
        hardPoints: Math.max(0, (currentRecent.hardPoints || 0) - 5),
        oldPoints: 0,
        lastSeenAt: now,
      };

      const currentRusty = updatedRustyTokens[tokenKey] || { hardPoints: 0, oldPoints: 0 };
      updatedRustyTokens[tokenKey] = {
        ...currentRusty,
        oldPoints: 0,
        lastSeenAt: now,
      };
    } else if (isNewWordsSession) {
      // Daily session:
      // Review words: -2 hard points when successfully completing the word at the end of the session!
      // New words: no minus points!
      // Both: old ranking resets to 0 ("uiteraard gaat de teller weer naar 0 als je deze woorden herhaalt")
      const isReviewWord = !isNew;
      if (isReviewWord) {
        // -2 hard points in recent review
        const currentRecent = updatedRecentTokens[tokenKey] || { hardPoints: 0, oldPoints: 0 };
        updatedRecentTokens[tokenKey] = {
          ...currentRecent,
          hardPoints: Math.max(0, (currentRecent.hardPoints || 0) - 2),
          oldPoints: 0,
          lastSeenAt: now,
        };

        // Also -2 hard points in rusty review
        const currentRusty = updatedRustyTokens[tokenKey] || { hardPoints: 0, oldPoints: 0 };
        updatedRustyTokens[tokenKey] = {
          ...currentRusty,
          hardPoints: Math.max(0, (currentRusty.hardPoints || 0) - 2),
          oldPoints: 0,
          lastSeenAt: now,
        };
      } else {
        // New words: no minus points!
        // Reset old points to 0 since word is introduced/practiced
        if (updatedRecentTokens[tokenKey]) {
          updatedRecentTokens[tokenKey] = {
            ...updatedRecentTokens[tokenKey],
            oldPoints: 0,
            lastSeenAt: now,
          };
        }
        if (updatedRustyTokens[tokenKey]) {
          updatedRustyTokens[tokenKey] = {
            ...updatedRustyTokens[tokenKey],
            oldPoints: 0,
            lastSeenAt: now,
          };
        }
      }
    }
  }

  return {
    ...profile,
    reviewHierarchies: {
      rustyReview: { tokens: updatedRustyTokens },
      recentReview: { tokens: updatedRecentTokens },
    },
  };
}

/**
 * Builds cards for the Level Exam:
 * "The exam consists of the 25 words you did wrong the most amount of times.
 * Treat answering in the language you are learning and answering in the familiar language
 * as 2 separate tokens, and keep track of them separately."
 */
export function buildExamSessionCards(
  profile: UserProfile,
  level: number,
  targetCount: number = 25
): StudyCard[] {
  const tLang = profile.targetLanguage || 'he';
  const kLang = profile.knownLanguage || 'en';
  const userWords = profile.words || {};
  const tokenMistakes = profile.tokenMistakeCounts || {};
  const recentStore = profile.reviewHierarchies?.recentReview?.tokens || {};
  const rustyStore = profile.reviewHierarchies?.rustyReview?.tokens || {};

  // 1. Collect candidate words for level (and previous level if needed)
  const wordsMap = new Map<string, WordItem>();

  const currentWords = getVocabularyForNumericLevel(tLang, level, kLang);
  currentWords.forEach((w) => wordsMap.set(w.id, getLocalizedWordItem(w, tLang, kLang)));

  // If level vocabulary is small, pull from previous level as well
  if (wordsMap.size < 25 && level > 1) {
    const prevWords = getVocabularyForNumericLevel(tLang, level - 1, kLang);
    prevWords.forEach((w) => {
      if (!wordsMap.has(w.id)) {
        wordsMap.set(w.id, getLocalizedWordItem(w, tLang, kLang));
      }
    });
  }

  // 2. Build candidate tokens (both to_target and from_target for each word)
  interface ExamTokenCandidate {
    wordId: string;
    word: WordItem;
    direction: TokenDirection;
    mistakeScore: number;
    tokenKey: string;
  }

  const candidates: ExamTokenCandidate[] = [];

  for (const [wordId, loc] of wordsMap.entries()) {
    const directions: TokenDirection[] = ['to_target', 'from_target'];
    const prog = userWords[wordId];
    const wordMistakes = prog?.timesIncorrect || 0;
    const isHardWord = prog?.isHard ? 2 : 0;

    for (const dir of directions) {
      const key = createTokenKey(wordId, dir);
      const recordedMistakes = tokenMistakes[key] || 0;
      const recentHard = recentStore[key]?.hardPoints || 0;
      const rustyHard = rustyStore[key]?.hardPoints || 0;

      // Calculate composite mistake score
      const mistakeScore =
        recordedMistakes * 10 +
        recentHard * 3 +
        rustyHard * 2 +
        wordMistakes +
        isHardWord;

      candidates.push({
        wordId,
        word: loc,
        direction: dir,
        mistakeScore,
        tokenKey: key,
      });
    }
  }

  // Stable pseudo-random tie-breaker
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 10007;
    }
    return hash;
  };

  // 3. Sort tokens descending by mistake score
  candidates.sort((a, b) => {
    if (b.mistakeScore !== a.mistakeScore) {
      return b.mistakeScore - a.mistakeScore;
    }
    return getHash(a.tokenKey) - getHash(b.tokenKey);
  });

  // Pick top 25 tokens
  const selectedCandidates = candidates.slice(0, targetCount);

  // Fallback: If still below targetCount, duplicate/pad from available candidates
  while (selectedCandidates.length < targetCount && candidates.length > 0) {
    selectedCandidates.push(candidates[selectedCandidates.length % candidates.length]);
  }

  return selectedCandidates.map((c, idx) => {
    const prog = userWords[c.wordId];
    const cat = getWordCategory(prog);

    return {
      word: {
        ...c.word,
        id: `${c.wordId}__dir__${c.direction}__idx__${idx}`,
      },
      category: cat,
      isNew: false,
      progress: prog,
      hierarchyDirection: c.direction, // strictly tests this token direction!
    };
  });
}
