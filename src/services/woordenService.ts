import { CEFRLevel, WordItem } from '../types';
import { isLatinOrDutch, getCefrForNumericLevel, getBaseNumericLevelForCefr } from '../data/languages';

export interface RawFirestoreWord {
  id: string;
  level?: number;
  niveau?: string;
  word_type?: string;
  en_no_article?: string;
  en_with_article?: string;
  nl?: string;
  nl_no_article?: string;
  es?: string;
  es_no_article?: string;
  fr?: string;
  fr_no_article?: string;
  it?: string;
  it_no_article?: string;
  pt?: string;
  pt_no_article?: string;
  he?: string;
  he_phonetic?: string;
  he_gender?: string;
  ar?: string;
  ar_phonetic?: string;
  ar_gender?: string;
  ru?: string;
  ru_phonetic?: string;
  ru_gender?: string;
  uk?: string;
  uk_phonetic?: string;
  uk_gender?: string;
  fa?: string;
  fa_phonetic?: string;
  ja?: string;
  ja_phonetic?: string;
  ko?: string;
  ko_phonetic?: string;
  [key: string]: any;
}

// In-memory store of all raw Firestore documents
let rawWordsStore: RawFirestoreWord[] = [];
let isLoaded = false;
let loadPromise: Promise<RawFirestoreWord[]> | null = null;

// Subscribers for updates when words are ready
const listeners = new Set<() => void>();

export function onWoordenLoaded(callback: () => void): () => void {
  listeners.add(callback);
  if (isLoaded) {
    callback();
  }
  return () => listeners.delete(callback);
}

/**
 * Initializes and fetches the 6,824 words from /api/woorden or static JSON.
 * Caches in localStorage / memory for instant zero-latency access across sessions.
 */
export async function initWoordenService(): Promise<RawFirestoreWord[]> {
  if (isLoaded && rawWordsStore.length > 0) {
    return rawWordsStore;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    // 1. Try local cache in window/localStorage first for instant boot
    try {
      const cached = localStorage.getItem('vocabpulse_firestore_woorden_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 1000) {
          rawWordsStore = parsed;
          isLoaded = true;
          listeners.forEach(fn => fn());
          // Refresh asynchronously in the background
          refreshFromServer();
          return rawWordsStore;
        }
      }
    } catch {
      // Ignore storage errors
    }

    // 2. Fetch from /api/woorden
    try {
      const res = await fetch('/api/woorden');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.words || [];
        if (list.length > 0) {
          rawWordsStore = list;
          isLoaded = true;
          try {
            localStorage.setItem('vocabpulse_firestore_woorden_v2', JSON.stringify(list));
          } catch {
            // Storage quota might be reached, memory cache remains active
          }
          listeners.forEach(fn => fn());
          return rawWordsStore;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch from /api/woorden, falling back to static file:', e);
    }

    // 3. Fallback to /data/woorden.json
    try {
      const res = await fetch('/data/woorden.json');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          rawWordsStore = list;
          isLoaded = true;
          listeners.forEach(fn => fn());
          return rawWordsStore;
        }
      }
    } catch (e) {
      console.error('Failed to load static woorden.json:', e);
    }

    return rawWordsStore;
  })();

  return loadPromise;
}

async function refreshFromServer() {
  try {
    const res = await fetch('/api/woorden');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.words || [];
      if (list.length >= rawWordsStore.length) {
        rawWordsStore = list;
        try {
          localStorage.setItem('vocabpulse_firestore_woorden_v1', JSON.stringify(list));
        } catch {}
      }
    }
  } catch {}
}

// Kick off background loading immediately on module import
if (typeof window !== 'undefined') {
  initWoordenService();
}

/**
 * Transforms a raw Firestore document into a WordItem according to the user's explicit article
 * and answer language rules:
 *
 * 1. Target word article rule:
 *    - For NL, ES, PT, FR, IT (Latin languages + Dutch): use the column with articles (nl, es, pt, fr, it).
 *    - For other languages (HE, AR, RU, FA, JA, KO, UK): use the column without articles.
 *
 * 2. Translation & Answer language rule:
 *    - If learning a Latin language or Dutch:
 *      - Answering in English: use en_with_article (with en_no_article as alternative).
 *      - Answering in Latin/Dutch (nl, es, fr, it, pt): use the column with articles (e.g. nl, es, fr, it, pt).
 *    - If learning a non-article language (HE, AR, RU, FA, etc.):
 *      - Answering in ANY language: use the column WITHOUT articles (e.g. nl_no_article, es_no_article,
 *        fr_no_article, it_no_article, pt_no_article, en_no_article, or native word).
 *
 * 3. Label:
 *    - word_type (noun, verb, adjective, etc.) is preserved as partOfSpeech.
 */
