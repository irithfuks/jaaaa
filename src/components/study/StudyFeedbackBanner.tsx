import React from 'react';
import { Check, X } from 'lucide-react';

interface StudyFeedbackBannerProps {
  expectedAnswer: string;
  transliteration?: string;
  showPhonetic?: boolean;
  isRtlTarget?: boolean;
  onOverrideCorrect?: () => void;
  overrideLabel?: string;
}

export const StudyFeedbackBanner: React.FC<StudyFeedbackBannerProps> = ({
  expectedAnswer,
  transliteration,
  showPhonetic = false,
  isRtlTarget = false,
  onOverrideCorrect,
  overrideLabel = 'I was correct',
}) => {
  return (
    <div className="w-full space-y-2 pt-1 text-left animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full p-4 rounded-2xl bg-white border border-stone-200 text-left shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-center shrink-0">
            <X className="w-3.5 h-3.5 stroke-[2]" />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
              Correct answer:
            </span>
            <div
              className={`font-display text-xl sm:text-2xl font-bold text-stone-900 tracking-tight leading-snug break-words ${
                isRtlTarget ? 'font-hebrew' : ''
              }`}
              dir={isRtlTarget ? 'rtl' : 'ltr'}
            >
              {expectedAnswer}
            </div>
            {showPhonetic && transliteration && isRtlTarget && (
              <p className="text-xs font-mono text-stone-500 pt-0.5">
                /{transliteration}/
              </p>
            )}
          </div>
        </div>
      </div>

      {onOverrideCorrect && (
        <div className="flex items-center justify-end pt-0.5">
          <button
            type="button"
            id="typo-override-btn"
            onClick={onOverrideCorrect}
            className="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 hover:border-stone-400 text-stone-700 hover:text-stone-900 font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Click 'I was correct' if you made a typo but you know the word"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{overrideLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};
