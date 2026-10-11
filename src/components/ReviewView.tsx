import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  getRustyReviewTokens,
  buildDeduplicatedWordRanking,
  RankedWordItem,
} from '../utils/reviewHierarchy';
import { getLanguage } from '../data/languages';
import { speakWord } from '../utils/speech';
import { matchesWordItem } from '../utils/textNormalization';
import {
  Brain,
  Search,
  Volume2,
  Clock,
  Flame,
  X,
  Play,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  Check,
} from 'lucide-react';

interface ReviewViewProps {
  profile: UserProfile;
  onStartRustyReview: (customCount?: number, direction?: 'both' | 'target' | 'known', selectedLevels?: number[]) => void;
  isLoadingSession?: boolean;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  profile,
  onStartRustyReview,
  isLoadingSession = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBadgeModal, setActiveBadgeModal] = useState<'hard' | 'old' | 'ranking' | null>(null);

  // Available levels: all completed levels AND the current level the user is currently working on
  const availableLevels = useMemo(() => {
    const currentWorkingLvl = profile.numericLevel || 1;
    const maxLvl = Math.max(1, currentWorkingLvl, profile.maxUnlockedNumericLevel || 1);
    const levelsSet = new Set<number>();
    for (let l = 1; l <= maxLvl; l++) {
      levelsSet.add(l);
    }
    Object.values(profile.words || {}).forEach((w: any) => {
      if (w?.numericLevel && typeof w.numericLevel === 'number' && w.numericLevel > 0) {
        levelsSet.add(w.numericLevel);
      }
    });
    return Array.from(levelsSet).sort((a, b) => a - b);
  }, [profile]);

  // Rusty review practice settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customWordCount, setCustomWordCount] = useState(10);
  const [customDirection, setCustomDirection] = useState<'both' | 'target' | 'known'>('both');
  const [selectedLevels, setSelectedLevels] = useState<number[]>(() => availableLevels);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const levelDropdownRef = useRef<HTMLDivElement>(null);

  // Close level dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (levelDropdownRef.current && !levelDropdownRef.current.contains(e.target as Node)) {
        setIsLevelDropdownOpen(false);
      }
    };
    if (isLevelDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isLevelDropdownOpen]);

  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);
  const knownLang = getLanguage(profile.knownLanguage);

  // Fetch tokens for Rusty Review (filtered by selectedLevels if customized)
  const currentTokens = useMemo(() => {
    let tokens = getRustyReviewTokens(profile);
    if (selectedLevels.length > 0 && selectedLevels.length < availableLevels.length) {
      tokens = tokens.filter((t) => {
        const lvl = t.wordItem?.numericLevel || profile.words?.[t.wordId]?.numericLevel || 1;
        return selectedLevels.includes(lvl);
      });
    }
    return tokens;
  }, [profile, selectedLevels, availableLevels]);

  // Deduplicated word ranking: each unique word appears exactly once, placed where it ranks highest
  const rankedWords = useMemo<RankedWordItem[]>(() => {
    return buildDeduplicatedWordRanking(currentTokens);
  }, [currentTokens]);

  // Apply search query (handles Hebrew nikud, Arabic harakat, Farsi vowels, phonetics, translations)
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return rankedWords;

    return rankedWords.filter((item) => {
      return matchesWordItem(item, searchQuery);
    });
  }, [rankedWords, searchQuery]);

  const isAllLevelsSelected = selectedLevels.length === availableLevels.length;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* 1. Practice Card: Rusty Review - Clean, modern & aesthetic (overflow-visible so dropdown can extend out) */}
      <div className="relative overflow-visible rounded-3xl bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 dark:from-purple-900 dark:via-purple-950 dark:to-indigo-950 text-white shadow-xl border border-purple-300/25 backdrop-blur-md py-8 sm:py-10 px-6 sm:px-8 flex flex-col items-center justify-center text-center transition-all select-none z-10">
        {/* Yellow Brain Icon - clean, simple, aesthetic (no game-like orb) */}
        <Brain className="w-10 h-10 sm:w-11 sm:h-11 text-amber-300 fill-amber-300/25 stroke-[2] drop-shadow-sm mb-2.5" />

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Rusty review
        </h1>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-5 flex-wrap justify-center">
          {/* Start Button in that matching warm yellow */}
          <button
            type="button"
            onClick={() => onStartRustyReview(customWordCount, customDirection, isAllLevelsSelected ? undefined : selectedLevels)}
            disabled={isLoadingSession || rankedWords.length === 0}
            className="px-8 sm:px-9 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-stone-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
            title={rankedWords.length === 0 ? 'Leer eerst woorden via dagelijkse sessies of verplaats woorden naar \'geleerd\' om de Rusty review te starten' : 'Start Rusty review'}
          >
            {isLoadingSession ? (
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-stone-950" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-stone-950 text-stone-950 ml-0.5" />
            )}
            <span>Start</span>
          </button>

          {/* Settings Button: clean frosted glass */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`px-5 py-2.5 rounded-xl border active:scale-95 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer select-none shadow-sm ${
              isSettingsOpen
                ? 'bg-white/30 border-white text-white'
                : 'bg-white/15 hover:bg-white/25 border-white/20 text-white/90 hover:text-white'
            }`}
            title="Instellingen voor sessie (aantal woorden, taal & levels)"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-300" />
            <span>Instellingen</span>
          </button>
        </div>

        {/* Expandable Settings: Clean & simplified (overflow-visible so dropdown can extend out into ranking) */}
        {isSettingsOpen && (
          <div className="mt-5 max-w-2xl sm:max-w-3xl w-full bg-black/35 dark:bg-black/50 backdrop-blur-xl p-4 sm:p-5 pt-8 sm:pt-9 rounded-2xl border border-white/15 shadow-xl text-left animate-in fade-in slide-in-from-top-2 duration-150 relative overflow-visible z-20">
            {/* Close Button - centered directly on the border corner vertex of the outer settings box */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-900/95 hover:bg-stone-800 border border-white/30 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg z-30"
              title="Sluit instellingen"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Setting 1: Aantal woorden */}
              <div className="bg-white/10 p-3 sm:p-3.5 rounded-xl border border-white/15 backdrop-blur-sm flex flex-col justify-between min-h-[80px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-100">Aantal woorden:</span>
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-400 text-stone-950 text-2xs sm:text-xs">
                    {customWordCount} w
                  </span>
                </div>
                <div className="pt-1">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={customWordCount}
                    onChange={(e) => setCustomWordCount(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5"
                  />
                </div>
              </div>

              {/* Setting 2: Taal / Richting */}
              <div className="bg-white/10 p-3 sm:p-3.5 rounded-xl border border-white/15 backdrop-blur-sm flex flex-col justify-between min-h-[80px]">
                <span className="font-semibold text-purple-100 text-xs block truncate">
                  Antwoord in taal:
                </span>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-black/20 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (customDirection === 'both') setCustomDirection('known');
                      else if (customDirection === 'known') setCustomDirection('both');
                    }}
                    className={`py-1 px-1.5 rounded-md text-2xs sm:text-xs font-bold transition-all cursor-pointer text-center truncate ${
                      customDirection === 'both' || customDirection === 'target'
                        ? 'bg-amber-400 text-stone-950 shadow-xs'
                        : 'text-purple-200 hover:text-white hover:bg-white/15'
                    }`}
                    title={`Antwoord in ${targetLang.name}`}
                  >
                    {targetLang.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (customDirection === 'both') setCustomDirection('target');
                      else if (customDirection === 'target') setCustomDirection('both');
                    }}
                    className={`py-1 px-1.5 rounded-md text-2xs sm:text-xs font-bold transition-all cursor-pointer text-center truncate ${
                      customDirection === 'both' || customDirection === 'known'
                        ? 'bg-amber-400 text-stone-950 shadow-xs'
                        : 'text-purple-200 hover:text-white hover:bg-white/15'
                    }`}
                    title={`Antwoord in ${knownLang.name}`}
                  >
                    {knownLang.name}
                  </button>
                </div>
              </div>

              {/* Setting 3: Levels */}
              <div className="bg-white/10 p-3 sm:p-3.5 rounded-xl border border-white/15 backdrop-blur-sm flex flex-col justify-between min-h-[80px] relative overflow-visible" ref={levelDropdownRef}>
                <span className="font-semibold text-purple-100 text-xs block truncate">
                  Levels:
                </span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
                    className="w-full py-1 px-2 bg-black/20 hover:bg-black/30 rounded-lg border border-white/10 text-2xs sm:text-xs font-bold text-purple-200 hover:text-white flex items-center justify-between gap-1 transition-all cursor-pointer"
                  >
                    <span className="truncate">
                      {isAllLevelsSelected
                        ? 'Alle levels'
                        : selectedLevels.map(l => `Level ${l}`).join(', ')}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isLevelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu - floats out of purple container down to ranking */}
                  {isLevelDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 sm:w-52 bg-stone-900/98 backdrop-blur-2xl border border-white/25 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLevels(availableLevels);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          isAllLevelsSelected
                            ? 'bg-amber-400 text-stone-950 shadow-xs'
                            : 'text-stone-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>Alle levels</span>
                        {isAllLevelsSelected && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="h-px bg-white/10 my-0.5" />

                      <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
                        {availableLevels.map((lvl) => {
                          const isSelected = selectedLevels.includes(lvl);
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (selectedLevels.length > 1) {
                                    setSelectedLevels(selectedLevels.filter(l => l !== lvl));
                                  }
                                } else {
                                  setSelectedLevels([...selectedLevels, lvl].sort((a, b) => a - b));
                                }
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                                isSelected && !isAllLevelsSelected
                                  ? 'bg-amber-400 text-stone-950 font-bold'
                                  : isSelected
                                  ? 'bg-white/15 text-white'
                                  : 'text-stone-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span>Level {lvl}</span>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Rusty review ranking */}
      <div className="space-y-4">
        {/* List of Tokens with compact Searchbar on the left of '?' */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800/80 shadow-xs overflow-hidden">
          <div className="px-3.5 sm:px-4 py-2 bg-stone-50 dark:bg-stone-850 text-stone-500 dark:text-stone-400 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between gap-2.5">
            <span className="truncate">
              Ranking ({displayedItems.length} woorden)
            </span>

            {/* Right side: Shortened search bar + Question mark */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Shortened search bar to the left of the '?' */}
              <div className="relative w-32 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-6 py-1 rounded-lg text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-purple-500 font-normal normal-case"
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

              {/* Question mark button */}
              <button
                type="button"
                onClick={() => setActiveBadgeModal('ranking')}
                className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-bold transition-all cursor-pointer hover:scale-110 active:scale-95 shrink-0"
                title="Hoe werkt de ranking?"
                aria-label="Uitleg ranking"
              >
                ?
              </button>
            </div>
          </div>

          {displayedItems.length === 0 ? (
            <div className="py-14 text-center text-stone-400">
              <Brain className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-2.5" />
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                {searchQuery ? 'Geen woorden gevonden' : 'Nog geen woorden in de ranking'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? 'Geen resultaten voor je zoekopdracht.'
                  : 'In de ranking horen alleen woorden te staan die je via dagelijkse sessies hebt geleerd, of die je handmatig naar \'geleerd\' hebt verplaatst.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {displayedItems.map((item, index) => {
                const isHard = item.reason === 'hard';

                return (
                  <div
                    key={`${item.wordId}-${index}`}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-stone-50/70 dark:hover:bg-stone-850/50 transition-colors"
                  >
                    {/* Left: Position Rank & Word Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        #{index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-white truncate">
                            {item.targetWord}
                          </span>
                          <button
                            type="button"
                            onClick={() => speakWord(item.targetWord, profile.targetLanguage)}
                            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                            title="Beluister uitspraak"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.transliteration && (
                          <div className="text-[11px] text-stone-400 dark:text-stone-500 font-serif italic truncate">
                            {item.transliteration}
                          </div>
                        )}

                        <div className="text-xs text-stone-600 dark:text-stone-400 truncate">
                          {item.translation}
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge for Hard or Old */}
                    <div className="shrink-0">
                      {isHard && item.hardPoints > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveBadgeModal('hard')}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:scale-105 transition-transform cursor-pointer"
                          title="Klik voor uitleg"
                        >
                          <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                          <span className="font-mono text-xs font-bold">{item.hardPoints}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            hard
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveBadgeModal('old')}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 hover:scale-105 transition-transform cursor-pointer"
                          title="Klik voor uitleg"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-mono text-xs font-bold">{item.oldPoints}d</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            oud
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Modal: Uitleg Hard-punten */}
      {activeBadgeModal === 'hard' && (
        <div
          onClick={() => setActiveBadgeModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150"
          >
            <button
              onClick={() => setActiveBadgeModal(null)}
              className="absolute top-5 right-5 p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800">
                <Flame className="w-5 h-5 fill-rose-500/20" />
              </div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">Uitleg</h2>
            </div>

            <div className="space-y-3 text-xs text-stone-600 dark:text-stone-300">
              <p className="leading-relaxed text-[13px] text-stone-800 dark:text-stone-200">
                hoe meer punten hoe vaker je dit woord fout beantwoorde, hoe hoger het in je ranking staat.
              </p>

              <div className="bg-stone-50 dark:bg-stone-800/60 p-3.5 rounded-2xl border border-stone-200/70 dark:border-stone-700 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-rose-600 bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    +1 punt
                  </span>
                  <span className="whitespace-nowrap">bij elke fout</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    -1 punt
                  </span>
                  <span className="whitespace-nowrap">
                    bij een goed antwoord van dit woord in Recent review of Rusty review
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-purple-600 bg-purple-100 dark:bg-purple-950/70 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    -5 punten
                  </span>
                  <span className="whitespace-nowrap">
                    bij een goed antwoord van dit woord in Rusty review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal: Hoe werkt de Oud-ranking? */}
      {activeBadgeModal === 'old' && (
        <div
          onClick={() => setActiveBadgeModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150"
          >
            <button
              onClick={() => setActiveBadgeModal(null)}
              className="absolute top-5 right-5 p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <div className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                Hoe werkt de Oud-ranking?
              </h2>
            </div>

            <div className="space-y-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              <p>
                Hoe langer je een woord niet hebt geoefend, hoe hoger dit woord op de ranking staat. Elke
                dag dat je het woord niet oefent komt er een +1 punt bij.
              </p>
              <p>
                Nadat je het woord tegenkomt in een oefen sessie, wordt de teller gereset naar 0.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal: Hoe werkt de Ranking? */}
      {activeBadgeModal === 'ranking' && (
        <div
          onClick={() => setActiveBadgeModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150"
          >
            <button
              onClick={() => setActiveBadgeModal(null)}
              className="absolute top-5 right-5 p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-stone-900 dark:text-white">
              <div className="w-8 h-8 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center font-bold text-sm text-stone-700 dark:text-stone-300">
                ?
              </div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                Hoe werkt de ranking?
              </h2>
            </div>

            <div className="space-y-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-2xl border border-stone-200/70 dark:border-stone-700">
                <span className="font-bold text-stone-900 dark:text-white block mb-0.5">
                  Om en om:
                </span>
                <p>
                  De ranking wisselt steeds af: 1 moeilijk woord, 1 oud woord, 1 moeilijk woord, 1 oud woord, enzovoort.
                </p>
              </div>

              <div className="space-y-2 pt-0.5">
                <div>
                  <span className="font-bold text-rose-600 dark:text-rose-400 block mb-0.5">
                    Hard (moeilijk):
                  </span>
                  <p>
                    Woorden waar je de meeste fouten op hebt gemaakt staan bovenaan (+1 punt per fout).
                  </p>
                </div>

                <div>
                  <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                    Oud:
                  </span>
                  <p>
                    Woorden die je het langst niet hebt geoefend staan bovenaan (+1 punt per dag niet geoefend).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