export function transformRawWordToItem(
  raw: RawFirestoreWord,
  targetLang: string,
  answerLang: string = 'en'
): WordItem | null {
  const targetIsLatinOrDutch = isLatinOrDutch(targetLang);

  // Determine Target Word
  let targetWord = '';
  let transliteration: string | undefined = undefined;

  if (targetIsLatinOrDutch) {
    // Latin languages + Dutch: use column WITH article
    targetWord = raw[targetLang] || raw[`${targetLang}_no_article`] || '';
  } else {
    // Non-article languages: use native column without article
    targetWord = raw[targetLang] || '';
    transliteration = raw[`${targetLang}_phonetic`];
  }

  targetWord = (targetWord || '').trim();
  if (!targetWord) {
    return null; // Target word not available in this entry
  }

  // Determine Primary Translation and Alternative Translations
  let translation = '';
  const alternatives: string[] = [];

  const answerIsLatinOrDutch = isLatinOrDutch(answerLang);

  if (!targetIsLatinOrDutch) {
    // Target is a non-article language (HE, AR, RU, FA, etc.):
    // Rule: "Voor de talen die zonder lidwoord bedoeld zijn, wil ik dat je die in alle talen kan leren,
    // maar belangrijk is dat je dan wel de kolom gebruikt zonder lidwoord."
    if (answerLang === 'en') {
      translation = raw.en_no_article || raw.en_with_article || '';
      if (raw.en_with_article && raw.en_with_article !== translation) {
        alternatives.push(raw.en_with_article);
      }
    } else if (answerIsLatinOrDutch) {
      // Use no_article column for the Latin/Dutch answer language
      translation = raw[`${answerLang}_no_article`] || raw[answerLang] || '';
      if (raw[answerLang] && raw[answerLang] !== translation) {
        alternatives.push(raw[answerLang]);
      }
    } else {
      // Non-Latin answer language (e.g. ru, he, ar, ja, etc.)
      translation = raw[answerLang] || '';
    }
  } else {
    // Target is a Latin language or Dutch:
    if (answerLang === 'en') {
      translation = raw.en_with_article || raw.en_no_article || '';
      if (raw.en_no_article && raw.en_no_article !== translation) {
        alternatives.push(raw.en_no_article);
      }
    } else if (answerIsLatinOrDutch) {
      // Use column with article for Latin/Dutch answers
      translation = raw[answerLang] || raw[`${answerLang}_no_article`] || '';
      if (raw[`${answerLang}_no_article`] && raw[`${answerLang}_no_article`] !== translation) {
        alternatives.push(raw[`${answerLang}_no_article`]);
      }
    } else {
      translation = raw[answerLang] || '';
    }
  }

  translation = (translation || '').trim();
  if (!translation) {
    // Fallback to English if translation is missing for answerLang
    translation = (raw.en_no_article || raw.en_with_article || targetWord).trim();
  }

  // Also include unarticled version of target word as alternative lookup if applicable
  if (targetIsLatinOrDutch && raw[`${targetLang}_no_article`]) {
    const noArt = raw[`${targetLang}_no_article`].trim();
    if (noArt && noArt !== targetWord) {
      alternatives.push(noArt);
    }
  }

  // Clean and split alternatives
  const cleanAlternatives = Array.from(
    new Set(
      alternatives
        .map(a => (a || '').trim())
        .filter(a => Boolean(a) && a.toLowerCase() !== translation.toLowerCase())
    )
  );

  const numLevel = raw.level ? Number(raw.level) : 1;
  const niveau = (raw.niveau as CEFRLevel) || getCefrForNumericLevel(numLevel);

  return {
    id: raw.id,
    targetWord,
    translation,
    alternativeTranslations: cleanAlternatives,
    transliteration,
    partOfSpeech: raw.word_type || undefined,
    level: niveau,
    numericLevel: numLevel,
    languagePairKey: `${targetLang}-${answerLang}`,
  };
}

/**
 * Returns all words for a specific numeric level (1 to 60) from the central Firestore collection.
 */
