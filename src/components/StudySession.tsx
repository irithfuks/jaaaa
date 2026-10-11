import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudyCard, UserProfile, StudySessionResult, WordProgress, WordCategory, WordStage, WordStudyState, SessionQueueItem, SavedSessionState, SessionType, TokenDirection } from '../types';
import { getLanguage } from '../data/languages';
import { getBankAlternativesForWord, getAllVocabularyForLanguage, getLocalizedWordItem } from '../data/vocabularyBank';
import { speakWord } from '../utils/speech';
import { checkTranslationLocal, verifyTranslationSmart, normalizeTranslationText } from '../utils/translationChecker';
import { recordTranslationOverride } from '../lib/firebase';
import { calculateWordUpdate, CATEGORY_DETAILS, getNextCategory, getWordCategory } from '../utils/srs';
import { generateStrictMultipleChoiceOptions, DONT_KNOW_OPTION, DONT_KNOW_OPTION_NL } from '../utils/distractorGenerator';
import { scheduleSpacedTasks, buildInitialSessionQueue } from '../core/study/queueScheduler';
import { HebrewKeyboard } from './study/HebrewKeyboard';
import { StudyFeedbackBanner } from './study/StudyFeedbackBanner';
import {
  Volume2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Award,
  Send,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  Keyboard,
  HelpCircle,
  RotateCcw,
  Lightbulb,
  Heart,
} from 'lucide-react';

interface FeedbackState {
  submitted: boolean;
  isCorrect: boolean;
  verdict: 'correct' | 'incorrect_spelling' | 'incorrect_meaning' | 'incorrect_loose';
  feedback: string;
  userAnswer: string;
  expectedAnswer: string;
  isFinalReview?: boolean;
  nextStepNote: string;
}

interface StudySessionProps {
  cards: StudyCard[];
  profile: UserProfile;
  sessionType?: SessionType;
  reviewDirection?: 'both' | 'target' | 'known';
  initialSavedState?: SavedSessionState | null;
  onSaveSession?: (state: SavedSessionState) => void;
  onClearSavedSession?: (sessionType?: SessionType) => void;
  onFinishSession: (
    result: StudySessionResult,
    updatedWords: Record<string, WordProgress>,
    hierarchyData?: {
      mistakeTokens: Array<{ wordId: string; direction: TokenDirection }>;
      completedTokens: Array<{ wordId: string; direction: TokenDirection }>;
    },
    examPassed?: boolean
  ) => void;
  onStartRecentReview?: () => void;
  onRestartExam?: () => void;
  onExit: (currentState?: SavedSessionState) => void;
}

/** 
 * Check if a word is being learned for the very first time.
 * If a word was EVER reviewed in any prior session, it is NOT new and must strictly use typing!
 */
export const isTotallyNewWord = (card: StudyCard): boolean => {
  const prog = card.progress;
  if (prog) {
    const timesReviewed = prog.timesReviewed ?? 0;
    const cleanCount = prog.cleanSessionsCount ?? 0;
    const historyLen = prog.history?.length ?? 0;
    const consecutive = prog.consecutiveCorrect ?? 0;
    const lastReviewed = prog.lastReviewedAt ?? 0;
    if (timesReviewed > 0 || cleanCount > 0 || historyLen > 0 || consecutive > 0 || lastReviewed > 0) {
      return false;
    }
  }
  if (card.category && card.category !== 'red') {
    return false;
  }
  return Boolean(card.isNew);
};

