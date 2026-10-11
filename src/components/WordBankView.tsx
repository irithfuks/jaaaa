import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CEFRLevel, UserProfile, WordCategory, WordItem, WordProgress } from '../types';
import { useProfile } from '../context/ProfileContext';
import {
  getLanguage,
  getNumericLevelInfo,
  getVocabularyForCefrBand,
  getVocabularyForNumericLevel,
  getAllVocabularyForLanguage,
} from '../data/languages';
import { getLocalizedWordItem } from '../data/vocabularyBank';
import { stripHebrewNiqqud } from '../data/supplementaryDictionary';
import { matchesWordItem } from '../utils/textNormalization';
import { speakWord } from '../utils/speech';
import {
  CATEGORY_DETAILS,
  CATEGORY_ORDER,
  getWordCategory,
  isWordLearnedInSession,
  isWordLearned,
  isLevelCompleteForUser,
} from '../utils/srs';
import {
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  Volume2,
  BookOpen,
  ArrowLeft,
  ChevronDown,
  Brain,
  Lightbulb,
  X,
  SlidersHorizontal,
  Filter,
  Check,
  ArrowUpDown,
} from 'lucide-react';

export type VocabFilterCategory = 'all' | 'learned' | 'new';
export type WordBankSortOption = 'journey' | 'alphabetical' | 'partOfSpeech';

export const getPartOfSpeechLabel = (pos?: string, isNl: boolean = true): string => {
  if (!pos) return '';
  const clean = pos.trim().toLowerCase();
  if (clean.includes('verb') || clean === 'werkwoord') {
    return isNl ? 'werkwoord' : 'verb';
  }
  if (clean.includes('noun') || clean === 'znw' || clean === 'zelfstandig naamwoord') {
    return isNl ? 'zelfstandig naamwoord' : 'noun';
  }
  if (clean.includes('adj') || clean === 'bijvoeglijk') {
    return isNl ? 'bijvoeglijk naamwoord' : 'adjective';
  }
  if (clean.includes('adv') || clean === 'bijwoord') {
    return isNl ? 'bijwoord' : 'adverb';
  }
  if (clean.includes('prep') || clean === 'voorzetsel') {
    return isNl ? 'voorzetsel' : 'preposition';
  }
  if (clean.includes('pron') || clean === 'voornaamwoord') {
    return isNl ? 'voornaamwoord' : 'pronoun';
  }
  if (clean.includes('conj') || clean === 'voegwoord') {
    return isNl ? 'voegwoord' : 'conjunction';
  }
  if (clean.includes('phrase') || clean.includes('uitdrukking')) {
    return isNl ? 'uitdrukking' : 'phrase';
  }
  if (clean.includes('num') || clean === 'getal' || clean === 'telwoord') {
    return isNl ? 'telwoord' : 'number';
  }
  if (clean.includes('interj') || clean === 'tussenwerpsel') {
    return isNl ? 'tussenwerpsel' : 'interjection';
  }
  return pos;
};

