import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  FirebaseUser,
} from '../lib/firebase';

export const STORAGE_KEY_ACTIVE_EMAIL = 'vocabpulse_active_user_email';

interface AuthContextValue {
  user: FirebaseUser | null;
  activeEmail: string | null;
  isLoadingAuth: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveEmail: (email: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeEmail, setActiveEmailState] = useState<string | null>(() => {
    try {
      const isLoggedOut = localStorage.getItem('vocabpulse_logged_out');
      if (isLoggedOut === 'true') {
        return null;
      }

      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_EMAIL);
      if (
        saved &&
        saved !== 'null' &&
        saved !== 'undefined' &&
        saved !== 'guest@learning.com' &&
        saved.trim() !== ''
      ) {
        return saved.trim().toLowerCase();
      }

      // Check browser google account
      const rawGoogle = localStorage.getItem('vocabpulse_browser_google_account');
      if (rawGoogle) {
        try {
          const parsed = JSON.parse(rawGoogle);
          if (parsed && typeof parsed.email === 'string' && parsed.email.includes('@')) {
            const clean = parsed.email.trim().toLowerCase();
            localStorage.setItem(STORAGE_KEY_ACTIVE_EMAIL, clean);
            return clean;
          }
        } catch (e) {}
      }

      // Check any saved user profile in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vocabpulse_user_')) {
          const cand = key.replace('vocabpulse_user_', '').trim().toLowerCase();
          if (cand && cand.includes('@') && cand !== 'guest@learning.com') {
            localStorage.setItem(STORAGE_KEY_ACTIVE_EMAIL, cand);
            return cand;
          }
        }
      }

      // Default active email for current user session in preview
      localStorage.setItem(STORAGE_KEY_ACTIVE_EMAIL, 'irithfuks@gmail.com');
      return 'irithfuks@gmail.com';
    } catch {
      return 'irithfuks@gmail.com';
    }
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const setActiveEmail = (email: string | null) => {
    const sanitized = email && email !== 'guest@learning.com' ? email.trim().toLowerCase() : null;
    setActiveEmailState(sanitized);
    if (sanitized) {
      localStorage.removeItem('vocabpulse_logged_out');
      localStorage.setItem(STORAGE_KEY_ACTIVE_EMAIL, sanitized);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_EMAIL);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        setActiveEmail(firebaseUser.email);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user?.email) {
        setActiveEmail(res.user.email);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      localStorage.setItem('vocabpulse_logged_out', 'true');
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Sign out notice:', err);
    } finally {
      setActiveEmail(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeEmail,
        isLoadingAuth,
        signInWithGoogle,
        signOut,
        setActiveEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
