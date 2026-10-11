import { CEFRLevel, WordItem, WordProgress } from '../types';
import {
  getVocabularyForNumericLevel,
  getVocabularyForCefrBand,
  getAllVocabularyForLanguage,
  getBankAlternativesForWord,
  getLocalizedWordItem,
  localizeWordList,
  localizeUserProgress,
} from './vocabularyBank';
import { getBaseNumericLevelForCefr, getCefrForNumericLevel } from './languages';

/**
 * VocabularyRepository
 * Single source of truth for retrieving and localizing vocabulary across
 * levels 1-60, CEFR bands, distractors, and user progress.
 */
export const VocabularyRepository = {
  getForNumericLevel: (targetLang: string, numericLevel: number, answerLang: string = 'en'): WordItem[] => {
    return getVocabularyForNumericLevel(targetLang, numericLevel, answerLang);
  },

  getForCefrBand: (targetLang: string, cefr: CEFRLevel, answerLang: string = 'en'): WordItem[] => {
    return getVocabularyForCefrBand(targetLang, cefr, answerLang);
  },

  getAll: (targetLang: string, answerLang: string = 'en'): WordItem[] => {
    return getAllVocabularyForLanguage(targetLang, answerLang);
  },

  getForLanguageAndLevel: (
    targetLanguage: string,
    level: CEFRLevel,
    knownLanguage: string = 'en',
    numericLevel?: number
  ): WordItem[] => {
    const numLevel = numericLevel || getBaseNumericLevelForCefr(level);
    return getVocabularyForNumericLevel(targetLanguage, numLevel, knownLanguage);
  },

  getAlternatives: (promptWord: string): string[] => {
    return getBankAlternativesForWord(promptWord);
  },

  localizeWord: (word: WordItem, targetLang: string = 'he', answerLang: string = 'en'): WordItem => {
    return getLocalizedWordItem(word, targetLang, answerLang);
  },

  localizeList: (words: WordItem[], targetLang: string = 'he', answerLang: string = 'en'): WordItem[] => {
    return localizeWordList(words, targetLang, answerLang);
  },

  localizeProgress: (
    progressMap: Record<string, WordProgress>,
    targetLang: string = 'he',
    answerLang: string = 'en'
  ): Record<string, WordProgress> => {
    return localizeUserProgress(progressMap, targetLang, answerLang);
  },
};

export function getSeedVocabularyForLanguageAndLevel(
  targetLanguage: string,
  level: CEFRLevel,
  knownLanguage: string = 'en',
  numericLevel?: number
): WordItem[] {
  const numLevel = numericLevel || getBaseNumericLevelForCefr(level);
  return getVocabularyForNumericLevel(targetLanguage, numLevel, knownLanguage);
}

// Direct function exports for flexible imports
export {
  getVocabularyForNumericLevel,
  getVocabularyForCefrBand,
  getAllVocabularyForLanguage,
  getBankAlternativesForWord,
  getLocalizedWordItem,
  localizeWordList,
  localizeUserProgress,
};
