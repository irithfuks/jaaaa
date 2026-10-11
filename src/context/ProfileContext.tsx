import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, SavedSessionState, SessionType, CEFRLevel, WordProgress } from '../types';
import { useAuth } from './AuthContext';
import { getLocalDateString, calculateCurrentStreak } from '../utils/streak';
import { localizeUserProgress } from '../data/vocabularyRepository';
import { getCefrForNumericLevel } from '../data/languages';
import { sanitizeWordProgress, isWordLearnedInSession, calculateTotalKnownWords, isWordForTargetLanguage } from '../utils/srs';
import {
  saveProfileToFirestore,
  loadProfileFromFirestore,
  saveSessionToFirestore,
  clearSessionInFirestore,
  syncPublicProfileStreakFirestore,
  getPublicProfileFirestore,
  normalizeIdentifierToEmail,
} from '../lib/firebase';

export const VOCABPULSE_LAST_SELECTED_LANGUAGE_KEY = 'vocabpulse_last_selected_language';
export const VOCABPULSE_LAST_TARGET_LANGUAGE_KEY = 'vocabpulse_last_target_language';

export const getStoredPreferredLanguage = (): string => {
  try {
    return localStorage.getItem(VOCABPULSE_LAST_SELECTED_LANGUAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
};

export const getStoredTargetLanguage = (email?: string): string => {
  try {
    if (email) {
      const clean = email.toLowerCase().trim();
      const stored = localStorage.getItem(`${VOCABPULSE_LAST_TARGET_LANGUAGE_KEY}_${clean}`);
      if (stored) return stored;
    }
    return localStorage.getItem(VOCABPULSE_LAST_TARGET_LANGUAGE_KEY) || 'he';
  } catch {
    return 'he';
  }
};

const getCanonicalEmailKey = (email: string) =>
  email.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');

const getSavedDailyStorageKey = (email: string, targetLang: string) =>
  `vocabpulse_saved_daily_${email}_${targetLang}`;
const getSavedRustyStorageKey = (email: string, targetLang: string) =>
  `vocabpulse_saved_rusty_${email}_${targetLang}`;

const loadSavedSessionFromStorage = (
  email: string,
  targetLang: string,
  type: SessionType
): SavedSessionState | null => {
  try {
    const key =
      type === 'rusty'
        ? getSavedRustyStorageKey(email, targetLang)
        : getSavedDailyStorageKey(email, targetLang);
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);

    // Legacy fallback migration
    const legacyKey = `vocabpulse_saved_session_${email}_${targetLang}`;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const legacyType: SessionType = parsed.sessionType || 'daily';
      if (legacyType === type) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(legacyKey);
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Error loading saved ${type} session:`, e);
  }
  return null;
};

interface ProfileContextValue {
  profile: UserProfile | null;
  isLoadingProfile: boolean;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  saveProfile: (updated: UserProfile, syncFirestore?: boolean) => Promise<void>;
  updateProfile: (updatedOrUpdater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => void;
  resetProgress: () => void;
  directLevelChange: (newCefr: CEFRLevel, newNumericLevel: number) => void;
  manualSync: () => Promise<{ success: boolean; wordsCount: number }>;
  savedDailySession: SavedSessionState | null;
  savedRustySession: SavedSessionState | null;
  saveSessionState: (type: SessionType, state: SavedSessionState | null) => void;
  clearSavedDailySession: () => void;
  clearSavedRustySession: () => void;
  clearSavedSession: (type?: SessionType) => void;
  loadProfile: (email: string, targetLang?: string) => Promise<void>;
  switchTargetLanguage: (newLangCode: string, knownLang?: string) => Promise<UserProfile | null>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeEmail, setActiveEmail } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      if (activeEmail) {
        const saved = localStorage.getItem(`vocabpulse_user_${activeEmail}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.email && parsed.email !== 'guest@learning.com') {
            const lastSelected = getStoredPreferredLanguage();
            parsed.knownLanguage = parsed.knownLanguage || lastSelected || 'en';
            if (parsed.words) {
              Object.keys(parsed.words).forEach((wId) => {
                parsed.words[wId] = sanitizeWordProgress(parsed.words[wId]);
              });
            }
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Error loading initial profile from storage:', e);
    }
    return null;
  });

  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(() => {
    try {
      if (activeEmail) {
        const saved = localStorage.getItem(`vocabpulse_user_${activeEmail}`);
        if (saved) return false;
        return true;
      }
    } catch {}
    return false;
  });

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [savedDailySession, setSavedDailySession] = useState<SavedSessionState | null>(() => {
    try {
      return activeEmail ? loadSavedSessionFromStorage(activeEmail, 'he', 'daily') : null;
    } catch {
      return null;
    }
  });

  const [savedRustySession, setSavedRustySession] = useState<SavedSessionState | null>(() => {
    try {
      return activeEmail ? loadSavedSessionFromStorage(activeEmail, 'he', 'rusty') : null;
    } catch {
      return null;
    }
  });

  // Sync saved sessions when email or target language changes
  useEffect(() => {
    if (!profile) {
      setSavedDailySession(null);
      setSavedRustySession(null);
      return;
    }
    setSavedDailySession(loadSavedSessionFromStorage(profile.email, profile.targetLanguage, 'daily'));
    setSavedRustySession(loadSavedSessionFromStorage(profile.email, profile.targetLanguage, 'rusty'));
  }, [profile?.email, profile?.targetLanguage]);

  const clearSavedDailySession = useCallback(() => {
    setSavedDailySession(null);
    if (!profile) return;
    try {
      localStorage.removeItem(getSavedDailyStorageKey(profile.email, profile.targetLanguage));
      localStorage.removeItem(`vocabpulse_saved_session_${profile.email}_${profile.targetLanguage}`);
      clearSessionInFirestore(getCanonicalEmailKey(profile.email), 'daily').catch(() => {});
    } catch (e) {
      console.error('Error removing saved daily session from localStorage:', e);
    }
  }, [profile?.email, profile?.targetLanguage]);

  const clearSavedRustySession = useCallback(() => {
    setSavedRustySession(null);
    if (!profile) return;
    try {
      localStorage.removeItem(getSavedRustyStorageKey(profile.email, profile.targetLanguage));
      localStorage.removeItem(`vocabpulse_saved_session_${profile.email}_${profile.targetLanguage}`);
      clearSessionInFirestore(getCanonicalEmailKey(profile.email), 'rusty').catch(() => {});
    } catch (e) {
      console.error('Error removing saved rusty session from localStorage:', e);
    }
  }, [profile?.email, profile?.targetLanguage]);

  const clearSavedSession = useCallback(
    (type?: SessionType) => {
      if (type === 'rusty') {
        clearSavedRustySession();
      } else {
        clearSavedDailySession();
      }
    },
    [clearSavedDailySession, clearSavedRustySession]
  );

  const saveProfile = useCallback(
    async (updated: UserProfile, syncFirestore: boolean = true) => {
      if (updated.knownLanguage) {
        try {
          localStorage.setItem(VOCABPULSE_LAST_SELECTED_LANGUAGE_KEY, updated.knownLanguage);
        } catch {}
      }
      if (updated.targetLanguage) {
        try {
          localStorage.setItem(VOCABPULSE_LAST_TARGET_LANGUAGE_KEY, updated.targetLanguage);
          localStorage.setItem(`${VOCABPULSE_LAST_TARGET_LANGUAGE_KEY}_${updated.email.toLowerCase().trim()}`, updated.targetLanguage);
          localStorage.setItem(`vocabpulse_user_${updated.email.toLowerCase().trim()}_${updated.targetLanguage}`, JSON.stringify(updated));
        } catch {}
      }
      setProfile(updated);
      try {
        localStorage.setItem(`vocabpulse_user_${updated.email.toLowerCase().trim()}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving profile to localStorage:', e);
      }

      // Save to server backend with explicit targetLanguage for separate file persistence
      fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profile: updated, 
          targetLanguage: updated.targetLanguage || 'he',
          clientTodayStr: getLocalDateString() 
        }),
      }).catch((err) => console.error('Error saving profile to server:', err));

      // Save to Firestore directly
      if (syncFirestore) {
        const firestoreKey = getCanonicalEmailKey(updated.email);
        saveProfileToFirestore(updated, firestoreKey).catch((fErr) => {
          console.warn('Firestore direct background sync note:', fErr);
        });
        syncPublicProfileStreakFirestore(
          updated.email,
          updated.streakDays || 0,
          updated
        ).catch((sErr) => {
          console.warn('Firestore public profile streak sync note:', sErr);
        });
      }
    },
    []
  );

  const updateProfile = useCallback(
    (updatedOrUpdater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => {
      if (!profile) return;
      const updated = typeof updatedOrUpdater === 'function' ? updatedOrUpdater(profile) : updatedOrUpdater;
      if (updated.knownLanguage) {
        try {
          localStorage.setItem(VOCABPULSE_LAST_SELECTED_LANGUAGE_KEY, updated.knownLanguage);
        } catch {}
      }
      const lastSelected = getStoredPreferredLanguage();
      const effectiveKnown = updated.knownLanguage || profile.knownLanguage || lastSelected || 'en';
      const effectiveTarget = updated.targetLanguage || profile.targetLanguage || 'he';
      const words =
        updated.knownLanguage && updated.knownLanguage !== profile.knownLanguage
          ? localizeUserProgress(profile.words || {}, effectiveTarget, effectiveKnown)
          : (updated.words || profile.words || {});

      const updatedProf: UserProfile = { ...profile, ...updated, knownLanguage: effectiveKnown, targetLanguage: effectiveTarget, words };
      saveProfile(updatedProf);
    },
    [profile, saveProfile]
  );

  const saveSessionState = useCallback(
    (type: SessionType, state: SavedSessionState | null) => {
      const currentProfile = profileRef.current;
      if (!currentProfile) return;
      const firestoreUserKey = getCanonicalEmailKey(currentProfile.email);

      if (!state) {
        if (type === 'rusty') {
          setSavedRustySession(null);
          try {
            localStorage.removeItem(
              getSavedRustyStorageKey(currentProfile.email, currentProfile.targetLanguage)
            );
            clearSessionInFirestore(firestoreUserKey, 'rusty').catch(() => {});
          } catch (e) {}
        } else {
          setSavedDailySession(null);
          try {
            localStorage.removeItem(
              getSavedDailyStorageKey(currentProfile.email, currentProfile.targetLanguage)
            );
            clearSessionInFirestore(firestoreUserKey, 'daily').catch(() => {});
          } catch (e) {}
        }
        return;
      }

      if (type === 'rusty') {
        setSavedRustySession(state);
        try {
          localStorage.setItem(
            getSavedRustyStorageKey(currentProfile.email, currentProfile.targetLanguage),
            JSON.stringify(state)
          );
          saveSessionToFirestore(firestoreUserKey, 'rusty', state).catch(() => {});
        } catch (e) {
          console.error('Error saving rusty session to localStorage:', e);
        }
      } else {
        setSavedDailySession(state);
        try {
          localStorage.setItem(
            getSavedDailyStorageKey(currentProfile.email, currentProfile.targetLanguage),
            JSON.stringify(state)
          );
          saveSessionToFirestore(firestoreUserKey, 'daily', state).catch(() => {});
        } catch (e) {
          console.error('Error saving daily session to localStorage:', e);
        }
      }
    },
    []
  );

  const loadProfile = useCallback(
    async (email: string, targetLangParam?: string) => {
      setIsLoadingProfile(true);
      const cleanEmail = email.toLowerCase().trim();
      const effectiveTargetLang = targetLangParam || getStoredTargetLanguage(cleanEmail) || 'he';
      const userDocKey = getCanonicalEmailKey(cleanEmail);

      try {
        // Fetch server and Firestore concurrently with explicit target language
        const [serverResult, firestoreResult] = await Promise.allSettled([
          fetch('/api/profile/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: cleanEmail, 
              targetLanguage: effectiveTargetLang,
              clientTodayStr: getLocalDateString() 
            }),
          }).then((r) => r.json()),
          loadProfileFromFirestore(userDocKey),
        ]);

        const serverData = serverResult.status === 'fulfilled' ? serverResult.value : null;
        const firestoreProf = firestoreResult.status === 'fulfilled' ? firestoreResult.value : null;

        let localProf: UserProfile | null = null;
        try {
          const langLocal = localStorage.getItem(`vocabpulse_user_${cleanEmail}_${effectiveTargetLang}`);
          if (langLocal) {
            localProf = JSON.parse(langLocal) as UserProfile;
          } else {
            const genericLocal = localStorage.getItem(`vocabpulse_user_${cleanEmail}`);
            if (genericLocal) {
              const parsed = JSON.parse(genericLocal) as UserProfile;
              if (parsed.targetLanguage === effectiveTargetLang) {
                localProf = parsed;
              }
            }
          }
        } catch {}

        const serverProf: UserProfile | null = serverData?.profile || null;

        // Isolate language data: if Firestore data is for another language, don't bleed its exams/words/levels!
        const isFirestoreMatchingLang = firestoreProf && (firestoreProf.targetLanguage || 'he') === effectiveTargetLang;
        const firestoreTargetProf = isFirestoreMatchingLang ? firestoreProf : null;

        // Base profile starting from the richest source for this specific language
        const base: Partial<UserProfile> = serverProf || firestoreTargetProf || localProf || {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          targetLanguage: effectiveTargetLang,
          knownLanguage: 'en',
          level: 'A1',
          numericLevel: 1,
        };

        // 1. Merge passedExams ONLY for this specific language
        const mergedPassedExams = {
          ...(localProf?.passedExams || {}),
          ...(serverProf?.passedExams || {}),
          ...(firestoreTargetProf?.passedExams || {}),
        };

        const passedExamNums = Object.keys(mergedPassedExams).map(Number).filter((n) => !isNaN(n));
        const maxPassedUnlock = passedExamNums.length > 0 ? Math.max(...passedExamNums.map((n) => Math.min(60, n + 1))) : 1;

        // 2. Merge levels strictly for this target language
        const mergedMaxUnlocked = Math.max(
          localProf?.maxUnlockedNumericLevel || 1,
          serverProf?.maxUnlockedNumericLevel || 1,
          firestoreTargetProf?.maxUnlockedNumericLevel || 1,
          maxPassedUnlock
        );

        const mergedNumericLevel = Math.max(
          localProf?.numericLevel || 1,
          serverProf?.numericLevel || 1,
          firestoreTargetProf?.numericLevel || 1,
          maxPassedUnlock > 1 ? maxPassedUnlock : 1
        );

        // 3. Merge words keeping strict language isolation (only words for this language)
        const filterLangWords = (wordsObj?: Record<string, WordProgress>) => {
          if (!wordsObj) return {};
          const res: Record<string, WordProgress> = {};
          Object.entries(wordsObj).forEach(([id, prog]) => {
            if (prog && isWordForTargetLanguage(prog, effectiveTargetLang)) {
              res[id] = prog;
            }
          });
          return res;
        };

        const filteredLocalWords = filterLangWords(localProf?.words);
        const filteredServerWords = filterLangWords(serverProf?.words);
        const filteredFirestoreWords = filterLangWords(firestoreTargetProf?.words);

        const verifiedLocalWordIds = Object.keys(filteredLocalWords).filter(wId => {
          const lp = filteredLocalWords[wId];
          return lp && isWordLearnedInSession(lp);
        });

        const allWordIds = new Set<string>([
          ...Object.keys(filteredFirestoreWords),
          ...Object.keys(filteredServerWords),
          ...verifiedLocalWordIds,
        ]);

        const mergedWords: Record<string, WordProgress> = {};
        allWordIds.forEach((wId) => {
          const lProg = filteredLocalWords[wId];
          const sProg = filteredServerWords[wId];
          const fProg = filteredFirestoreWords[wId];
          
          if (fProg) {
            mergedWords[wId] = sanitizeWordProgress(fProg);
          } else if (sProg) {
            mergedWords[wId] = sanitizeWordProgress(sProg);
          } else if (lProg) {
            mergedWords[wId] = sanitizeWordProgress(lProg);
          }
        });

        // 4. Merge journey progress strictly for this language
        const mergedCompletedButtons = {
          ...(localProf?.journeyProgress?.completedSessionsByButton || {}),
          ...(serverProf?.journeyProgress?.completedSessionsByButton || {}),
          ...(firestoreTargetProf?.journeyProgress?.completedSessionsByButton || {}),
        };
        const mergedLessonsByLevel = {
          ...(localProf?.journeyProgress?.completedLessonsByLevel || {}),
          ...(serverProf?.journeyProgress?.completedLessonsByLevel || {}),
          ...(firestoreTargetProf?.journeyProgress?.completedLessonsByLevel || {}),
        };

        const lastSelected = getStoredPreferredLanguage();
        const effectiveKnownLang =
          localProf?.knownLanguage || firestoreProf?.knownLanguage || lastSelected || serverProf?.knownLanguage || 'en';

        // Safe following/followers (account level)
        const safeFollowing = Array.from(new Set([
          ...(localProf?.following || []).map(normalizeIdentifierToEmail),
          ...(serverProf?.following || []).map(normalizeIdentifierToEmail),
          ...(firestoreProf?.following || []).map(normalizeIdentifierToEmail),
        ])).filter(Boolean);

        const safeFollowers = Array.from(new Set([
          ...(localProf?.followers || []).map(normalizeIdentifierToEmail),
          ...(serverProf?.followers || []).map(normalizeIdentifierToEmail),
          ...(firestoreProf?.followers || []).map(normalizeIdentifierToEmail),
        ])).filter(Boolean);

        const initialStreakVal = Math.max(
          firestoreProf?.streakDays || 0,
          firestoreProf?.currentStreak || 0,
          serverProf?.streakDays || 0,
          serverProf?.currentStreak || 0,
          localProf?.streakDays || 0,
          localProf?.currentStreak || 0
        );

        const maxStreakVal = Math.max(
          firestoreProf?.maxStreakDays || 0,
          serverProf?.maxStreakDays || 0,
          localProf?.maxStreakDays || 0,
          initialStreakVal
        );

        const sessionHistories = [
          firestoreProf?.sessionHistory,
          serverProf?.sessionHistory,
          localProf?.sessionHistory,
        ].filter((h) => Array.isArray(h) && h.length > 0) as any[][];
        const mergedSessionHistory = sessionHistories.length > 0 ? sessionHistories[0] : [];

        let finalProfile: UserProfile = {
          ...base,
          email: cleanEmail,
          name: base.name || cleanEmail.split('@')[0],
          level: (serverProf?.level || firestoreTargetProf?.level || localProf?.level || 'A1') as any,
          createdAt: firestoreProf?.createdAt || serverProf?.createdAt || localProf?.createdAt || Date.now(),
          lastActiveAt: Date.now(),
          knownLanguage: effectiveKnownLang,
          targetLanguage: effectiveTargetLang,
          avatarUrl: firestoreProf?.avatarUrl || serverProf?.avatarUrl || localProf?.avatarUrl || '',
          words: mergedWords,
          passedExams: mergedPassedExams,
          maxUnlockedNumericLevel: mergedMaxUnlocked,
          numericLevel: mergedNumericLevel,
          following: safeFollowing,
          followers: safeFollowers,
          lastActiveDateStr: firestoreProf?.lastActiveDateStr || serverProf?.lastActiveDateStr || localProf?.lastActiveDateStr,
          sessionHistory: mergedSessionHistory,
          streakDays: initialStreakVal,
          currentStreak: initialStreakVal,
          maxStreakDays: maxStreakVal,
          totalSessionsCompleted: Math.max(
            serverProf?.totalSessionsCompleted || 0,
            localProf?.totalSessionsCompleted || 0,
            0
          ),
          levelVerified: Boolean(serverProf?.levelVerified || firestoreTargetProf?.levelVerified || localProf?.levelVerified),
          journeyProgress: {
            completedSessionsByButton: mergedCompletedButtons,
            completedLessonsByLevel: mergedLessonsByLevel,
          },
          reviewHierarchies: serverProf?.reviewHierarchies || firestoreTargetProf?.reviewHierarchies || localProf?.reviewHierarchies,
        };

        finalProfile.words = localizeUserProgress(finalProfile.words || {}, effectiveTargetLang, effectiveKnownLang);

        // Re-evaluate streak strictly with daily rule
        const validatedStreak = calculateCurrentStreak(finalProfile);
        finalProfile.streakDays = validatedStreak;
        finalProfile.currentStreak = validatedStreak;

        setProfile(finalProfile);
        localStorage.setItem(`vocabpulse_user_${cleanEmail}`, JSON.stringify(finalProfile));
        localStorage.setItem(`vocabpulse_user_${cleanEmail}_${effectiveTargetLang}`, JSON.stringify(finalProfile));
        localStorage.setItem(`${VOCABPULSE_LAST_TARGET_LANGUAGE_KEY}_${cleanEmail}`, effectiveTargetLang);
        localStorage.setItem(VOCABPULSE_LAST_TARGET_LANGUAGE_KEY, effectiveTargetLang);

        // Background update server and Firestore
        fetch('/api/profile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: finalProfile,
            targetLanguage: effectiveTargetLang,
            clientTodayStr: getLocalDateString(),
          }),
        }).catch(() => {});

        saveProfileToFirestore(finalProfile, userDocKey).catch(() => {});
      } catch (e) {
        console.warn('Profile load encountered error, checking local fallback:', e);
        const langLocal = localStorage.getItem(`vocabpulse_user_${cleanEmail}_${effectiveTargetLang}`);
        if (langLocal) {
          try {
            setProfile(JSON.parse(langLocal));
          } catch {}
        }
      } finally {
        setIsLoadingProfile(false);
      }
    },
    []
  );

  const switchTargetLanguage = useCallback(
    async (newLangCode: string, knownLang?: string): Promise<UserProfile | null> => {
      const currentProfile = profileRef.current;
      if (!currentProfile) return null;
      const cleanEmail = currentProfile.email.toLowerCase().trim();
      const currentLang = (currentProfile.targetLanguage || 'he').toLowerCase().trim();
      const targetLangClean = (newLangCode || 'he').toLowerCase().trim();
      if (targetLangClean === currentLang) return currentProfile;

      setIsLoadingProfile(true);

      // 1. Snapshot and save current language progress to its separate storage & server file
      try {
        localStorage.setItem(`vocabpulse_user_${cleanEmail}_${currentLang}`, JSON.stringify(currentProfile));
        await fetch('/api/profile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: currentProfile,
            targetLanguage: currentLang,
            clientTodayStr: getLocalDateString(),
          }),
        });
      } catch (e) {
        console.warn('Error saving previous language state:', e);
      }

      // 2. Fetch or initialize the new language from the server (which creates a separate file at 0 if new!)
      let newProfile: UserProfile | null = null;
      try {
        const res = await fetch('/api/profile/switch-language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            newTargetLanguage: targetLangClean,
            knownLanguage: knownLang || currentProfile.knownLanguage || 'en',
            clientTodayStr: getLocalDateString(),
          }),
        });
        const data = await res.json();
        if (data && data.success && data.profile) {
          newProfile = data.profile;
        }
      } catch (err) {
        console.error('Error switching language on server:', err);
      }

      // 3. Fallback to localStorage or initialize fresh at 0
      if (!newProfile) {
        try {
          const cached = localStorage.getItem(`vocabpulse_user_${cleanEmail}_${targetLangClean}`);
          if (cached) newProfile = JSON.parse(cached);
        } catch (_) {}
      }

      if (!newProfile) {
        // "Heel belangrijk: elke taal begin je vanaf 0."
        newProfile = {
          ...currentProfile,
          targetLanguage: targetLangClean,
          level: 'A1',
          numericLevel: 1,
          maxUnlockedNumericLevel: 1,
          levelVerified: false,
          levelScore: undefined,
          unlockedLevels: ['A1'],
          words: {},
          journeyProgress: {
            completedLessonsByLevel: {},
            completedSessionsByButton: {},
          },
          passedExams: {},
          reviewHierarchies: {},
          tokenMistakeCounts: {},
          totalSessionsCompleted: 0,
          lastActiveAt: Date.now(),
        };
      }

      setProfile(newProfile);
      localStorage.setItem(`vocabpulse_user_${cleanEmail}`, JSON.stringify(newProfile));
      localStorage.setItem(`vocabpulse_user_${cleanEmail}_${targetLangClean}`, JSON.stringify(newProfile));
      localStorage.setItem(`${VOCABPULSE_LAST_TARGET_LANGUAGE_KEY}_${cleanEmail}`, targetLangClean);
      localStorage.setItem(VOCABPULSE_LAST_TARGET_LANGUAGE_KEY, targetLangClean);

      // Load saved sessions specifically for new language
      setSavedDailySession(loadSavedSessionFromStorage(cleanEmail, targetLangClean, 'daily'));
      setSavedRustySession(loadSavedSessionFromStorage(cleanEmail, targetLangClean, 'rusty'));

      // Background sync to Firestore
      saveProfileToFirestore(newProfile).catch(() => {});

      setIsLoadingProfile(false);
      return newProfile;
    },
    []
  );

  useEffect(() => {
    if (!activeEmail) {
      setProfile(null);
      return;
    }
    loadProfile(activeEmail);
  }, [activeEmail, loadProfile]);

  const resetProgress = useCallback(() => {
    if (!profile) return;
    const resetProf: UserProfile = {
      ...profile,
      words: {},
      levelVerified: false,
      totalSessionsCompleted: 0,
      streakDays: 0,
      maxStreakDays: 0,
      sessionHistory: [],
      lastActiveDateStr: undefined,
    };
    saveProfile(resetProf);
  }, [profile, saveProfile]);

  const directLevelChange = useCallback(
    (newCefr: CEFRLevel, newNumericLevel: number) => {
      if (!profile) return;
      const maxAllowed = Math.max(1, profile.maxUnlockedNumericLevel ?? profile.numericLevel ?? 1);
      const safeNumeric = Math.min(newNumericLevel, maxAllowed);
      const safeCefr = getCefrForNumericLevel(safeNumeric);

      const updated: UserProfile = {
        ...profile,
        level: safeCefr,
        numericLevel: safeNumeric,
        maxUnlockedNumericLevel: maxAllowed,
        levelVerified: true,
      };
      saveProfile(updated);
    },
    [profile, saveProfile]
  );

  const manualSync = useCallback(async (): Promise<{ success: boolean; wordsCount: number }> => {
    if (!profile) return { success: false, wordsCount: 0 };
    try {
      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          wordsCount: data.wordsCount ?? calculateTotalKnownWords(profile),
        };
      }
    } catch (err) {
      console.error('Manual sync check failed:', err);
    }
    return { success: false, wordsCount: calculateTotalKnownWords(profile) };
  }, [profile]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoadingProfile,
        setProfile,
        saveProfile,
        updateProfile,
        resetProgress,
        directLevelChange,
        manualSync,
        savedDailySession,
        savedRustySession,
        saveSessionState,
        clearSavedDailySession,
        clearSavedRustySession,
        clearSavedSession,
        loadProfile,
        switchTargetLanguage,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileContextValue => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
