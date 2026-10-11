import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserProfile,
  CEFRLevel,
  StudyCard,
  StudySessionResult,
  WordProgress,
  WordCategory,
  PlacementTestResult,
  SavedSessionState,
  SessionType,
  WordItem,
  TokenDirection,
} from './types';
import {
  getBaseNumericLevelForCefr,
  getCefrForNumericLevel,
} from './data/languages';
import {
  buildStudySessionBatch,
  buildRustyReviewBatchWithHierarchies,
  calculateWordUpdate,
  isNumericLevelCompleted,
} from './utils/srs';
import {
  applyReviewMistakePoints,
  applySessionWordCompletion,
  buildExamSessionCards,
  buildNewWordsSessionCards,
  buildRecentReviewSessionCards,
  buildRustyReviewSessionCards,
} from './utils/reviewHierarchy';
import {
  getLevelButtons,
  getLevelCompletedSessions,
} from './components/JourneyView';
import {
  getSeedVocabularyForLanguageAndLevel,
  getLocalizedWordItem,
  localizeUserProgress,
} from './data/vocabularyRepository';
import { advanceStreakOnSessionComplete } from './utils/streak';
import { useAuth } from './context/AuthContext';
import { useProfile } from './context/ProfileContext';

import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { LaunchScreen } from './components/LaunchScreen';
import { PlacementTest } from './components/PlacementTest';
import { StudySession } from './components/StudySession';
import { WordBankView } from './components/WordBankView';
import { ReviewView } from './components/ReviewView';
import { JourneyView } from './components/JourneyView';
import { ChangeLevelModal } from './components/ChangeLevelModal';
import { FriendsView } from './components/FriendsView';
import { ProfileView } from './components/ProfileView';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const { activeEmail, setActiveEmail, signOut } = useAuth();
  const {
    profile,
    isLoadingProfile,
    setProfile,
    saveProfile,
    updateProfile,
    directLevelChange,
    savedDailySession,
    savedRustySession,
    saveSessionState,
    clearSavedDailySession,
    clearSavedRustySession,
    clearSavedSession,
    switchTargetLanguage,
  } = useProfile();

  // Views: 'launch' | 'placement' | 'journey' | 'review' | 'active-session' | 'bank' | 'friends' | 'profile' | 'admin'
  const [currentView, setCurrentView] = useState<
    'launch' | 'placement' | 'journey' | 'review' | 'active-session' | 'bank' | 'friends' | 'profile' | 'admin'
  >('journey');

  const sessionOriginViewRef = useRef<'journey' | 'review'>('journey');

  // Active Journey lesson tracking
  const [journeyActiveLesson, setJourneyActiveLesson] = useState<{
    level: number;
    ballIndex: number;
    lessonIndex: number;
  } | null>(null);

  // Pending placement test parameters
  const [pendingPlacementLevel, setPendingPlacementLevel] = useState<CEFRLevel>('A1');
  const [pendingTargetLang, setPendingTargetLang] = useState<string>('he');
  const [pendingKnownLang, setPendingKnownLang] = useState<string>(() => {
    try {
      return localStorage.getItem('vocabpulse_last_selected_language') || 'en';
    } catch {
      return 'en';
    }
  });

  // Active study session state
  const [activeSessionCards, setActiveSessionCards] = useState<StudyCard[]>([]);
  const [activeSessionType, setActiveSessionType] = useState<SessionType>('daily');
  const [activeReviewDirection, setActiveReviewDirection] = useState<'both' | 'target' | 'known'>('both');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [wordBankCategoryFilter, setWordBankCategoryFilter] = useState<WordCategory | 'all' | 'hard'>('all');

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChangeLevelOpen, setIsChangeLevelOpen] = useState(false);

  // Theme Management (Light vs Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('vocabpulse_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vocabpulse_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Error applying theme:', e);
    }
  }, [theme]);

  const handleToggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const handleLogOff = () => {
    clearSavedDailySession();
    clearSavedRustySession();
    signOut().catch(() => {});
    setProfile(null);
    setCurrentView('journey');
  };

  const handleDeleteAccount = async () => {
    if (!profile?.email) return;
    const emailToDelete = profile.email;
    try {
      await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToDelete }),
      });
    } catch (e) {
      console.error('Error deleting account on server:', e);
    }
    clearSavedDailySession();
    clearSavedRustySession();
    try {
      localStorage.removeItem(`vocabpulse_user_${emailToDelete}`);
      localStorage.removeItem(`vocabpulse_pwd_${emailToDelete}`);
    } catch (e) {
      console.error('Error clearing storage after account deletion:', e);
    }
    signOut().catch(() => {});
    setProfile(null);
    setIsSettingsModalOpen(false);
    setCurrentView('journey');
  };

  const handleLoginSuccess = (loggedInProfile: UserProfile) => {
    let lastSelected: string | null = null;
    try {
      lastSelected = localStorage.getItem('vocabpulse_last_selected_language');
    } catch {}
    const effectiveProfile: UserProfile = {
      ...loggedInProfile,
      knownLanguage: lastSelected || loggedInProfile.knownLanguage || 'en',
    };
    setActiveEmail(effectiveProfile.email);
    saveProfile(effectiveProfile);
    if (
      (effectiveProfile.totalSessionsCompleted && effectiveProfile.totalSessionsCompleted > 0) ||
      Object.keys(effectiveProfile.words || {}).length > 0
    ) {
      setCurrentView('journey');
    } else {
      setCurrentView('launch');
    }
  };

  // Continue saved Daily Practice session
  const handleContinueDailySession = () => {
    if (!savedDailySession) return;
    setActiveSessionCards(savedDailySession.cards);
    setActiveSessionType('daily');
    setActiveReviewDirection(savedDailySession.reviewDirection || 'both');
    setCurrentView('active-session');
  };

  // Continue saved Review Rusty Words session
  const handleContinueRustySession = () => {
    if (!savedRustySession) return;
    setActiveSessionCards(savedRustySession.cards);
    setActiveSessionType('rusty');
    setActiveReviewDirection(savedRustySession.reviewDirection || 'both');
    setCurrentView('active-session');
  };

  const handleDirectLevelChange = (newCefr: CEFRLevel, newNumericLevel: number) => {
    directLevelChange(newCefr, newNumericLevel);
    if (currentView === 'launch' || currentView === 'placement') {
      setCurrentView('journey');
    }
  };

  const handleSwitchLanguage = async (newLangCode: string) => {
    if (!profile) return;
    await switchTargetLanguage(newLangCode);
    setCurrentView('journey');
  };

  // Handle saving Launch setup (Languages & Level)
  const handleSaveLaunchSetup = async (
    targetLang: string,
    knownLang: string,
    level: CEFRLevel,
    needsPlacementTest: boolean
  ) => {
    setPendingTargetLang(targetLang);
    setPendingKnownLang(knownLang);
    setPendingPlacementLevel(level);

    if (needsPlacementTest) {
      setCurrentView('placement');
    } else {
      if (!profile) return;
      if (targetLang !== profile.targetLanguage) {
        await switchTargetLanguage(targetLang, knownLang);
      } else if (knownLang !== profile.knownLanguage) {
        updateProfile({ knownLanguage: knownLang });
      }
      setCurrentView('journey');
    }
  };

  // Handle completion of placement test
  const handlePlacementComplete = (result: PlacementTestResult, finalLevel: CEFRLevel) => {
    if (!profile) return;
    const numericLevel = getBaseNumericLevelForCefr(finalLevel);
    const currentTarget = pendingTargetLang || profile.targetLanguage;
    const currentKnown = pendingKnownLang || profile.knownLanguage;
    const maxUnlocked = Math.max(profile.maxUnlockedNumericLevel || 1, numericLevel);

    const CEFR_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const targetIdx = CEFR_ORDER.indexOf(finalLevel);
    const existingUnlocked = new Set<CEFRLevel>(profile.unlockedLevels || ['A1']);
    for (let i = 0; i <= Math.max(0, targetIdx); i++) {
      existingUnlocked.add(CEFR_ORDER[i]);
    }

    const updated: UserProfile = {
      ...profile,
      targetLanguage: currentTarget,
      knownLanguage: currentKnown,
      level: finalLevel,
      numericLevel,
      maxUnlockedNumericLevel: maxUnlocked,
      levelVerified: true,
      levelScore: result.correctCount,
      unlockedLevels: Array.from(existingUnlocked),
    };

    // Also automatically register verified placement words into user's word bank!
    const newWords = { ...updated.words };
    result.answers.forEach((ans, idx) => {
      const wordItem: WordItem = getLocalizedWordItem(
        {
          id: `${currentTarget}-${finalLevel}-test-${idx}-${ans.targetWord}`,
          targetWord: ans.targetWord,
          translation: ans.expectedTranslation,
          level: finalLevel,
          numericLevel,
          languagePairKey: `${currentTarget}-${currentKnown}`,
        },
        currentTarget,
        currentKnown
      );
      newWords[wordItem.id] = calculateWordUpdate(
        undefined,
        wordItem,
        ans.isCorrect,
        ans.isCorrect ? 0 : 1,
        ans.userAnswer
      );
    });

    updated.words = localizeUserProgress(newWords, currentTarget, currentKnown);
    saveProfile(updated);
    setCurrentView('journey');
  };

  // Start "Your daily practice": 10-word structured session
  // User spec: 4 new words (Nieuw) + 6 review words (Herhaling: top 4 hard, top 2 old from current and previous level)
  const handleStartDailyPractice = async () => {
    if (!profile) return;
    setIsLoadingSession(true);

    try {
      const targetNumericLevel = profile.numericLevel || getBaseNumericLevelForCefr(profile.level);
      const sessionCards = buildNewWordsSessionCards(profile, targetNumericLevel);

      clearSavedDailySession();
      setActiveSessionCards(sessionCards);
      setActiveSessionType('daily');
      setActiveReviewDirection('both');
      setCurrentView('active-session');
    } catch (e) {
      console.error('Error starting daily practice session:', e);
      const fallbackCards = buildNewWordsSessionCards(profile, profile.numericLevel || 1);
      clearSavedDailySession();
      setActiveSessionCards(fallbackCards);
      setActiveSessionType('daily');
      setActiveReviewDirection('both');
      setCurrentView('active-session');
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Start Journey lesson practice session
  const handleStartJourneyLesson = (
    level: number,
    ballIndex: number,
    lessonIndex: number,
    cards: StudyCard[],
    sessionType?: SessionType
  ) => {
    setJourneyActiveLesson({ level, ballIndex, lessonIndex });
    clearSavedDailySession();
    setActiveSessionCards(cards);
    setActiveSessionType(sessionType || 'daily');
    setActiveReviewDirection('both');
    setCurrentView('active-session');
  };

  // Start Journey Daily Practice session (exact same session logic as dashboard while tracking journey progress)
  const handleStartJourneyDailyPractice = (
    level: number,
    ballIndex: number,
    lessonIndex: number
  ) => {
    setJourneyActiveLesson({ level, ballIndex, lessonIndex });
    handleStartDailyPractice();
  };

  // Continue Journey Daily Practice session (resumes in-progress session while tracking journey progress)
  const handleContinueJourneyDailyPractice = (
    level: number,
    ballIndex: number,
    lessonIndex: number
  ) => {
    setJourneyActiveLesson({ level, ballIndex, lessonIndex });
    handleContinueDailySession();
  };

  // Start "Review rusty words": customizable or 10-word adaptive review session
  const handleStartRustyReview = async (
    customCount: number = 10,
    direction: 'both' | 'target' | 'known' = 'both',
    selectedLevels?: number[]
  ) => {
    if (!profile) return;
    sessionOriginViewRef.current = currentView === 'review' ? 'review' : 'journey';
    setIsLoadingSession(true);

    try {
      const reviewCards = buildRustyReviewSessionCards(
        profile,
        customCount,
        direction,
        selectedLevels
      );

      if (reviewCards.length === 0) {
        setIsLoadingSession(false);
        return;
      }

      clearSavedRustySession();
      setActiveSessionCards(reviewCards);
      setActiveSessionType('rusty');
      setActiveReviewDirection(direction);
      setCurrentView('active-session');
    } catch (e) {
      console.error('Error starting rusty review session:', e);
      const fallbackCards = buildRustyReviewSessionCards(
        profile,
        customCount,
        direction,
        selectedLevels
      );
      clearSavedRustySession();
      setActiveSessionCards(fallbackCards);
      setActiveSessionType('rusty');
      setActiveReviewDirection(direction);
      setCurrentView('active-session');
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Open Word Bank with optional specific category filter
  const handleOpenWordBank = (filterCat?: WordCategory | 'all' | 'hard') => {
    setWordBankCategoryFilter(filterCat || 'all');
    setCurrentView('bank');
  };

  // Start Recent Review session (practicing hardest and oldest words)
  const handleStartRecentReview = (targetCount: number = 10) => {
    if (!profile) return;
    const cards = buildRecentReviewSessionCards(profile, targetCount);
    clearSavedSession('recent_review');
    setActiveSessionCards(cards);
    setActiveSessionType('recent_review');
    setActiveReviewDirection('both');
    setJourneyActiveLesson(null);
    setCurrentView('active-session');
  };

  // Restart Exam session (25 tokens missed most often)
  const handleRestartExam = (lvl?: number) => {
    if (!profile) return;
    const targetLvl = lvl ?? (journeyActiveLesson?.level || profile.numericLevel || 1);
    const cards = buildExamSessionCards(profile, targetLvl, 25);
    setJourneyActiveLesson({ level: targetLvl, ballIndex: 6, lessonIndex: 0 });
    clearSavedSession('exam');
    setActiveSessionCards(cards);
    setActiveSessionType('exam');
    setActiveReviewDirection('both');
    setCurrentView('active-session');
  };

  // Handle completion of study session
  const handleFinishSession = (
    result: StudySessionResult,
    updatedWords: Record<string, WordProgress>,
    hierarchyData?: {
      mistakeTokens: Array<{ wordId: string; direction: TokenDirection }>;
      completedTokens: Array<{ wordId: string; direction: TokenDirection; wasClean?: boolean; isNew?: boolean }>;
    },
    examPassed?: boolean
  ) => {
    if (!profile) return;
    clearSavedSession(activeSessionType);
    const now = Date.now();

    // 1. Apply mistake tokens and completed tokens to Review Hierarchies
    let profileWithHierarchies = profile;
    if (hierarchyData?.mistakeTokens && hierarchyData.mistakeTokens.length > 0) {
      for (const m of hierarchyData.mistakeTokens) {
        profileWithHierarchies = applyReviewMistakePoints(
          profileWithHierarchies,
          m.wordId,
          m.direction,
          activeSessionType
        );
      }
    }

    if (hierarchyData?.completedTokens && hierarchyData.completedTokens.length > 0) {
      profileWithHierarchies = applySessionWordCompletion(
        profileWithHierarchies,
        hierarchyData.completedTokens,
        activeSessionType
      );
    }

    const streakResult = advanceStreakOnSessionComplete(profileWithHierarchies, {
      sessionId: result.sessionId,
      sessionType: activeSessionType,
      cardsCount: result.cardsCount,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      level: profileWithHierarchies.level,
      numericLevel: profileWithHierarchies.numericLevel,
      targetLanguage: profileWithHierarchies.targetLanguage,
    });

    const mergedWords = {
      ...(profileWithHierarchies.words || {}),
      ...updatedWords,
    };

    const isExamSession = activeSessionType === 'exam';
    const activeNumeric = profileWithHierarchies.numericLevel || 1;
    const sessionLevel = journeyActiveLesson?.level || activeNumeric;

    let updatedPassedExams = { ...(profileWithHierarchies.passedExams || {}) };
    let nextUnlocked = profileWithHierarchies.maxUnlockedNumericLevel || activeNumeric;
    let nextNumericLevel = activeNumeric;

    // Exam handling: "You can only go to the next level after passing the exam."
    if (isExamSession && examPassed) {
      updatedPassedExams[sessionLevel] = {
        passedAt: now,
        mistakes: result.incorrectCount,
      };
      // Level N exam passed unlocks Level N+1
      nextUnlocked = Math.max(nextUnlocked, Math.min(60, sessionLevel + 1));
      nextNumericLevel = Math.min(60, sessionLevel + 1);
    }

    // Handle Journey progress update if session was launched from a Journey lesson
    let updatedJourneyProgress = profileWithHierarchies.journeyProgress;
    const wasJourney = Boolean(journeyActiveLesson);
    if (journeyActiveLesson && !isExamSession) {
      const lvl = journeyActiveLesson.level;
      const bIdx = journeyActiveLesson.ballIndex;
      const sIdx = journeyActiveLesson.lessonIndex;

      const lvlButtons = getLevelButtons(profileWithHierarchies, lvl);
      const ballStartLesson = lvlButtons.slice(0, bIdx).reduce(
        (acc, b) => acc + b.sessions,
        0
      );
      const lessonNumber = ballStartLesson + sIdx + 1;
      const currentCompleted = getLevelCompletedSessions(profileWithHierarchies, lvl);
      const newCompleted = Math.max(currentCompleted, lessonNumber);

      const prevCompletedButtons = profileWithHierarchies.journeyProgress?.completedSessionsByButton || {};
      const updatedButtonsMap = { ...prevCompletedButtons };
      const btnKey = `${lvl}_${bIdx}`;
      const currentOnBtn = updatedButtonsMap[btnKey] || 0;
      updatedButtonsMap[btnKey] = Math.min(lvlButtons[bIdx].sessions, Math.max(currentOnBtn, sIdx + 1));

      updatedJourneyProgress = {
        ...profileWithHierarchies.journeyProgress,
        completedLessonsByLevel: {
          ...(profileWithHierarchies.journeyProgress?.completedLessonsByLevel || {}),
          [lvl]: newCompleted,
        },
        completedSessionsByButton: updatedButtonsMap,
      };

      // Note: User can only go to the next level after passing the exam!
    }
    setJourneyActiveLesson(null);

    const updated: UserProfile = {
      ...profileWithHierarchies,
      numericLevel: nextNumericLevel,
      words: mergedWords,
      totalSessionsCompleted: (profileWithHierarchies.totalSessionsCompleted || 0) + 1,
      streakDays: streakResult.streakDays,
      currentStreak: streakResult.streakDays,
      maxStreakDays: streakResult.maxStreakDays,
      lastActiveAt: now,
      lastActiveDateStr: streakResult.lastActiveDateStr,
      sessionHistory: streakResult.sessionHistory,
      maxUnlockedNumericLevel: nextUnlocked,
      passedExams: updatedPassedExams,
      journeyProgress: updatedJourneyProgress,
    };
    saveProfile(updated);
    setCurrentView(
      isExamSession
        ? 'journey'
        : sessionOriginViewRef.current === 'review'
        ? 'review'
        : 'journey'
    );
  };

  // Toggle hard word flag manually in word bank
  const handleToggleHardWord = (wordId: string) => {
    if (!profile) return;
    const existing = profile.words?.[wordId];
    if (existing) {
      const nextIsHard = !existing.isHard;
      const nextHardScore = nextIsHard ? Math.max(1, (existing.hardScore || 0) + 2) : 0;
      const updated = {
        ...profile,
        words: {
          ...profile.words,
          [wordId]: {
            ...existing,
            isHard: nextIsHard,
            hardScore: nextHardScore,
            difficultyScore: nextIsHard
              ? Math.min(10, existing.difficultyScore + 3)
              : Math.max(1, existing.difficultyScore - 2),
          },
        },
      };
      saveProfile(updated);
      return;
    }

    const candidateWords = getSeedVocabularyForLanguageAndLevel(
      profile.targetLanguage,
      profile.level,
      profile.knownLanguage,
      profile.numericLevel
    );
    const found = candidateWords.find((w) => w.id === wordId);
    if (found) {
      const initialProgress = calculateWordUpdate(undefined, found, false, 1, '');
      initialProgress.isHard = true;
      initialProgress.hardScore = 2;
      initialProgress.difficultyScore = 8;

      const updated: UserProfile = {
        ...profile,
        words: {
          ...(profile.words || {}),
          [wordId]: initialProgress,
        },
      };
      saveProfile(updated);
    }
  };

  const handleSaveSession = useCallback(
    (state: SavedSessionState) => {
      saveSessionState(state.sessionType || 'daily', state);
    },
    [saveSessionState]
  );

  const handleClearActiveSavedSession = useCallback(
    (type?: SessionType) => {
      clearSavedSession(type || activeSessionType);
    },
    [clearSavedSession, activeSessionType]
  );

  // If profile is still being retrieved, show elegant loader
  if (isLoadingProfile && !profile) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-stone-600 dark:text-stone-400">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center border border-amber-500/20">
            <RefreshCw className="w-6 h-6 text-amber-600 dark:text-amber-400 animate-spin" />
          </div>
          <p className="text-sm font-medium tracking-wide">Profiel laden...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in / profile is null, show AuthScreen so user MUST log in or create an account
  if (!profile) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        defaultEmail={
          activeEmail && activeEmail !== 'guest@learning.com' && activeEmail !== 'null'
            ? activeEmail
            : ''
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col selection:bg-amber-100 selection:text-amber-900 transition-colors overflow-x-clip w-full max-w-full">
      {/* Navigation Header */}
      <Header
        profile={profile}
        onOpenMyProfile={() => setCurrentView('profile')}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenLanguageSelect={() => setCurrentView('launch')}
        onLogOff={handleLogOff}
        onOpenWordBank={() => handleOpenWordBank('all')}
        onOpenFriends={() => setCurrentView('friends')}
        onChangeLevel={() => setIsChangeLevelOpen(true)}
        activeView={
          currentView === 'bank'
            ? 'bank'
            : currentView === 'review'
            ? 'review'
            : currentView === 'launch'
            ? 'launch'
            : currentView === 'friends'
            ? 'friends'
            : currentView === 'profile'
            ? 'profile'
            : currentView === 'admin'
            ? 'admin'
            : 'journey'
        }
        setActiveView={(v) => setCurrentView(v)}
      />

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-full overflow-x-clip pt-14 sm:pt-16">
        {currentView === 'admin' && (
          <AdminDashboard currentProfile={profile} onClose={() => setCurrentView('journey')} />
        )}

        {currentView === 'launch' && (
          <LaunchScreen
            profile={profile}
            onSaveSetup={handleSaveLaunchSetup}
            onSwitchLanguage={handleSwitchLanguage}
            onStartStudyDirect={() => setCurrentView('journey')}
          />
        )}

        {currentView === 'placement' && (
          <PlacementTest
            profile={profile}
            targetLangCode={pendingTargetLang || profile.targetLanguage || 'he'}
            knownLangCode={pendingKnownLang || profile.knownLanguage || 'en'}
            level={pendingPlacementLevel}
            onComplete={handlePlacementComplete}
            onCancel={() => setCurrentView('journey')}
          />
        )}

        {currentView === 'journey' && (
          <JourneyView
            profile={profile}
            savedDailySession={savedDailySession}
            onStartLesson={handleStartJourneyLesson}
            onStartExam={(lvl) => handleRestartExam(lvl)}
            onStartDailyPractice={handleStartJourneyDailyPractice}
            onContinueDailyPractice={handleContinueJourneyDailyPractice}
            onStartRustyReview={handleStartRustyReview}
            onOpenWordBank={() => handleOpenWordBank('all')}
            onBackToDashboard={() => setCurrentView('journey')}
          />
        )}

        {currentView === 'review' && (
          <ReviewView
            profile={profile}
            onStartRustyReview={handleStartRustyReview}
            isLoadingSession={isLoadingSession}
          />
        )}

        {currentView === 'active-session' && (
          <StudySession
            cards={activeSessionCards}
            profile={profile}
            sessionType={activeSessionType}
            reviewDirection={activeReviewDirection}
            initialSavedState={
              activeSessionType === 'rusty' ? savedRustySession : savedDailySession
            }
            onSaveSession={handleSaveSession}
            onClearSavedSession={handleClearActiveSavedSession}
            onFinishSession={handleFinishSession}
            onStartRecentReview={() => handleStartRecentReview(10)}
            onRestartExam={() => handleRestartExam()}
            onExit={(savedState) => {
              if (savedState) {
                handleSaveSession(savedState);
              }
              setJourneyActiveLesson(null);
              setCurrentView(sessionOriginViewRef.current === 'review' ? 'review' : 'journey');
            }}
          />
        )}

        {currentView === 'bank' && (
          <WordBankView
            profile={profile}
            initialCategory={wordBankCategoryFilter}
            onBackToStudy={() => setCurrentView('journey')}
            onToggleHardWord={handleToggleHardWord}
            onUpdateProfile={updateProfile}
          />
        )}

        {currentView === 'friends' && (
          <FriendsView
            profile={profile}
            onBackToDashboard={() => setCurrentView('journey')}
            onUpdateProfile={updateProfile}
            onOpenMyProfile={() => setCurrentView('profile')}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            profile={profile}
            onBackToDashboard={() => setCurrentView('journey')}
            onUpdateProfile={updateProfile}
            onNavigateToFriends={() => setCurrentView('friends')}
          />
        )}
      </main>

      {/* Direct Level Change Modal */}
      <ChangeLevelModal
        isOpen={isChangeLevelOpen}
        onClose={() => setIsChangeLevelOpen(false)}
        currentLevel={profile.level}
        currentNumericLevel={profile.numericLevel || 1}
        maxUnlockedNumericLevel={profile.maxUnlockedNumericLevel ?? profile.numericLevel ?? 1}
        onSelectLevel={handleDirectLevelChange}
      />

      {/* Settings Modal (Theme: Dark / Light, Profile updates) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        profile={profile}
        onUpdateProfile={updateProfile}
        onDeleteAccount={handleDeleteAccount}
        onOpenAdmin={() => setCurrentView('admin')}
      />
    </div>
  );
}
