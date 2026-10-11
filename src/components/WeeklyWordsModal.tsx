import React, { useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  User 
} from 'lucide-react';
import { WeeklyLearnedWord } from '../types';
import { getLanguage } from '../data/languages';

interface WeeklyWordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
  targetLanguage: string;
  knownLanguage?: string;
  words: WeeklyLearnedWord[];
  count: number;
  isCurrentUser?: boolean;
  isLoading?: boolean;
}

export const WeeklyWordsModal: React.FC<WeeklyWordsModalProps> = ({
  isOpen,
  onClose,
  userName,
  avatarUrl,
  targetLanguage,
  knownLanguage = 'nl',
  words = [],
  count,
  isCurrentUser = false,
  isLoading = false,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetLang = getLanguage(targetLanguage);
  const isNl = knownLanguage === 'nl';

  // Format timestamp to date only: Today, Yesterday, or Tue, Oct 6 / Di 6 okt
  const formatLearnedAt = (ts: number): string => {
    if (!ts) return '';
    try {
      const now = new Date();
      const d = new Date(ts);
      const isToday = now.toDateString() === d.toDateString();
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = yesterday.toDateString() === d.toDateString();

      if (isToday) {
        return isNl ? 'Vandaag' : 'Today';
      }
      if (isYesterday) {
        return isNl ? 'Gisteren' : 'Yesterday';
      }

      if (isNl) {
        const str = d.toLocaleDateString('nl-NL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        return str.charAt(0).toUpperCase() + str.slice(1);
      }

      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch (_) {
      return '';
    }
  };

  const getWordLevelLabel = (w: WeeklyLearnedWord): string => {
    if (typeof w.numericLevel === 'number') {
      return `Lvl ${w.numericLevel}`;
    }
    if (w.level && !isNaN(Number(w.level))) {
      return `Lvl ${w.level}`;
    }
    return 'Lvl 1';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/70 shrink-0">
          {/* Close button - placed higher up, above the +15 words badge */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer z-10"
            title={isNl ? 'Sluiten' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 min-w-0 pr-8">
            {/* User Avatar */}
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={userName} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 border-emerald-500/30 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-2xs shrink-0">
                {userName ? userName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-white truncate">
                {userName}
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs sm:text-sm text-stone-500">
                {isNl ? 'Woorden ophalen...' : 'Loading words...'}
              </p>
            </div>
          ) : words.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                  {isNl ? 'Nog geen woorden geleerd deze week' : 'No words learned yet this week'}
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
                  {isCurrentUser
                    ? (isNl 
                        ? 'Oefen een dagelijkse sessie om nieuwe woorden te leren en punten te scoren voor de poule!'
                        : 'Practice daily sessions to learn new words and climb the pool ranking!')
                    : (isNl
                        ? `${userName} heeft deze week nog geen nieuwe woorden geleerd in dagelijkse sessies.`
                        : `${userName} hasn't learned any new words in daily practice sessions this week yet.`)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {words.map((word, idx) => (
                <div
                  key={word.id || `${word.targetWord}_${idx}`}
                  className="p-3 sm:p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {/* Target Word */}
                      <span
                        className={`text-lg sm:text-xl font-bold font-serif text-stone-900 dark:text-white leading-tight ${
                          targetLang.rtl ? 'font-hebrew' : ''
                        }`}
                        dir={targetLang.rtl ? 'rtl' : 'ltr'}
                      >
                        {word.targetWord}
                      </span>

                      {/* Transliteration */}
                      {word.transliteration && (
                        <span className="text-xs text-stone-500 dark:text-stone-400 italic">
                          {word.transliteration}
                        </span>
                      )}
                    </div>

                    {/* Translation in Dutch / English */}
                    <div className="text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200 truncate mt-0.5">
                      {word.translation}
                    </div>
                  </div>

                  {/* Metadata: subtle Lvl badge placed to the left of the date */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 bg-stone-200/70 dark:bg-stone-700/60 border border-stone-300/60 dark:border-stone-600/60 px-1.5 py-0.5 rounded-md">
                      {getWordLevelLabel(word)}
                    </span>

                    {word.learnedAt ? (
                      <span className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {formatLearnedAt(word.learnedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