export function getWordsForNumericLevel(
  targetLang: string,
  numericLevel: number,
  answerLang: string = 'en'
): WordItem[] {
  const cleanLevel = Math.max(1, Math.min(60, Math.round(numericLevel || 1)));
  const matches = rawWordsStore.filter(w => w.level === cleanLevel);

  const result: WordItem[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const item = transformRawWordToItem(raw, targetLang, answerLang);
    if (item && !seen.has(item.targetWord.toLowerCase())) {
      seen.add(item.targetWord.toLowerCase());
      result.push(item);
    }
  }

  return result;
}

/**
 * Returns all ~1,000+ words for a CEFR band (A1, A2, B1, B2, C1, C2) from the central Firestore collection.
 */
export function getWordsForCefrBand(
  targetLang: string,
  cefr: CEFRLevel,
  answerLang: string = 'en'
): WordItem[] {
  const targetNiveau = (cefr || 'A1').toUpperCase();
  const matches = rawWordsStore.filter(w => (w.niveau || '').toUpperCase() === targetNiveau);

  const result: WordItem[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const item = transformRawWordToItem(raw, targetLang, answerLang);
    if (item && !seen.has(item.targetWord.toLowerCase())) {
      seen.add(item.targetWord.toLowerCase());
      result.push(item);
    }
  }

  // If filtered by niveau yielded nothing (e.g. before initial load), fallback to numeric band range
  if (result.length === 0) {
    const startLevel = getBaseNumericLevelForCefr(cefr);
    for (let lvl = startLevel; lvl < startLevel + 10; lvl++) {
      const lvlWords = getWordsForNumericLevel(targetLang, lvl, answerLang);
      for (const w of lvlWords) {
        if (!seen.has(w.targetWord.toLowerCase())) {
          seen.add(w.targetWord.toLowerCase());
          result.push(w);
        }
      }
    }
  }

  return result;
}

/**
 * Returns all words across all levels for a target language and answer language pair.
 */
export function getAllWordsForLanguage(
  targetLang: string,
  answerLang: string = 'en'
): WordItem[] {
  const result: WordItem[] = [];
  const seen = new Set<string>();

  for (const raw of rawWordsStore) {
    const item = transformRawWordToItem(raw, targetLang, answerLang);
    if (item && !seen.has(item.targetWord.toLowerCase())) {
      seen.add(item.targetWord.toLowerCase());
      result.push(item);
    }
  }

  return result;
}

/**
 * Checks whether the Firestore woorden bank is currently loaded in memory.
 */
export function isWoordenLoaded(): boolean {
  return isLoaded && rawWordsStore.length > 0;
}

/**
 * Returns the raw total count of loaded Firestore woorden.
 */
export function getLoadedWoordenCount(): number {
  return rawWordsStore.length;
}

import { getSupplementaryEntry, ENGLISH_TO_DUTCH_GLOSSARY, stripHebrewNiqqud } from '../data/supplementaryDictionary';
import { normalizeScriptForSearch, stripDiacriticsAndVowels } from '../utils/textNormalization';

/**
 * Finds a raw Firestore word entry by target word (with or without vowels) or document ID.
 */
export function findRawWord(targetWord: string, id?: string, targetLang: string = 'he'): RawFirestoreWord | null {
  if (!targetWord && !id) return null;

  // 1. Try exact document ID first
  if (id) {
    const byId = rawWordsStore.find(w => w.id === id);
    if (byId) return byId;
  }

  // 2. Try exact string match (with vowels/accents)
  if (targetWord) {
    const trimmed = targetWord.trim();
    const exact = rawWordsStore.find(w => (w[targetLang] || '').trim() === trimmed);
    if (exact) return exact;
  }

  // 3. Fallback: match by stripped vowels / diacritics & normalized script
  const normTarget = normalizeScriptForSearch(targetWord);
  if (normTarget) {
    const byTarget = rawWordsStore.find(w => {
      const rawTarget = w[targetLang] || '';
      return normalizeScriptForSearch(rawTarget) === normTarget;
    });
    if (byTarget) return byTarget;
  }

  return null;
}

/**
 * Returns a guaranteed localized WordItem whose translation and alternative translations
 * strictly match the user's selected answer language (e.g. Dutch 'nl' or English 'en').
 */
