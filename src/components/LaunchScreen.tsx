import React from 'react';
import { CEFRLevel, UserProfile } from '../types';
import { SUPPORTED_LANGUAGES, getLanguageName } from '../data/languages';
import { Check, X } from 'lucide-react';

interface LaunchScreenProps {
  profile: UserProfile;
  onSaveSetup: (targetLang: string, knownLang: string, level: CEFRLevel, needsPlacementTest: boolean) => void;
  onSwitchLanguage?: (targetLang: string) => void;
  onStartStudyDirect: () => void;
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({
  profile,
  onSaveSetup,
  onSwitchLanguage,
  onStartStudyDirect,
}) => {
  const currentKnown = profile.knownLanguage || 'en';
  const currentTarget = profile.targetLanguage || 'he';

  const handleSelectLanguage = (langCode: string) => {
    if (langCode === currentTarget) {
      onStartStudyDirect();
      return;
    }
    // Each language starts fresh from 0 or loads its own saved progression
    if (onSwitchLanguage) {
      onSwitchLanguage(langCode);
    } else {
      onSaveSetup(langCode, currentKnown, 'A1', false);
    }
  };

  return (
    <div id="launch-screen-view" className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-900 dark:text-white tracking-tight">
          {currentKnown === 'nl' ? 'Kies een taal' : 'Choose a language'}
        </h1>
        <button
          type="button"
          id="close-language-select-btn"
          onClick={onStartStudyDirect}
          className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
          title={currentKnown === 'nl' ? 'Sluiten' : 'Close'}
          aria-label={currentKnown === 'nl' ? 'Sluiten' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = currentTarget === lang.code;
          const displayName = getLanguageName(lang.code, currentKnown);
          return (
            <button
              key={lang.code}
              type="button"
              id={`select-lang-${lang.code}`}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                isSelected
                  ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-stone-950 dark:text-white font-bold ring-2 ring-amber-400/80 shadow-xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300 hover:shadow-2xs active:scale-98'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0 leading-none drop-shadow-2xs">{lang.flag}</span>
                <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
                  {displayName}
                </span>
              </div>
              {isSelected && (
                <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 stroke-[3]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

