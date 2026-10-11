import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, CEFRLevel, WordProgress } from '../types';
import { getLanguage, CEFR_LEVELS } from '../data/languages';
import { getCharacterAvatarDataUri, getDefaultAvatarConfig } from '../utils/characterAvatar';
import { calculateCurrentStreak, isDailyPracticeCompletedToday } from '../utils/streak';
import { 
  isWordLearnedInSession, 
  calculateLearnedWordsFromJourney, 
  calculateTotalKnownWords 
} from '../utils/srs';
import { WordsStatsModal } from './WordsStatsModal';
import { 
  Sparkles, 
  User, 
  CheckCircle2, 
  BookOpen, 
  Flame, 
  Users, 
  Settings, 
  LogOut, 
  ChevronRight,
  Crown,
  Trophy,
  Compass,
  Brain
} from 'lucide-react';

interface HeaderProps {
  profile: UserProfile;
  onOpenMyProfile: () => void;
  onOpenSettings: () => void;
  onLogOff: () => void;
  onOpenWordBank: () => void;
  onOpenFriends?: () => void;
  onChangeLevel?: () => void;
  onOpenAccountModal?: () => void;
  onOpenLanguageSelect?: () => void;
  activeView: 'journey' | 'review' | 'bank' | 'launch' | 'friends' | 'profile' | 'admin';
  setActiveView: (view: 'journey' | 'review' | 'bank' | 'launch' | 'friends' | 'profile' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenMyProfile,
  onOpenSettings,
  onLogOff,
  onOpenWordBank,
  onOpenFriends,
  onChangeLevel,
  onOpenLanguageSelect,
  activeView,
  setActiveView,
}) => {
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isWordsStatsModalOpen, setIsWordsStatsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileDropdownOpen]);

  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);
  const isNl = profile.knownLanguage === 'nl';
  const currentLevelInfo = CEFR_LEVELS.find(l => l.level === profile.level) || CEFR_LEVELS[0];

  const totalKnownWords = calculateTotalKnownWords(profile);
  const learnedWordsCount = calculateLearnedWordsFromJourney(profile);
  const characterAvatarSrc = profile.avatarUrl || getCharacterAvatarDataUri(profile.avatarConfig || getDefaultAvatarConfig('bear'));
  const userStreak = calculateCurrentStreak(profile);
  const isStreakDoneToday = isDailyPracticeCompletedToday(profile);
  const currentNumLevel = profile.numericLevel || 1;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-stone-900 text-stone-100 border-b border-stone-800 shadow-sm w-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Active Language Flag Only */}
        <div className="flex items-center shrink-0">
          <button
            id="header-lang-settings-btn"
            onClick={() => {
              if (onOpenLanguageSelect) {
                onOpenLanguageSelect();
              } else {
                setActiveView('launch');
              }
            }}
            className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all cursor-pointer border ${
              activeView === 'launch'
                ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40 shadow-xs'
                : 'bg-stone-800/90 hover:bg-stone-750 border-stone-700/80 hover:border-amber-400/60'
            }`}
            title={isNl ? `Huidige taal: ${targetLang.name} (klik om te wijzigen)` : `Current language: ${targetLang.name} (click to change)`}
            aria-label={targetLang.name}
          >
            <span className="text-xl sm:text-2xl leading-none select-none drop-shadow-xs">{targetLang.flag}</span>
          </button>
        </div>

        {/* Center / Nav Quick Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            id="header-nav-journey-btn"
            onClick={() => setActiveView('journey')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'journey'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
            title="Journey (Duolingo Leerpad)"
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Journey</span>
          </button>
          <button
            id="header-nav-review-btn"
            onClick={() => setActiveView('review')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'review'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
            title="Review & Ranking"
          >
            <Brain className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Review</span>
          </button>
          <button
            id="header-nav-bank-btn"
            onClick={onOpenWordBank}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'bank'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
            title="Woordenbank"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Woorden</span>
          </button>
          <button
            id="header-nav-friends-btn"
            onClick={() => {
              if (onOpenFriends) onOpenFriends();
              else setActiveView('friends');
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'friends'
                ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
            title="Social / Vrienden"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Sociaal</span>
          </button>
        </div>

        {/* Right: Stats (Streak, Words, Level) & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* User Streak Badge */}
          <div
            id="header-user-streak-badge"
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 select-none transition-all border ${
              isStreakDoneToday
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                : 'bg-stone-800/60 border-stone-700/60 text-stone-400'
            }`}
            title={
              isStreakDoneToday
                ? `${userStreak} ${isNl ? 'streak dagen (vandaag al gehaald!)' : 'streak days (completed today!)'}`
                : `${userStreak} ${isNl ? 'streak dagen (vandaag nog te halen)' : 'streak days (not completed yet today)'}`
            }
          >
            <Flame
              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                isStreakDoneToday
                  ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                  : 'text-stone-400 fill-none'
              }`}
            />
            <span className={`font-mono text-xs font-black ${isStreakDoneToday ? 'text-amber-400' : 'text-stone-400'}`}>
              {userStreak}d
            </span>
          </div>

          {/* Words Count Badge */}
          <button
            type="button"
            id="header-words-count-badge"
            onClick={() => setIsWordsStatsModalOpen(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold shrink-0 cursor-pointer transition-colors"
            title={`${totalKnownWords} ${isNl ? 'woorden geleerd (klik voor details)' : 'words learned (click for details)'}`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-xs font-black">{totalKnownWords}w</span>
          </button>

          {/* Level Badge */}
          <button
            type="button"
            id="header-level-badge"
            onClick={onChangeLevel}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-400 hover:bg-indigo-500/25 text-xs font-bold shrink-0 cursor-pointer transition-colors"
            title={`Level ${currentNumLevel} (${profile.level || 'A1'})`}
          >
            <Trophy className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-xs font-black">L{currentNumLevel}</span>
          </button>

          {/* User Profile Button with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="header-user-profile-btn"
              onClick={() => setIsProfileDropdownOpen(prev => !prev)}
              aria-expanded={isProfileDropdownOpen}
              aria-haspopup="true"
              className={`flex items-center justify-center p-1 rounded-xl border text-stone-200 text-xs transition-all focus:outline-none cursor-pointer ${
                activeView === 'profile' || isProfileDropdownOpen
                  ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40'
                  : 'bg-stone-800 hover:bg-stone-750 border-stone-700 hover:border-stone-600'
              }`}
              title={profile.name || 'User Profile'}
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-xs shadow-sm">
                  {characterAvatarSrc ? (
                    <img src={characterAvatarSrc} alt="User Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(profile.name || profile.email || 'I').charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
            </button>

            {/* Floating Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div
                id="header-profile-dropdown"
                className="absolute right-0 top-full mt-2 w-64 sm:w-72 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-1.5 z-50 text-stone-900 dark:text-stone-100 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* User Identity Header */}
                <div className="p-3 flex items-center gap-3 border-b border-stone-100 dark:border-stone-800/80 mb-1">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {characterAvatarSrc ? (
                      <img src={characterAvatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(profile.name || profile.email || 'I').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                      {profile.name || 'Irith Fuks'}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      @{profile.username || profile.email.split('@')[0]}
                    </p>
                  </div>
                </div>

                {/* Dropdown Navigation Actions */}
                <div className="space-y-0.5">
                  <button
                    id="dropdown-my-profile-btn"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      onOpenMyProfile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-amber-500" />
                      <span>{isNl ? 'Mijn profiel' : 'My profile'}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    id="dropdown-settings-btn"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                      <span>{isNl ? 'Instellingen' : 'Settings'}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <div className="my-1 border-t border-stone-100 dark:border-stone-800/80" />

                  <button
                    id="dropdown-logoff-btn"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      onLogOff();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>{isNl ? 'Uitloggen' : 'Log off'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    <WordsStatsModal
      isOpen={isWordsStatsModalOpen}
      onClose={() => setIsWordsStatsModalOpen(false)}
      totalKnownWords={totalKnownWords}
      learnedWordsCount={learnedWordsCount}
      isNl={isNl}
    />
  </>
);
};
