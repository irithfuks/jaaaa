import React from 'react';
import { UserProfile, CharacterAvatarConfig } from '../types';
import { X, Settings, LogOut, Sparkles, Pencil, User, ChevronRight, Crown } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onOpenMyProfile?: () => void;
  onOpenSettings: () => void;
  onLogOff: () => void;
  onOpenAdmin?: () => void;
  onOpenAvatarCreator?: () => void;
  onSwitchAccount?: (newEmail: string) => void;
  onManualSync?: () => Promise<{ success: boolean; wordsCount: number }>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenMyProfile,
  onOpenSettings,
  onLogOff,
  onOpenAdmin,
  onOpenAvatarCreator,
}) => {
  if (!isOpen) return null;

  const displayName = profile.name || (profile.email ? profile.email.split('@')[0] : 'Gebruiker');
  const avatarLetter = (profile.name || profile.email || 'U').charAt(0).toUpperCase();
  const currentEmail = profile.email || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="account-profile-modal"
        className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 w-full max-w-sm sm:max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 sm:p-7 relative overflow-hidden flex flex-col transition-colors max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-account-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative group my-1">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-2xl sm:text-3xl shadow-md border-2 border-stone-100 dark:border-stone-800">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{avatarLetter}</span>
              )}
            </div>
            {onOpenAvatarCreator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAvatarCreator();
                }}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-md cursor-pointer border-2 border-white dark:border-stone-900 transition-transform hover:scale-110"
                title="Karakter aanpassen"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <h2 className="text-xl font-bold font-display text-stone-900 dark:text-stone-50 mt-2 capitalize tracking-tight">
            {displayName}
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-mono mt-1">
            <span>{currentEmail}</span>
          </div>
        </div>

        {/* Action Buttons: My Profile, Settings & Log Off */}
        <div className="w-full space-y-2 pt-4 mt-3 border-t border-stone-100 dark:border-stone-800">
          {((profile.email && profile.email.toLowerCase() === 'irithfuks@gmail.com') || Boolean(profile.isAdmin)) && (
            <button
              id="account-admin-dashboard-btn"
              type="button"
              onClick={() => {
                onClose();
                if (onOpenAdmin) {
                  onOpenAdmin();
                }
              }}
              className="w-full h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-stone-950 font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-md shadow-amber-500/15 group border border-amber-400"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-stone-950/15 flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 text-stone-950" />
                </div>
                <span className="text-sm tracking-tight font-extrabold">Beheerderspaneel (Accounts)</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-stone-950" />
            </button>
          )}

          <button
            id="account-my-profile-btn"
            type="button"
            onClick={() => {
              onClose();
              if (onOpenMyProfile) {
                onOpenMyProfile();
              }
            }}
            className="w-full h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-stone-950 font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-md shadow-amber-500/10 group border border-amber-400"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-stone-950/15 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-stone-950" />
              </div>
              <span className="text-sm tracking-tight font-extrabold">My profile</span>
            </div>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-stone-950" />
          </button>

          <button
            id="account-settings-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full h-10 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-stone-200 dark:border-stone-700"
          >
            <Settings className="w-4 h-4 text-stone-600 dark:text-stone-400" />
            <span>Settings</span>
          </button>

          <button
            id="account-logoff-btn"
            type="button"
            onClick={() => {
              onClose();
              onLogOff();
            }}
            className="w-full h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-rose-200 dark:border-rose-900/60"
          >
            <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Log off</span>
          </button>
        </div>
      </div>
    </div>
  );
};