export const StudySession: React.FC<StudySessionProps> = ({
  cards,
  profile,
  sessionType = 'daily',
  reviewDirection = 'both',
  initialSavedState = null,
  onSaveSession,
  onClearSavedSession,
  onFinishSession,
  onStartRecentReview,
  onRestartExam,
  onExit,
}) => {
  const targetLang = getLanguage(profile.targetLanguage);
  const knownLang = getLanguage(profile.knownLanguage);
  const activeDirection = initialSavedState?.reviewDirection || reviewDirection || 'both';

  // Exam mode state
  const isExam = sessionType === 'exam';
  const [examMistakesCount, setExamMistakesCount] = useState(0);
  const [isExamFailed, setIsExamFailed] = useState(false);
  const [isExamPassed, setIsExamPassed] = useState(false);

  // Track mistakes per token direction for Hard Hierarchy
  // "Every time you do a word wrong (multiple choice don’t count) the word gets a +1 in the hard hierarchy."
  const mistakeTokensRef = useRef<Array<{ wordId: string; direction: TokenDirection }>>([]);

  // Track mistaken tasks (wordId and stage: 3 for to_target, 2 for from_target) for end-of-session randomized review
  // "en op het eind komen natuurlijk alle woorden die je fout had opnieuw aanbod in een random volgorde"
  const sessionMistakenTasksRef = useRef<Map<string, { wordId: string; stage: WordStage }>>(
    (() => {
      const map = new Map<string, { wordId: string; stage: WordStage }>();
      if (initialSavedState?.wordStates) {
        Object.values(initialSavedState.wordStates).forEach((st: any) => {
          if (st.hadMistakeAtAnyStage || (st.mistakesCount ?? 0) > 0) {
            st.history?.forEach((h: any) => {
              if (!h.wasCorrect && (h.stage === 2 || h.stage === 3)) {
                map.set(`${st.wordId}::${h.stage}`, {
                  wordId: st.wordId,
                  stage: h.stage,
                });
              }
            });
          }
        });
      }
      return map;
    })()
  );
  const hasStartedEndReviewRef = useRef(false);
  const [isInEndReviewRound, setIsInEndReviewRound] = useState(false);

  // Strictly deduplicate incoming cards and localize to knownLanguage
  const sessionCards = useMemo(() => {
    const seen = new Set<string>();
    const unique: StudyCard[] = [];
    cards.forEach(c => {
      const localizedWord = getLocalizedWordItem(c.word, profile.targetLanguage, profile.knownLanguage);
      const cardWithLocalized: StudyCard = {
        ...c,
        word: localizedWord,
      };
      const normTarget = normalizeTranslationText(cardWithLocalized.word.targetWord) || cardWithLocalized.word.id.toLowerCase();
      const normTrans = cardWithLocalized.word.translation.trim().toLowerCase();
      const tokenSuffix = sessionType === 'exam' || c.hierarchyDirection
        ? `::${c.hierarchyDirection || 'token'}::${cardWithLocalized.word.id}`
        : '';
      const comboKey = `${normTarget}::${normTrans}${tokenSuffix}`;
      const tokenKey = `${normTarget}${tokenSuffix}`;
      if (!seen.has(tokenKey) && !seen.has(comboKey)) {
        seen.add(tokenKey);
        seen.add(comboKey);
        unique.push(cardWithLocalized);
      }
    });
    return unique;
  }, [cards, profile.targetLanguage, profile.knownLanguage]);

  // Active queue of tasks (restoring from saved state if resuming)
  const [queue, setQueue] = useState<SessionQueueItem[]>(() => {
    if (initialSavedState?.queue && initialSavedState.queue.length > 0) {
      return initialSavedState.queue;
    }
    return buildInitialSessionQueue({
      sessionCards,
      activeDirection,
      sessionType: sessionType as any,
    });
  });

  // Initialize word study states for each word in session
  const [wordStates, setWordStates] = useState<Record<string, WordStudyState>>(() => {
    if (initialSavedState?.wordStates && Object.keys(initialSavedState.wordStates).length > 0) {
      return initialSavedState.wordStates;
    }
    const map: Record<string, WordStudyState> = {};
    const isExamSession = sessionType === 'exam';
    sessionCards.forEach(card => {
      const cat = card.category || (card.progress ? getWordCategory(card.progress) : 'red');
      const isRed = cat === 'red';
      const isNew = isTotallyNewWord(card);
      const initialTask = queue.find((q) => q.wordId === card.word.id);
      const startingStage: WordStage = initialTask ? initialTask.stage : (isNew ? 1 : 3);
      const initialHard = card.progress?.hardScore !== undefined
        ? card.progress.hardScore
        : (card.progress?.timesIncorrect ? card.progress.timesIncorrect : (card.progress?.isHard ? 2 : 0));

      map[card.word.id] = {
        wordId: card.word.id,
        card,
        category: cat,
        isRedCategory: isRed,
        currentStage: startingStage,
        completedStages: { 
          // For repeating words and exam, Stage 1 (multiple choice) is completely skipped and marked done!
          1: !isNew || activeDirection === 'target' || isExamSession,
          2: activeDirection === 'target' || (isExamSession && startingStage === 3),
          3: activeDirection === 'known' || (isExamSession && startingStage === 2),
        },
        mistakesCount: 0,
        hadMistakeAtAnyStage: false,
        sessionHardScore: initialHard,
        isFullyMastered: false,
        finalVerificationPassed: false,
        history: [],
      };
    });
    return map;
  });

  // Calculate total expected tasks based on direction mode and repeating vs new words
  const baseExpectedTasks = useMemo(() => {
    if (initialSavedState?.baseExpectedTasks) {
      return initialSavedState.baseExpectedTasks;
    }
    if (sessionType === 'exam') return sessionCards.length;
    if (activeDirection === 'target') return sessionCards.length * 1;
    if (activeDirection === 'known') {
      return sessionCards.reduce((acc, c) => acc + (isTotallyNewWord(c) ? 2 : 1), 0);
    }
    // 'both' mode: New words have 3 tasks (1, 2, 3), repeating words have 2 tasks (2 and 3)
    return sessionCards.reduce((acc, c) => acc + (isTotallyNewWord(c) ? 3 : 2), 0);
  }, [sessionCards, initialSavedState?.baseExpectedTasks, activeDirection, sessionType]);

  const [currentTask, setCurrentTask] = useState<SessionQueueItem | null>(() => queue[0] || null);

  // Interaction inputs
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);
  const [showPhonetic, setShowPhonetic] = useState(() => {
    return localStorage.getItem('study_show_phonetic') === 'true';
  });

  const handleTogglePhonetic = () => {
    setShowPhonetic(prev => {
      const next = !prev;
      localStorage.setItem('study_show_phonetic', String(next));
      return next;
    });
  };

  const [isCompleted, setIsCompleted] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Total session statistics
  const [completedTasksCount, setCompletedTasksCount] = useState(() => {
    return initialSavedState?.completedTasksCount || 0;
  });

  const isMountedRef = useRef(false);
  const sessionIdRef = useRef<string>(initialSavedState?.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const onSaveSessionRef = useRef(onSaveSession);
  onSaveSessionRef.current = onSaveSession;

  // Persist session state on queue/wordStates updates (skip initial mount to prevent update depth loop)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (!isCompleted && queue.length > 0) {
      const currentSessionType: SessionType = sessionType === 'rusty' ? 'rusty' : 'daily';
      const stateToSave: SavedSessionState = {
        sessionId: sessionIdRef.current,
        sessionType: currentSessionType,
        reviewDirection: activeDirection,
        cards,
        queue,
        wordStates,
        completedTasksCount,
        baseExpectedTasks,
        savedAt: Date.now(),
        targetLanguage: profile.targetLanguage,
        knownLanguage: profile.knownLanguage,
      };
      onSaveSessionRef.current?.(stateToSave);
    }
  }, [queue, wordStates, completedTasksCount, isCompleted, cards, sessionType, baseExpectedTasks, profile.targetLanguage, profile.knownLanguage, activeDirection]);

  // Update currentTask whenever queue shifts
  useEffect(() => {
    if (queue.length > 0) {
      setCurrentTask(queue[0]);
    } else if (cards.length > 0) {
      setCurrentTask(null);
      setIsCompleted(true);
    }
  }, [queue, cards.length]);

  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Focus input when moving to a typing task
  useEffect(() => {
    if (currentTask && currentTask.stage !== 1 && !feedbackState?.submitted) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentTask, feedbackState?.submitted]);

  const activeWordState = currentTask ? wordStates[currentTask.wordId] : null;
  const activeCard = activeWordState?.card;
  const activeCategory = activeWordState?.category || 'red';

  // Only 2 categories: "Nieuw" and "Geleerd".
  // During a daily session:
  // - New words: "Nieuw"
  // - Already learned words: "Herhaling"
  const isCardNewWord = Boolean(
    activeCard?.isNew ||
    activeWordState?.isRedCategory ||
    (activeCard && !activeCard.progress && activeCard.category === 'red') ||
    (activeCard?.progress && (activeCard.progress.timesReviewed ?? 0) === 0 && !activeCard.progress.manuallyLearned)
  );

  const cardBadgeInfo = useMemo(() => {
    if (isCardNewWord) {
      return {
        label: 'Nieuw',
        dotColor: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    return {
      label: 'Herhaling',
      dotColor: 'bg-blue-500',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }, [isCardNewWord]);

  // Cooldown timestamp to prevent accidental double-Enter skipping feedback pop-up
  const submissionTimeRef = useRef<number>(0);

  // Distractors cache per word and global used-distractor tracker across the session
  const sessionMcOptionsMapRef = useRef<Record<string, string[]>>({});
  const usedSessionDistractorsRef = useRef<Set<string>>(new Set());

  // Calculate exact remaining tasks assuming the user gets everything correct from this moment on:
  const remainingTasksCount = useMemo(() => {
    if (isCompleted || cards.length === 0) return 0;

    let count = 0;
    cards.forEach(card => {
      const state = wordStates[card.word.id];
      if (!state || state.isFullyMastered) return;

      const isNew = isTotallyNewWord(card);
      let cardRemaining = 0;

      if (activeDirection === 'target') {
        if (!state.completedStages[3]) cardRemaining++;
      } else if (activeDirection === 'known') {
        if (isNew && !state.completedStages[1]) cardRemaining++;
        if (!state.completedStages[2]) cardRemaining++;
      } else {
        // 'both'
        if (isNew && !state.completedStages[1]) cardRemaining++;
        if (!state.completedStages[2]) cardRemaining++;
        if (!state.completedStages[3]) cardRemaining++;
      }

      // If the word had any mistake, it still needs its final verification test
      if (state.hadMistakeAtAnyStage && !state.finalVerificationPassed) {
        cardRemaining++;
      }

      count += cardRemaining;
    });

    // Count any active spacer tasks in the queue
    const spacerTasksInQueue = queue.filter(item => item.id.includes('-spacer-')).length;
    count += spacerTasksInQueue;

    return Math.max(0, count);
  }, [isCompleted, cards, wordStates, activeDirection, queue, isTotallyNewWord]);

  // Single session progress percentage accurately scaling with completed tasks
  const sessionProgressPercent = useMemo(() => {
    if (isCompleted) return 100;
    const total = completedTasksCount + remainingTasksCount;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((completedTasksCount / total) * 100));
  }, [completedTasksCount, remainingTasksCount, isCompleted]);

  // Candidate vocabulary pool across all levels to supply rich, authentic distractors
  const candidateVocabPool = useMemo(() => {
    try {
      return getAllVocabularyForLanguage(profile.targetLanguage, profile.knownLanguage);
    } catch {
      return [];
    }
  }, [profile.targetLanguage, profile.knownLanguage]);

  // Generate 4 strictly unique multiple choice options (1 correct + 2 distractors + 1 "I don't know")
  // Guarantees no session word is ever a distractor, and all options strictly share the exact same part of speech
  const multipleChoiceOptions = useMemo(() => {
    if (!activeCard || currentTask?.stage !== 1) return [];

    if (sessionMcOptionsMapRef.current[activeCard.word.id]) {
      return sessionMcOptionsMapRef.current[activeCard.word.id];
    }

    const sessionWords = cards.map(c => c.word);
    const result = generateStrictMultipleChoiceOptions(
      activeCard.word,
      candidateVocabPool.length > 0 ? candidateVocabPool : sessionWords,
      sessionWords,
      usedSessionDistractorsRef.current,
      profile.knownLanguage
    );

    result.usedDistractors.forEach(d => usedSessionDistractorsRef.current.add(d.toLowerCase()));
    sessionMcOptionsMapRef.current[activeCard.word.id] = result.options;

    return result.options;
  }, [activeCard?.word.id, currentTask?.stage, cards, candidateVocabPool, profile.knownLanguage]);

  // Keyboard shortcut listener for Multiple Choice (1-4, a-d)
  useEffect(() => {
    if (!currentTask || currentTask.stage !== 1 || feedbackState?.submitted || isChecking) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      let chosenIndex = -1;
      if (e.key === '1' || e.key.toLowerCase() === 'a') chosenIndex = 0;
      else if (e.key === '2' || e.key.toLowerCase() === 'b') chosenIndex = 1;
      else if (e.key === '3' || e.key.toLowerCase() === 'c') chosenIndex = 2;
      else if (e.key === '4' || e.key.toLowerCase() === 'd') chosenIndex = 3;

      if (chosenIndex >= 0 && chosenIndex < multipleChoiceOptions.length) {
        e.preventDefault();
        handleSelectChoice(multipleChoiceOptions[chosenIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTask, feedbackState?.submitted, isChecking, multipleChoiceOptions]);

  if (!activeCard && !isCompleted) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <p className="text-stone-700">No words available for study session.</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handlePlayAudio = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    speakWord(text, profile.targetLanguage);
  };

  // Helper to determine if two word IDs refer to the same target word (or have identical target text / translation)
  const isSameWord = useCallback((idA: string, idB: string): boolean => {
    if (!idA || !idB) return false;
    if (idA === idB) return true;
    const cardA = sessionCards.find((c) => c.word.id === idA);
    const cardB = sessionCards.find((c) => c.word.id === idB);
    if (!cardA || !cardB) return false;
    const keyA = normalizeTranslationText(cardA.word.targetWord);
    const keyB = normalizeTranslationText(cardB.word.targetWord);
    if (keyA && keyB && keyA === keyB) return true;
    const transA = cardA.word.translation.trim().toLowerCase();
    const transB = cardB.word.translation.trim().toLowerCase();
    if (transA && transB && transA === transB) return true;
    return false;
  }, [sessionCards]);

  // Spaced queue scheduler delegated to pure core queueScheduler
  const handleScheduleSpacedTasks = ({
    remainingQueue,
    itemToInsert,
    currentWordId,
    desiredSpacing,
  }: {
    remainingQueue: SessionQueueItem[];
    itemToInsert: SessionQueueItem | null;
    currentWordId: string;
    desiredSpacing?: number;
  }): SessionQueueItem[] => {
    return scheduleSpacedTasks({
      remainingQueue,
      itemToInsert,
      currentWordId,
      sessionCards,
      wordStates,
      activeDirection,
      isSameWord,
      desiredSpacing,
    });
  };

  // Advance task and update queue & states
  const advanceTask = (
    feedback: FeedbackState,
    task: SessionQueueItem,
    card: StudyCard
  ) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const { isCorrect } = feedback;
    const currentWordId = task.wordId;
    const currentStage = task.stage;
    const isFinal = Boolean(task.isFinalReview);
    const currentWordState = wordStates[currentWordId];

    if (isCorrect) {
      setCompletedTasksCount(prev => prev + 1);
    }

    const remainingQueue = queue.slice(1);

    // Update word state
    setWordStates(prev => {
      const existing = prev[currentWordId];
      if (!existing) return prev;

      const nextCompleted = { ...existing.completedStages };
      let hadMistake = existing.hadMistakeAtAnyStage;
      let mistakes = existing.mistakesCount;
      let finalPassed = existing.finalVerificationPassed;
      let isMastered = existing.isFullyMastered;

      if (isCorrect) {
        if (isFinal) {
          finalPassed = true;
          isMastered = true;
        } else {
          nextCompleted[currentStage] = true;
          if (activeDirection === 'target' && currentStage === 3 && !hadMistake) {
            isMastered = true;
          } else if (activeDirection === 'known') {
            const isNew = isTotallyNewWord(card);
            const isDone = isNew ? (nextCompleted[1] && nextCompleted[2]) : nextCompleted[2];
            if (isDone && !hadMistake) {
              isMastered = true;
            }
          } else if (activeDirection === 'both') {
            const isNew = isTotallyNewWord(card);
            const bothTypingDone = nextCompleted[2] && nextCompleted[3];
            const isDone = isNew ? (nextCompleted[1] && bothTypingDone) : bothTypingDone;
            if (isDone && !hadMistake) {
              isMastered = true;
            }
          }
        }
      } else {
        hadMistake = true;
        mistakes += 1;
        if (currentStage === 1) {
          // Multiple choice Stage 1 is marked completed so it is never shown again
          // Multiple choice mistakes do NOT add hard points
          nextCompleted[1] = true;
        } else {
          // Stage 2: English/known language typing (translating to familiar language) -> from_target
          // Stage 3: Hebrew/target language typing (translating into language you are learning) -> to_target
          const dir: TokenDirection = card.hierarchyDirection || (currentStage === 3 ? 'to_target' : 'from_target');
          const cleanId = currentWordId.includes('__dir__') ? currentWordId.split('__dir__')[0] : currentWordId;
          mistakeTokensRef.current.push({ wordId: cleanId, direction: dir });
        }
      }

      // Hierarchy 2 Hard Points: +1 point for incorrect attempt in any stage
      const startingHard = card.progress?.hardScore !== undefined 
        ? card.progress.hardScore 
        : (card.progress?.timesIncorrect ? card.progress.timesIncorrect : (card.progress?.isHard ? 2 : 0));
      let sessionHard = existing.sessionHardScore !== undefined
        ? existing.sessionHardScore
        : startingHard;

      if (!isCorrect) {
        sessionHard = sessionHard + 1;
      }

      return {
        ...prev,
        [currentWordId]: {
          ...existing,
          completedStages: nextCompleted,
          hadMistakeAtAnyStage: hadMistake,
          mistakesCount: mistakes,
          sessionHardScore: sessionHard,
          finalVerificationPassed: finalPassed,
          isFullyMastered: isMastered,
          history: [
            ...existing.history,
            {
              stage: currentStage,
              isFinalReview: isFinal,
              userAnswer: feedback.userAnswer,
              wasCorrect: isCorrect,
              feedback: feedback.feedback,
            },
          ],
        },
      };
    });

    // Determine what task (if any) needs to be scheduled next for currentWordId
    let itemToSchedule: SessionQueueItem | null = null;
    let desiredSpacing: number | undefined = undefined;

    if (sessionType === 'exam') {
      // In exam mode, each question is evaluated once without repeats
      itemToSchedule = null;
      if (!isCorrect) {
        const nextMistakes = examMistakesCount + 1;
        setExamMistakesCount(nextMistakes);
        if (nextMistakes >= 3) {
          setIsExamFailed(true);
          return;
        }
      }
    } else if (task.isBufferReview) {
      // Spacer refresher tasks: if correct, finished! If incorrect, re-queue once with 2 words spacing
      if (!isCorrect) {
        itemToSchedule = {
          id: `${currentWordId}-spacer-retry-${Date.now()}`,
          wordId: currentWordId,
          stage: currentStage,
          isBufferReview: true,
          retryStep: 1,
        };
        desiredSpacing = 2;
      }
    } else if (!isCorrect) {
      // Mistake handling:
      // "zet er 2 woorden tussen, en herhaal het woord dat je fout deed. Zodat je opnieuw de kans krijgt om het woord te typen, dat helpt bij het leer proces"
      // "Hier houd je je wel aan het onderscheid tussen 'to target' en 'from target'. Als de fout is in 'to target' is de herhaling ook in to target. als de fout zit in from target, is de herhaling ook in from target."
      const repeatStage: WordStage = currentStage === 1
        ? (activeDirection === 'target' ? 3 : 2)
        : currentStage;

      const cleanId = currentWordId.includes('__dir__') ? currentWordId.split('__dir__')[0] : currentWordId;
      sessionMistakenTasksRef.current.set(`${cleanId}::${repeatStage}`, {
        wordId: cleanId,
        stage: repeatStage,
      });

      itemToSchedule = {
        id: `${currentWordId}-s${repeatStage}-retry1-${Date.now()}`,
        wordId: currentWordId,
        stage: repeatStage,
        retryStep: 1,
        isFinalReview: isFinal,
      };
      desiredSpacing = 2;
    } else {
      // Correct answer handling:
      if (task.retryStep === 1) {
        // Just passed the 2-word retry!
        // "vervolgens moeten er minstens 5 maar woorden tussen zitten en herhaal je het opnieuw."
        itemToSchedule = {
          id: `${currentWordId}-s${currentStage}-retry2-${Date.now()}`,
          wordId: currentWordId,
          stage: currentStage,
          retryStep: 2,
          isFinalReview: isFinal,
        };
        desiredSpacing = 5;
      } else if (task.retryStep === 2) {
        // Just passed the >=5 words retry! Both spaced repetition steps complete.
        itemToSchedule = null;
      } else if (isFinal) {
        // Passed end-of-session review task!
        itemToSchedule = null;
      } else if (currentStage === 1) {
        // Stage 1 (multiple choice) passed for brand-new word; advance to target language typing (Stage 3)
        const hasStage3InQueue = remainingQueue.some(q => isSameWord(q.wordId, currentWordId) && q.stage === 3);
        if (!hasStage3InQueue) {
          itemToSchedule = {
            id: `${currentWordId}-s3-${Date.now()}`,
            wordId: currentWordId,
            stage: 3,
          };
          desiredSpacing = 5;
        } else {
          itemToSchedule = null;
        }
      } else {
        // Regular typing task (Stage 2 or 3) answered correctly on 1st try!
        itemToSchedule = null;
      }
    }

    const nextQ = sessionType === 'exam'
      ? remainingQueue
      : handleScheduleSpacedTasks({
          remainingQueue,
          itemToInsert: itemToSchedule,
          currentWordId,
          desiredSpacing,
        });

    if (nextQ.length === 0) {
      if (sessionType === 'exam') {
        setIsExamPassed(true);
        setIsCompleted(true);
        setQueue([]);
      } else if (!hasStartedEndReviewRef.current && sessionMistakenTasksRef.current.size > 0) {
        // End-of-session review round for all words that had a mistake:
        // "en op het eind komen natuurlijk alle woorden die je fout had opnieuw aanbod in een random volgorde."
        // "Hier houd je je wel aan het onderscheid tussen 'to target' en 'from target'. Als de fout is in 'to target' is de herhaling ook in to target. als de fout zit in from target, is de herhaling ook in from target."
        hasStartedEndReviewRef.current = true;
        const mistakenItems: Array<{ wordId: string; stage: WordStage }> = Array.from(sessionMistakenTasksRef.current.values());
        const shuffledMistakes = [...mistakenItems].sort(() => Math.random() - 0.5);
        const endReviewQueue: SessionQueueItem[] = shuffledMistakes.map((item, idx) => ({
          id: `${item.wordId}-end-s${item.stage}-${Date.now()}-${idx}`,
          wordId: item.wordId,
          stage: item.stage,
          isFinalReview: true,
        }));
        setQueue(endReviewQueue);
        setIsInEndReviewRound(true);
      } else {
        setIsCompleted(true);
        setQueue([]);
      }
    } else {
      setQueue(nextQ);
    }

    // Reset inputs
    setSelectedChoice(null);
    setTypedAnswer('');
    setFeedbackState(null);
  };

  // Handle multiple choice selection (Stage 1)
  const handleSelectChoice = (option: string) => {
    if (!currentTask || !activeCard || isChecking || feedbackState?.submitted) return;

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    setSelectedChoice(option);

    const expectedText = activeCard.word.translation;

    // Handle "I don't know" / "Ik weet het niet" choice
    const isDontKnowChoice =
      option === DONT_KNOW_OPTION ||
      option === DONT_KNOW_OPTION_NL ||
      option.toLowerCase().includes("don't know") ||
      option.toLowerCase().includes("weet het niet");

    if (isDontKnowChoice) {
      submissionTimeRef.current = Date.now();
      const feedbackObj: FeedbackState = {
        submitted: true,
        isCorrect: false,
        verdict: 'incorrect_meaning',
        feedback: '',
        userAnswer: option,
        expectedAnswer: expectedText,
        isFinalReview: Boolean(currentTask.isFinalReview),
        nextStepNote: 'This word will return for practice later in the session.',
      };
      setFeedbackState(feedbackObj);
      return;
    }

    const isExactChoice = option.trim().toLowerCase() === expectedText.trim().toLowerCase();
    const checkRes = checkTranslationLocal(
      option,
      expectedText,
      activeCard.word.targetWord,
      activeCard.word.alternativeTranslations
    );
    const isCorrect = isExactChoice || checkRes.isCorrect;
    const verdict = isCorrect ? 'correct' : checkRes.verdict;

    if (!isCorrect) {
      submissionTimeRef.current = Date.now();
    }

    const feedbackObj: FeedbackState = {
      submitted: true,
      isCorrect,
      verdict,
      feedback: isCorrect ? 'Correct!' : '',
      userAnswer: option,
      expectedAnswer: expectedText,
      isFinalReview: Boolean(currentTask.isFinalReview),
      nextStepNote: '',
    };

    setFeedbackState(feedbackObj);

    if (isCorrect) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        advanceTask(feedbackObj, currentTask, activeCard);
      }, 500);
    }
  };

  // User explicitly indicates they don't know the word (typing or empty Enter)
  const handleDontKnow = () => {
    if (!currentTask || !activeCard || isChecking || feedbackState?.submitted) return;

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const isStage2 = currentTask.stage === 2;
    const isFinal = Boolean(currentTask.isFinalReview);
    const expectedText = isStage2 ? activeCard.word.translation : activeCard.word.targetWord;

    submissionTimeRef.current = Date.now();

    const feedbackObj: FeedbackState = {
      submitted: true,
      isCorrect: false,
      verdict: 'incorrect_meaning',
      feedback: '',
      userAnswer: '',
      expectedAnswer: expectedText,
      isFinalReview: isFinal,
      nextStepNote: 'This word will return for practice later in the session.',
    };

    setFeedbackState(feedbackObj);
    setIsChecking(false);
  };

  // Submit Answer for typing stages (Stage 2 & 3)
  const handleSubmitAnswer = async (overrideValue?: string) => {
    if (!currentTask || !activeCard || isChecking || feedbackState?.submitted) return;

    if (currentTask.stage === 1) {
      if (!selectedChoice) return;
      handleSelectChoice(selectedChoice);
      return;
    }

    const answerGiven = (overrideValue !== undefined ? overrideValue : typedAnswer).trim();
    const isStage2 = currentTask.stage === 2;
    const isStage3 = currentTask.stage === 3;
    const isFinal = Boolean(currentTask.isFinalReview);

    // If user doesn't know the word, pressing Enter or clicking Submit with empty text reveals the answer and stops for review
    if (!answerGiven) {
      handleDontKnow();
      return;
    }

    setIsChecking(true);

    let isCorrect = false;
    let verdict: 'correct' | 'incorrect_spelling' | 'incorrect_meaning' | 'incorrect_loose' = 'incorrect_meaning';
    let feedbackText = '';
    let expectedText = '';

    if (isStage2) {
      expectedText = activeCard.word.translation;
      const checkRes = await verifyTranslationSmart({
        userTranslation: answerGiven,
        expectedTranslation: expectedText,
        alternativeTranslations: activeCard.word.alternativeTranslations,
        promptWord: activeCard.word.targetWord,
        sourceLanguage: profile.targetLanguage,
        targetLanguage: profile.knownLanguage,
        direction: 'target_to_known',
        level: activeCard.word.level,
      });
      isCorrect = checkRes.isCorrect;
      verdict = checkRes.verdict;
      feedbackText = checkRes.feedback;
    } else {
      expectedText = activeCard.word.targetWord;
      const altTargets = getBankAlternativesForWord(activeCard.word.translation);
      const checkRes = await verifyTranslationSmart({
        userTranslation: answerGiven,
        expectedTranslation: expectedText,
        alternativeTranslations: altTargets,
        promptWord: activeCard.word.translation,
        sourceLanguage: profile.knownLanguage,
        targetLanguage: profile.targetLanguage,
        direction: 'known_to_target',
        level: activeCard.word.level,
      });
      isCorrect = checkRes.isCorrect;
      verdict = checkRes.verdict;
      feedbackText = checkRes.feedback;
    }

    if (!isCorrect) {
      submissionTimeRef.current = Date.now();
    }

    const feedbackObj: FeedbackState = {
      submitted: true,
      isCorrect,
      verdict,
      feedback: isCorrect ? 'Correct!' : '',
      userAnswer: answerGiven,
      expectedAnswer: expectedText,
      isFinalReview: isFinal,
      nextStepNote: '',
    };

    setFeedbackState(feedbackObj);
    setIsChecking(false);

    if (isCorrect) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      // Quick, responsive green auto-advance duration for typing (550ms)
      autoAdvanceTimerRef.current = setTimeout(() => {
        advanceTask(feedbackObj, currentTask, activeCard);
      }, 550);
    }
  };

  const handleContinueNext = () => {
    if (!currentTask || !activeCard || !feedbackState) return;

    // Grace period check: require at least 450ms on screen so user can observe feedback
    if (Date.now() - submissionTimeRef.current < 450) {
      return;
    }

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    advanceTask(feedbackState, currentTask, activeCard);
  };

  // Typo override handler
  const handleOverrideCorrect = () => {
    if (!currentTask || !activeCard || !feedbackState) return;

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Track override in Firebase & Server to identify missing translations (e.g. 'receipt' for 'חשבון')
    const userTyped = feedbackState.userAnswer || typedAnswer || '';
    const targetWord = activeCard.word.targetWord;
    const expectedTranslation = activeCard.word.translation || feedbackState.expectedAnswer;
    const targetLanguage = profile.targetLanguage || 'he';
    const knownLanguage = profile.knownLanguage || 'en';

    recordTranslationOverride({
      targetWord,
      targetLanguage,
      knownLanguage,
      expectedTranslation,
      alternativeTranslations: activeCard.word.alternativeTranslations,
      userTyped,
      level: activeCard.word.level,
      sessionType: sessionType || 'study_session',
      userEmail: profile.email,
      transliteration: activeCard.word.transliteration,
      direction: activeCard.taskType === 3 ? 'known_to_target' : 'target_to_known',
    }).catch(err => console.warn('Override tracking note:', err));

    const cleanId = currentTask.wordId.includes('__dir__') ? currentTask.wordId.split('__dir__')[0] : currentTask.wordId;
    sessionMistakenTasksRef.current.delete(`${cleanId}::${currentTask.stage}`);

    const updatedFeedback: FeedbackState = {
      ...feedbackState,
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Correct!',
      nextStepNote: '',
    };

    advanceTask(updatedFeedback, currentTask, activeCard);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChecking || e.repeat) return;

      if (feedbackState?.submitted) {
        // Only allow manual Enter advance when the answer was incorrect (for correct answers, show the green border and auto-advance)
        if (e.key === 'Enter' && !feedbackState.isCorrect) {
          e.preventDefault();
          handleContinueNext();
        } else if (!feedbackState.isCorrect && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'o' || e.key.toLowerCase() === 'i')) {
          e.preventDefault();
          handleOverrideCorrect();
        }
      } else {
        if (e.key === 'Enter' && currentTask && currentTask.stage !== 1) {
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            handleSubmitAnswer();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedbackState, currentTask, activeCard, isChecking, typedAnswer]);

  const handleInsertLetter = (char: string) => {
    setTypedAnswer(prev => prev + char);
    inputRef.current?.focus();
  };

  // Complete and save to SRS and Category Hierarchy
  const handleCompleteAndSave = () => {
    const updatedWords: Record<string, WordProgress> = { ...profile.words };
    let hardCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let promotedCount = 0;

    const allWordStates = Object.values(wordStates) as WordStudyState[];
    const sessionItems: StudySessionResult['items'] = [];

    allWordStates.forEach(item => {
      const { card, hadMistakeAtAnyStage, mistakesCount } = item;
      const rawWId = card.word.id;
      const wId = rawWId.includes('__dir__') ? rawWId.split('__dir__')[0] : rawWId;
      const existing = updatedWords[wId] || profile.words?.[wId];

      const isPromoted = mistakesCount <= 3;
      const wasFirstTryClean = !hadMistakeAtAnyStage && mistakesCount === 0;

      if (isPromoted) {
        correctCount++;
      } else {
        incorrectCount++;
        hardCount++;
      }

      const catBefore = existing ? getWordCategory(existing) : item.category;

      const updated = calculateWordUpdate(
        existing,
        card.word,
        wasFirstTryClean,
        mistakesCount,
        undefined,
        item.sessionHardScore
      );

      if (updated.isHard) {
        hardCount++;
      }

      const catAfter = updated.category;
      if (catAfter !== catBefore) {
        promotedCount++;
      }

      updatedWords[wId] = {
        ...updated,
        wordId: wId,
      };

      sessionItems.push({
        wordId: wId,
        targetWord: card.word.targetWord,
        translation: card.word.translation,
        categoryBefore: catBefore,
        categoryAfter: catAfter,
        wasFirstTryClean,
        isHard: updated.isHard,
      });
    });

    const sessionSummary: StudySessionResult = {
      sessionId: initialSavedState?.sessionId || `session-${Date.now()}`,
      timestamp: Date.now(),
      cardsCount: cards.length,
      newWordsCount: cards.filter(c => c.category === 'red' || c.isNew).length,
      reviewWordsCount: cards.filter(c => c.category !== 'red' && !c.isNew).length,
      correctCount,
      incorrectCount,
      hardWordsAdded: hardCount,
      promotedWordsCount: promotedCount,
      items: sessionItems,
    };

    onClearSavedSession?.(sessionType);

    const completedTokens: Array<{
      wordId: string;
      direction: TokenDirection;
      wasClean?: boolean;
      isNew?: boolean;
    }> = cards.flatMap((c) => {
      const cleanId = c.word.id.includes('__dir__') ? c.word.id.split('__dir__')[0] : c.word.id;
      const isNew = Boolean(c.isNew || c.category === 'red');
      const st = wordStates[c.word.id];
      const wasClean = (st?.mistakesCount ?? 0) === 0;

      if (c.hierarchyDirection) {
        return [{ wordId: cleanId, direction: c.hierarchyDirection, wasClean, isNew }];
      }
      return [
        { wordId: cleanId, direction: 'to_target' as TokenDirection, wasClean, isNew },
        { wordId: cleanId, direction: 'from_target' as TokenDirection, wasClean, isNew },
      ];
    });

    onFinishSession(
      sessionSummary,
      updatedWords,
      {
        mistakeTokens: mistakeTokensRef.current,
        completedTokens,
      },
      sessionType === 'exam' && examMistakesCount <= 2
    );
  };

  const handleExitClick = () => {
    if (!isCompleted && queue.length > 0) {
      const currentSessionType: SessionType = sessionType === 'rusty' ? 'rusty' : 'daily';
      const stateToSave: SavedSessionState = {
        sessionId: initialSavedState?.sessionId || `session-${Date.now()}`,
        sessionType: currentSessionType,
        reviewDirection: activeDirection,
        cards,
        queue,
        wordStates,
        completedTasksCount,
        baseExpectedTasks,
        savedAt: Date.now(),
        targetLanguage: profile.targetLanguage,
        knownLanguage: profile.knownLanguage,
      };
      onSaveSession?.(stateToSave);
      onExit(stateToSave);
    } else {
      onExit();
    }
  };

  // --- EXAM FAILED SCREEN ---
  if (isExamFailed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-600/20">
            <XCircle className="w-10 h-10 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-bold">
              Level {profile.numericLevel || 1} Examen
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 dark:text-white">
              Examen niet gehaald
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
              Je hebt 3 fouten gemaakt op het examen. Je hebt ruimte voor maximaal 2 fouten om te slagen.
            </p>
          </div>

          {/* 3 Broken Hearts */}
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="text-3xl" title="Fout 1">💔</span>
            <span className="text-3xl" title="Fout 2">💔</span>
            <span className="text-3xl" title="Fout 3 (Gezakt)">💔</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 text-left space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Advies: Oefen eerst Recent Review</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              In Recent Review oefen je de moeilijkste en oudste woorden van het huidige en voorgaande niveau. Je kunt het examen zo vaak doen als je wilt totdat je slaagt!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {onStartRecentReview && (
              <button
                type="button"
                onClick={onStartRecentReview}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Oefen Recent Review</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onRestartExam) {
                  onRestartExam();
                } else {
                  setExamMistakesCount(0);
                  setIsExamFailed(false);
                  setIsCompleted(false);
                  setQueue(cards.map((card, idx) => ({
                    id: `${card.word.id}-exam-retry-${idx}`,
                    wordId: card.word.id,
                    stage: card.hierarchyDirection === 'from_target' ? 2 : 3,
                  })));
                  setCompletedTasksCount(0);
                }
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Probeer Examen Opnieuw</span>
            </button>

            <button
              type="button"
              onClick={() => onExit()}
              className="w-full py-2.5 text-xs font-semibold text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors cursor-pointer"
            >
              Terug naar Journey
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- EXAM PASSED SUMMARY SCREEN ---
  if (isCompleted && sessionType === 'exam') {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-600/20">
            <Award className="w-10 h-10 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              Level {profile.numericLevel || 1} Examen
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 dark:text-white">
              Gefeliciteerd! Examen Gehaald! 🎉
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
              Geweldig gedaan! Je hebt alle 25 vragen beantwoord met {examMistakesCount} fout(en) (maximaal 2 toegestaan). Level {(profile.numericLevel || 1) + 1} is nu ontgrendeld!
            </p>
          </div>

          {/* Lives display */}
          <div className="flex items-center justify-center gap-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="text-2xl">
                {i < (3 - examMistakesCount) ? '❤️' : '💔'}
              </span>
            ))}
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300 ml-2">
              {examMistakesCount} / 2 fouten gemaakt (Geslaagd)
            </span>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCompleteAndSave}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Opslaan & Naar Volgende Level</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SUMMARY SCREEN ---
  if (isCompleted) {
    const allStates = Object.values(wordStates) as WordStudyState[];

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl text-center space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight mt-1">
              Well done!
            </h2>
          </div>

          {/* Words Overview & Category Promotions */}
          <div className="text-left space-y-2.5 max-h-80 overflow-y-auto pr-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Results
            </h4>
            {allStates.map((item, idx) => {
              const isItemNew = Boolean(item.card.isNew || item.isRedCategory);
              const isPromoted = item.mistakesCount <= 3;

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isPromoted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-bold text-stone-900 mr-1.5">{item.card.word.targetWord}</span>
                      <span className="text-stone-700">({item.card.word.translation})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isItemNew ? (
                      <>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                          Nieuw
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          Geleerd
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                          Herhaling
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Geleerd
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              id="save-session-btn"
              onClick={handleCompleteAndSave}
              className="w-full py-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active task details
  const isStage1 = currentTask?.stage === 1;
  const isStage2 = currentTask?.stage === 2;
  const isStage3 = currentTask?.stage === 3;
  const isFinalReview = Boolean(currentTask?.isFinalReview);
  const isPromptInTargetLanguage = Boolean(currentTask && isStage2);
  const isRedWord = activeWordState?.isRedCategory ?? true;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="btn-session-exit"
            onClick={handleExitClick}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer shadow-2xs"
            title="Afsluiten"
            aria-label="Afsluiten"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
              {isInEndReviewRound ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Eindronde: Fouten herhalen ({queue.length} over)
                </span>
              ) : sessionType === 'exam'
                ? `Level ${profile.numericLevel || 1} Examen`
                : `${cards.length}-Word ${
                    sessionType === 'rusty_review'
                      ? 'Rusty Review'
                      : sessionType === 'recent_review'
                      ? 'Recent Review'
                      : sessionType === 'new_words'
                      ? 'New Words'
                      : sessionType === 'rusty'
                      ? 'Review'
                      : 'Daily'
                  } Session`}
            </span>
            {sessionType === 'exam' && (
              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                Vraag {Math.min(cards.length, completedTasksCount + 1)} van {cards.length}
              </span>
            )}
          </div>
        </div>

        {sessionType === 'exam' && (
          <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className="text-base select-none" title={i < (3 - examMistakesCount) ? "Leven over" : "Fout gemaakt"}>
                  {i < (3 - examMistakesCount) ? '❤️' : '💔'}
                </span>
              ))}
            </div>
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300 font-mono ml-1">
              {2 - examMistakesCount === 2
                ? '2 fouten over'
                : 2 - examMistakesCount === 1
                ? '1 fout over'
                : 'Laatste kans! (0 over)'}
            </span>
          </div>
        )}
      </div>

      {/* Main Interactive Practice Card */}
      {activeCard && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden flex flex-col min-h-[420px] transition-all">
          {/* Card Top Header */}
          <div className="px-6 py-2.5 border-b border-stone-200/80 bg-stone-50/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {activeCard.hasYellowBall && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-bold shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-xs" />
                  In progress
                </span>
              )}
              {isFinalReview && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-900 text-white font-bold text-[11px]">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Final Retention Check
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* Show phonetic toggle switch - whenever active card has transliteration */}
              {Boolean(activeCard?.word?.transliteration) && (
                <>
                  <label
                    id="switch-show-phonetic"
                    onClick={handleTogglePhonetic}
                    className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-stone-600 hover:text-stone-900 transition-colors font-medium"
                  >
                    <span>show phonetic</span>
                    <div
                      role="switch"
                      aria-checked={showPhonetic}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-200 ease-in-out ${
                        showPhonetic ? 'bg-amber-500' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                          showPhonetic ? 'translate-x-3.5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </label>

                  <span className="text-stone-300">•</span>
                </>
              )}

              <span className="text-[11px] text-stone-500 font-medium">
                Level {activeCard.word.level}
              </span>
            </div>
          </div>

          {/* Prompt Area */}
          <div className="p-6 sm:p-8 flex-1 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-white to-stone-50/40">
            {/* Prompt Word: Stage 3 translates into target language (prompt in familiar language), Stage 2 translates into familiar language (prompt in target language) */}
            {isStage3 ? (
              <div className="space-y-3">
                <h3 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
                  {activeCard.word.translation}
                </h3>
                <div className="flex items-center justify-center gap-2 flex-wrap pt-2.5">
                  {activeWordState && (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cardBadgeInfo.badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${cardBadgeInfo.dotColor}`} />
                      <span>{cardBadgeInfo.label}</span>
                    </span>
                  )}
                  {activeCard.word.partOfSpeech && (
                    <span className="inline-block text-[11px] font-semibold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full border border-stone-200">
                      {activeCard.word.partOfSpeech}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <h3
                    className={`font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight ${
                      targetLang.rtl ? 'font-hebrew' : ''
                    }`}
                    dir={targetLang.rtl ? 'rtl' : 'ltr'}
                  >
                    {activeCard.word.targetWord}
                  </h3>
                  <button
                    onClick={(e) => handlePlayAudio(activeCard.word.targetWord, e)}
                    className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors shadow-2xs cursor-pointer"
                    title="Pronounce word"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {showPhonetic && activeCard.word.transliteration && (
                  <p className="text-sm font-medium text-stone-600 font-mono animate-in fade-in duration-150">
                    /{activeCard.word.transliteration}/
                  </p>
                )}

                <div className="flex items-center justify-center gap-2 flex-wrap pt-2.5">
                  {activeWordState && (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cardBadgeInfo.badgeClass}`}>
                      <span className={`w-2 h-2 rounded-full ${cardBadgeInfo.dotColor}`} />
                      <span>{cardBadgeInfo.label}</span>
                    </span>
                  )}
                  {activeCard.word.partOfSpeech && (
                    <span className="inline-block text-[11px] font-semibold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full border border-stone-200">
                      {activeCard.word.partOfSpeech}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Stage 1: Multiple Choice Options */}
            {isStage1 && (
              <div className="w-full max-w-md pt-4 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {multipleChoiceOptions.map((opt, idx) => {
                    const isSelected = selectedChoice === opt;
                    const isDontKnow =
                      opt === DONT_KNOW_OPTION ||
                      opt === DONT_KNOW_OPTION_NL ||
                      opt.toLowerCase().includes("don't know") ||
                      opt.toLowerCase().includes("weet het niet");
                    const isExpected = opt.trim().toLowerCase() === activeCard.word.translation.trim().toLowerCase();
                    
                    let btnStyle = 'bg-white hover:bg-stone-50 border-stone-300 text-stone-800 hover:border-amber-400';
                    let rightIcon = null;

                    if (feedbackState?.submitted) {
                      if (isSelected && feedbackState.isCorrect) {
                        btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-400 shadow-md';
                        rightIcon = <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />;
                      } else if (isSelected && !feedbackState.isCorrect) {
                        btnStyle = 'bg-stone-100 border-stone-300 text-stone-600 font-semibold shadow-xs';
                        rightIcon = <X className="w-4 h-4 text-stone-500 shrink-0" />;
                      } else if (isExpected && !feedbackState.isCorrect) {
                        btnStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400';
                        rightIcon = <Check className="w-4 h-4 text-emerald-700 shrink-0" />;
                      } else {
                        btnStyle = 'bg-stone-50 border-stone-200 text-stone-600 opacity-60';
                      }
                    } else if (isDontKnow) {
                      // Distinctive subtle styling for "I don't know" so it's clearly distinct from word choices
                      btnStyle = 'bg-stone-50/90 hover:bg-stone-100 border-dashed border-stone-300 hover:border-stone-400 text-stone-600 hover:text-stone-900 font-medium italic';
                      rightIcon = <HelpCircle className="w-4 h-4 text-stone-400 shrink-0" />;
                    } else if (isSelected) {
                      btnStyle = 'bg-amber-500 border-amber-600 text-stone-950 shadow-md ring-2 ring-amber-400';
                      rightIcon = <Check className="w-4 h-4 text-stone-950 shrink-0" />;
                    }

                    return (
                      <button
                        key={idx}
                        id={`choice-opt-${idx}`}
                        type="button"
                        disabled={feedbackState?.submitted || isChecking}
                        onClick={() => handleSelectChoice(opt)}
                        className={`p-3.5 rounded-xl border text-sm font-semibold transition-all text-left flex items-center justify-between cursor-pointer ${btnStyle}`}
                      >
                        <span className={isDontKnow ? 'italic' : ''}>{opt}</span>
                        {rightIcon}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stage 2 & 3: Typing Input (answer stays in the bar where it was typed) */}
            {!isStage1 && (
              <div className="w-full max-w-md pt-4 space-y-3">
                <div className="space-y-1 text-left">
                  <div
                    className={`relative flex items-center rounded-2xl transition-all duration-200 ${
                      feedbackState?.submitted
                        ? feedbackState.isCorrect
                          ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/40 bg-emerald-50/60 shadow-md shadow-emerald-500/20'
                          : 'border-2 border-stone-300 bg-stone-50/40'
                        : 'border-2 border-stone-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-400/30 bg-white'
                    }`}
                  >
                    <input
                      ref={inputRef}
                      id="study-text-input"
                      name={`study_word_input_${currentTask.id}`}
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      aria-autocomplete="none"
                      dir={isStage3 ? (targetLang.rtl ? 'rtl' : 'ltr') : 'ltr'}
                      placeholder=""
                      value={typedAnswer}
                      disabled={isChecking || Boolean(feedbackState?.submitted)}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!feedbackState?.submitted) {
                            inputRef.current?.blur();
                            handleSubmitAnswer(e.currentTarget.value);
                          } else if (!feedbackState.isCorrect) {
                            handleContinueNext();
                          }
                        }
                      }}
                      className={`w-full px-4 py-3.5 bg-transparent border-0 outline-none text-base font-medium text-stone-900 placeholder:text-stone-400 ${
                        isStage3 ? 'text-lg' : ''
                      }`}
                    />
                    {feedbackState?.submitted && feedbackState.isCorrect && (
                      <div className="pr-3.5 flex items-center gap-1.5 shrink-0 text-emerald-600 animate-in zoom-in duration-150">
                        <CheckCircle2 className="w-5 h-5 fill-emerald-100 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 hidden sm:inline">Correct</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* On-screen letter keyboard helper for Hebrew (optional toggle, hidden during feedback) */}
                {isStage3 && targetLang.code === 'he' && !feedbackState?.submitted && (
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        id="btn-toggle-hebrew-keyboard"
                        onClick={() => setShowVirtualKeyboard((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Toggle on-screen Hebrew keyboard"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>{showVirtualKeyboard ? 'Hide keyboard' : 'Hebrew keyboard'}</span>
                      </button>
                    </div>

                    {showVirtualKeyboard && (
                      <HebrewKeyboard onInsertLetter={handleInsertLetter} />
                    )}
                  </div>
                )}

                {/* Gentle, calm white card with understated cross badge (less attention-grabbing) */}
                {feedbackState?.submitted && !feedbackState.isCorrect && (
                  <StudyFeedbackBanner
                    expectedAnswer={feedbackState.expectedAnswer}
                    transliteration={activeCard.word.transliteration}
                    showPhonetic={showPhonetic}
                    isRtlTarget={isStage3 && targetLang.rtl}
                    onOverrideCorrect={handleOverrideCorrect}
                  />
                )}
              </div>
            )}

            {/* Stage 1 feedback pop up if incorrect (gentle white layout) */}
            {isStage1 && feedbackState?.submitted && !feedbackState.isCorrect && (
              <div className="w-full max-w-md pt-2 space-y-2 text-left animate-in fade-in zoom-in-95 duration-200">
                <StudyFeedbackBanner
                  expectedAnswer={feedbackState.expectedAnswer}
                  isRtlTarget={targetLang.rtl}
                />
              </div>
            )}
          </div>

          {/* Action Footer with Single Session Progress Bar */}
          <div className="p-4 sm:p-5 bg-stone-50/90 border-t border-stone-200 flex flex-col gap-3.5">
            {/* Action Buttons: Above Progress Bar (Submit or Continue) */}
            {(feedbackState?.submitted ? !feedbackState.isCorrect : !isStage1) && (
              <div className="flex items-center justify-end">
                {feedbackState?.submitted ? (
                  <button
                    id="continue-study-btn"
                    onClick={handleContinueNext}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-105"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    id="submit-study-answer-btn"
                    onClick={handleSubmitAnswer}
                    disabled={isChecking}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    {isChecking ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Single Session Progress Bar */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span className="font-semibold text-stone-700">Session Progress</span>
                <span className="font-medium text-stone-600">
                  <strong className="text-stone-900 font-bold">
                    {remainingTasksCount}
                  </strong>{' '}
                  {remainingTasksCount === 1 ? 'word to go' : 'words to go'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${sessionProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
