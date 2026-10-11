import React, { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import {
  getRustyReviewTokens,
  getRecentReviewTokens,
  buildDeduplicatedWordRanking,
  RankedWordItem,
} from '../utils/reviewHierarchy';
import { getLanguage } from '../data/languages';
import { speakWord } from '../utils/speech';
import { matchesWordItem } from '../utils/textNormalization';
import {
  Brain,
  Lightbulb,
  Search,
  Volume2,
  Clock,
  Flame,
  X,
} from 'lucide-react';

interface ReviewHierarchyViewProps {
  profile: UserProfile;
}

type HierarchyScope = 'rusty' | 'recent';

export const ReviewHierarchyView: React.FC<ReviewHierarchyViewProps> = ({ profile }) => {
  const [activeScope, setActiveScope] = useState<HierarchyScope>('rusty');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBadgeModal, setActiveBadgeModal] = useState<'hard' | 'old' | null>(null);

  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);
  const userNumLevel = profile.numericLevel || 1;
  const prevNumLevel = Math.max(1, userNumLevel - 1);

  // Fetch tokens for Rusty and Recent
  const rustyTokens = useMemo(() => {
    return getRustyReviewTokens(profile);
  }, [profile]);

  const recentTokens = useMemo(() => {
    return getRecentReviewTokens(profile);
  }, [profile]);

  // Selected scope tokens
  const currentTokens = activeScope === 'rusty' ? rustyTokens : recentTokens;

  // Deduplicated word ranking: each unique word appears exactly once, placed where it ranks highest
  const rankedItems = useMemo<RankedWordItem[]>(() => {
    return buildDeduplicatedWordRanking(currentTokens);
  }, [currentTokens]);

  // Apply search query (handles Hebrew nikud, Arabic harakat, Farsi vowels, phonetics, translations)
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return rankedItems;

    return rankedItems.filter((item) => {
      return matchesWordItem(item, searchQuery);
    });
  }, [rankedItems, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Scope Selector (Rusty review vs Recent Review) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Rusty review Button */}
        <button
          type="button"
          onClick={() => setActiveScope('rusty')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
            activeScope === 'rusty'
              ? 'bg-purple-900/15 dark:bg-purple-950/40 border-purple-500/60 dark:border-purple-500/80 shadow-md ring-2 ring-purple-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-purple-300 dark:hover:border-purple-800/60'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              activeScope === 'rusty'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
            }`}
          >
            <Brain className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-white block">
              Rusty review
            </span>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
              Alle <em>geleerde</em> woorden
            </p>
          </div>
        </button>

        {/* Recent Review Button */}
        <button
          type="button"
          onClick={() => setActiveScope('recent')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
            activeScope === 'recent'
              ? 'bg-indigo-900/15 dark:bg-indigo-950/40 border-indigo-500/60 dark:border-indigo-500/80 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-indigo-300 dark:hover:border-indigo-800/60'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              activeScope === 'recent'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            <Lightbulb className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-white block">
              Recent review
            </span>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
              Ranking van huidig en vorig level
            </p>
          </div>
        </button>
      </div>

      {/* Control Bar: Search & Info Button */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-semibold"
            >
              Wissen
            </button>
          )}
        </div>
      </div>

      {/* List of Tokens */}
      {displayedItems.length === 0 ? (
        <div className="py-16 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <Brain className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
            {searchQuery ? 'Geen woorden gevonden' : 'Nog geen woorden in de ranking'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? 'Geen woorden gevonden die voldoen aan je zoekterm.'
              : 'In de ranking horen alleen woorden te staan die je via dagelijkse sessies hebt geleerd, of die je handmatig naar \'geleerd\' hebt verplaatst.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
            {displayedItems.map((item, idx) => {
              const isHard = item.reason === 'hard';

              return (
                <div
                  key={`${item.wordId}-${idx}`}
                  className="p-3.5 sm:p-4 hover:bg-stone-50/60 dark:hover:bg-stone-850/40 transition-colors flex items-center justify-between gap-3"
                >
                  {/* Left: Index badge + Word info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Queue order position */}
                    <div className="w-7 h-7 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center font-mono font-bold text-xs text-stone-700 dark:text-stone-300 shrink-0">
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-serif">
                          {item.targetWord}
                        </span>
                        <button
                          type="button"
                          onClick={() => speakWord(item.targetWord, targetLang.voiceLang || targetLang.code)}
                          className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                          title="Beluister"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        {item.transliteration && (
                          <span className="text-xs text-stone-400 italic">
                            ({item.transliteration})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        <span className="truncate">{item.translation}</span>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <span className="text-[11px] font-mono">Lvl {item.level}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Only the single reason badge (either hard points OR days old, NEVER both!) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isHard && item.hardPoints > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveBadgeModal('hard')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Klik voor uitleg hoe Hard-punten geteld worden"
                      >
                        <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                        <span>{item.hardPoints} hard</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveBadgeModal('old')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-2xs hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Klik voor uitleg hoe Oud-punten geteld worden"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{item.oldPoints}d oud</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                Uitleg
              </h2>
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
                  <span className="whitespace-nowrap">bij een goed antwoord van dit woord in Recent review of Rusty review</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-purple-600 bg-purple-100 dark:bg-purple-950/70 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    -5 punten
                  </span>
                  <span className="whitespace-nowrap">bij een goed antwoord van dit woord in Rusty review</span>
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
                Hoe langer je een woord niet hebt geoefend, hoe hoger dit woord op de ranking staat. Elke dag dat je het woord niet oefent komt er een +1 punt bij.
              </p>
              <p>
                Nadat je het woord tegenkomt in een oefen sessie, wordt de teller gereset naar 0.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
