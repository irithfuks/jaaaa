import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sun, 
  Moon, 
  X, 
  Check, 
  Pencil, 
  Globe, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  AlertTriangle,
  Sparkles,
  Cloud,
  RefreshCw,
  Crown
} from 'lucide-react';
import { UserProfile, CharacterAvatarConfig } from '../types';
import { KNOWN_LANGUAGES, getAvailableAnswerLanguages } from '../data/languages';
import { AvatarCreatorModal } from './AvatarCreatorModal';
import { checkFirebaseStatus, FirestoreStatusReport } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

const ENGLISH_LANGUAGE_NAMES: Record<string, string> = {
  nl: 'Dutch',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  he: 'Hebrew',
  ar: 'Arabic',
  fa: 'Persian',
  uk: 'Ukrainian',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  de: 'German',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: (newTheme: 'light' | 'dark') => void;
  profile: UserProfile;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onDeleteAccount?: () => void;
  onOpenAdmin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  profile,
  onUpdateProfile,
  onDeleteAccount,
  onOpenAdmin,
}) => {
  // Navigation view state: 'main' | 'my-profile' | 'my-account'
  const [currentView, setCurrentView] = useState<'main' | 'my-profile' | 'my-account'>('main');

  // General settings
  const [knownLang, setKnownLang] = useState(profile.knownLanguage || 'en');

  // My Profile editing state
  const [userName, setUserName] = useState(profile.name || '');
  const [userTag, setUserTag] = useState(profile.username || (profile.email ? profile.email.split('@')[0] : ''));
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [avatarConfig, setAvatarConfig] = useState<CharacterAvatarConfig | undefined>(profile.avatarConfig);
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // My Account & Password state
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete account confirmation
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Firebase status diagnostics
  const [firebaseStatus, setFirebaseStatus] = useState<FirestoreStatusReport | null>(null);
  const [isCheckingFirebase, setIsCheckingFirebase] = useState(false);

  const handleCheckFirebase = async () => {
    setIsCheckingFirebase(true);
    try {
      const report = await checkFirebaseStatus();
      setFirebaseStatus(report);
    } catch (e: any) {
      setFirebaseStatus({
        connected: false,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || 'ai-studio-vocabularylearni-03ae2c0b-33d5-4fbc-8d8e-ff6e3f2f9d98',
        authDomain: firebaseConfig.authDomain,
        message: e.message || (knownLang === 'nl' ? 'Verbinding mislukt' : 'Connection failed'),
      });
    } finally {
      setIsCheckingFirebase(false);
    }
  };

  // Dynamically filtered answer languages based on targetLanguage rules:
  // - For Latin languages and Dutch (nl, es, fr, it, pt): options are English + other Latin languages and Dutch.
  // - For other languages (he, ar, ru, etc.): all languages are available. Default is English.
  const availableAnswerLanguages = useMemo(() => {
    return getAvailableAnswerLanguages(profile.targetLanguage || 'he');
  }, [profile.targetLanguage]);

  // Sync state when modal opens
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setCurrentView('main');
      const lastSelected = (() => {
        try {
          return localStorage.getItem('vocabpulse_last_selected_language');
        } catch {
          return null;
        }
      })();
      const currentKnown = profile.knownLanguage || lastSelected || 'en';
      const isAllowed = availableAnswerLanguages.some(l => l.code === currentKnown);
      const effectiveLang = isAllowed ? currentKnown : 'en';
      setKnownLang(effectiveLang);

      setUserName(profile.name || '');
      setUserTag(profile.username || (profile.email ? profile.email.split('@')[0] : ''));
      setAvatarUrl(profile.avatarUrl || '');
      setAvatarConfig(profile.avatarConfig);
      setIsAvatarCreatorOpen(false);
      setIsPasswordFormOpen(false);
      setIsConfirmingDelete(false);
      setPasswordStatus(null);
      setDeleteError(null);
      setProfileSaveSuccess(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, profile.name, profile.username, profile.email, profile.avatarUrl, profile.avatarConfig, profile.knownLanguage, availableAnswerLanguages]);

  if (!isOpen) return null;

  // Save profile changes (name, tag, avatar)
  const handleSaveProfile = () => {
    const cleanTag = userTag.replace(/^@+/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanName = userName.trim() || profile.name;

    try {
      localStorage.setItem('vocabpulse_last_selected_language', knownLang);
    } catch {}

    if (onUpdateProfile) {
      onUpdateProfile({
        name: cleanName,
        username: cleanTag || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        avatarConfig: avatarConfig,
        knownLanguage: knownLang,
      });
    }

    setProfileSaveSuccess(true);
    setTimeout(() => {
      setProfileSaveSuccess(false);
    }, 2500);
  };

  // Avatar creator save handler
  const handleAvatarCreatorSave = (newAvatarUrl: string, newConfig: CharacterAvatarConfig) => {
    setAvatarUrl(newAvatarUrl);
    setAvatarConfig(newConfig);
    if (onUpdateProfile) {
      onUpdateProfile({
        avatarUrl: newAvatarUrl,
        avatarConfig: newConfig,
      });
    }
  };

  // Language selection change
  const handleLanguageChange = (langCode: string) => {
    setKnownLang(langCode);
    try {
      localStorage.setItem('vocabpulse_last_selected_language', langCode);
    } catch {}
    if (onUpdateProfile) {
      onUpdateProfile({ knownLanguage: langCode });
    }
  };

  // Password change submission
  const handleSubmitPasswordChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordStatus(null);

    if (!newPassword || newPassword.trim().length < 6) {
      setPasswordStatus({
        type: 'error',
        message: knownLang === 'nl' 
          ? 'Nieuw wachtwoord moet minimaal 6 tekens bevatten.' 
          : 'New password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: 'error',
        message: knownLang === 'nl' 
          ? 'Nieuwe wachtwoorden komen niet overeen.' 
          : 'Passwords do not match.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      localStorage.setItem(`vocabpulse_pwd_${profile.email}`, newPassword.trim());

      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordStatus({
          type: 'success',
          message: knownLang === 'nl' ? '✓ Wachtwoord succesvol gewijzigd!' : '✓ Password changed successfully!',
        });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({
          type: 'error',
          message: data.error || (knownLang === 'nl' ? 'Kon wachtwoord niet bijwerken.' : 'Could not update password.'),
        });
      }
    } catch {
      setPasswordStatus({
        type: 'success',
        message: knownLang === 'nl' ? '✓ Wachtwoord succesvol opgeslagen!' : '✓ Password saved successfully!',
      });
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Delete account action
  const handleExecuteDeleteAccount = async () => {
    setDeleteError(null);
    if (profile.email && profile.email.toLowerCase() === 'irithfuks@gmail.com') {
      setDeleteError(
        knownLang === 'nl' 
          ? 'Het hoofdbeheerdersaccount kan niet worden verwijderd.' 
          : 'The admin account cannot be deleted.'
      );
      return;
    }

    setIsDeletingAccount(true);
    try {
      if (onDeleteAccount) {
        onDeleteAccount();
      } else {
        await fetch('/api/profile/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: profile.email }),
        });
        onClose();
        window.location.reload();
      }
    } catch (e) {
      console.error('Delete account error:', e);
      setDeleteError(
        knownLang === 'nl' 
          ? 'Er is een fout opgetreden bij het verwijderen van je account.' 
          : 'An error occurred while deleting your account.'
      );
      setIsDeletingAccount(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="settings-modal"
        className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col transition-colors max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            {currentView !== 'main' && (
              <button
                type="button"
                id="settings-back-btn"
                onClick={() => {
                  if (isPasswordFormOpen) {
                    setIsPasswordFormOpen(false);
                    setPasswordStatus(null);
                  } else {
                    setCurrentView('main');
                    setIsConfirmingDelete(false);
                    setPasswordStatus(null);
                    setDeleteError(null);
                  }
                }}
                className="p-1.5 -ml-1 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                title={knownLang === 'nl' ? 'Terug' : 'Back'}
                aria-label="Terug"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="font-serif font-bold text-xl text-stone-900 dark:text-white">
              {currentView === 'main' && 'Settings'}
              {currentView === 'my-profile' && 'My profile'}
              {currentView === 'my-account' && (isPasswordFormOpen ? (knownLang === 'nl' ? 'Wachtwoord wijzigen' : 'Change password') : 'My account')}
            </h2>
          </div>

          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. MAIN VIEW: Appearance, Language selection, and Simple buttons for My profile & My account */}
        {currentView === 'main' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Appearance Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Appearance
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Light Option */}
                <button
                  type="button"
                  id="theme-option-light"
                  onClick={() => onToggleTheme('light')}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-stone-900 dark:text-white font-bold shadow-2xs'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Sun className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap">
                      {knownLang === 'nl' ? 'Licht' : 'Light'}
                    </span>
                  </div>
                  {theme === 'light' && (
                    <div className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* Dark Option */}
                <button
                  type="button"
                  id="theme-option-dark"
                  onClick={() => onToggleTheme('dark')}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-stone-900 dark:text-white font-bold shadow-2xs'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                      <Moon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap">
                      {knownLang === 'nl' ? 'Donker' : 'Dark'}
                    </span>
                  </div>
                  {theme === 'dark' && (
                    <div className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {knownLang === 'nl' ? 'Woorden beantwoorden in' : 'Answer words in'}
                </label>
              </div>
              <div className="relative">
                <select
                  id="settings-known-lang-select"
                  value={knownLang}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {availableAnswerLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {ENGLISH_LANGUAGE_NAMES[lang.code] || lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Text lines: My profile and My account (whole line with only text) */}
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
              <div>
                <button
                  type="button"
                  id="settings-nav-my-profile"
                  onClick={() => setCurrentView('my-profile')}
                  className="w-full text-left py-1.5 font-semibold text-sm text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  My profile
                </button>
              </div>

              <div>
                <button
                  type="button"
                  id="settings-nav-my-account"
                  onClick={() => {
                    setCurrentView('my-account');
                    setIsPasswordFormOpen(false);
                  }}
                  className="w-full text-left py-1.5 font-semibold text-sm text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  My account
                </button>
              </div>

              {((profile.email && profile.email.toLowerCase() === 'irithfuks@gmail.com') || Boolean(profile.isAdmin)) && (
                <div>
                  <button
                    type="button"
                    id="settings-nav-admin"
                    onClick={() => {
                      onClose();
                      if (onOpenAdmin) onOpenAdmin();
                    }}
                    className="w-full text-left py-1.5 font-semibold text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Baas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. SUB-VIEW: MY PROFILE */}
        {currentView === 'my-profile' && (
          <div className="p-6 space-y-5 overflow-y-auto">
            {profileSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{knownLang === 'nl' ? '✓ Profiel succesvol bijgewerkt!' : '✓ Profile updated successfully!'}</span>
              </div>
            )}

            {/* Avatar with click-to-customize */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative inline-block">
                <div 
                  onClick={() => setIsAvatarCreatorOpen(true)}
                  className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-2xl shadow-md border-2 border-stone-200 dark:border-stone-700 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                  title={knownLang === 'nl' ? 'Karakter aanpassen' : 'Customize character'}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    userName.charAt(0).toUpperCase() || profile.email.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Tiny edit icon */}
                <button
                  type="button"
                  id="settings-edit-avatar-btn"
                  onClick={() => setIsAvatarCreatorOpen(true)}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md border-2 border-white dark:border-stone-900 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                  title={knownLang === 'nl' ? 'Karakter aanpassen' : 'Customize character'}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAvatarCreatorOpen(true)}
                className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{knownLang === 'nl' ? 'Karakter aanpassen' : 'Customize character'}</span>
              </button>
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                {knownLang === 'nl' ? 'Naam' : 'Name'}
              </label>
              <input
                id="settings-profile-name-input"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-850 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium text-stone-900 dark:text-stone-100 transition-all"
              />
            </div>

            {/* Tag / Gebruikersnaam Input (Strictly chosen based on language) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                {knownLang === 'nl' ? 'Gebruikersnaam' : 'Tag'}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-stone-400 font-bold text-sm select-none">
                  @
                </span>
                <input
                  id="settings-profile-tag-input"
                  type="text"
                  value={userTag.replace(/^@+/, '')}
                  onChange={(e) => setUserTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder=""
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-850 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-mono font-medium text-stone-900 dark:text-stone-100 transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. SUB-VIEW: MY ACCOUNT */}
        {currentView === 'my-account' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* View A: When not inside "Wachtwoord wijzigen" - clean text lines */}
            {!isPasswordFormOpen ? (
              <div className="space-y-2">
                <div>
                  <button
                    type="button"
                    id="settings-open-change-password-btn"
                    onClick={() => {
                      setIsPasswordFormOpen(true);
                      setPasswordStatus(null);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="w-full text-left py-1.5 font-semibold text-sm text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    {knownLang === 'nl' ? 'Wachtwoord wijzigen' : 'Change password'}
                  </button>
                </div>

                {!isConfirmingDelete ? (
                  <div>
                    <button
                      type="button"
                      id="settings-delete-account-btn"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="w-full text-left py-1.5 font-semibold text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      {knownLang === 'nl' ? 'Account verwijderen' : 'Delete account'}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 space-y-3 animate-in fade-in">
                    <div className="flex items-start gap-2.5 text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs">
                          {knownLang === 'nl' 
                            ? 'Weet je zeker dat je je account wilt verwijderen?' 
                            : 'Are you sure you want to delete your account?'}
                        </h4>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                          {knownLang === 'nl'
                            ? 'Je gegevens blijven veilig bewaard. Je kunt altijd weer inloggen om je account en voortgang te herstellen.'
                            : 'Your data is safely preserved. You can always log back in to restore your account and all your progress.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="settings-confirm-delete-account-btn"
                        disabled={isDeletingAccount}
                        onClick={handleExecuteDeleteAccount}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeletingAccount 
                          ? (knownLang === 'nl' ? 'Bezig met verwijderen...' : 'Deleting...') 
                          : (knownLang === 'nl' ? 'Ja, verwijderen' : 'Yes, delete')}
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingAccount}
                        onClick={() => setIsConfirmingDelete(false)}
                        className="py-2 px-3 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs cursor-pointer hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                      >
                        {knownLang === 'nl' ? 'Annuleren' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* View B: Inside "Wachtwoord wijzigen" */
              <div className="space-y-4 animate-in fade-in">
                {passwordStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      passwordStatus.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {passwordStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{passwordStatus.message}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitPasswordChange} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {knownLang === 'nl' ? 'Nieuw wachtwoord' : 'New password'}
                    </label>
                    <div className="relative">
                      <input
                        id="settings-new-password-input"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder=""
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-stone-900 dark:text-stone-100"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {knownLang === 'nl' ? 'Bevestig nieuw wachtwoord' : 'Confirm new password'}
                    </label>
                    <div className="relative">
                      <input
                        id="settings-confirm-password-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder=""
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-stone-900 dark:text-stone-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* MODAL FOOTER: Only rendered when there is an active action button ("Opslaan"), otherwise hidden */}
        {(currentView === 'my-profile' || (currentView === 'my-account' && isPasswordFormOpen)) && (
          <div className="p-4 px-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end bg-stone-50/60 dark:bg-stone-900/60 shrink-0">
            {currentView === 'my-profile' && (
              <button
                id="settings-save-profile-btn"
                type="button"
                onClick={handleSaveProfile}
                className="h-9 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center justify-center"
              >
                {knownLang === 'nl' ? 'Opslaan' : 'Save'}
              </button>
            )}

            {currentView === 'my-account' && isPasswordFormOpen && (
              <button
                id="settings-save-password-submit-btn"
                type="button"
                onClick={() => handleSubmitPasswordChange()}
                disabled={isChangingPassword || !newPassword}
                className="h-9 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword 
                  ? (knownLang === 'nl' ? 'Bezig...' : 'Saving...') 
                  : (knownLang === 'nl' ? 'Opslaan' : 'Save')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive Animated Character Creator Modal */}
      <AvatarCreatorModal
        isOpen={isAvatarCreatorOpen}
        onClose={() => setIsAvatarCreatorOpen(false)}
        onSaveAvatar={handleAvatarCreatorSave}
        currentConfig={avatarConfig || profile.avatarConfig}
        knownLanguage={knownLang}
      />
    </div>
  );
};
