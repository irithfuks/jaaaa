import React, { useState, useEffect, useRef } from 'react';
import { CEFRLevel, PlacementTestResult, UserProfile, WordItem } from '../types';
import { getLanguage, getSeedVocabularyForLanguageAndLevel, getBaseNumericLevelForCefr } from '../data/languages';
import { getVocabularyForCefrBand, getAllVocabularyForLanguage } from '../data/vocabularyBank';
import { speakWord } from '../utils/speech';
import { checkTranslationLocal, normalizeTranslationText, areHebrewTextsEquivalent, stripBracketedContent } from '../utils/translationChecker';
import { recordTranslationOverride } from '../lib/firebase';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  X,
  Keyboard,
  Volume2,
  Award,
  Sparkles,
  Heart,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface PlacementTestProps {
  profile: UserProfile;
  targetLangCode: string;
  knownLangCode: string;
  level?: CEFRLevel;
  onComplete: (result: PlacementTestResult, verifiedLevel: CEFRLevel) => void;
  onCancel: () => void;
}

const TOTAL_WORDS = 20; // Exact 20 words for the test
const INITIAL_LIVES = 4; // 4 hearts (lives)
const MAX_ERRORS_ALLOWED = 4; // 16 of 20 needed -> max 4 errors allowed

// Hebrew on-screen keyboard helper characters
const HEBREW_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
  'כ', 'ך', 'ל', 'מ', 'ם', 'נ', 'ן', 'ס', 'ע', 'פ',
  'ף', 'צ', 'ץ', 'ק', 'ר', 'ש', 'ת',
];

const DUTCH_LANG_NAMES: Record<string, string> = {
  he: 'Hebreeuws',
  es: 'Spaans',
  fr: 'Frans',
  de: 'Duits',
  it: 'Italiaans',
  ja: 'Japans',
  ar: 'Arabisch',
  ru: 'Russisch',
  pt: 'Portugees',
  nl: 'Nederlands',
  zh: 'Mandarijn Chinees',
  ko: 'Koreaans',
  el: 'Grieks',
  en: 'Engels',
};

interface AnswerRecord {
  targetWord: string;
  expectedTranslation: string;
  userAnswer: string;
  isCorrect: boolean;
  level: CEFRLevel;
}

interface FeedbackState {
  submitted: boolean;
  isCorrect: boolean;
  expectedAnswer: string;
}

