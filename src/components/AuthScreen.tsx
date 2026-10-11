import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X,
  UserPlus,
  ExternalLink,
  Copy,
  Server,
  Send,
  Key
} from 'lucide-react';
import { UserProfile } from '../types';
import { 
  signInWithGoogleFirebase, 
  signInWithEmailFirebase, 
  signUpWithEmailFirebase 
} from '../lib/firebase';

interface AuthScreenProps {
  onLoginSuccess: (profile: UserProfile) => void;
  defaultEmail?: string;
}

type AuthMode = 'login' | 'register';

interface SavedGoogleAccount {
  email: string;
  name?: string;
  avatarUrl?: string;
}

const getBrowserGoogleAccount = (): SavedGoogleAccount | null => {
  try {
    const raw = localStorage.getItem('vocabpulse_browser_google_account');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.email === 'string' && parsed.email.includes('@')) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  defaultEmail = '',
}) => {
  // Mode: login or register
  const [mode, setMode] = useState<AuthMode>('login');

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>(defaultEmail);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Username check states
  const [usernameChecking, setUsernameChecking] = useState<boolean>(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available: boolean; message: string } | null>(null);

  // Standard Google Account Chooser Modal state
  const [showGoogleChooser, setShowGoogleChooser] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string>('');

  // Interface language: English default for everyone, or last selected language from settings/toggle
  const [uiLang, setUiLang] = useState<'nl' | 'en'>(() => {
    try {
      const last = localStorage.getItem('vocabpulse_last_selected_language');
      if (last === 'nl' || last === 'en') return last;
    } catch {}
    return 'en';
  });
  const isNl = uiLang === 'nl';

  // Debounced username check ref
  const debounceTimerRef = useRef<any>(null);

  // Email verification state
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [emailDelivered, setEmailDelivered] = useState<boolean>(false);
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [pendingRegistrationPayload, setPendingRegistrationPayload] = useState<{
    email: string;
    name: string;
    username: string;
    password?: string;
    isGoogle?: boolean;
    avatarUrl?: string;
  } | null>(null);

  // Focus management
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const verificationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (mode === 'register') {
      nameInputRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
  }, [mode]);

  // When user types their name, auto-suggest username if username is empty
  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!username) {
      const suggested = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '')
        .slice(0, 16);
      if (suggested.length >= 3) {
        handleUsernameChange(suggested);
      }
    }
  };

  // Clean username input live
  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/^@/, '').replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
    setUsername(clean);
    setUsernameStatus(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (clean.length < 3) {
      if (clean.length > 0) {
        setUsernameStatus({
          available: false,
          message: isNl ? 'Minimaal 3 tekens nodig' : 'Minimum 3 characters required',
        });
      }
      return;
    }

    setUsernameChecking(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: clean, currentEmail: email }),
        });
        if (res.ok) {
          const data = await res.json();
          setUsernameStatus({
            available: data.available,
            message: data.message || (data.available ? (isNl ? 'Beschikbaar' : 'Available') : (isNl ? 'Al bezet' : 'Taken')),
          });
        }
      } catch (err) {
        console.error('Username check error:', err);
      } finally {
        setUsernameChecking(false);
      }
    }, 350);
  };

  // Reset form messages
  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Switch between Login and Register
  const handleSwitchMode = (newMode: AuthMode) => {
    clearMessages();
    setMode(newMode);
    if (newMode === 'register') {
      // Ensure all fields start completely clean for a new account!
      setFullName('');
      setEmail('');
      setPassword('');
      setUsername('');
      setUsernameStatus(null);
    } else {
      setPassword('');
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(isNl ? 'Vul een geldig e-mailadres in' : 'Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMessage(isNl ? 'Vul je wachtwoord in' : 'Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.needsSetup) {
          setMode('register');
          setSuccessMessage(
            isNl
              ? 'Dit account heeft nog geen wachtwoord. Vul je gegevens in om te registreren.'
              : 'This account does not have a password yet. Please complete registration.'
          );
        } else {
          setErrorMessage(
            data.error ||
              (isNl
                ? 'Inloggen mislukt. Controleer je e-mail en wachtwoord.'
                : 'Login failed. Please check your credentials.')
          );
        }
        return;
      }

      if (data.profile) {
        // Authenticate with Firebase Auth in parallel to establish security credentials for Cloud Firestore
        try {
          await signInWithEmailFirebase(cleanEmail, password);
        } catch (fbErr) {
          console.warn('Firebase Auth sign-in notice:', fbErr);
        }
        onLoginSuccess(data.profile);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(isNl ? 'Er is een verbindingsfout opgetreden.' : 'Network connection error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Register: Validates input, sends verification code, and opens verification step
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase();

    if (!cleanName) {
      setErrorMessage(isNl ? 'Vul je naam in' : 'Please enter your name');
      nameInputRef.current?.focus();
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(isNl ? 'Vul een geldig e-mailadres in' : 'Please enter a valid email address');
      emailInputRef.current?.focus();
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setErrorMessage(isNl ? 'Gebruikersnaam moet minimaal 3 tekens zijn' : 'Username must be at least 3 characters');
      return;
    }
    if (usernameStatus && !usernameStatus.available) {
      setErrorMessage(
        isNl ? 'Kies een andere gebruikersnaam, deze is niet beschikbaar' : 'Please choose an available username'
      );
      return;
    }

    if (!password || password.trim().length < 6) {
      setErrorMessage(isNl ? 'Wachtwoord moet minimaal 6 tekens bevatten' : 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setIsSendingCode(true);

    try {
      // 1. Check if username is already taken
      const uRes = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });
      const uData = await uRes.json();
      if (!uData.available) {
        setErrorMessage(uData.message || (isNl ? 'Deze gebruikersnaam is al bezet' : 'Username is taken'));
        setIsLoading(false);
        setIsSendingCode(false);
        return;
      }

      // 2. Check if email already has a registered password
      const eRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const eData = await eRes.json();
      if (eData.exists && eData.hasPassword) {
        setErrorMessage(
          isNl ? 'Er bestaat al een account met dit e-mailadres. Log in met je wachtwoord.' : 'Account already exists. Please log in.'
        );
        setIsLoading(false);
        setIsSendingCode(false);
        return;
      }

      // 3. For all email registrations: save pending payload and send verification code
      const payload = {
        email: cleanEmail,
        name: cleanName,
        username: cleanUser,
        password: password.trim(),
        isGoogle: false,
      };
      setPendingRegistrationPayload(payload);

      const codeRes = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const codeData = await codeRes.json();
      if (!codeRes.ok || !codeData.success) {
        setErrorMessage(codeData.error || (isNl ? 'Kon verificatiecode niet versturen' : 'Failed to send verification code'));
        setIsLoading(false);
        setIsSendingCode(false);
        return;
      }

      setEmailDelivered(Boolean(codeData.emailDelivered));
      setVerificationCodeInput('');
      setVerificationError('');
      setResendCooldown(15);
      setShowVerificationModal(true);
      setTimeout(() => verificationInputRef.current?.focus(), 150);

    } catch (err) {
      console.error('Registration initiate error:', err);
      setErrorMessage(isNl ? 'Er is een verbindingsfout opgetreden.' : 'Network error occurred.');
    } finally {
      setIsLoading(false);
      setIsSendingCode(false);
    }
  };

  // Verify entered 6-digit code and complete account registration
  const handleVerifyAndCompleteRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingRegistrationPayload) return;

    const cleanCode = verificationCodeInput.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setVerificationError(
        isNl ? 'Vul de 6-cijferige verificatiecode in' : 'Please enter the 6-digit verification code'
      );
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError('');

    try {
      if (pendingRegistrationPayload.isGoogle) {
        const res = await fetch('/api/auth/google-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pendingRegistrationPayload.email,
            name: pendingRegistrationPayload.name,
            username: pendingRegistrationPayload.username,
            avatarUrl: pendingRegistrationPayload.avatarUrl,
            targetLanguage: 'he',
            knownLanguage: isNl ? 'nl' : 'en',
            verificationCode: cleanCode,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setVerificationError(data.error || (isNl ? 'Verificatie mislukt' : 'Verification failed'));
          return;
        }

        if (data.profile) {
          try {
            localStorage.setItem(
              'vocabpulse_browser_google_account',
              JSON.stringify({
                email: pendingRegistrationPayload.email,
                name: pendingRegistrationPayload.name,
                avatarUrl: data.profile.avatarUrl,
              })
            );
          } catch (err) {
            // ignore
          }
          setShowVerificationModal(false);
          onLoginSuccess(data.profile);
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pendingRegistrationPayload.email,
            password: pendingRegistrationPayload.password,
            username: pendingRegistrationPayload.username,
            name: pendingRegistrationPayload.name,
            targetLanguage: 'he',
            knownLanguage: isNl ? 'nl' : 'en',
            verificationCode: cleanCode,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setVerificationError(data.error || (isNl ? 'Verificatie mislukt' : 'Verification failed'));
          return;
        }

        if (data.profile) {
          try {
            await signUpWithEmailFirebase(pendingRegistrationPayload.email, pendingRegistrationPayload.password);
          } catch (fbErr) {
            console.warn('Firebase Auth sign-up notice:', fbErr);
          }
          setShowVerificationModal(false);
          onLoginSuccess(data.profile);
        }
      }
    } catch (err) {
      console.error('Registration verification error:', err);
      setVerificationError(isNl ? 'Er is een verbindingsfout opgetreden.' : 'Network error occurred.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Resend verification code
  const handleResendVerificationCode = async () => {
    if (!pendingRegistrationPayload || resendCooldown > 0) return;
    setIsLoading(true);
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingRegistrationPayload.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerificationError(data.error || 'Kon code niet opnieuw versturen');
        return;
      }
      setEmailDelivered(Boolean(data.emailDelivered));
      setResendCooldown(15);
    } catch (e) {
      setVerificationError(isNl ? 'Netwerkfout bij opnieuw versturen' : 'Network error on resend');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login / Registration Execution:
  // When logging in: logs in if exists.
  // When registering or new account: requires filling in Naam, Email, and Gebruikersnaam!
  const handleSelectGoogleAccount = async (targetEmail: string, displayName?: string, avatarUrl?: string) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setGoogleError(isNl ? 'Vul een geldig Gmail-adres in' : 'Please enter a valid Gmail address');
      return;
    }

    setGoogleLoading(true);
    setGoogleError('');

    try {
      // 1. Check if account already exists in VocabPulse
      const checkRes = await fetch('/api/auth/google-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });
      const checkData = await checkRes.json();

      // Log in directly or automatically create unified account for verified Google user!
      const loginRes = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, name: displayName, avatarUrl }),
      });
      const loginData = await loginRes.json();
      if (loginData.success && loginData.profile) {
        try {
          localStorage.setItem(
            'vocabpulse_browser_google_account',
            JSON.stringify({
              email: clean,
              name: loginData.profile.name || displayName || clean.split('@')[0],
              avatarUrl: loginData.profile.avatarUrl || avatarUrl,
            })
          );
        } catch (e) {
          // ignore
        }
        setShowGoogleChooser(false);
        onLoginSuccess(loginData.profile);
        return;
      }

      // Fallback if network issue
      setShowGoogleChooser(false);
      setMode('register');

      const initialName = displayName || checkData.profile?.name || '';

      // Fill in email
      setEmail(clean);

      // Fill in name if known, else let user enter it
      setFullName(initialName);

      // Auto-suggest username
      const userSeed = (initialName || clean.split('@')[0])
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);
      handleUsernameChange(userSeed);

      setSuccessMessage(
        isNl
          ? 'E-mailadres ingevuld. Kies een wachtwoord en gebruikersnaam om een 6-cijferige verificatiecode per e-mail te ontvangen.'
          : 'Email filled in. Choose a password and username to receive your 6-digit verification code.'
      );
      setErrorMessage('');

      // Focus password field
      setTimeout(() => {
        document.getElementById('auth-register-password-input')?.focus();
      }, 150);

    } catch (err) {
      console.error('Google account select error:', err);
      setGoogleError(isNl ? 'Verbindingsfout met Google' : 'Connection error with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Open Firebase Google Sign-In with popup, falling back gracefully if cancelled
  const handleOpenGoogle = async () => {
    setGoogleError('');
    setGoogleLoading(true);

    try {
      // Direct Firebase Google Sign-In popup with project authDomain
      const result = await signInWithGoogleFirebase();
      if (result && result.email) {
        await handleSelectGoogleAccount(
          result.email, 
          result.displayName || undefined, 
          result.photoURL || undefined
        );
        return;
      }
    } catch (err: any) {
      console.warn('Firebase Google sign-in note:', err?.code || err?.message);
      // If user closed popup intentionally or popup blocked in iframe, offer the chooser
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setGoogleLoading(false);
        return;
      }
    } finally {
      setGoogleLoading(false);
    }

    // Fallback if popup blocked by iframe container
    setShowGoogleChooser(true);
  };

  // Current browser Google account if previously logged in on this machine
  const browserGoogleAccount = getBrowserGoogleAccount();

  return (
    <div
      id="auth-screen-container"
      className="min-h-screen w-full flex flex-col justify-between bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200"
    >
      {/* Top Bar with Brand and Language Switch */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-stone-950 font-black shadow-md shadow-amber-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="font-black text-lg tracking-tight">
            <span>VocabPulse</span>
          </div>
        </div>

        {/* Language switch */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            id="auth-lang-toggle-nl"
            onClick={() => {
              setUiLang('nl');
              try {
                localStorage.setItem('vocabpulse_last_selected_language', 'nl');
              } catch {}
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              uiLang === 'nl'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            NL
          </button>
          <button
            type="button"
            id="auth-lang-toggle-en"
            onClick={() => {
              setUiLang('en');
              try {
                localStorage.setItem('vocabpulse_last_selected_language', 'en');
              } catch {}
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              uiLang === 'en'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div
          id="auth-card"
          className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 dark:shadow-black/40 space-y-4"
        >
          {/* Mode Switch Tabs (Inloggen vs Nieuw account) - Directly at top without any 'Register' heading */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-800 text-xs font-bold">
            <button
              type="button"
              id="auth-tab-login"
              onClick={() => handleSwitchMode('login')}
              className={`py-2 rounded-xl transition-all cursor-pointer text-center ${
                mode === 'login'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {isNl ? 'Inloggen' : 'Sign In'}
            </button>
            <button
              type="button"
              id="auth-tab-register"
              onClick={() => handleSwitchMode('register')}
              className={`py-2 rounded-xl transition-all cursor-pointer text-center ${
                mode === 'register'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {isNl ? 'Nieuw account' : 'Register'}
            </button>
          </div>

          {/* Messages Alert */}
          {errorMessage && (
            <div
              id="auth-error-alert"
              className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-alert"
              className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in"
            >
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* MODE 1: LOGIN FORM */}
          {mode === 'login' && (
            <form id="auth-login-form" onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1">
              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    ref={emailInputRef}
                    id="auth-login-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {isNl ? 'Wachtwoord' : 'Password'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    ref={passwordInputRef}
                    id="auth-login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                    title={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="auth-login-submit-btn"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-stone-950 font-black text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isNl ? 'Inloggen' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Standard Google Login Button (no 'of' divider) */}
              <button
                type="button"
                id="auth-login-google-btn"
                onClick={handleOpenGoogle}
                disabled={googleLoading}
                className="w-full h-11 px-4 rounded-full bg-white dark:bg-[#131314] hover:bg-[#f8fafd] dark:hover:bg-[#1f1f20] text-[#3c4043] dark:text-[#e8eaed] font-medium text-sm border border-[#dadce0] dark:border-[#5f6368] shadow-xs flex items-center justify-center gap-3 cursor-pointer transition-all active:bg-[#f1f3f4] mt-3"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-roboto">{isNl ? 'Inloggen met Google' : 'Sign in with Google'}</span>
              </button>
            </form>
          )}

          {/* MODE 2: REGISTER FORM - Order: 1. Naam, 2. Email, 3. Wachtwoord, 4. Gebruikersnaam */}
          {mode === 'register' && (
            <form id="auth-register-form" onSubmit={handleRegisterSubmit} className="space-y-3 pt-1">
              {/* Field 1: Naam (FIRST FIELD) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {isNl ? 'Naam' : 'Name'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    ref={nameInputRef}
                    id="auth-register-name-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Email (SECOND FIELD) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    ref={emailInputRef}
                    id="auth-register-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Field 3: Wachtwoord */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {isNl ? 'Wachtwoord' : 'Password'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-register-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                    title={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 4: Gebruikersnaam */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    {isNl ? 'Gebruikersnaam' : 'Username'}
                  </label>
                  {usernameChecking ? (
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                      <span>{isNl ? 'Controleren...' : 'Checking...'}</span>
                    </span>
                  ) : usernameStatus ? (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        usernameStatus.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {usernameStatus.available ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      <span>{usernameStatus.message}</span>
                    </span>
                  ) : null}
                </div>

                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 font-bold text-sm">
                    @
                  </div>
                  <input
                    id="auth-register-username-input"
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder=""
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-medium rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Submit Register Button */}
              <button
                type="submit"
                id="auth-register-submit-btn"
                disabled={isLoading || (usernameStatus !== null && !usernameStatus.available)}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-stone-950 font-black text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none mt-2"
              >
                {isLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isNl ? 'Registreren' : 'Register'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Standard Google Sign-In Button on Register page */}
              <button
                type="button"
                id="auth-register-google-btn"
                onClick={handleOpenGoogle}
                disabled={googleLoading}
                className="w-full h-11 px-4 rounded-full bg-white dark:bg-[#131314] hover:bg-[#f8fafd] dark:hover:bg-[#1f1f20] text-[#3c4043] dark:text-[#e8eaed] font-medium text-sm border border-[#dadce0] dark:border-[#5f6368] shadow-xs flex items-center justify-center gap-3 cursor-pointer transition-all active:bg-[#f1f3f4] mt-2.5"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-roboto">{isNl ? 'Inloggen met Google' : 'Sign in with Google'}</span>
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Standard Google Account Chooser Modal (Authentic Google Sign-In Experience) */}
      {showGoogleChooser && (
        <div
          id="google-account-chooser-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#5f6368] rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-fade-in text-[#202124] dark:text-[#e8eaed]">
            {/* Google Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-white leading-tight">
                    {isNl ? 'Inloggen met Google' : 'Sign in with Google'}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {isNl ? 'Kies een Google account om direct in te loggen' : 'Choose a Google account to sign in'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleChooser(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner */}
            {googleError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                {googleError}
              </div>
            )}

            {/* Explanatory and configuration details */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
                  {isNl
                    ? 'Om rechtstreeks via de officiële Google pop-up in te loggen, moet een Google OAuth 2.0 Client ID worden gekoppeld.'
                    : 'To sign in directly via the official Google popup, a Google OAuth 2.0 Client ID must be linked.'}
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {isNl
                    ? 'Totdat de Client ID is ingesteld, kun je veilig inloggen en registreren met je e-mailadres en wachtwoord (met 6-cijferige verificatiecode).'
                    : 'Until the Client ID is configured, you can securely log in and register using your email and password (with 6-digit verification code).'}
                </p>
              </div>

              {/* Primary action: Go to Email & Password login */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowGoogleChooser(false);
                    setMode('login');
                    setTimeout(() => emailInputRef.current?.focus(), 150);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isNl ? 'Inloggen met E-mail & Wachtwoord' : 'Sign in with Email & Password'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowGoogleChooser(false);
                    setMode('register');
                    setTimeout(() => nameInputRef.current?.focus(), 150);
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isNl ? 'Nieuw account aanmaken met e-mail' : 'Create new account with email'}</span>
                </button>
              </div>

              {/* Collapsible Google Cloud OAuth 2.0 Client ID instructions */}
              <details className="pt-2 text-[11px] text-stone-500 dark:text-stone-400 group border-t border-stone-200 dark:border-stone-800">
                <summary className="cursor-pointer font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5 hover:text-amber-600">
                  <Key className="w-3 h-3" />
                  <span>{isNl ? 'Hoe koppel ik een Google OAuth Client ID?' : 'How do I link a Google OAuth Client ID?'}</span>
                </summary>
                <div className="mt-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
                  <p className="leading-relaxed">
                    {isNl 
                      ? '1. Maak in Google Cloud Console een OAuth 2.0 Web Client ID aan.'
                      : '1. Create an OAuth 2.0 Web Client ID in Google Cloud Console.'}
                  </p>
                  <p className="leading-relaxed">
                    {isNl 
                      ? '2. Voeg deze URL toe als Authorized JavaScript origin:'
                      : '2. Add this origin to Authorized JavaScript origins:'}
                  </p>
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 font-mono text-[10px] break-all border border-stone-200 dark:border-stone-700">
                    <span className="flex-1 truncate">{typeof window !== 'undefined' ? window.location.origin : ''}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(window.location.origin);
                          setCopiedOrigin(true);
                          setTimeout(() => setCopiedOrigin(false), 2000);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-100 font-sans text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      {copiedOrigin ? (isNl ? 'Gekopieerd' : 'Copied') : (isNl ? 'Kopieer' : 'Copy')}
                    </button>
                  </div>
                  <p>
                    {isNl ? '3. Stel ' : '3. Set '}
                    <code className="text-amber-600 font-bold">VITE_GOOGLE_CLIENT_ID</code>
                    {isNl ? ' in bij de AI Studio instellingen.' : ' in AI Studio settings.'}
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Modal */}
      {showVerificationModal && pendingRegistrationPayload && (
        <div 
          id="email-verification-modal-overlay"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            id="email-verification-modal"
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Close / Cancel */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Mail className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isNl ? 'E-mail Verificatie' : 'Email Verification'}
                </span>
              </div>
              <button
                type="button"
                id="close-verification-modal-btn"
                onClick={() => {
                  setShowVerificationModal(false);
                  setVerificationError('');
                }}
                className="w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Header copy */}
            <div className="text-center space-y-1.5 pt-1">
              <h3 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                {isNl ? 'Verifieer je e-mailadres' : 'Verify your email address'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-sm mx-auto">
                {isNl ? (
                  <>
                    We hebben een 6-cijferige verificatiecode gestuurd naar{' '}
                    <strong className="text-stone-900 dark:text-white font-medium break-all">
                      {pendingRegistrationPayload.email}
                    </strong>
                    . Voer de code in om te bevestigen dat dit e-mailadres echt van jou is.
                  </>
                ) : (
                  <>
                    We sent a 6-digit confirmation code to{' '}
                    <strong className="text-stone-900 dark:text-white font-medium break-all">
                      {pendingRegistrationPayload.email}
                    </strong>
                    . Enter the code to verify this email belongs to you.
                  </>
                )}
              </p>
            </div>

            {/* Email delivery badge */}
            <div 
              id="email-delivered-badge"
              className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="leading-relaxed font-medium">
                {isNl
                  ? 'Bevestigingsmail is verzonden naar je inbox! Controleer je e-mail (en eventueel spambox) voor de 6-cijferige verificatiecode.'
                  : 'Confirmation email sent to your inbox! Check your email (and spam folder) for the 6-digit verification code.'}
              </span>
            </div>

            {/* Verification Error */}
            {verificationError && (
              <div 
                id="verification-error-banner"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{verificationError}</span>
              </div>
            )}

            {/* Code Input Form */}
            <form onSubmit={handleVerifyAndCompleteRegistration} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 text-center uppercase tracking-wider">
                  {isNl ? '6-cijferige code' : '6-digit code'}
                </label>
                <input
                  ref={verificationInputRef}
                  id="verification-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  required
                  value={verificationCodeInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setVerificationCodeInput(val);
                    if (val.length === 6) {
                      setVerificationError('');
                    }
                  }}
                  placeholder="······"
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-3.5 px-4 rounded-2xl bg-stone-50 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-stone-400 shadow-inner"
                />
              </div>

              <button
                type="submit"
                id="verify-and-register-submit-btn"
                disabled={isVerifyingCode || verificationCodeInput.length < 6}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-450 active:scale-[0.99] text-stone-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifyingCode ? (
                  <span className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isNl ? 'Bevestig & Voltooi Registratie' : 'Confirm & Complete Registration'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Actions below submit */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  type="button"
                  id="change-email-btn"
                  onClick={() => {
                    setShowVerificationModal(false);
                    setVerificationError('');
                    emailInputRef.current?.focus();
                  }}
                  className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
                >
                  {isNl ? 'E-mailadres wijzigen' : 'Change email'}
                </button>

                <button
                  type="button"
                  id="resend-code-btn"
                  disabled={resendCooldown > 0 || isSendingCode}
                  onClick={handleResendVerificationCode}
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  {resendCooldown > 0
                    ? `${isNl ? 'Opnieuw verzenden in' : 'Resend in'} ${resendCooldown}s`
                    : isSendingCode
                    ? (isNl ? 'Verzenden...' : 'Sending...')
                    : (isNl ? 'Code opnieuw verzenden' : 'Resend code')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clean Bottom Spacer */}
      <div className="h-6" />
    </div>
  );
};