export function getLocalizedWordItem(
  word: Partial<WordItem> & { targetWord: string; id?: string },
  targetLang: string,
  answerLang: string = 'en'
): WordItem {
  const normAnswerLang = (answerLang || 'en').toLowerCase().trim();
  const cleanTarget = stripHebrewNiqqud(word.targetWord || '');

  // 1. Try resolving against the 6,824 words in the central Firestore / local database
  const raw = findRawWord(word.targetWord, word.id, targetLang);
  if (raw) {
    const item = transformRawWordToItem(raw, targetLang, normAnswerLang);
    if (item && item.translation) {
      return {
        ...item,
        id: word.id || item.id,
        targetWord: word.targetWord || item.targetWord,
        level: word.level || item.level,
        numericLevel: word.numericLevel || item.numericLevel,
        category: word.category || item.category,
      };
    }
  }

  // 2. Try the supplementary dictionary (curated for placement tests, seed sets, and higher levels)
  const supp = getSupplementaryEntry(word.targetWord);
  if (supp) {
    const isNl = normAnswerLang === 'nl';
    const translation = isNl ? supp.nl : supp.en;
    const alts = isNl ? (supp.nlAlts || []) : (supp.enAlts || []);
    return {
      id: word.id || `supp-${cleanTarget}`,
      targetWord: word.targetWord,
      translation,
      alternativeTranslations: alts.length > 0 ? alts : (word.alternativeTranslations || []),
      transliteration: word.transliteration || supp.transliteration,
      partOfSpeech: word.partOfSpeech || supp.partOfSpeech,
      level: word.level || (supp.level as CEFRLevel) || 'A1',
      numericLevel: word.numericLevel || supp.numericLevel || 1,
      languagePairKey: `${targetLang}-${normAnswerLang}`,
      exampleTarget: word.exampleTarget,
      exampleTranslation: word.exampleTranslation,
      category: word.category,
    };
  }

  // 3. Fallback: If answering in Dutch and word has an English translation, check the English -> Dutch glossary
  if (normAnswerLang === 'nl' && word.translation) {
    const cleanTrans = word.translation.trim().toLowerCase();
    const glossaryMatch = ENGLISH_TO_DUTCH_GLOSSARY[cleanTrans];
    if (glossaryMatch) {
      return {
        id: word.id || `item-${cleanTarget}`,
        targetWord: word.targetWord,
        translation: glossaryMatch.nl,
        alternativeTranslations: glossaryMatch.alts || word.alternativeTranslations || [],
        transliteration: word.transliteration,
        partOfSpeech: word.partOfSpeech,
        level: word.level || 'A1',
        numericLevel: word.numericLevel || 1,
        languagePairKey: `${targetLang}-${normAnswerLang}`,
        exampleTarget: word.exampleTarget,
        exampleTranslation: word.exampleTranslation,
        category: word.category,
      };
    }
  }

  // 4. Return word with updated languagePairKey
  return {
    id: word.id || `item-${cleanTarget}`,
    targetWord: word.targetWord,
    translation: word.translation || word.targetWord,
    alternativeTranslations: word.alternativeTranslations || [],
    transliteration: word.transliteration,
    partOfSpeech: word.partOfSpeech,
    level: word.level || 'A1',
    numericLevel: word.numericLevel || 1,
    languagePairKey: `${targetLang}-${normAnswerLang}`,
    exampleTarget: word.exampleTarget,
    exampleTranslation: word.exampleTranslation,
    category: word.category,
  };
}

/**
 * Localizes an array of WordItem objects strictly into the specified answer language.
 */
export function localizeWordList(
  words: WordItem[],
  targetLang: string,
  answerLang: string
): WordItem[] {
  return words.map(w => getLocalizedWordItem(w, targetLang, answerLang));
}

/**
 * Scans user progress and ensures every stored word has its translation updated
 * to match the user's currently selected answer language.
 */
export function localizeUserProgress(
  wordsProgress: Record<string, any>,
  targetLang: string,
  answerLang: string
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, p] of Object.entries(wordsProgress || {})) {
    if (!p || !p.targetWord) {
      result[key] = p;
      continue;
    }
    const localized = getLocalizedWordItem(
      {
        id: p.wordId || key,
        targetWord: p.targetWord,
        translation: p.translation,
        alternativeTranslations: p.alternativeTranslations,
        transliteration: p.transliteration,
        partOfSpeech: p.partOfSpeech,
        level: p.level,
        numericLevel: p.numericLevel,
        category: p.category,
      },
      targetLang,
      answerLang
    );

    result[key] = {
      ...p,
      translation: localized.translation,
      alternativeTranslations: localized.alternativeTranslations,
      languagePairKey: `${targetLang}-${answerLang}`,
    };
  }
  return result;
}