export const PlacementTest: React.FC<PlacementTestProps> = ({
  profile,
  targetLangCode,
  knownLangCode,
  level,
  onComplete,
  onCancel,
}) => {
  const targetLevel: CEFRLevel = level || 'A2';
  const targetLang = getLanguage(targetLangCode);

  const isNl = knownLangCode === 'nl';
  const targetLangName = isNl ? (DUTCH_LANG_NAMES[targetLangCode] || targetLang.name) : targetLang.name;

  const [testWords, setTestWords] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Lives / hearts system: 4 hearts
  const [lives, setLives] = useState<number>(INITIAL_LIVES);
  const [lostLifePulse, setLostLifePulse] = useState<boolean>(false);
  const [lostHeartIndex, setLostHeartIndex] = useState<number | null>(null);
  const [showLostBadge, setShowLostBadge] = useState<boolean>(false);

  // User input & feedback state
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState<boolean>(false);

  // Answers tracker
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  // Completion states
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isTestFinished, setIsTestFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a fresh 20-word test pool specifically for the targetLevel to unlock
  const generateTestWords = (): WordItem[] => {
    let pool = getVocabularyForCefrBand(targetLangCode, targetLevel);
    if (!pool || pool.length < TOTAL_WORDS) {
      const seeds = getSeedVocabularyForLanguageAndLevel(targetLangCode, targetLevel, knownLangCode);
      pool = [...(pool || []), ...seeds];
    }
    if (!pool || pool.length < TOTAL_WORDS) {
      const allWords = getAllVocabularyForLanguage(targetLangCode);
      pool = [...(pool || []), ...allWords];
    }

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const gathered: WordItem[] = [];
    const usedWords = new Set<string>();

    for (const w of shuffled) {
      const key = (w.targetWord || '').trim();
      if (!key || usedWords.has(key)) continue;
      usedWords.add(key);
      gathered.push({
        ...w,
        level: targetLevel,
      });
      if (gathered.length >= TOTAL_WORDS) break;
    }

    return gathered;
  };

  // Initialize test
  useEffect(() => {
    const words = generateTestWords();
    setTestWords(words);
    setCurrentIndex(0);
    setAnswers([]);
    setLives(INITIAL_LIVES);
    setTypedAnswer('');
    setFeedbackState(null);
    setIsGameOver(false);
    setIsTestFinished(false);
  }, [targetLangCode, knownLangCode, targetLevel]);

  // Restart test handler (unlimited retries)
  const handleRestartTest = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    const words = generateTestWords();
    setTestWords(words);
    setCurrentIndex(0);
    setAnswers([]);
    setLives(INITIAL_LIVES);
    setLostLifePulse(false);
    setLostHeartIndex(null);
    setShowLostBadge(false);
    setTypedAnswer('');
    setFeedbackState(null);
    setIsGameOver(false);
    setIsTestFinished(false);
  };

  // Clean up auto-advance timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Autofocus input on each new question
  useEffect(() => {
    if (!feedbackState?.submitted && !isTestFinished && !isGameOver) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, feedbackState, isTestFinished, isGameOver]);

  const currentWord = testWords[currentIndex];

  // Helper to verify user answer against target
  const checkAnswer = (input: string, word: WordItem): boolean => {
    const rawUser = input.trim();
    if (!rawUser) return false;

    // Direct check
    if (rawUser.toLowerCase() === word.targetWord.toLowerCase().trim()) return true;

    // Brackets check: if targetWord or input has brackets like "Orange (fruit)", count correct without brackets
    const userNoBrackets = stripBracketedContent(rawUser);
    const targetNoBrackets = stripBracketedContent(word.targetWord);
    if (userNoBrackets && targetNoBrackets) {
      if (userNoBrackets.toLowerCase() === targetNoBrackets.toLowerCase().trim()) return true;
      if (normalizeTranslationText(userNoBrackets) === normalizeTranslationText(targetNoBrackets)) return true;
      if (areHebrewTextsEquivalent(userNoBrackets, targetNoBrackets)) return true;
    }

    const normalizedUser = normalizeTranslationText(rawUser);
    const normalizedExpected = normalizeTranslationText(word.targetWord);

    // Exact match
    if (normalizedUser === normalizedExpected) return true;

    // Hebrew Cholam / Vav equivalence (writing 'ו' for 'o' sound or ktiv male/chaser)
    if (areHebrewTextsEquivalent(rawUser, word.targetWord)) return true;

    // Check alternative translations
    if (word.alternativeTranslations && word.alternativeTranslations.length > 0) {
      for (const alt of word.alternativeTranslations) {
        if (!alt) continue;
        if (normalizeTranslationText(rawUser) === normalizeTranslationText(alt)) return true;
        if (rawUser.toLowerCase() === alt.toLowerCase().trim()) return true;
        if (areHebrewTextsEquivalent(rawUser, alt)) return true;
        const altNoBrackets = stripBracketedContent(alt);
        if (altNoBrackets && userNoBrackets) {
          if (userNoBrackets.toLowerCase() === altNoBrackets.toLowerCase().trim()) return true;
          if (normalizeTranslationText(userNoBrackets) === normalizeTranslationText(altNoBrackets)) return true;
          if (areHebrewTextsEquivalent(userNoBrackets, altNoBrackets)) return true;
        }
      }
    }

    // Advanced transliteration/fuzzy check
    const checkResult = checkTranslationLocal(rawUser, word.targetWord, word.translation, word.alternativeTranslations);
    return checkResult.isCorrect;
  };

  // Handle Answer Submission
  const handleSubmit = () => {
    if (!typedAnswer.trim() || !currentWord || feedbackState?.submitted) return;

    const isCorrect = checkAnswer(typedAnswer, currentWord);

    const newRecord: AnswerRecord = {
      targetWord: currentWord.targetWord,
      expectedTranslation: currentWord.translation,
      userAnswer: typedAnswer.trim(),
      isCorrect,
      level: currentWord.level,
    };

    const nextAnswers = [...answers, newRecord];
    setAnswers(nextAnswers);

    let nextLives = lives;
    if (!isCorrect) {
      const lostIndex = Math.max(0, lives - 1);
      setLostHeartIndex(lostIndex);
      nextLives = Math.max(0, lives - 1);
      setLives(nextLives);
      setLostLifePulse(true);
      setShowLostBadge(true);
      setTimeout(() => {
        setLostLifePulse(false);
        setShowLostBadge(false);
      }, 900);
    }

    setFeedbackState({
      submitted: true,
      isCorrect,
      expectedAnswer: currentWord.targetWord,
    });

    // Check if mistakes exceed allowed quota (more than 4 mistakes means max score < 16)
    const mistakesCount = nextAnswers.filter(a => !a.isCorrect).length;
    if (mistakesCount > MAX_ERRORS_ALLOWED) {
      // 5th mistake made! Cannot reach 16/20
      setTimeout(() => {
        setIsGameOver(true);
      }, 1200);
      return;
    }

    // If correct, auto advance gently
    if (isCorrect) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        advanceNext(nextAnswers, nextLives);
      }, 950);
    }
  };

  // Override Typo ("I was correct")
  const handleOverrideCorrect = () => {
    if (!feedbackState?.submitted || feedbackState.isCorrect) return;

    // Track override in Firebase & backend for vocabulary dictionary improvements
    if (currentWord) {
      const lastAns = answers[answers.length - 1];
      const userTyped = lastAns?.userAnswer || typedAnswer || '';
      recordTranslationOverride({
        targetWord: currentWord.targetWord,
        targetLanguage: targetLangCode,
        knownLanguage: knownLangCode,
        expectedTranslation: currentWord.translation,
        alternativeTranslations: currentWord.alternativeTranslations,
        userTyped,
        level: currentWord.level,
        sessionType: 'placement_test',
        userEmail: profile.email,
        transliteration: currentWord.transliteration,
      }).catch(err => console.warn('Placement override tracking note:', err));
    }

    // Update last recorded answer to correct
    const updatedAnswers = answers.map((ans, idx) => {
      if (idx === answers.length - 1) {
        return { ...ans, isCorrect: true };
      }
      return ans;
    });
    setAnswers(updatedAnswers);

    // Restore 1 life!
    const restoredLives = Math.min(INITIAL_LIVES, lives + 1);
    setLives(restoredLives);
    setLostLifePulse(false);
    setLostHeartIndex(null);
    setShowLostBadge(false);

    setFeedbackState({
      submitted: true,
      isCorrect: true,
      expectedAnswer: currentWord?.targetWord || '',
    });

    if (isGameOver) {
      setIsGameOver(false);
    }

    advanceNext(updatedAnswers, restoredLives);
  };

  // Advance to next word or finalize
  const advanceNext = (currentAnswersList = answers, currentLivesCount = lives) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (currentIndex + 1 < testWords.length) {
      setCurrentIndex(prev => prev + 1);
      setTypedAnswer('');
      setFeedbackState(null);
    } else {
      // Completed all 20 words! Determine placement level
      finalizePlacement(currentAnswersList, currentLivesCount);
    }
  };

  // Determine Level: Based on score and performance
  const finalizePlacement = (finalAnswers = answers, finalLives = lives) => {
    setIsTestFinished(true);
  };

  // Insert virtual Hebrew letter
  const handleInsertLetter = (char: string) => {
    setTypedAnswer(prev => prev + char);
    inputRef.current?.focus();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTestFinished || isGameOver) return;

      if (feedbackState?.submitted) {
        if (e.key === 'Enter' && !feedbackState.isCorrect) {
          e.preventDefault();
          advanceNext();
        } else if (!feedbackState.isCorrect && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'i')) {
          e.preventDefault();
          handleOverrideCorrect();
        }
      } else {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedbackState, isTestFinished, isGameOver, typedAnswer, currentWord, answers, lives]);

  // Start learning at target level
  const handleConfirmStart = () => {
    const totalQuestions = answers.length;
    const correctCount = answers.filter(a => a.isCorrect).length;
    const isPassed = correctCount >= (TOTAL_WORDS - MAX_ERRORS_ALLOWED);

    const result: PlacementTestResult = {
      totalQuestions,
      correctCount,
      level: targetLevel,
      passed: isPassed,
      feedback: isPassed
        ? (isNl ? `Niveau ${targetLevel} ontgrendeld met ${correctCount}/20 goed!` : `Level ${targetLevel} unlocked with ${correctCount}/20 correct!`)
        : (isNl ? `Niveau ${targetLevel} niet ontgrendeld (${correctCount}/20 goed).` : `Level ${targetLevel} not unlocked (${correctCount}/20 correct).`),
      suggestedLevel: targetLevel,
      remainingLives: lives,
      answers: answers.map(a => ({
        targetWord: a.targetWord,
        expectedTranslation: a.expectedTranslation,
        userAnswer: a.userAnswer,
        isCorrect: a.isCorrect,
      })),
    };

    onComplete(result, targetLevel);
  };

  // ==========================================
  // VIEW 1: GAME OVER (LIVES DEPLETED / > 4 ERRORS)
  // ==========================================
  if (isGameOver) {
    const mistakesCount = answers.filter(a => !a.isCorrect).length;

    return (
      <div id="placement-game-over-view" className="max-w-xl mx-auto px-4 py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 border border-stone-200 dark:border-stone-800 shadow-xl text-center space-y-6">
          {/* Status indicator */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
              {isNl ? 'Je levens zijn op' : 'You are out of lives'}
            </h2>
            <p className="text-base text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
              {isNl
                ? `Je bent nog niet klaar voor niveau ${targetLevel}`
                : `You are not ready for level ${targetLevel}`}
            </p>
          </div>

          {/* Action button: ONLY a button that says 'Back' */}
          <div className="pt-2">
            <button
              id="placement-back-btn"
              type="button"
              onClick={onCancel}
              className="w-full h-12 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-950 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isNl ? 'Terug' : 'Back'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: TEST RESULTS / LEVEL UNLOCKED
  // ==========================================
  if (isTestFinished) {
    const totalCorrect = answers.filter(a => a.isCorrect).length;
    const isPassed = totalCorrect >= (TOTAL_WORDS - MAX_ERRORS_ALLOWED);
    const numericLevel = getBaseNumericLevelForCefr(targetLevel);

    return (
      <div id="placement-test-complete-view" className="max-w-2xl mx-auto px-4 py-8 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 border border-stone-200 dark:border-stone-800 shadow-xl text-center space-y-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
            isPassed
              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
          }`}>
            {isPassed ? <Award className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>

          <div className="space-y-1.5">
            <h2 className="font-serif text-3xl font-bold text-stone-900 dark:text-white tracking-tight">
              {isPassed
                ? (isNl ? `Gefeliciteerd! Niveau ${targetLevel} ontgrendeld!` : `Congratulations! Level ${targetLevel} unlocked!`)
                : (isNl ? 'Je levens zijn op' : 'You are out of lives')}
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto">
              {isPassed ? (
                isNl ? (
                  <>
                    Je had <strong>{totalCorrect} van de 20 woorden goed</strong>. Niveau {targetLevel} is nu voor jou ontgrendeld!
                  </>
                ) : (
                  <>
                    You scored <strong>{totalCorrect} of the 20 words correct</strong>. Level {targetLevel} is now unlocked for you!
                  </>
                )
              ) : (
                isNl
                  ? `Je bent nog niet klaar voor niveau ${targetLevel}`
                  : `You are not ready for level ${targetLevel}`
              )}
            </p>
          </div>

          {/* Level Badge Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-stone-900 border border-amber-200/80 dark:border-amber-900/50 shadow-xs max-w-sm mx-auto text-center space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {isPassed
                ? (isNl ? 'Ontgrendeld Niveau' : 'Unlocked Level')
                : (isNl ? 'Getest Niveau' : 'Tested Level')}
            </span>
            <div className="text-4xl font-serif font-black text-amber-950 dark:text-amber-100">
              {isNl ? `Niveau ${targetLevel}` : `Level ${targetLevel}`}
            </div>
            <div className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-400">
              Level {numericLevel}
            </div>
          </div>

          {/* Summary table of answers */}
          <div className="space-y-2 text-left max-w-lg mx-auto">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {isNl ? `Geteste woorden (${totalCorrect}/20 goed)` : `Tested words (${totalCorrect}/20 correct)`}
            </h4>
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1 border border-stone-200 dark:border-stone-800 rounded-2xl p-2 bg-stone-50/50 dark:bg-stone-950/40">
              {answers.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={item.isCorrect ? 'text-emerald-600' : 'text-rose-500'}>
                      {item.isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {item.targetWord}
                    </span>
                    <span className="text-stone-400 dark:text-stone-500">
                      ({item.expectedTranslation})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                    {item.level}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isPassed ? (
              <>
                <button
                  id="placement-confirm-level-btn"
                  type="button"
                  onClick={handleConfirmStart}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md shadow-amber-500/25 transition-all inline-flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
                >
                  <span>{isNl ? `Start met leren op niveau ${targetLevel}` : `Start learning at Level ${targetLevel}`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id="placement-exit-to-levels-btn"
                  type="button"
                  onClick={onCancel}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{isNl ? 'Niveauselectie' : 'Level selection'}</span>
                </button>
              </>
            ) : (
              <button
                id="placement-back-from-results-btn"
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-950 font-bold text-sm shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{isNl ? 'Terug' : 'Back'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: INTERACTIVE PRACTICE CARD
  // ==========================================
  const remainingCount = TOTAL_WORDS - currentIndex;

  return (
    <div id="placement-test-session-view" className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="btn-placement-exit"
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer shadow-2xs"
            title={isNl ? 'Terug naar niveauselectie' : 'Back to level selection'}
            aria-label={isNl ? 'Terug naar niveauselectie' : 'Back to level selection'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-stone-900 dark:text-white block">
            {isNl ? `Test niveau ${targetLevel}` : `Test level ${targetLevel}`}
          </span>
        </div>
      </div>

      {/* Main Interactive Card */}
      {currentWord && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-lg overflow-hidden flex flex-col min-h-[420px] transition-all">
          {/* Prompt Area (The inner square where you type the words) */}
          <div className="p-5 sm:p-7 flex-1 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-white to-stone-50/40 dark:from-stone-900 dark:to-stone-950/40 relative">
            {/* Top row inside the inner square: instruction on left, hearts in upper right corner */}
            <div className="w-full flex items-center justify-between text-xs gap-3">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                {isNl ? `Vertaal naar het ${targetLangName}` : `Translate to ${targetLangName}`}
              </span>

              {/* Lowered Hearts UI directly inside the inner square in the upper right corner */}
              <div className="relative flex items-center shrink-0">
                {showLostBadge && (
                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-full shadow-xs animate-in fade-in slide-in-from-right-2 duration-300 z-30 whitespace-nowrap">
                    <span>-1</span>
                    <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                  </div>
                )}

                <div
                  id="placement-hearts-status"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 shadow-2xs transition-all duration-200 ${
                    lostLifePulse ? 'animate-shake ring-2 ring-rose-400 border-rose-300' : ''
                  }`}
                  title={`${lives}/4 ${isNl ? 'levens' : 'lives'}`}
                >
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {[0, 1, 2, 3].map((i) => {
                      const isAlive = i < lives;
                      const isJustLost = i === lostHeartIndex && lostLifePulse;

                      return (
                        <div key={i} className="relative flex items-center justify-center w-4 h-4">
                          {isJustLost ? (
                            <>
                              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 absolute animate-ping opacity-75" />
                              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 scale-125 rotate-12 transition-transform duration-300" />
                            </>
                          ) : isAlive ? (
                            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 transition-all duration-300 drop-shadow-xs" />
                          ) : (
                            <Heart className="w-3.5 h-3.5 text-stone-300 dark:text-stone-700 stroke-[1.75] transition-all duration-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono ml-0.5">
                    {lives}/4
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h3 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white tracking-tight">
                {currentWord.translation}
              </h3>
              {currentWord.partOfSpeech && (
                <div className="flex items-center justify-center pt-1">
                  <span className="inline-block text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2.5 py-0.5 rounded-full border border-stone-200 dark:border-stone-700">
                    {currentWord.partOfSpeech}
                  </span>
                </div>
              )}
            </div>

            {/* Typing Input */}
            <div className="w-full max-w-md pt-4 space-y-3">
              <div className="space-y-1 text-left">
                <div
                  className={`relative flex items-center rounded-2xl transition-all duration-200 ${
                    feedbackState?.submitted
                      ? feedbackState.isCorrect
                        ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/20'
                        : 'border-2 border-stone-300 dark:border-stone-700 bg-stone-50/40 dark:bg-stone-950/40'
                      : 'border-2 border-stone-300 dark:border-stone-700 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-400/30 bg-white dark:bg-stone-900'
                  }`}
                >
                  <input
                    ref={inputRef}
                    id="placement-typing-input"
                    name="placement_word_input"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-form-type="other"
                    dir={targetLang.rtl ? 'rtl' : 'ltr'}
                    placeholder=""
                    value={typedAnswer}
                    disabled={Boolean(feedbackState?.submitted)}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    className={`w-full py-3.5 px-4 rounded-2xl text-lg font-medium outline-hidden transition-colors ${
                      targetLang.rtl ? 'text-right font-hebrew text-2xl' : 'text-left'
                    } text-stone-900 dark:text-white placeholder:text-stone-400`}
                  />

                  {/* Keyboard toggle for Hebrew */}
                  {targetLang.rtl && !feedbackState?.submitted && (
                    <button
                      id="toggle-virtual-keyboard-btn"
                      type="button"
                      onClick={() => setShowVirtualKeyboard(!showVirtualKeyboard)}
                      className="p-2 mr-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
                      title={isNl ? 'Hebreeuws schermtoetsenbord' : 'On-screen Hebrew keyboard'}
                    >
                      <Keyboard className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* On-screen Hebrew keyboard */}
              {targetLang.rtl && showVirtualKeyboard && !feedbackState?.submitted && (
                <div className="p-3 bg-stone-100 dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-semibold px-1">
                    <span>{isNl ? 'Hebreeuwse letters' : 'Hebrew letters'}</span>
                    <button
                      type="button"
                      onClick={() => setTypedAnswer(prev => prev.slice(0, -1))}
                      className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
                    >
                      {isNl ? '⌫ Wis' : '⌫ Backspace'}
                    </button>
                  </div>
                  <div className="grid grid-cols-9 gap-1" dir="rtl">
                    {HEBREW_LETTERS.map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => handleInsertLetter(char)}
                        className="h-9 rounded-lg bg-white dark:bg-stone-700 hover:bg-amber-100 dark:hover:bg-stone-600 font-hebrew text-lg font-bold text-stone-900 dark:text-white shadow-xs border border-stone-200 dark:border-stone-600 transition-all cursor-pointer active:scale-95"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Incorrect feedback card with typo override */}
              {feedbackState?.submitted && !feedbackState.isCorrect && (
                <div className="w-full space-y-2 pt-1 text-left animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-full p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-left shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-500 flex items-center justify-center shrink-0">
                        <X className="w-3.5 h-3.5 stroke-[2]" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                          {isNl ? 'Juiste antwoord:' : 'Correct answer:'}
                        </span>
                        <div
                          className={`font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight leading-snug break-words ${
                            targetLang.rtl ? 'font-hebrew' : ''
                          }`}
                          dir={targetLang.rtl ? 'rtl' : 'ltr'}
                        >
                          {feedbackState.expectedAnswer}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakWord(feedbackState.expectedAnswer, targetLangCode)}
                        className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors shadow-2xs cursor-pointer shrink-0"
                        title={isNl ? 'Spreek woord uit' : 'Pronounce word'}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons (I was correct + Continue / Check) - placed ABOVE the divider line */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                {feedbackState?.submitted && !feedbackState.isCorrect && !feedbackState.overridden && (
                  <button
                    type="button"
                    id="placement-override-btn"
                    onClick={handleOverrideCorrect}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                    title={isNl ? 'Herstel als je een typfoutje maakte' : 'Override if you made a typo'}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isNl ? 'Ik had het wel goed' : 'I was correct'}</span>
                  </button>
                )}

                {feedbackState?.submitted ? (
                  <button
                    id="continue-placement-btn"
                    type="button"
                    onClick={() => advanceNext()}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-105 shrink-0"
                  >
                    <span>
                      {currentIndex + 1 >= TOTAL_WORDS
                        ? (isNl ? 'Resultaat bekijken' : 'View results')
                        : (isNl ? 'Doorgaan' : 'Continue')}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    id="submit-placement-answer-btn"
                    type="button"
                    onClick={handleSubmit}
                    disabled={!typedAnswer.trim()}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-200 dark:text-stone-950 disabled:opacity-40 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <span>{isNl ? 'Controleren' : 'Check'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer with Progress Bar (under the divider line) */}
          <div className="p-4 sm:p-5 bg-stone-50/90 dark:bg-stone-950/60 border-t border-stone-200 dark:border-stone-800">
            {/* Test Progress Bar */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-end text-xs text-stone-600 dark:text-stone-400">
                <span className="font-medium text-stone-600 dark:text-stone-400">
                  <strong className="text-stone-900 dark:text-white font-bold">
                    {remainingCount}
                  </strong>{' '}
                  {isNl
                    ? (remainingCount === 1 ? 'woord te gaan' : 'woorden te gaan')
                    : (remainingCount === 1 ? 'word left' : 'words left')}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / TOTAL_WORDS) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