interface WordBankViewProps {
  profile: UserProfile;
  onBackToStudy: () => void;
  onToggleHardWord: (wordId: string) => void;
  onUpdateProfile?: (updatedOrUpdater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => void;
  initialCategory?: WordCategory | 'all' | 'learned' | 'new';
}

type BankScope = 'my-level' | 'total-a1' | 'total-a2' | 'total-b1' | 'total-b2' | 'total-c1' | 'total-c2' | 'all-levels' | `level-${number}`;

const mapInitialFilter = (cat?: string): VocabFilterCategory => {
  if (!cat || cat === 'all') return 'all';
  if (cat === 'blue' || cat === 'mastered' || cat === 'learned') return 'learned';
  if (cat === 'red' || cat === 'new') return 'new';
  return 'all';
};

// Helper to strip slashes and multiple options from translation string to leave pure primary English word
const cleanTranslation = (text: string): string => {
  if (!text) return '';
  return text.split(/[/,;|]/)[0].trim();
};

export const WordBankView: React.FC<WordBankViewProps> = ({
  profile,
  onBackToStudy,
  onToggleHardWord,
  onUpdateProfile,
  initialCategory = 'all',
}) => {
  const userNumLevel = profile.numericLevel || 1;
  const isNl = profile.knownLanguage === 'nl';

  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(userNumLevel);
  const [selectedScope, setSelectedScope] = useState<BankScope>(`level-${userNumLevel}`);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<VocabFilterCategory>(() => mapInitialFilter(initialCategory));

  // Sort order option: journey, alphabetical, or partOfSpeech
  const [sortBy, setSortBy] = useState<WordBankSortOption>(() => {
    const saved = localStorage.getItem('study_sort_by');
    if (saved === 'alphabetical' || saved === 'partOfSpeech') return saved;
    return 'journey';
  });

  const handleSetSortBy = (option: WordBankSortOption) => {
    setSortBy(option);
    localStorage.setItem('study_sort_by', option);
  };

  // Card view toggles (schuifjes)
  const [showPhonetic, setShowPhonetic] = useState(() => {
    return localStorage.getItem('study_show_phonetic') !== 'false';
  });

  const handleTogglePhonetic = () => {
    setShowPhonetic(prev => {
      const next = !prev;
      localStorage.setItem('study_show_phonetic', String(next));
      return next;
    });
  };

  const [showPartOfSpeech, setShowPartOfSpeech] = useState<boolean>(() => {
    return localStorage.getItem('study_show_part_of_speech') === 'true';
  });

  const handleTogglePartOfSpeech = () => {
    setShowPartOfSpeech(prev => {
      const next = !prev;
      localStorage.setItem('study_show_part_of_speech', String(next));
      return next;
    });
  };

  const [showAudio, setShowAudio] = useState<boolean>(() => {
    return localStorage.getItem('study_show_audio') !== 'false';
  });

  const handleToggleAudio = () => {
    setShowAudio(prev => {
      const next = !prev;
      localStorage.setItem('study_show_audio', String(next));
      return next;
    });
  };

  // State for filter options dropdown
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // State for single-card popover & multi-selection
  const [activePopoverWordId, setActivePopoverWordId] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [recentlyMasteredWordId, setRecentlyMasteredWordId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; word: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const profileContext = useProfile();
  const updateProfile = onUpdateProfile || profileContext?.updateProfile;

  // Handle clicking outside to dismiss status popover, filter menu, and clear selection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterMenuOpen(false);
      }
      if (!target.closest('.vocab-word-card, .vocab-mini-popover, .vocab-bulk-action-bar')) {
        setActivePopoverWordId(null);
        setSelectedWordIds((prev) => (prev.size === 0 ? prev : new Set()));
        setIsMultiSelectMode(false);
        setLastSelectedIndex(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
        setActivePopoverWordId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Clean up toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Helper to check if a blue word can be shifted back to red 'new'
  const canShiftBlueToRed = (item: WordItem, progress?: WordProgress): boolean => {
    const wordLevel = item.numericLevel || progress?.numericLevel || selectedLevelNum || 1;
    // 1. Learned via daily session -> cannot shift manually back to new
    if (isWordLearnedInSession(progress)) {
      return false;
    }
    // 2. Level is complete -> cannot shift words back to new
    if (isLevelCompleteForUser(profile, wordLevel)) {
      return false;
    }
    // Still busy in the level, manually set to blue -> CAN shift back to new!
    return true;
  };

  const handleSetWordCategory = (item: WordItem, newCategory: WordCategory) => {
    const wordId = item.id;
    const now = Date.now();
    const isBlue = newCategory === 'blue';
    const isRed = newCategory === 'red';

    if (updateProfile) {
      updateProfile((prevProfile: UserProfile) => {
        const existing = prevProfile.words?.[wordId];
        const updatedWords = { ...(prevProfile.words || {}) };

        if (isRed) {
          // Setting back to new removes it from learned words map completely
          delete updatedWords[wordId];
        } else {
          let updatedProgress: WordProgress;
          if (existing) {
            updatedProgress = {
              ...existing,
              category: 'blue',
              cleanSessionsCount: Math.max(4, existing.cleanSessionsCount || 4),
              consecutiveCorrect: Math.max(4, existing.consecutiveCorrect || 4),
              timesReviewed: Math.max(1, existing.timesReviewed || 1),
              timesCorrect: Math.max(1, existing.timesCorrect || 1),
              timesIncorrect: existing.timesIncorrect || 0,
              isHard: false,
              hardScore: 0,
              difficultyScore: 1,
              lastReviewedAt: now,
              nextReviewAt: now + 14 * 24 * 60 * 60 * 1000,
              intervalDays: Math.max(14, existing.intervalDays || 14),
              history: existing.history?.length ? existing.history : [{ timestamp: now, wasCorrect: true }],
              manuallyLearned: true,
            };
          } else {
            updatedProgress = {
              wordId: item.id,
              targetWord: item.targetWord,
              translation: item.translation,
              alternativeTranslations: item.alternativeTranslations || [],
              transliteration: item.transliteration || '',
              partOfSpeech: item.partOfSpeech || '',
              exampleTarget: item.exampleTarget || '',
              exampleTranslation: item.exampleTranslation || '',
              level: item.level || 'A1',
              numericLevel: item.numericLevel || 1,
              languagePairKey: item.languagePairKey || `${prevProfile.targetLanguage}-${prevProfile.knownLanguage}`,
              category: 'blue',
              cleanSessionsCount: 4,
              timesReviewed: 1,
              timesCorrect: 1,
              timesIncorrect: 0,
              consecutiveCorrect: 4,
              isHard: false,
              hardScore: 0,
              difficultyScore: 1,
              firstLearnedAt: now,
              introducedAt: now,
              lastReviewedAt: now,
              nextReviewAt: now + 14 * 24 * 60 * 60 * 1000,
              intervalDays: 14,
              history: [{ timestamp: now, wasCorrect: true }],
              manuallyLearned: true,
            };
          }
          updatedWords[wordId] = updatedProgress;
        }

        return {
          ...prevProfile,
          words: updatedWords,
        };
      });
    }

    // Close the popover
    setActivePopoverWordId(null);

    // Provide feedback toast
    if (newCategory === 'blue') {
      setRecentlyMasteredWordId(wordId);
      setToastMessage({ text: 'toegevoegd aan geleerd', word: item.targetWord });
    } else {
      setToastMessage({ text: 'teruggezet naar nieuw', word: item.targetWord });
    }

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setRecentlyMasteredWordId(null);
      setToastMessage(null);
    }, 2500);
  };

  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);
  const knownLang = getLanguage(profile.knownLanguage);

