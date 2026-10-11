import React, { useState } from 'react';
import { SavedSessionState, UserProfile, WordCategory, WordProgress } from '../types';
import { getLanguage, getNumericLevelInfo, getSeedVocabularyForLanguageAndLevel } from '../data/languages';
import { CATEGORY_DETAILS, CATEGORY_ORDER, getLevelProgressStats } from '../utils/srs';
import { calculateCurrentStreak, isDailyPracticeCompletedToday } from '../utils/streak';
import {
  Play,
  Flame,
  Trophy,
  Target,
  Milestone,
  Sparkles,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  BarChart3,
  BookMarked,
  SlidersHorizontal,
  Check,
  X,
  Zap,
} from 'lucide-react';

interface StatsBannerProps {
  profile: UserProfile;
  savedDailySession?: SavedSessionState | null;
  savedRustySession?: SavedSessionState | null;
  onContinueDailySession?: () => void;
  onDiscardDailySession?: () => void;
  onContinueRustySession?: () => void;
  onDiscardRustySession?: () => void;
  onStartDailyPractice: () => void;
  onStartRustyReview: (customCount?: number, direction?: 'both' | 'target' | 'known') => void;
  onOpenSettings: () => void;
  onChangeLevel: () => void;
  onOpenWordBank: (filterCategory?: WordCategory | 'all' | 'hard') => void;
  isLoadingSession?: boolean;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  profile,
  savedDailySession = null,
  savedRustySession = null,
  onContinueDailySession,
  onDiscardDailySession,
  onContinueRustySession,
  onDiscardRustySession,
  onStartDailyPractice,
  onStartRustyReview,
  onOpenSettings,
  onChangeLevel,
  onOpenWordBank,
  isLoadingSession = false,
}) => {
  const [isCustomCountOpen, setIsCustomCountOpen] = useState(false);
  const [customWordCount, setCustomWordCount] = useState(15);
  const [customDirection, setCustomDirection] = useState<'both' | 'target' | 'known'>('both');
  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);
  const knownLang = getLanguage(profile.knownLanguage);

  // Compute numeric level (1-60)
  const numericLevel = profile.numericLevel || 1;
  const levelInfo = getNumericLevelInfo(numericLevel);

  // Check if daily streak practice has already been completed today
  const isStreakDoneToday = isDailyPracticeCompletedToday(profile);
  const currentStreak = calculateCurrentStreak(profile);

  // Get vocabulary for this level to compute exact level progress
  const levelWords = getSeedVocabularyForLanguageAndLevel(
    profile.targetLanguage,
    levelInfo.cefr,
    profile.knownLanguage,
    numericLevel
  );

  const stats = getLevelProgressStats(levelWords, profile.words || {});

  // Compute total hard words across profile
  const userWordsList = Object.values(profile.words || {}) as WordProgress[];
  const totalHardWords = userWordsList.filter(
    (w) => w.isHard || (w.hardScore !== undefined && w.hardScore > 0) || (w.timesIncorrect ?? 0) > 0
  ).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Top Header & Scoreboard */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-xs relative w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Language & Flag (clickable to select language & level, or do test) */}
          <button
            type="button"
            id="banner-target-language-flag-btn"
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 sm:gap-3 text-left hover:opacity-85 transition-all cursor-pointer group focus:outline-none shrink-0"
            title="Klik om taal en niveau te kiezen of de test te doen"
          >
            <span className="text-3xl sm:text-4xl select-none drop-shadow-xs group-hover:scale-105 transition-transform" role="img" aria-label="Target language flag">
              {targetLang.flag}
            </span>
            <div className="flex flex-col min-w-0">
              <h1 className="font-display text-xl sm:text-3xl font-extrabold text-stone-900 tracking-tight leading-none group-hover:text-amber-600 transition-colors truncate">
                {targetLang.name}
              </h1>
            </div>
          </button>

          {/* Right: Clean Score, Streak, and Level Badges in order: Streak, Level, Words */}
          <div
            id="main-scoreboard"
            className="flex items-center flex-wrap gap-2 w-full sm:w-auto sm:justify-end"
          >
            {/* 1. Streak Badge: Only fire symbol and number (Left) */}
            <div
              id="scoreboard-streak"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-2xs transition-all ${
                isStreakDoneToday
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200'
                  : 'bg-stone-50 dark:bg-stone-850 border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400'
              }`}
              title={
                isStreakDoneToday 
                  ? `Daily practice afgerond! Streak: ${currentStreak}d` 
                  : currentStreak > 0
                    ? `Streak: ${currentStreak}d (doe vandaag je practice om hem vast te houden!)`
                    : 'Streak: 0d (voltooi daily practice om te starten)'
              }
            >
              <Flame 
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isStreakDoneToday 
                    ? 'text-amber-500 fill-amber-500 drop-shadow-xs' 
                    : 'text-stone-400 dark:text-stone-500 fill-none'
                }`} 
              />
              <span className={`font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${
                isStreakDoneToday ? 'text-amber-950 dark:text-amber-200' : 'text-stone-600 dark:text-stone-400'
              }`}>
                {currentStreak}
              </span>
            </div>

            {/* 2. Score Badge: Only 'X words' with trophy icon (Middle) */}
            <div
              id="scoreboard-blue-score"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100/70 border border-sky-200/80 text-sky-950 shadow-2xs transition-colors"
              title="Total Mastered Blue Words"
            >
              <Trophy className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="font-mono font-bold text-xs sm:text-sm text-sky-950 whitespace-nowrap">
                {stats.globalBlueScore} words
              </span>
            </div>

            {/* 3. Level Badge: Only Lvl X with distinct level icon (Right) */}
            <button
              id="scoreboard-level-btn"
              onClick={onChangeLevel}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200/80 text-purple-950 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
              title="Click to switch level (1 to 60)"
            >
              <Target className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-purple-950 whitespace-nowrap">
                Lvl {numericLevel}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2 Action Cards (Daily Practice & Review Rusty Words) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5 w-full">
        {/* Card 1: Daily Practice (Orange Square) - In-Progress Saved Daily Session OR Fresh Practice */}
        {savedDailySession ? (
          <div
            id="card-continue-practice"
            className="group text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 text-stone-950 border border-amber-400 shadow-md flex flex-col justify-between min-h-[180px] sm:min-h-[190px] relative w-full"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-950/15 text-stone-950 text-[11px] font-bold tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-stone-950 animate-pulse" />
                  Session Paused
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0">
                  {isLoadingSession ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-amber-400 ml-0.5" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950 leading-tight tracking-tight">
                  Daily Practice
                </h2>
                <p className="text-xs text-stone-900/90 mt-1 font-medium">
                  {(() => {
                    const remainingTasks = Math.max(
                      0,
                      savedDailySession.baseExpectedTasks - savedDailySession.completedTasksCount
                    );
                    return `${remainingTasks} more words to go`;
                  })()}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 bg-stone-950/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-950 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(8, (savedDailySession.completedTasksCount / Math.max(1, savedDailySession.baseExpectedTasks)) * 100))}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-950/15 flex items-center justify-between gap-2">
              <button
                id="btn-continue-session"
                onClick={onContinueDailySession}
                disabled={isLoadingSession}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-900 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-amber-400" />
                <span>Continue</span>
              </button>

              <button
                id="btn-discard-session"
                onClick={onDiscardDailySession}
                className="px-2.5 py-1.5 rounded-lg text-stone-900/80 hover:text-stone-950 hover:bg-stone-950/10 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Discard this paused daily session and start a new batch"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Start Fresh</span>
              </button>
            </div>
          </div>
        ) : isStreakDoneToday ? (
          /* State A: Completed Today -> Inviting for extra sessions */
          <button
            id="btn-daily-practice"
            onClick={onStartDailyPractice}
            disabled={isLoadingSession}
            className="group text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 text-stone-950 border border-amber-400 shadow-md hover:shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer flex flex-col justify-between min-h-[180px] sm:min-h-[190px] w-full"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-950/15 text-stone-950 text-[11px] font-bold tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-950 shrink-0" />
                  <span>Streak ({currentStreak}d 🔥)</span>
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  {isLoadingSession ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-amber-400 ml-0.5" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950 leading-tight tracking-tight">
                  Daily Practice
                </h2>
                <p className="text-xs text-stone-900/80 mt-1 font-medium">
                  Streak secured for today! You can practice 10 more words whenever you want.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-950/15 flex items-center justify-between text-xs font-bold text-stone-950">
              <span>Practice 10 Extra Words</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </button>
        ) : (
          /* State B: Not Completed Today -> Highlighting Daily Practice */
          <button
            id="btn-daily-practice"
            onClick={onStartDailyPractice}
            disabled={isLoadingSession}
            className="group text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-stone-950 border border-amber-400 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[180px] sm:min-h-[190px] w-full"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-950/15 text-stone-950 text-[11px] font-bold tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-stone-950 animate-pulse" />
                  Daily practice pending today
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-950 text-amber-300 flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  {isLoadingSession ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Play className="w-4 h-4 fill-amber-300 ml-0.5" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950 leading-tight tracking-tight">
                  Daily Practice
                </h2>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-950/15 flex items-center justify-between text-xs font-bold text-stone-950">
              <span>Start 10-Word Session</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </button>
        )}

        {/* Card 2: Review Rusty Words (In-Progress Saved Rusty Session OR Start Review) */}
        {savedRustySession ? (
          <div
            id="card-continue-rusty-review"
            className="group text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-100/95 via-indigo-50/70 to-slate-200/90 text-stone-900 border border-slate-300 shadow-sm flex flex-col justify-between min-h-[180px] sm:min-h-[190px] relative w-full"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-full bg-slate-900/10 text-slate-800 text-[11px] font-bold tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse" />
                  Review Paused
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  {isLoadingSession ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 leading-tight tracking-tight">
                  Review Rusty Words
                </h2>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {(() => {
                    const remainingTasks = Math.max(
                      0,
                      savedRustySession.baseExpectedTasks - savedRustySession.completedTasksCount
                    );
                    return `${remainingTasks} more words to go (${savedRustySession.cards.length} total)`;
                  })()}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 bg-slate-900/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(8, (savedRustySession.completedTasksCount / Math.max(1, savedRustySession.baseExpectedTasks)) * 100))}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                id="btn-continue-rusty-session"
                onClick={onContinueRustySession}
                disabled={isLoadingSession}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Continue</span>
              </button>

              <button
                id="btn-discard-rusty-session"
                onClick={onDiscardRustySession}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Discard this paused review session and start fresh"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Start Fresh</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            id="card-review-rusty-words"
            className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-100/90 via-indigo-50/50 to-slate-200/80 text-stone-900 border border-slate-300/80 shadow-xs flex flex-col justify-between min-h-[180px] sm:min-h-[190px] relative w-full"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 leading-tight tracking-tight">
                    Review Rusty Words
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Strengthen long-term memory
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 text-slate-100 flex items-center justify-center font-bold shadow-xs shrink-0">
                  <BookMarked className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            {/* Modal / Inline Custom Amount & Direction Picker */}
            {isCustomCountOpen ? (
              <div className="mt-4 pt-3 border-t border-slate-200/90 space-y-3 bg-white/95 p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">
                    Configure Review Session
                  </span>
                  <button
                    onClick={() => setIsCustomCountOpen(false)}
                    className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Word Count Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                    <span>Number of words:</span>
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md border border-slate-200">
                      {customWordCount} words
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={customWordCount}
                    onChange={(e) => setCustomWordCount(Number(e.target.value))}
                    className="w-full accent-slate-800 cursor-pointer"
                  />
                </div>

                {/* 2. Answer Language Selection (Efficient Segmented Control) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-stone-600 block">
                    Answer in:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setCustomDirection('both')}
                      className={`py-1.5 px-1 sm:px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                        customDirection === 'both'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                      }`}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomDirection('target')}
                      className={`py-1.5 px-1 sm:px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                        customDirection === 'target'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                      }`}
                      title={`Answer in ${targetLang.name}`}
                    >
                      {targetLang.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomDirection('known')}
                      className={`py-1.5 px-1 sm:px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                        customDirection === 'known'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                      }`}
                      title={`Answer in ${knownLang.name}`}
                    >
                      {knownLang.name}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsCustomCountOpen(false);
                      onStartRustyReview(customWordCount, customDirection);
                    }}
                    disabled={isLoadingSession}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-transform hover:scale-[1.01] cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Start</span>
                  </button>
                  <button
                    onClick={() => setIsCustomCountOpen(false)}
                    className="py-2 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* 2 Review Action Buttons */
              <div className="mt-4 pt-3 border-t border-slate-200/90 flex items-center gap-2">
                <button
                  id="btn-start-review-default"
                  onClick={() => onStartRustyReview(10, 'both')}
                  disabled={isLoadingSession}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white shrink-0" />
                  <span className="truncate">Start Review</span>
                </button>

                <button
                  id="btn-start-review-custom"
                  onClick={() => setIsCustomCountOpen(true)}
                  disabled={isLoadingSession}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Choose custom number of words and language mode"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Custom</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-stone-200 shadow-xs space-y-4 sm:space-y-5 w-full">
        {/* Title & Level Status */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="font-display text-lg sm:text-2xl font-bold text-stone-900">
              Progress
            </h3>
            <span className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Level {numericLevel}
            </span>
          </div>

          <button
            type="button"
            id="banner-open-hard-hierarchy-btn"
            onClick={() => onOpenWordBank('hard')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
            title="Bekijk de rangschikking van moeilijke woorden"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500 group-hover:scale-110 transition-transform shrink-0" />
            <span className="whitespace-nowrap">Hard Hiërarchie ({totalHardWords})</span>
          </button>
        </div>

        {/* 2 Progress Boxes: Geleerd (Learned) & Nieuw (New) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Geleerd (Learned) */}
          <button
            id="cat-box-learned"
            onClick={() => onOpenWordBank('blue')}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer bg-sky-50 border-sky-300 shadow-2xs group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                Level {numericLevel}
              </span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold text-sky-950">
              {stats.studiedCount}
            </div>
            <div className="text-xs sm:text-sm font-bold text-sky-800 mt-0.5 truncate">
              Geleerd
            </div>
          </button>

          {/* Nieuw (New) */}
          <button
            id="cat-box-new"
            onClick={() => onOpenWordBank('red')}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer bg-rose-50 border-rose-300 shadow-2xs group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                Nog te doen
              </span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold text-rose-950">
              {stats.unstudiedCount}
            </div>
            <div className="text-xs sm:text-sm font-bold text-rose-900 mt-0.5 truncate">
              Nieuw
            </div>
          </button>
        </div>

        {/* Visual Horizontal Stacked Bar Chart & Level Completion Progress */}
        <div className="space-y-2 pt-1">
          {/* Segmented Distribution Bar: Geleerd vs Nieuw */}
          <div
            id="horizontal-level-bar-chart"
            className="w-full h-5 bg-stone-100 rounded-xl overflow-hidden flex border border-stone-200 shadow-inner p-0.5 gap-1"
          >
            {/* Geleerd (Blue Segment) */}
            {stats.studiedCount > 0 && (
              <div
                style={{ width: `${(stats.studiedCount / stats.totalWords) * 100}%` }}
                className="h-full bg-sky-500 rounded-lg flex items-center justify-center text-white text-[11px] font-bold transition-all shadow-xs relative group cursor-pointer"
                onClick={() => onOpenWordBank('blue')}
                title={`Geleerd: ${stats.studiedCount} woorden`}
              >
                <span className="truncate px-1 font-mono">
                  {stats.studiedCount}
                </span>
              </div>
            )}

            {/* Nieuw (Stone/Rose Segment) */}
            {stats.unstudiedCount > 0 && (
              <div
                style={{ width: `${(stats.unstudiedCount / stats.totalWords) * 100}%` }}
                className="h-full bg-rose-100 rounded-lg flex items-center justify-center text-rose-900 text-[11px] font-semibold transition-all relative group cursor-pointer"
                onClick={() => onOpenWordBank('red')}
                title={`Nieuw: ${stats.unstudiedCount} woorden`}
              >
                <span className="truncate px-1 font-mono">
                  {stats.unstudiedCount}
                </span>
              </div>
            )}
          </div>

          {/* Level Progress details */}
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-500 pt-0.5">
            <span>{stats.studiedCount} van de {stats.totalWords} woorden geleerd</span>
            <span className="font-mono text-stone-700 font-bold">{stats.masteryPercentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
