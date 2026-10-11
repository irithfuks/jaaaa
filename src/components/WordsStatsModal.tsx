import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

interface WordsStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalKnownWords: number;
  learnedWordsCount: number;
  isNl?: boolean;
}

export const WordsStatsModal: React.FC<WordsStatsModalProps> = ({
  isOpen,
  onClose,
  totalKnownWords,
  learnedWordsCount,
  isNl = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tooltipText = isNl ? 'woorden die je al kende meegeteld' : 'including words you already knew';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl p-5 sm:p-6 overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
          title={isNl ? 'Sluiten' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header - without symbol, titled 'Your words' */}
        <div className="mb-5 pr-8">
          <h3 className="text-base sm:text-lg font-bold text-stone-100">
            {isNl ? 'Jouw woorden' : 'Your words'}
          </h3>
        </div>

        {/* Stats List */}
        <div className="space-y-3">
          {/* Card 1: Totaal aantal woorden dat je kent */}
          <div className="relative group p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-all">
            <div 
              className="flex items-center justify-between gap-3 cursor-pointer"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(prev => !prev)}
              title={tooltipText}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-medium text-stone-200 truncate">
                  {isNl ? 'Totaal aantal woorden dat je kent:' : 'Total words you know:'}
                </span>
                <span className="p-0.5 rounded-full text-sky-400 hover:text-sky-300 shrink-0">
                  <Info className="w-3.5 h-3.5" />
                </span>
              </div>
              <span className="text-base sm:text-lg font-black font-mono text-sky-400 shrink-0">
                {totalKnownWords}
              </span>
            </div>

            {/* Hover Tooltip: 'woorden die je al kende meegeteld' */}
            <div 
              className={`absolute left-4 -top-8 z-30 transition-all duration-150 pointer-events-none ${
                showTooltip ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden group-hover:flex'
              }`}
            >
              <div className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 border border-stone-700 text-2xs font-medium shadow-xl whitespace-nowrap">
                {tooltipText}
                <div className="absolute -bottom-1 left-4 w-2 h-2 bg-stone-800 border-r border-b border-stone-700 rotate-45" />
              </div>
            </div>
          </div>

          {/* Card 2: Totaal aantal woorden dat je hebt geleerd */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-stone-200 truncate">
                {isNl ? 'Totaal aantal woorden dat je hebt geleerd:' : "Total words you've learned:"}
              </span>
            </div>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400 shrink-0">
              {learnedWordsCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