  // 1. Resolve words based on selected scope
  const scopeWords = useMemo<WordItem[]>(() => {
    const lang = profile.knownLanguage || 'en';
    if (selectedScope === 'my-level') {
      return getVocabularyForNumericLevel(profile.targetLanguage, userNumLevel, lang);
    }
    if (selectedScope === 'total-a1') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'A1', lang);
    }
    if (selectedScope === 'total-a2') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'A2', lang);
    }
    if (selectedScope === 'total-b1') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'B1', lang);
    }
    if (selectedScope === 'total-b2') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'B2', lang);
    }
    if (selectedScope === 'total-c1') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'C1', lang);
    }
    if (selectedScope === 'total-c2') {
      return getVocabularyForCefrBand(profile.targetLanguage, 'C2', lang);
    }
    if (selectedScope === 'all-levels') {
      const all: WordItem[] = [];
      const seen = new Set<string>();
      for (let l = 1; l <= 60; l++) {
        const lvlWords = getVocabularyForNumericLevel(profile.targetLanguage, l, lang);
        for (const w of lvlWords) {
          const key = w.id || `${l}_${(w.targetWord || '').trim().toLowerCase()}`;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          all.push({ ...w, numericLevel: w.numericLevel || l });
        }
      }
      return all;
    }
    if (selectedScope.startsWith('level-')) {
      const lvl = parseInt(selectedScope.replace('level-', ''), 10);
      return getVocabularyForNumericLevel(profile.targetLanguage, lvl || 1, lang);
    }
    return getVocabularyForNumericLevel(profile.targetLanguage, userNumLevel, lang);
  }, [selectedScope, profile.targetLanguage, profile.knownLanguage, userNumLevel]);

  // 2. Map word items to their user progress (if practiced)
  const wordsWithProgress = useMemo(() => {
    const userWords = (profile.words || {}) as Record<string, WordProgress>;
    const userWordsList = Object.values(userWords);
    const isAllLevels = selectedScope === 'all-levels';
    return scopeWords.map(rawWord => {
      const word = getLocalizedWordItem(rawWord, profile.targetLanguage, profile.knownLanguage);
      const targetWordLevel = word.numericLevel || (selectedScope.startsWith('level-') ? parseInt(selectedScope.replace('level-', ''), 10) : userNumLevel);
      
      // Match strictly by ID first
      let rawProgress: WordProgress | undefined = userWords[word.id] || userWords[rawWord.id];
      // If direct match found, ensure it doesn't belong to a different numeric level
      if (rawProgress && rawProgress.numericLevel && targetWordLevel && rawProgress.numericLevel !== targetWordLevel && rawProgress.wordId !== word.id && rawProgress.wordId !== rawWord.id) {
        rawProgress = undefined;
      }
      // Fallback matching in userWordsList:
      if (!rawProgress) {
        rawProgress = userWordsList.find(p => {
          if (p.wordId === word.id || p.wordId === rawWord.id) {
            if (p.numericLevel && targetWordLevel && p.numericLevel !== targetWordLevel) return false;
            return true;
          }
          if (p.numericLevel && targetWordLevel && p.numericLevel !== targetWordLevel) return false;
          return p.targetWord === word.targetWord;
        });
      }

      let progress: WordProgress | undefined = rawProgress;
      if (rawProgress) {
        const localizedProgItem = getLocalizedWordItem({
          id: rawProgress.wordId,
          targetWord: rawProgress.targetWord,
          translation: rawProgress.translation,
          alternativeTranslations: rawProgress.alternativeTranslations,
          transliteration: rawProgress.transliteration,
          partOfSpeech: rawProgress.partOfSpeech,
          exampleTarget: rawProgress.exampleTarget,
          exampleTranslation: rawProgress.exampleTranslation,
          level: rawProgress.level,
          numericLevel: rawProgress.numericLevel,
          languagePairKey: rawProgress.languagePairKey,
        }, profile.targetLanguage, profile.knownLanguage);

        progress = {
          ...rawProgress,
          translation: localizedProgItem.translation,
          alternativeTranslations: localizedProgItem.alternativeTranslations,
        };
      }
      const isStudied = !!progress && (progress.timesReviewed ?? 0) > 0;
      const wordLevel = word.numericLevel || progress?.numericLevel || selectedLevelNum || 1;
      const isLearnedSession = isWordLearnedInSession(progress);
      const isManualLearned = progress?.manuallyLearned === true;
      const isLevelComplete = isLevelCompleteForUser(profile, wordLevel);

      // Categories: 'learned' (blue) vs 'new' (red)
      // A word is 'learned' (blue) IF AND ONLY IF:
      // - It has been studied in a daily session (isWordLearnedInSession)
      // - OR manually set to blue by the user (progress.manuallyLearned === true)
      // NEVER automatically put words in learned!
      const isLearned = isWordLearned(progress);
      const displayCategory: 'learned' | 'new' = isLearned ? 'learned' : 'new';
      const rawCategory: WordCategory = isLearned ? 'blue' : 'red';
      const canShiftBack = displayCategory === 'learned';

      return {
        item: word,
        progress,
        isStudied,
        category: rawCategory,
        displayCategory,
        isHard: progress?.isHard ?? false,
        wordLevel,
        isLearnedSession,
        isLevelComplete,
        canShiftBack,
      };
    });
  }, [scopeWords, profile, selectedLevelNum, selectedScope, userNumLevel]);

  // 3. Compute statistics for current scope
  const stats = useMemo(() => {
    const total = wordsWithProgress.length;
    const learned = wordsWithProgress.filter(w => w.displayCategory === 'learned').length;
    const newWords = wordsWithProgress.filter(w => w.displayCategory === 'new').length;
    const studied = wordsWithProgress.filter(w => w.isStudied).length;

    return { total, learned, new: newWords, studied };
  }, [wordsWithProgress]);

  // Compute percentage progress (only 2 categories: new and learned)
  const levelProgressStats = useMemo(() => {
    const totalWords = Math.max(wordsWithProgress.length, 1);
    const learnedWords = wordsWithProgress.filter(w => w.displayCategory === 'learned').length;
    const masteryPercentage = Math.round((learnedWords / totalWords) * 100);

    return {
      categoryCounts: {
        red: totalWords - learnedWords,
        orange: 0,
        yellow: 0,
        green: 0,
        blue: learnedWords,
      },
      totalWords,
      earnedLevelPoints: learnedWords,
      maxPossibleLevelPoints: totalWords,
      masteryPercentage,
    };
  }, [wordsWithProgress]);

  // 4. Apply search and category filter
  const filteredWords = useMemo(() => {
    return wordsWithProgress.filter(({ item, displayCategory }) => {
      // Search match (handles Hebrew nikud, Arabic harakat, Farsi vowels, phonetics, translations)
      if (searchQuery.trim()) {
        if (!matchesWordItem(item, searchQuery)) {
          return false;
        }
      }

      // Category match
      if (filterCategory !== 'all') {
        return displayCategory === filterCategory;
      }
      return true;
    });
  }, [wordsWithProgress, searchQuery, filterCategory]);

  // 5. Apply sorting (journey, alphabetical, or partOfSpeech)
  const displayedWords = useMemo(() => {
    if (sortBy === 'journey' || (sortBy as string) === 'default') {
      return filteredWords;
    }
    const list = [...filteredWords];
    if (sortBy === 'alphabetical') {
      return list.sort((a, b) => {
        return (a.item.targetWord || '').localeCompare(b.item.targetWord || '', undefined, { sensitivity: 'base' });
      });
    }
    if (sortBy === 'partOfSpeech') {
      const getPosPrio = (pos?: string): number => {
        if (!pos) return 99;
        const p = pos.trim().toLowerCase();
        if (p.includes('verb') || p === 'werkwoord') return 1;
        if (p.includes('noun') || p === 'znw' || p === 'zelfstandig naamwoord') return 2;
        if (p.includes('adj') || p === 'bijvoeglijk') return 3;
        if (p.includes('adv') || p === 'bijwoord') return 4;
        if (p.includes('prep') || p === 'voorzetsel') return 5;
        if (p.includes('pron') || p === 'voornaamwoord') return 6;
        if (p.includes('conj') || p === 'voegwoord') return 7;
        if (p.includes('phrase') || p.includes('uitdrukking')) return 8;
        if (p.includes('num') || p === 'telwoord') return 9;
        return 50;
      };

      return list.sort((a, b) => {
        const prioA = getPosPrio(a.item.partOfSpeech);
        const prioB = getPosPrio(b.item.partOfSpeech);
        if (prioA !== prioB) return prioA - prioB;
        return (a.item.targetWord || '').localeCompare(b.item.targetWord || '', undefined, { sensitivity: 'base' });
      });
    }
    return list;
  }, [filteredWords, sortBy]);

  const handleCardClick = (index: number, wordId: string, e: React.MouseEvent) => {
    // 1. Shift click: range selection between anchor and clicked item
    if (e.shiftKey) {
      e.preventDefault();
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
      const anchor = lastSelectedIndex !== null ? lastSelectedIndex : index;
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);

      setSelectedWordIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (displayedWords[i]) {
            next.add(displayedWords[i].item.id);
          }
        }
        setIsMultiSelectMode(next.size > 0);
        return next;
      });
      setLastSelectedIndex(index);
      setActivePopoverWordId(null);
      return;
    }

    // 2. Command / Ctrl click: individual toggle on random spots
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
      setSelectedWordIds((prev) => {
        const next = new Set(prev);
        if (next.has(wordId)) {
          next.delete(wordId);
        } else {
          next.add(wordId);
        }
        setIsMultiSelectMode(next.size > 0);
        return next;
      });
      setLastSelectedIndex(index);
      setActivePopoverWordId(null);
      return;
    }

    // 3. Normal simple click:
    const targetWordEntry = displayedWords[index] || displayedWords.find((w) => w.item.id === wordId);
    if (targetWordEntry && targetWordEntry.displayCategory === 'learned' && !targetWordEntry.canShiftBack) {
      // Cannot shift back to new because learned in daily session or level is complete
      setActivePopoverWordId(null);
      setSelectedWordIds(new Set([wordId]));
      setIsMultiSelectMode(false);
      setLastSelectedIndex(index);
      setToastMessage({ text: 'Dit woord heb je al geleerd', word: targetWordEntry.item.targetWord });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 2200);
      return;
    }

    setLastSelectedIndex(index);
    setSelectedWordIds(new Set([wordId]));
    setIsMultiSelectMode(false);
    setActivePopoverWordId((prev) => (prev === wordId ? null : wordId));
  };

  const selectedEntries = useMemo(() => {
    if (selectedWordIds.size === 0) return [];
    return wordsWithProgress.filter((w) => selectedWordIds.has(w.item.id));
  }, [wordsWithProgress, selectedWordIds]);

  const hasSelectedLearned = useMemo(() => {
    return selectedEntries.some((w) => w.displayCategory === 'learned');
  }, [selectedEntries]);

  const hasSelectedNew = useMemo(() => {
    return selectedEntries.some((w) => w.displayCategory === 'new');
  }, [selectedEntries]);

  const handleBulkSetCategory = (newCategory: WordCategory) => {
    if (selectedWordIds.size === 0 || !updateProfile) return;
    const now = Date.now();
    const isBlue = newCategory === 'blue';
    const isRed = newCategory === 'red';

    let eligibleCount = 0;
    let blockedCount = 0;

    updateProfile((prevProfile: UserProfile) => {
      const updatedWords = { ...prevProfile.words };
      selectedWordIds.forEach((id) => {
        const item = scopeWords.find((w) => w.id === id) || displayedWords.find((w) => w.item.id === id)?.item;
        if (!item) return;

        const existing = updatedWords[id];
        if (isRed) {
          const allowed = canShiftBlueToRed(item, existing);
          if (!allowed) {
            blockedCount++;
            return;
          }
        }

        eligibleCount++;

        if (isRed) {
          delete updatedWords[id];
        } else if (existing) {
          updatedWords[id] = {
            ...existing,
            category: 'blue',
            cleanSessionsCount: Math.max(4, existing.cleanSessionsCount || 4),
            consecutiveCorrect: Math.max(4, existing.consecutiveCorrect || 4),
            timesReviewed: Math.max(1, existing.timesReviewed || 1),
            timesCorrect: Math.max(1, existing.timesCorrect || 1),
            timesIncorrect: existing.timesIncorrect || 0,
            isHard: false,
            hardScore: 0,
            difficultyScore: 1,
            lastReviewedAt: now,
            nextReviewAt: now + 14 * 24 * 60 * 60 * 1000,
            intervalDays: Math.max(14, existing.intervalDays || 14),
            history: existing.history?.length ? existing.history : [{ timestamp: now, wasCorrect: true }],
            manuallyLearned: true,
          };
        } else {
          updatedWords[id] = {
            wordId: item.id,
            targetWord: item.targetWord,
            translation: item.translation,
            alternativeTranslations: item.alternativeTranslations || [],
            transliteration: item.transliteration || '',
            partOfSpeech: item.partOfSpeech || '',
            exampleTarget: item.exampleTarget || '',
            exampleTranslation: item.exampleTranslation || '',
            level: item.level || 'A1',
            numericLevel: item.numericLevel || 1,
            languagePairKey: item.languagePairKey || `${prevProfile.targetLanguage}-${prevProfile.knownLanguage}`,
            category: 'blue',
            cleanSessionsCount: 4,
            timesReviewed: 1,
            timesCorrect: 1,
            timesIncorrect: 0,
            consecutiveCorrect: 4,
            isHard: false,
            hardScore: 0,
            difficultyScore: 1,
            firstLearnedAt: now,
            introducedAt: now,
            lastReviewedAt: now,
            nextReviewAt: now + 14 * 24 * 60 * 60 * 1000,
            intervalDays: 14,
            history: [{ timestamp: now, wasCorrect: true }],
            manuallyLearned: true,
          };
        }
      });

      return {
        ...prevProfile,
        words: updatedWords,
      };
    });

    setSelectedWordIds(new Set());
    setIsMultiSelectMode(false);
    setLastSelectedIndex(null);

    if (isRed) {
      if (eligibleCount > 0 && blockedCount === 0) {
        setToastMessage({ text: 'teruggezet naar nieuw', word: `${eligibleCount} ${eligibleCount === 1 ? 'woord' : 'woorden'}` });
      } else if (eligibleCount > 0 && blockedCount > 0) {
        setToastMessage({ text: `${eligibleCount} ${eligibleCount === 1 ? 'woord' : 'woorden'} teruggezet (${blockedCount} al geleerd)`, word: '' });
      } else {
        setToastMessage({ text: 'Dit woord heb je al geleerd', word: `${blockedCount} ${blockedCount === 1 ? 'woord' : 'woorden'}` });
      }
    } else {
      setToastMessage({ text: 'toegevoegd aan geleerd', word: `${eligibleCount} ${eligibleCount === 1 ? 'woord' : 'woorden'}` });
    }

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToStudy}
            aria-label="Back"
            title="Back"
            className="p-2 -ml-1 rounded-xl text-stone-600 hover:text-stone-950 hover:bg-stone-200/70 dark:text-stone-300 dark:hover:text-white dark:hover:bg-stone-800 cursor-pointer transition-colors inline-flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-900 dark:text-white">
            Vocab Library
          </h1>
        </div>
      </div>

      {/* Unified Scope & Category Filter Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 sm:p-3.5 border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Level Selector & Category Filters on the same line */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Level Selector - Primary / prominent button */}
            <div className="relative inline-flex items-center rounded-xl bg-stone-900 text-white shadow-sm hover:bg-stone-800 transition-colors group cursor-pointer ring-1 ring-stone-900/10">
              <div className="pl-3.5 pr-1.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white select-none">
                {selectedScope === 'all-levels' ? 'All words' : `Level ${selectedLevelNum}`}
              </div>

              {/* Dropdown trigger with all levels + All words */}
              <div className="relative inline-flex items-center pr-2.5 pl-0.5">
                <select
                  id="vocab-level-selector"
                  value={selectedScope === 'all-levels' ? 'all-levels' : `level-${selectedLevelNum}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all-levels') {
                      setSelectedScope('all-levels');
                    } else {
                      const lvl = parseInt(val.replace('level-', ''), 10);
                      setSelectedLevelNum(lvl);
                      setSelectedScope(`level-${lvl}`);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title="Selecteer level of All words"
                >
                  <option value="all-levels" className="bg-white text-stone-900 font-semibold">
                    All words
                  </option>
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((lvl) => (
                    <option key={lvl} value={`level-${lvl}`} className="bg-white text-stone-900 font-semibold">
                      Level {lvl}
                    </option>
                  ))}
                </select>
                <div className="w-5 h-5 rounded-md flex items-center justify-center transition-colors pointer-events-none bg-stone-800 text-stone-200 group-hover:bg-stone-700">
                  <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Subtle separator */}
            <div className="h-5 w-px bg-stone-200 dark:bg-stone-700 hidden sm:block mx-0.5" />

            {/* Category Filters: Alle -> Nieuw -> Geleerd */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  filterCategory === 'all'
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white border-stone-300 dark:border-stone-600 shadow-xs'
                    : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border-stone-200 dark:border-stone-800'
                }`}
              >
                <span>Alle ({stats.total})</span>
              </button>

              {/* Nieuw (Red) */}
              <button
                type="button"
                onClick={() => setFilterCategory(filterCategory === 'new' ? 'all' : 'new')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  filterCategory === 'new'
                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-xs font-bold'
                    : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border-stone-200 dark:border-stone-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Nieuw ({stats.new})</span>
              </button>

              {/* Geleerd (Blue) */}
              <button
                type="button"
                onClick={() => setFilterCategory(filterCategory === 'learned' ? 'all' : 'learned')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  filterCategory === 'learned'
                    ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 shadow-xs font-bold'
                    : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border-stone-200 dark:border-stone-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Geleerd ({stats.learned})</span>
              </button>
            </div>
          </div>

          {/* Right: Black & White Progress Line + Percentage (placed where colored line was) */}
          <div className="w-28 sm:w-36 shrink-0 flex items-center gap-2 self-end sm:self-center">
            <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden border border-stone-200/90 dark:border-stone-700">
              <div
                style={{ width: `${levelProgressStats.masteryPercentage}%` }}
                className="h-full bg-stone-800 dark:bg-stone-200 rounded-full transition-all duration-500"
                title={`${levelProgressStats.masteryPercentage}% voortgang (${levelProgressStats.earnedLevelPoints}/${levelProgressStats.maxPossibleLevelPoints} woorden)`}
              />
            </div>
            <span className="font-mono text-xs text-stone-700 dark:text-stone-300 font-bold shrink-0">
              {levelProgressStats.masteryPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Words Section: Header + Grid unified so words/searchbar/filter belongs directly to the cards */}
      <div className="space-y-2.5 -mt-2 sm:-mt-2.5">
        {/* Floating Header: Words count, Search Bar & Filter Button (floating freely without container box) */}
        <div className="flex items-center justify-between gap-2.5 px-0.5 text-stone-500 dark:text-stone-400 text-[11px] font-bold uppercase tracking-wider">
          <span className="truncate">
            {isNl ? 'Woorden' : 'Words'} ({displayedWords.length} {isNl ? 'woorden' : 'words'})
          </span>

        {/* Right side: Compact search bar + Filter button floating cleanly */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Shortened search bar matching Review */}
          <div className="relative w-36 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder={isNl ? 'Zoeken...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1 rounded-lg text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-normal normal-case shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 cursor-pointer"
                title="Wissen"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Button (in place of '?') */}
          <div className="relative shrink-0" ref={filterMenuRef}>
            <button
              type="button"
              id="wordbank-filter-options-btn"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer hover:scale-110 active:scale-95 shrink-0 ${
                isFilterMenuOpen
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
              }`}
              title="Filter"
              aria-label="Filter"
              aria-expanded={isFilterMenuOpen}
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>

            {/* Filter Dropdown */}
            {isFilterMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl p-4 z-40 animate-in fade-in zoom-in-95 duration-150 normal-case tracking-normal"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                    Filter
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterMenuOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  title="Sluiten"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Section 1: Volgorde */}
              <div className="py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
                  {isNl ? 'Volgorde' : 'Order'}
                </p>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSetSortBy('journey')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      sortBy === 'journey' || (sortBy as string) === 'default'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span>Journey</span>
                    {(sortBy === 'journey' || (sortBy as string) === 'default') && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetSortBy('alphabetical')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      sortBy === 'alphabetical'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span>Alphabetical A-&gt;Z</span>
                    {sortBy === 'alphabetical' && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetSortBy('partOfSpeech')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                      sortBy === 'partOfSpeech'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span>Word type</span>
                    {sortBy === 'partOfSpeech' && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

              {/* Section 2: Flashcard view */}
              <div className="pt-3 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2.5">
                  Flashcard view
                </p>
                <div className="space-y-3">
                  {/* Schuifje 1: Fonetisch */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {isNl ? 'Fonetisch' : 'Phonetic'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPhonetic}
                      onClick={handleTogglePhonetic}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out ${
                        showPhonetic ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                          showPhonetic ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Schuifje 2: Type woord */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {isNl ? 'Type woord' : 'Word type'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPartOfSpeech}
                      onClick={handleTogglePartOfSpeech}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out ${
                        showPartOfSpeech ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                          showPartOfSpeech ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Schuifje 3: Audio */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Audio
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showAudio}
                      onClick={handleToggleAudio}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out ${
                        showAudio ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                          showAudio ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
              {/* Filter Dropdown end */}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Word Grid / Cards */}
      {displayedWords.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 sm:p-12 text-center border border-stone-200 space-y-3.5">
          <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-base font-bold text-stone-900">
            {searchQuery.trim() ? `Geen woorden gevonden voor "${searchQuery}"` : 'Geen woorden in deze categorie'}
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {searchQuery.trim()
              ? selectedScope !== 'all-levels'
                ? `Dit woord staat mogelijk in een ander level. Klik hieronder om in alle 60 levels te zoeken.`
                : 'Controleer de spelling of probeer een ander zoekwoord of vertaling.'
              : 'Probeer een andere categorie of zoekterm.'}
          </p>
          {searchQuery.trim() && selectedScope !== 'all-levels' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSelectedScope('all-levels')}
                className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer shadow-xs"
              >
                Zoek in alle levels
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5 select-none">
          {displayedWords.map(({ item, progress, isStudied, displayCategory, isHard, canShiftBack }, index) => {
            const hardScore = progress?.hardScore ?? (progress?.timesIncorrect ? progress.timesIncorrect : (isHard ? 2 : 0));
            const isSelected = selectedWordIds.has(item.id);
            const isLearned = displayCategory === 'learned';
            const cannotShift = isLearned && !canShiftBack;

            return (
              <div
                key={item.id}
                onMouseDown={(e) => {
                  // Prevent browser native text selection when Shift or Command is held
                  if (e.shiftKey || e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                  }
                }}
                onClick={(e) => handleCardClick(index, item.id, e)}
                title={cannotShift ? 'Dit woord heb je al geleerd' : undefined}
                className={`vocab-word-card group/card relative bg-white rounded-2xl p-4 sm:p-5 border shadow-xs flex flex-col justify-between gap-3 transition-all select-none ${
                  cannotShift ? 'cursor-default' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-400/40 bg-sky-50/20 shadow-md'
                    : 'border-stone-200 hover:border-stone-300 hover:shadow-2xs'
                }`}
              >
                {/* Mini popover on normal simple click */}
                {activePopoverWordId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="vocab-mini-popover absolute right-3 top-3 z-40 flex items-center gap-1.5 p-1 rounded-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none ring-2 ring-stone-900/10 dark:ring-white/10"
                  >
                    {isLearned ? (
                      canShiftBack && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetWordCategory(item, 'red');
                            setActivePopoverWordId(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                          title="Zet op 'nieuw'"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0 shadow-xs" />
                          <span>nieuw</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleSetWordCategory(item, 'blue');
                          setActivePopoverWordId(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                        title="Zet op 'geleerd'"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0 shadow-xs" />
                        <span>geleerd</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActivePopoverWordId(null)}
                      className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      title="Sluiten"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Header & Word */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`font-serif text-2xl font-bold text-stone-900 tracking-wide ${
                          targetLang.rtl ? 'font-hebrew' : ''
                        }`}
                        dir={targetLang.rtl ? 'rtl' : 'ltr'}
                      >
                        {item.targetWord}
                      </span>
                      {showAudio && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWord(item.targetWord, profile.targetLanguage);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Listen to pronunciation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                      {selectedScope === 'all-levels' && (
                        <span className="text-[10px] font-bold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-md">
                          Lvl {item.numericLevel || progress?.numericLevel || 1}
                        </span>
                      )}
                    </div>

                    {/* Subtitle area: phonetic, part of speech, or both */}
                    {showPartOfSpeech && !showPhonetic && item.partOfSpeech && (
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 italic animate-in fade-in duration-150">
                        {getPartOfSpeechLabel(item.partOfSpeech, isNl)}
                      </p>
                    )}
                    {showPhonetic && !showPartOfSpeech && item.transliteration && (
                      <p className="text-xs font-mono text-amber-900/80 dark:text-amber-300/90 font-medium animate-in fade-in duration-150">
                        /{item.transliteration}/
                      </p>
                    )}
                    {showPhonetic && showPartOfSpeech && (item.transliteration || item.partOfSpeech) && (
                      <div className="flex items-center gap-2 flex-wrap text-xs animate-in fade-in duration-150">
                        {item.transliteration && (
                          <span className="font-mono text-amber-900/80 dark:text-amber-300/90 font-medium">
                            /{item.transliteration}/
                          </span>
                        )}
                        {item.partOfSpeech && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                            {getPartOfSpeechLabel(item.partOfSpeech, isNl)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-0.5">
                      <p className="text-sm font-semibold text-stone-800">
                        {cleanTranslation(item.translation)}
                      </p>
                    </div>
                  </div>

                  {/* Badges & Status - Category Dot */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Category Dot Button */}
                    <div className="relative inline-flex items-center group/dot">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(index, item.id, e);
                        }}
                        className={`w-3.5 h-3.5 rounded-full shrink-0 transition-all focus:outline-none ${
                          cannotShift
                            ? 'cursor-not-allowed bg-sky-400 ring-2 ring-sky-200 dark:ring-sky-800'
                            : isLearned
                            ? 'cursor-pointer hover:scale-125 bg-sky-400 hover:bg-sky-500 ring-2 ring-sky-200 dark:ring-sky-800'
                            : 'cursor-pointer hover:scale-125 bg-rose-400 hover:bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-800'
                        }`}
                        title={
                          cannotShift
                            ? 'Dit woord heb je al geleerd'
                            : isLearned
                            ? "Geleerd (klik om te wijzigen naar nieuw)"
                            : "Nieuw (klik om te wijzigen naar geleerd)"
                        }
                        aria-label={
                          cannotShift
                            ? 'Dit woord heb je al geleerd'
                            : isLearned
                            ? "Geleerd"
                            : "Nieuw"
                        }
                      />

                      {/* Brief inline feedback pill 'toegevoegd aan geleerd' */}
                      {recentlyMasteredWordId === item.id && (
                        <span className="absolute right-0 -top-8 whitespace-nowrap bg-sky-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-sky-400/40 animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1.5 z-40 pointer-events-none">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-200" />
                          <span>toegevoegd aan geleerd</span>
                        </span>
                      )}

                      {/* Hover tooltip for unshiftable learned word */}
                      {cannotShift && (
                        <div className="absolute right-0 -top-8 pointer-events-none opacity-0 group-hover/card:opacity-100 group-hover/dot:opacity-100 transition-opacity duration-150 z-30 whitespace-nowrap bg-stone-900/95 dark:bg-stone-800 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-lg border border-stone-700/80 flex items-center gap-1.5 backdrop-blur-xs">
                          <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>Dit woord heb je al geleerd</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Example sentence - English and Hebrew aligned at the same height */}
                {item.exampleTarget && (
                  <div className="bg-stone-50 rounded-xl px-3 py-2 text-xs border border-stone-100 flex flex-row items-baseline justify-between gap-3">
                    {item.exampleTranslation ? (
                      <p className="text-[11px] text-stone-600 italic text-left">
                        {item.exampleTranslation}
                      </p>
                    ) : <span />}
                    <p
                      className={`font-normal text-stone-700 text-right ${targetLang.rtl ? 'font-hebrew font-normal text-sm' : ''}`}
                      dir={targetLang.rtl ? 'rtl' : 'ltr'}
                    >
                      {item.exampleTarget}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Floating Multi-Select Action Bar (shown when Command/Shift selecting >= 1 word, or multi-selecting > 1) */}
      {(selectedWordIds.size > 1 || (isMultiSelectMode && selectedWordIds.size > 0)) && (
        <div className="vocab-bulk-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-stone-900/95 dark:bg-stone-850/95 backdrop-blur-md text-white border border-stone-700 shadow-2xl animate-in slide-in-from-bottom-4 duration-150">
          <span className="text-xs font-bold text-stone-300 whitespace-nowrap">
            {selectedWordIds.size} geselecteerd
          </span>
          <div className="h-4 w-px bg-stone-700" />
          {hasSelectedNew && (
            <button
              type="button"
              onClick={() => handleBulkSetCategory('blue')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 active:scale-95 text-stone-100 font-semibold text-xs border border-stone-600 transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="Zet geselecteerde woorden op 'geleerd'"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0 shadow-xs" />
              <span>geleerd</span>
            </button>
          )}
          {hasSelectedLearned && (
            <button
              type="button"
              onClick={() => handleBulkSetCategory('red')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 active:scale-95 text-stone-100 font-semibold text-xs border border-stone-600 transition-all cursor-pointer whitespace-nowrap shadow-xs"
              title="Zet geselecteerde woorden op 'nieuw'"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0 shadow-xs" />
              <span>nieuw</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedWordIds(new Set());
              setIsMultiSelectMode(false);
              setLastSelectedIndex(null);
            }}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Deselecteren"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Quick Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-stone-750 flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 fade-in duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-xs" />
          <span>{toastMessage.text}</span>
          {toastMessage.word ? <span className="text-stone-400 font-medium">({toastMessage.word})</span> : null}
        </div>
      )}
    </div>
  );
};
