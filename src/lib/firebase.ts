import { initializeApp, getApps, getApp } from 'firebase/app';
import { stripDiacriticsAndVowels } from '../utils/textNormalization';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User as FirebaseUser
} from 'firebase/auth';

export {
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
};
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  getDocFromServer,
  collection,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  UserProfile, 
  PublicUserProfile,
  AdminUserSummary,
  SavedSessionState, 
  WordItem,
  TranslationOverrideRecord,
  TypedAnswerStat,
  OverrideSubmissionLog
} from '../types';
import { 
  calculateCurrentStreak, 
  calculateWeeklyNewWordsCount, 
  getWeeklyLearnedWordsList,
  getEffectiveWeeklyNewWordsCount,
  calculatePast7DaysWordStats,
  calculateCumulativeWordStats,
  getLocalDateString 
} from '../utils/streak';
import { calculateTotalKnownWords } from '../utils/srs';

// 1. Initialize Firebase App and Services
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Support both default Firestore database and named database
const targetDbId = (!firebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId === '(default)')
  ? undefined
  : firebaseConfig.firestoreDatabaseId;
export const db = targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 2. Error Handling as mandated by the Firebase skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively cleans and sanitizes any object or array destined for Cloud Firestore.
 * - Removes keys with `undefined` values.
 * - Replaces any `undefined` inside arrays with `null` or filters them.
 * - Preserves null, boolean, number, string, and Date/serverTimestamp values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as T;
}

// 3. Connection Test
export interface FirestoreStatusReport {
  connected: boolean;
  projectId: string;
  databaseId: string;
  authDomain: string;
  latencyMs?: number;
  message: string;
}

export async function checkFirebaseStatus(): Promise<FirestoreStatusReport> {
  const start = Date.now();
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const authDomain = firebaseConfig.authDomain;

  try {
    // Attempt fetching a ping document from Firestore server directly
    await getDocFromServer(doc(db, 'test', 'ping'));
    const latency = Date.now() - start;
    return {
      connected: true,
      projectId,
      databaseId,
      authDomain,
      latencyMs: latency,
      message: `Connected successfully (${latency}ms)`,
    };
  } catch (error: any) {
    const latency = Date.now() - start;
    // Note: permission-denied from rules means the Firestore server was reached and responded!
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      return {
        connected: true,
        projectId,
        databaseId,
        authDomain,
        latencyMs: latency,
        message: `Connected and secured by rules (${latency}ms)`,
      };
    }
    if (error?.message?.includes('client is offline')) {
      return {
        connected: false,
        projectId,
        databaseId,
        authDomain,
        latencyMs: latency,
        message: 'Client appears offline',
      };
    }
    return {
      connected: true,
      projectId,
      databaseId,
      authDomain,
      latencyMs: latency,
      message: `Firebase active (${latency}ms)`,
    };
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await checkFirebaseStatus();
    console.log('[Firebase] Cloud Firestore status verified.');
    return true;
  } catch (error) {
    return false;
  }
}

// Run connection test non-blockingly
testFirestoreConnection().catch(() => {});

// Canonical sanitized document key for email address to guarantee 1 email = 1 account
export function getCanonicalEmailKey(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Helper to get safe document key for user ID - always canonicalized by email for 1 email = 1 account
export function getFirebaseUserKey(user: FirebaseUser | null, emailFallback?: string): string {
  const email = emailFallback || user?.email;
  if (email && email.includes('@')) {
    return getCanonicalEmailKey(email);
  }
  if (user?.uid) return user.uid;
  return 'anonymous';
}

// Sign in with email and password via Firebase Auth
export async function signInWithEmailFirebase(email: string, password: string): Promise<FirebaseUser> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  } catch (err: any) {
    // If account doesn't exist yet in Firebase Auth, attempt creation seamlessly
    if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/user-not-found') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        return newCred.user;
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          // Re-throw original credential error if password was wrong
          throw err;
        }
        throw createErr;
      }
    }
    throw err;
  }
}

// Register with email and password via Firebase Auth
export async function signUpWithEmailFirebase(email: string, password: string): Promise<FirebaseUser> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      const existingCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      return existingCred.user;
    }
    throw err;
  }
}

// Save User Profile to Cloud Firestore (Guarantees exactly 1 single document per email)
export async function saveProfileToFirestore(profile: UserProfile, explicitUserId?: string): Promise<boolean> {
  if (!profile || !profile.email) return false;
  
  const cleanEmail = profile.email.toLowerCase().trim();
  const currentUser = auth.currentUser;
  // Avoid writing to another user's document if currently authenticated as a different account
  if (currentUser?.email && cleanEmail && currentUser.email.toLowerCase().trim() !== cleanEmail) {
    return false;
  }

  const canonicalEmailKey = getCanonicalEmailKey(cleanEmail);
  const userId = canonicalEmailKey;
  const path = `users/${userId}`;

  try {
    const userDocRef = doc(db, 'users', userId);
    const currentLang = profile.targetLanguage || 'he';
    const currentLangSnapshot = {
      targetLanguage: currentLang,
      level: profile.level || 'A1',
      numericLevel: profile.numericLevel || 1,
      maxUnlockedNumericLevel: profile.maxUnlockedNumericLevel || 1,
      levelVerified: Boolean(profile.levelVerified),
      words: profile.words || {},
      journeyProgress: profile.journeyProgress || {},
      passedExams: profile.passedExams || {},
      reviewHierarchies: profile.reviewHierarchies || {},
      tokenMistakeCounts: profile.tokenMistakeCounts || {},
      totalSessionsCompleted: profile.totalSessionsCompleted || 0,
      updatedAt: Date.now(),
    };

    const updatedLanguages = {
      ...(profile.languages || {}),
      [currentLang]: currentLangSnapshot,
    };

    const profilePayload: Record<string, any> = {
      ...profile,
      languages: updatedLanguages,
      userId,
      email: cleanEmail,
      ownerEmail: cleanEmail,
      createdAt: profile.createdAt || Date.now(),
      updatedAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    await setDoc(userDocRef, sanitizeForFirestore(profilePayload), { merge: true });

    // Also maintain email index for lookup
    try {
      await setDoc(doc(db, 'emailIndex', canonicalEmailKey), sanitizeForFirestore({
        uid: userId,
        canonicalId: canonicalEmailKey,
        email: cleanEmail,
        updatedAt: Date.now(),
      }), { merge: true });
    } catch (e) {
      // Non-fatal
    }

    // Update public directory for friends and leaderboard (1 single profile per email)
    const effectiveStreak = calculateCurrentStreak(profile);
    const weeklyWords = calculateWeeklyNewWordsCount(profile.words, new Date(), profile.targetLanguage);
    const wordsCount = calculateTotalKnownWords(profile);

    const publicPayload: Record<string, any> = {
      userId,
      ownerEmail: cleanEmail,
      email: cleanEmail,
      name: profile.name || cleanEmail.split('@')[0],
      username: profile.username || cleanEmail.split('@')[0],
      avatarUrl: profile.avatarUrl || '',
      targetLanguage: profile.targetLanguage || 'he',
      knownLanguage: profile.knownLanguage || 'en',
      level: profile.level || 'A1',
      numericLevel: profile.numericLevel || 1,
      currentStreak: effectiveStreak,
      streakDays: effectiveStreak,
      maxStreakDays: Math.max(profile.maxStreakDays || 0, profile.streakDays || 0, effectiveStreak),
      weeklyNewWordsCount: weeklyWords,
      weeklyWords: getWeeklyLearnedWordsList(profile.words, new Date(), profile.targetLanguage),
      totalWordsLearned: wordsCount,
      totalSessionsCompleted: profile.totalSessionsCompleted || 0,
      lastActiveDateStr: profile.lastActiveDateStr || '',
      updatedAt: Date.now(),
    };

    // Only update following/followers if explicitly populated, NEVER overwrite with empty array []
    if (Array.isArray(profile.following) && profile.following.length > 0) {
      publicPayload.following = profile.following;
    }
    if (Array.isArray(profile.followers) && profile.followers.length > 0) {
      publicPayload.followers = profile.followers;
    }

    const publicDocRef = doc(db, 'publicProfiles', userId);
    await setDoc(publicDocRef, sanitizeForFirestore(publicPayload), { merge: true });

    // Clean up any legacy publicProfile document keyed by raw auth.currentUser.uid to eliminate duplicates
    if (currentUser?.uid && currentUser.uid !== userId) {
      try {
        await deleteDoc(doc(db, 'publicProfiles', currentUser.uid));
      } catch (delErr) {
        // Non-fatal
      }
    }

    // If admin, record admin role doc
    if (profile.isAdmin || cleanEmail === 'irithfuks@gmail.com') {
      try {
        await setDoc(doc(db, 'admins', userId), sanitizeForFirestore({
          email: cleanEmail,
          grantedAt: Date.now(),
        }), { merge: true });
        if (currentUser?.uid) {
          await setDoc(doc(db, 'admins', currentUser.uid), sanitizeForFirestore({
            email: cleanEmail,
            grantedAt: Date.now(),
          }), { merge: true });
        }
      } catch (adminErr) {
        // Non-fatal
      }
    }

    console.log(`[Firestore] Successfully saved unified profile to users/${userId} (${Object.keys(profile.words || {}).length} words)`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

// Fetch User Profile from Cloud Firestore
export async function loadProfileFromFirestore(userIdOrEmail: string): Promise<UserProfile | null> {
  if (!userIdOrEmail) return null;

  const isEmail = userIdOrEmail.includes('@');
  const primaryKey = isEmail 
    ? getCanonicalEmailKey(userIdOrEmail) 
    : userIdOrEmail;

  const path = `users/${primaryKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', primaryKey));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    
    // Fallback 1: check emailIndex if it was an email
    if (isEmail) {
      try {
        const emailSnap = await getDoc(doc(db, 'emailIndex', primaryKey));
        if (emailSnap.exists() && emailSnap.data()?.uid) {
          const candidateUid = emailSnap.data().uid;
          const candidateSnap = await getDoc(doc(db, 'users', candidateUid));
          if (candidateSnap.exists()) {
            return candidateSnap.data() as UserProfile;
          }
        }
      } catch {}
    }

    // Fallback 2: if currentUser has a raw UID
    if (auth.currentUser?.uid && auth.currentUser.uid !== primaryKey) {
      try {
        const currentSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (currentSnap.exists()) {
          return currentSnap.data() as UserProfile;
        }
      } catch {}
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// Save In-Progress Session to Cloud Firestore (tied to canonical email)
export async function saveSessionToFirestore(
  userIdOrEmail: string, 
  sessionType: 'daily' | 'rusty', 
  sessionState: SavedSessionState
): Promise<boolean> {
  const cleanEmail = (userIdOrEmail.includes('@') ? userIdOrEmail : auth.currentUser?.email) || '';
  const userId = cleanEmail ? getCanonicalEmailKey(cleanEmail) : (auth.currentUser?.uid || userIdOrEmail);
  if (!userId) return false;
  const sessionId = `${sessionType}_active`;
  const path = `users/${userId}/sessions/${sessionId}`;
  try {
    const sessionDocRef = doc(db, 'users', userId, 'sessions', sessionId);
    await setDoc(sessionDocRef, sanitizeForFirestore({
      ...sessionState,
      sessionId,
      sessionType,
      email: cleanEmail,
      ownerEmail: cleanEmail,
      savedAt: Date.now(),
    }));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

// Clear Saved In-Progress Session from Cloud Firestore
export async function clearSessionInFirestore(
  userIdOrEmail: string, 
  sessionType: 'daily' | 'rusty'
): Promise<boolean> {
  const cleanEmail = (userIdOrEmail.includes('@') ? userIdOrEmail : auth.currentUser?.email) || '';
  const userId = cleanEmail ? getCanonicalEmailKey(cleanEmail) : (auth.currentUser?.uid || userIdOrEmail);
  if (!userId) return false;
  const sessionId = `${sessionType}_active`;
  const path = `users/${userId}/sessions/${sessionId}`;
  try {
    const sessionDocRef = doc(db, 'users', userId, 'sessions', sessionId);
    await deleteDoc(sessionDocRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

// Google Sign-In with popup via Firebase Auth
export async function signInWithGoogleFirebase() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      user: result.user,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
  } catch (error: any) {
    console.error('Firebase Google Sign-In note:', error);
    // If account was already registered with email/password, Firebase Auth identifies the email
    if (error?.code === 'auth/account-exists-with-different-credential' && error?.customData?.email) {
      return {
        user: auth.currentUser,
        email: error.customData.email as string,
        displayName: (error?.customData?.displayName as string) || undefined,
        photoURL: (error?.customData?.photoURL as string) || undefined,
      };
    }
    throw error;
  }
}

// Sign Out via Firebase Auth
export async function signOutFirebase() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Firebase Sign-Out error:', error);
  }
}

// Fetch uploaded words from milim-af691 Firestore collections
export async function fetchUploadedWordsFromFirestore(
  possibleCollectionNames = ['words', 'vocabulary', 'milim', 'hebrew_words', 'dictionary']
): Promise<{ words: WordItem[]; collectionUsed: string } | null> {
  for (const colName of possibleCollectionNames) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty && snap.docs.length > 0) {
        const words: WordItem[] = snap.docs.map((docSnap, index) => {
          const d = docSnap.data() as any;
          const target = d.targetWord || d.target || d.word || d.hebrew || d.term || d.lemma || '';
          const trans = d.translation || d.meaning || d.dutch || d.english || d.vertaling || '';
          const level = (d.level || d.cefr || 'A1').toUpperCase() as any;
          const numericLevel = typeof d.numericLevel === 'number' ? d.numericLevel : (parseInt(d.levelNumber, 10) || 1);

          return {
            id: docSnap.id || `cloud-${colName}-${index}`,
            targetWord: target,
            translation: trans,
            alternativeTranslations: Array.isArray(d.alternativeTranslations) ? d.alternativeTranslations : (d.synonyms ? [d.synonyms] : []),
            transliteration: d.transliteration || d.phonetic || d.pronunciation || '',
            partOfSpeech: d.partOfSpeech || d.pos || '',
            exampleTarget: d.exampleTarget || d.exampleHebrew || d.sentenceTarget || d.example || '',
            exampleTranslation: d.exampleTranslation || d.exampleDutch || d.sentenceTranslation || '',
            level: (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level) ? level : 'A1'),
            numericLevel: Math.max(1, Math.min(60, numericLevel)),
            languagePairKey: d.languagePairKey || 'he-en',
            category: d.category || 'blue',
          };
        }).filter(w => Boolean(w.targetWord));

        if (words.length > 0) {
          console.log(`[milim-af691] Successfully loaded ${words.length} words from collection '${colName}'`);
          return { words, collectionUsed: colName };
        }
      }
    } catch (err) {
      // Try next collection name
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Translation Overrides ("I was correct" feedback tracking in Firebase & Server)
// ---------------------------------------------------------------------------

export function getSafeOverrideDocId(targetLanguage: string, targetWord: string): string {
  const cleanWord = (targetWord || '')
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew niqqud
    .trim()
    .toLowerCase()
    .replace(/[\s/\\#%?&]+/g, '_')
    .slice(0, 80);
  return `${targetLanguage || 'word'}_${cleanWord || 'unknown'}`;
}

export async function recordTranslationOverride(params: {
  targetWord: string;
  cleanTargetWord?: string;
  targetLanguage: string;
  knownLanguage?: string;
  expectedTranslation: string;
  alternativeTranslations?: string[];
  userTyped: string;
  level?: string;
  sessionType?: string;
  userEmail?: string;
  transliteration?: string;
  direction?: string;
}): Promise<boolean> {
  const targetWord = (params.targetWord || '').trim();
  const userTyped = (params.userTyped || '').trim();
  const targetLanguage = (params.targetLanguage || 'he').toLowerCase().trim();
  const knownLanguage = (params.knownLanguage || 'en').toLowerCase().trim();
  const expectedTranslation = (params.expectedTranslation || '').trim();

  if (!targetWord || !expectedTranslation) {
    return false;
  }

  const cleanTargetWord = params.cleanTargetWord || stripDiacriticsAndVowels(targetWord).trim().toLowerCase();
  const docId = getSafeOverrideDocId(targetLanguage, targetWord);
  const now = Date.now();

  const submissionLog: OverrideSubmissionLog = {
    timestamp: now,
    userEmail: params.userEmail || auth.currentUser?.email || undefined,
    userTyped: userTyped || '(empty)',
    sessionType: params.sessionType || 'quiz',
    level: params.level || 'A1',
    direction: params.direction || 'target_to_known',
  };

  // 1. Direct Firestore write if authenticated
  let firestoreSuccess = false;
  if (auth.currentUser) {
    const overrideDocRef = doc(db, 'translationOverrides', docId);
    try {
      const snap = await getDoc(overrideDocRef);
      if (snap.exists()) {
        const data = snap.data() as TranslationOverrideRecord;
        const currentCount = (data.overrideCount || 0) + 1;
        const existingAnswers: TypedAnswerStat[] = Array.isArray(data.typedAnswers) ? [...data.typedAnswers] : [];
        
        if (userTyped) {
          const matchIdx = existingAnswers.findIndex(a => a.text.toLowerCase() === userTyped.toLowerCase());
          if (matchIdx >= 0) {
            existingAnswers[matchIdx].count += 1;
            existingAnswers[matchIdx].lastUsedAt = now;
          } else {
            existingAnswers.push({ text: userTyped, count: 1, lastUsedAt: now });
          }
        }

        const existingLogs = Array.isArray(data.recentLogs) ? data.recentLogs.slice(0, 49) : [];
        existingLogs.unshift(submissionLog);

        const currentAlts = Array.from(new Set([
          ...(data.currentAlternatives || []),
          ...(params.alternativeTranslations || [])
        ]));

        await setDoc(overrideDocRef, sanitizeForFirestore({
          ...data,
          targetWord,
          cleanTargetWord,
          targetLanguage,
          knownLanguage,
          expectedTranslation,
          currentAlternatives: currentAlts,
          overrideCount: currentCount,
          lastReportedAt: now,
          typedAnswers: existingAnswers,
          recentLogs: existingLogs,
          level: params.level || data.level || 'A1',
          transliteration: params.transliteration || data.transliteration || '',
        }), { merge: true });
      } else {
        const initialAnswers: TypedAnswerStat[] = userTyped ? [{ text: userTyped, count: 1, lastUsedAt: now }] : [];
        const newRecord: TranslationOverrideRecord = {
          id: docId,
          targetWord,
          cleanTargetWord,
          targetLanguage,
          knownLanguage,
          expectedTranslation,
          currentAlternatives: params.alternativeTranslations || [],
          overrideCount: 1,
          status: 'pending',
          firstReportedAt: now,
          lastReportedAt: now,
          typedAnswers: initialAnswers,
          recentLogs: [submissionLog],
          level: params.level || 'A1',
          transliteration: params.transliteration || '',
        };
        await setDoc(overrideDocRef, sanitizeForFirestore(newRecord));
      }
      firestoreSuccess = true;
    } catch (err) {
      console.warn('Firestore translationOverrides write note:', err);
    }
  }

  // 2. Parallel / Fallback write to server backend
  try {
    const payload = {
      id: docId,
      targetWord,
      cleanTargetWord,
      targetLanguage,
      knownLanguage,
      expectedTranslation,
      alternativeTranslations: params.alternativeTranslations || [],
      userTyped,
      level: params.level,
      sessionType: params.sessionType,
      userEmail: params.userEmail || auth.currentUser?.email,
      transliteration: params.transliteration,
      direction: params.direction,
      timestamp: now,
    };
    await fetch('/api/translation-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (serverErr) {
    console.warn('Server translation-override write error:', serverErr);
  }

  return firestoreSuccess;
}

export async function fetchTranslationOverridesFromFirestore(): Promise<TranslationOverrideRecord[]> {
  // If Firestore is accessible, try fetching directly
  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, 'translationOverrides'));
      if (!snap.empty) {
        const list: TranslationOverrideRecord[] = snap.docs.map(docSnap => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            targetWord: d.targetWord || '',
            cleanTargetWord: d.cleanTargetWord || '',
            targetLanguage: d.targetLanguage || 'he',
            knownLanguage: d.knownLanguage || 'en',
            expectedTranslation: d.expectedTranslation || '',
            currentAlternatives: Array.isArray(d.currentAlternatives) ? d.currentAlternatives : [],
            overrideCount: typeof d.overrideCount === 'number' ? d.overrideCount : 1,
            status: (['pending', 'resolved', 'dismissed'].includes(d.status) ? d.status : 'pending'),
            resolvedTranslation: d.resolvedTranslation || undefined,
            resolvedAt: d.resolvedAt || undefined,
            resolvedBy: d.resolvedBy || undefined,
            firstReportedAt: d.firstReportedAt || Date.now(),
            lastReportedAt: d.lastReportedAt || Date.now(),
            typedAnswers: Array.isArray(d.typedAnswers) ? d.typedAnswers : [],
            recentLogs: Array.isArray(d.recentLogs) ? d.recentLogs : [],
            level: d.level || 'A1',
            transliteration: d.transliteration || '',
          };
        });
        return list;
      }
    } catch (e) {
      console.warn('Firestore fetchTranslationOverrides note, falling back to server API:', e);
    }
  }

  // Fallback to Server API
  try {
    const res = await fetch('/api/admin/translation-overrides');
    const data = await res.json();
    if (data.success && Array.isArray(data.overrides)) {
      return data.overrides;
    }
  } catch (err) {
    console.error('Failed to load translation overrides from API:', err);
  }

  return [];
}

export async function resolveTranslationOverride(params: {
  overrideId: string;
  action: 'add_translation' | 'mark_resolved' | 'dismiss' | 'reopen' | 'delete';
  addedTranslation?: string;
  adminEmail?: string;
}): Promise<boolean> {
  const { overrideId, action, addedTranslation, adminEmail } = params;
  if (!overrideId) return false;

  const now = Date.now();

  // 1. Update Firestore if accessible
  if (auth.currentUser) {
    const overrideDocRef = doc(db, 'translationOverrides', overrideId);
    try {
      if (action === 'delete') {
        await deleteDoc(overrideDocRef);
      } else {
        const snap = await getDoc(overrideDocRef);
        if (snap.exists()) {
          const currentData = snap.data() as TranslationOverrideRecord;
          const currentAlts = [...(currentData.currentAlternatives || [])];
          if (action === 'add_translation' && addedTranslation) {
            const cleanAdd = addedTranslation.trim().toLowerCase();
            if (!currentAlts.some(a => a.toLowerCase() === cleanAdd)) {
              currentAlts.push(addedTranslation.trim());
            }
          }

          const status = action === 'dismiss' ? 'dismissed' : action === 'reopen' ? 'pending' : 'resolved';

          await setDoc(overrideDocRef, sanitizeForFirestore({
            ...currentData,
            status,
            currentAlternatives: currentAlts,
            resolvedTranslation: action === 'add_translation' ? addedTranslation : currentData.resolvedTranslation,
            resolvedAt: status === 'resolved' ? now : null,
            resolvedBy: status === 'resolved' ? (adminEmail || auth.currentUser?.email || 'Admin') : null,
          }), { merge: true });
        }
      }
    } catch (err) {
      console.warn('Firestore resolveTranslationOverride note:', err);
    }
  }

  // 2. Synchronize with Server API
  try {
    const res = await fetch('/api/admin/translation-overrides/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrideId,
        action,
        addedTranslation,
        adminEmail: adminEmail || auth.currentUser?.email || 'irithfuks@gmail.com',
      }),
    });
    const result = await res.json();
    return Boolean(result.success);
  } catch (err) {
    console.error('Server resolve translation override error:', err);
    return false;
  }
}

export function normalizeIdentifierToEmail(id: string): string {
  if (!id) return '';
  const clean = String(id).toLowerCase().trim();
  if (clean.includes('@')) return clean;
  // If canonical key like 'irithfotos1_gmail_com', convert trailing '_domain_tld' to '@domain.tld'
  const converted = clean.replace(/_([a-zA-Z0-9-]+)_([a-zA-Z]{2,10})$/, '@$1.$2');
  if (converted.includes('@')) return converted;
  return clean;
}

// Search publicProfiles directly from Cloud Firestore (falls back or combines with server)
export async function searchPublicProfilesFirestore(query: string, currentEmail?: string): Promise<PublicUserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'publicProfiles'));
    if (snap.empty) return [];
    
    const cleanQ = (query || '').toLowerCase().trim().replace(/^@/, '');
    const cleanCurrent = (currentEmail || '').toLowerCase().trim();
    const cleanCurrentKey = cleanCurrent ? getCanonicalEmailKey(cleanCurrent) : '';

    const results: PublicUserProfile[] = [];
    snap.docs.forEach(d => {
      const data = d.data() as any;
      const rawEmail = data.email || data.ownerEmail || normalizeIdentifierToEmail(d.id);
      const email = (rawEmail || '').toLowerCase().trim();
      if (!email || (cleanCurrent && email === cleanCurrent)) return;

      const username = (data.username || '').toLowerCase();
      const name = (data.name || '').toLowerCase();

      if (!cleanQ || username.includes(cleanQ) || name.includes(cleanQ) || email.includes(cleanQ)) {
        const rawFollowing = Array.isArray(data.following) ? data.following : [];
        const rawFollowers = Array.isArray(data.followers) ? data.followers : [];

        const followingList: string[] = Array.from(new Set<string>(rawFollowing.map((e: string) => normalizeIdentifierToEmail(String(e)))));
        const followersList: string[] = Array.from(new Set<string>(rawFollowers.map((e: string) => normalizeIdentifierToEmail(String(e)))));
        const rawStreak = data.currentStreak !== undefined ? data.currentStreak : (data.streakDays || 0);
        const streakVal = calculateCurrentStreak({
          lastActiveDateStr: data.lastActiveDateStr,
          lastActiveAt: data.lastActiveAt || data.updatedAt,
          totalSessionsCompleted: data.totalSessionsCompleted,
          sessionHistory: data.sessionHistory,
          streakDays: rawStreak,
          currentStreak: rawStreak,
        });
        const weeklyWordsVal = getEffectiveWeeklyNewWordsCount(data);

        const rawFollowersSet = new Set(rawFollowers.map((e: string) => String(e).toLowerCase().trim()));
        const rawFollowingSet = new Set(rawFollowing.map((e: string) => String(e).toLowerCase().trim()));

        const isFollowedByMe = cleanCurrent ? (
          rawFollowersSet.has(cleanCurrent) ||
          (cleanCurrentKey ? rawFollowersSet.has(cleanCurrentKey) : false) ||
          followersList.includes(cleanCurrent)
        ) : false;

        const isFollowingMe = cleanCurrent ? (
          rawFollowingSet.has(cleanCurrent) ||
          (cleanCurrentKey ? rawFollowingSet.has(cleanCurrentKey) : false) ||
          followingList.includes(cleanCurrent)
        ) : false;

        results.push({
          email: email,
          username: data.username || email.split('@')[0],
          name: data.name || email.split('@')[0],
          avatarUrl: data.avatarUrl || '',
          targetLanguage: data.targetLanguage || 'he',
          knownLanguage: data.knownLanguage || 'en',
          level: data.level || 'A1',
          numericLevel: data.numericLevel || 1,
          currentStreak: streakVal,
          streakDays: streakVal,
          maxStreakDays: data.maxStreakDays || rawStreak || streakVal,
          lastActiveDateStr: data.lastActiveDateStr,
          totalWordsLearned: data.totalWordsLearned || 0,
          totalSessionsCompleted: data.totalSessionsCompleted || 0,
          weeklyNewWordsCount: weeklyWordsVal,
          weeklyWords: data.weeklyWords || [],
          following: followingList,
          followers: followersList,
          isFollowing: isFollowedByMe,
          isFollower: isFollowingMe,
        });
      }
    });

    return results;
  } catch (err) {
    console.warn('Error querying Firestore publicProfiles:', err);
    return [];
  }
}

// Fetch public user profiles for a list of emails or identifiers directly from Firestore
export async function fetchConnectionsFromFirestore(
  identifiers: string[],
  currentEmail?: string
): Promise<PublicUserProfile[]> {
  if (!identifiers || identifiers.length === 0) return [];
  const cEmail = (currentEmail || '').toLowerCase().trim();
  const cEmailKey = cEmail ? getCanonicalEmailKey(cEmail) : '';

  const cleanIdentifiers = Array.from(
    new Set(
      identifiers
        .map(id => (id || '').trim())
        .filter(Boolean)
    )
  );

  const profiles: PublicUserProfile[] = [];
  const seenEmails = new Set<string>();

  await Promise.all(
    cleanIdentifiers.map(async (rawId) => {
      const email = normalizeIdentifierToEmail(rawId).toLowerCase().trim();
      const docKey = email.includes('@') ? getCanonicalEmailKey(email) : rawId;
      if (!docKey) return;

      try {
        const snap = await getDoc(doc(db, 'publicProfiles', docKey));
        if (snap.exists()) {
          const d = snap.data() as any;
          const userEmail = (d.email || d.ownerEmail || email).toLowerCase().trim();
          if (!userEmail || seenEmails.has(userEmail)) return;
          seenEmails.add(userEmail);

          const rawStreak = d.currentStreak !== undefined ? d.currentStreak : (d.streakDays || 0);
          const streakVal = calculateCurrentStreak({
            lastActiveDateStr: d.lastActiveDateStr,
            lastActiveAt: d.lastActiveAt || d.updatedAt,
            totalSessionsCompleted: d.totalSessionsCompleted,
            sessionHistory: d.sessionHistory,
            streakDays: rawStreak,
            currentStreak: rawStreak,
          });
          const weeklyWordsVal = getEffectiveWeeklyNewWordsCount(d);
          const rawFollowing = Array.isArray(d.following) ? d.following : [];
          const rawFollowers = Array.isArray(d.followers) ? d.followers : [];

          const rawFollowersSet = new Set(rawFollowers.map((e: string) => String(e).toLowerCase().trim()));
          const rawFollowingSet = new Set(rawFollowing.map((e: string) => String(e).toLowerCase().trim()));

          profiles.push({
            email: userEmail,
            name: d.name || userEmail.split('@')[0],
            username: d.username || userEmail.split('@')[0],
            avatarUrl: d.avatarUrl || '',
            targetLanguage: d.targetLanguage || 'he',
            knownLanguage: d.knownLanguage || 'en',
            level: d.level || 'A1',
            numericLevel: d.numericLevel || 1,
            currentStreak: streakVal,
            streakDays: streakVal,
            maxStreakDays: d.maxStreakDays || rawStreak || streakVal,
            lastActiveDateStr: d.lastActiveDateStr,
            totalWordsLearned: d.totalWordsLearned || 0,
            totalSessionsCompleted: d.totalSessionsCompleted || 0,
            weeklyNewWordsCount: weeklyWordsVal,
            weeklyWords: d.weeklyWords || [],
            following: rawFollowing.map((e: string) => normalizeIdentifierToEmail(String(e))),
            followers: rawFollowers.map((e: string) => normalizeIdentifierToEmail(String(e))),
            isFollowing: cEmail ? (
              rawFollowersSet.has(cEmail) ||
              (cEmailKey ? rawFollowersSet.has(cEmailKey) : false)
            ) : false,
            isFollower: cEmail ? (
              rawFollowingSet.has(cEmail) ||
              (cEmailKey ? rawFollowingSet.has(cEmailKey) : false)
            ) : false,
          });
        }
      } catch (err) {
        // non-fatal
      }
    })
  );

  return profiles;
}

// Fetch single public profile from Cloud Firestore (including resolved public followers & following)
export async function getPublicProfileFirestore(targetEmail: string, currentEmail?: string): Promise<PublicUserProfile | null> {
  const tEmail = targetEmail.toLowerCase().trim();
  const cEmail = (currentEmail || '').toLowerCase().trim();
  if (!tEmail) return null;

  try {
    const docId = getCanonicalEmailKey(tEmail);
    const docRef = doc(db, 'publicProfiles', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data() as any;
    const rawFollowing = Array.isArray(data.following) ? data.following : [];
    const rawFollowers = Array.isArray(data.followers) ? data.followers : [];

    const followingList: string[] = Array.from(new Set<string>(rawFollowing.map((e: string) => normalizeIdentifierToEmail(String(e)))));
    const followersList: string[] = Array.from(new Set<string>(rawFollowers.map((e: string) => normalizeIdentifierToEmail(String(e)))));
    const rawStreak = data.currentStreak !== undefined ? data.currentStreak : (data.streakDays || 0);
    const streakVal = calculateCurrentStreak({
      lastActiveDateStr: data.lastActiveDateStr,
      lastActiveAt: data.lastActiveAt || data.updatedAt,
      totalSessionsCompleted: data.totalSessionsCompleted,
      sessionHistory: data.sessionHistory,
      streakDays: rawStreak,
      currentStreak: rawStreak,
    });
    const weeklyWordsVal = getEffectiveWeeklyNewWordsCount(data);

    const cEmailKey = cEmail ? getCanonicalEmailKey(cEmail) : '';
    const rawFollowersSet = new Set(rawFollowers.map((e: string) => String(e).toLowerCase().trim()));
    const rawFollowingSet = new Set(rawFollowing.map((e: string) => String(e).toLowerCase().trim()));

    // Concurrently load public profiles for who they follow and who follows them
    const [followingUsers, followersUsers] = await Promise.all([
      fetchConnectionsFromFirestore(rawFollowing, currentEmail),
      fetchConnectionsFromFirestore(rawFollowers, currentEmail),
    ]);

    return {
      email: data.email || tEmail,
      name: data.name || tEmail.split('@')[0],
      username: data.username || tEmail.split('@')[0],
      avatarUrl: data.avatarUrl || '',
      targetLanguage: data.targetLanguage || 'he',
      knownLanguage: data.knownLanguage || 'en',
      level: data.level || 'A1',
      numericLevel: data.numericLevel || 1,
      currentStreak: streakVal,
      streakDays: streakVal,
      maxStreakDays: data.maxStreakDays || rawStreak || streakVal,
      lastActiveDateStr: data.lastActiveDateStr,
      totalWordsLearned: data.totalWordsLearned || 0,
      totalSessionsCompleted: data.totalSessionsCompleted || 0,
      weeklyNewWordsCount: weeklyWordsVal,
      weeklyWords: data.weeklyWords || [],
      following: followingList,
      followers: followersList,
      followingUsers,
      followersUsers,
      past7DaysHistory: data.past7DaysHistory || undefined,
      weeklyHistory: data.past7DaysHistory || data.weeklyHistory || undefined,
      cumulativeHistory: data.cumulativeHistory || undefined,
      isFollowing: cEmail ? (
        rawFollowersSet.has(cEmail) ||
        (cEmailKey ? rawFollowersSet.has(cEmailKey) : false) ||
        followersList.includes(cEmail)
      ) : false,
      isFollower: cEmail ? (
        rawFollowingSet.has(cEmail) ||
        (cEmailKey ? rawFollowingSet.has(cEmailKey) : false) ||
        followingList.includes(cEmail)
      ) : false,
    };
  } catch (err) {
    console.warn('Error fetching Firestore public profile:', err);
    return null;
  }
}

// Write/Sync user daily streak and stats into /publicProfiles/{userId} document
export async function syncPublicProfileStreakFirestore(
  email: string,
  newStreak: number,
  additionalData?: Partial<UserProfile>
): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return false;
  const userId = getCanonicalEmailKey(cleanEmail);

  try {
    const publicDocRef = doc(db, 'publicProfiles', userId);
    const updatePayload: Record<string, any> = {
      userId,
      email: cleanEmail,
      ownerEmail: cleanEmail,
      currentStreak: newStreak,
      streakDays: newStreak,
      maxStreakDays: additionalData?.maxStreakDays !== undefined
        ? Math.max(additionalData.maxStreakDays, newStreak)
        : newStreak,
      lastActiveDateStr: additionalData?.lastActiveDateStr || '',
      updatedAt: Date.now(),
    };

    if (additionalData?.name) updatePayload.name = additionalData.name;
    if (additionalData?.username) updatePayload.username = additionalData.username;
    if (additionalData?.targetLanguage) updatePayload.targetLanguage = additionalData.targetLanguage;
    if (additionalData?.knownLanguage) updatePayload.knownLanguage = additionalData.knownLanguage;
    if (additionalData?.level) updatePayload.level = additionalData.level;
    if (additionalData?.numericLevel) updatePayload.numericLevel = additionalData.numericLevel;
    if (additionalData?.words) {
      updatePayload.totalWordsLearned = Object.keys(additionalData.words).length;
      updatePayload.weeklyNewWordsCount = calculateWeeklyNewWordsCount(
        additionalData.words,
        new Date(),
        additionalData.targetLanguage
      );
      updatePayload.weeklyWords = getWeeklyLearnedWordsList(
        additionalData.words,
        new Date(),
        additionalData.targetLanguage
      );
      updatePayload.past7DaysHistory = calculatePast7DaysWordStats(additionalData.words);
      updatePayload.cumulativeHistory = calculateCumulativeWordStats(additionalData.words, additionalData.createdAt);
    }
    if (additionalData?.totalSessionsCompleted !== undefined) {
      updatePayload.totalSessionsCompleted = additionalData.totalSessionsCompleted;
    }
    if (additionalData?.following && Array.isArray(additionalData.following) && additionalData.following.length > 0) {
      updatePayload.following = additionalData.following;
    }
    if (additionalData?.followers && Array.isArray(additionalData.followers) && additionalData.followers.length > 0) {
      updatePayload.followers = additionalData.followers;
    }

    await setDoc(publicDocRef, sanitizeForFirestore(updatePayload), { merge: true });
    return true;
  } catch (err) {
    console.warn('syncPublicProfileStreakFirestore note:', err);
    return false;
  }
}

/**
 * 1. Mutual Follow / Unfollow using an atomic Firestore WriteBatch.
 * When User A follows User B:
 *   - B's userId is added to A's `following` array using arrayUnion.
 *   - A's userId is added to B's `followers` array using arrayUnion.
 * When User A unfollows User B:
 *   - B's userId is removed from A's `following` array using arrayRemove.
 *   - A's userId is removed from B's `followers` array using arrayRemove.
 * Both operations succeed or fail together atomically in a single batch write.
 */
export async function followUserInFirestore(
  currentEmailOrId: string,
  targetEmailOrId: string,
  follow: boolean
): Promise<boolean> {
  const currentEmail = currentEmailOrId.includes('@') ? currentEmailOrId.toLowerCase().trim() : normalizeIdentifierToEmail(currentEmailOrId);
  const targetEmail = targetEmailOrId.includes('@') ? targetEmailOrId.toLowerCase().trim() : normalizeIdentifierToEmail(targetEmailOrId);
  const currentKey = currentEmail ? getCanonicalEmailKey(currentEmail) : currentEmailOrId.trim();
  const targetKey = targetEmail ? getCanonicalEmailKey(targetEmail) : targetEmailOrId.trim();

  if (!currentKey || !targetKey || currentKey === targetKey) {
    console.warn('followUserInFirestore: Invalid user IDs', { currentKey, targetKey });
    return false;
  }

  const currentIdentifiers = Array.from(new Set([currentEmail, currentKey].filter(Boolean)));
  const targetIdentifiers = Array.from(new Set([targetEmail, targetKey].filter(Boolean)));

  try {
    const batch = writeBatch(db);
    const currentRef = doc(db, 'publicProfiles', currentKey);
    const targetRef = doc(db, 'publicProfiles', targetKey);

    if (follow) {
      // 1. Add Target to Current User's following list (include both email and key)
      batch.set(currentRef, {
        userId: currentKey,
        following: arrayUnion(...targetIdentifiers),
        updatedAt: Date.now(),
      }, { merge: true });

      // 2. Add Current User to Target's followers list (include both email and key)
      batch.set(targetRef, {
        userId: targetKey,
        followers: arrayUnion(...currentIdentifiers),
        updatedAt: Date.now(),
      }, { merge: true });
    } else {
      // 1. Remove Target from Current User's following list (remove both email and key)
      batch.set(currentRef, {
        userId: currentKey,
        following: arrayRemove(...targetIdentifiers),
        updatedAt: Date.now(),
      }, { merge: true });

      // 2. Remove Current User from Target's followers list (remove both email and key)
      batch.set(targetRef, {
        userId: targetKey,
        followers: arrayRemove(...currentIdentifiers),
        updatedAt: Date.now(),
      }, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error('followUserInFirestore batch commit error:', err);
    return false;
  }
}

/**
 * Alternative implementation using Firestore `runTransaction` for mutual follow/unfollow.
 * Useful if you need to read both documents first (e.g. to enforce maximum limits or verify existence).
 */
export async function followUserWithTransaction(
  currentEmailOrId: string,
  targetEmailOrId: string,
  follow: boolean
): Promise<boolean> {
  const currentKey = currentEmailOrId.includes('@') ? getCanonicalEmailKey(currentEmailOrId) : currentEmailOrId.trim();
  const targetKey = targetEmailOrId.includes('@') ? getCanonicalEmailKey(targetEmailOrId) : targetEmailOrId.trim();

  if (!currentKey || !targetKey || currentKey === targetKey) return false;

  try {
    await runTransaction(db, async (transaction) => {
      const currentRef = doc(db, 'publicProfiles', currentKey);
      const targetRef = doc(db, 'publicProfiles', targetKey);

      // Read both documents in transaction
      const currentSnap = await transaction.get(currentRef);
      const targetSnap = await transaction.get(targetRef);

      const currentData = currentSnap.exists() ? currentSnap.data() : { userId: currentKey };
      const targetData = targetSnap.exists() ? targetSnap.data() : { userId: targetKey };

      const currentFollowing = Array.isArray(currentData.following) ? [...currentData.following] : [];
      const targetFollowers = Array.isArray(targetData.followers) ? [...targetData.followers] : [];

      if (follow) {
        if (!currentFollowing.includes(targetKey)) currentFollowing.push(targetKey);
        if (!targetFollowers.includes(currentKey)) targetFollowers.push(currentKey);
      } else {
        const fIdx = currentFollowing.indexOf(targetKey);
        if (fIdx > -1) currentFollowing.splice(fIdx, 1);
        const tIdx = targetFollowers.indexOf(currentKey);
        if (tIdx > -1) targetFollowers.splice(tIdx, 1);
      }

      transaction.set(currentRef, {
        ...currentData,
        userId: currentKey,
        following: currentFollowing,
        updatedAt: Date.now(),
      }, { merge: true });

      transaction.set(targetRef, {
        ...targetData,
        userId: targetKey,
        followers: targetFollowers,
        updatedAt: Date.now(),
      }, { merge: true });
    });

    return true;
  } catch (err) {
    console.error('followUserWithTransaction error:', err);
    return false;
  }
}

/**
 * Fetch all registered user profiles from Cloud Firestore for the Admin Dashboard ("Baas").
 * Fetches publicProfiles, merges private data if admin authenticated, normalizes IDs to emails,
 * and deduplicates so that users like Séna Zeewijk, henkpenk, etc. appear properly with their stats.
 */
export async function fetchAllProfilesForAdmin(): Promise<AdminUserSummary[]> {
  try {
    const snap = await getDocs(collection(db, 'publicProfiles'));
    if (snap.empty) return [];

    // Also attempt fetching users collection for deep word stats if user is admin
    const privateUsersMap = new Map<string, any>();
    try {
      const privateSnap = await getDocs(collection(db, 'users'));
      privateSnap.docs.forEach((d) => {
        const u = d.data();
        const email = (u.email || u.ownerEmail || normalizeIdentifierToEmail(d.id)).toLowerCase().trim();
        if (email) privateUsersMap.set(email, u);
        if (u.username) privateUsersMap.set(u.username.toLowerCase().trim(), u);
      });
    } catch (_) {
      // Non-fatal if rules don't permit or not logged in yet
    }

    const userMap = new Map<string, AdminUserSummary>();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const rawEmail = data.email || data.ownerEmail || normalizeIdentifierToEmail(docSnap.id);
      const email = (rawEmail || '').toLowerCase().trim();
      const username = (data.username || '').toLowerCase().trim();
      
      const privData = (email ? privateUsersMap.get(email) : undefined) ||
                       (username ? privateUsersMap.get(username) : undefined);

      const cleanEmail = email.includes('@') ? email : (privData?.email || (username ? `${username}@vocabpulse.com` : `${docSnap.id}@vocabpulse.com`));
      const cleanUsername = data.username || privData?.username || cleanEmail.split('@')[0];
      const cleanName = data.name || privData?.name || cleanEmail.split('@')[0];

      const wordsCount = typeof data.totalWordsLearned === 'number'
        ? data.totalWordsLearned
        : (privData?.words ? Object.keys(privData.words).length : 0);
      const rawStreak = data.currentStreak !== undefined ? data.currentStreak : (data.streakDays || privData?.streakDays || 0);
      const streak = calculateCurrentStreak({
        lastActiveDateStr: data.lastActiveDateStr || privData?.lastActiveDateStr,
        lastActiveAt: data.lastActiveAt || privData?.lastActiveAt || data.updatedAt,
        totalSessionsCompleted: data.totalSessionsCompleted || privData?.totalSessionsCompleted,
        sessionHistory: data.sessionHistory || privData?.sessionHistory,
        streakDays: rawStreak,
        currentStreak: rawStreak,
      });

      const summary: AdminUserSummary = {
        email: cleanEmail,
        username: cleanUsername,
        name: cleanName,
        avatarUrl: data.avatarUrl || privData?.avatarUrl || undefined,
        hasPassword: Boolean(privData?.passwordHash),
        targetLanguage: data.targetLanguage || privData?.targetLanguage || 'he',
        knownLanguage: data.knownLanguage || privData?.knownLanguage || 'en',
        level: (data.level || privData?.level || 'A1') as any,
        numericLevel: data.numericLevel || privData?.numericLevel || 1,
        createdAt: data.createdAt || privData?.createdAt || data.updatedAt || null,
        lastActiveAt: data.lastActiveAt || privData?.lastActiveAt || data.updatedAt || null,
        streakDays: streak,
        maxStreakDays: Math.max(data.maxStreakDays || 0, rawStreak, streak, privData?.maxStreakDays || 0),
        totalSessionsCompleted: data.totalSessionsCompleted || privData?.totalSessionsCompleted || 0,
        wordsCount: wordsCount,
        masteredCount: privData?.words ? Object.values(privData.words).filter((w: any) => w.category === 'blue' || (w.intervalDays && w.intervalDays >= 21)).length : 0,
        learningCount: privData?.words ? Object.values(privData.words).filter((w: any) => w.category === 'red' || w.category === 'orange').length : 0,
        followersCount: Array.isArray(data.followers) ? data.followers.length : 0,
        followingCount: Array.isArray(data.following) ? data.following.length : 0,
        isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(data.isAdmin || privData?.isAdmin),
        emailVerified: Boolean(privData?.emailVerified),
        emailVerifiedAt: privData?.emailVerifiedAt || null,
      };

      // Deduplicate by cleanEmail and username
      const existing = (cleanEmail ? userMap.get(cleanEmail) : undefined) ||
                       (cleanUsername ? userMap.get(cleanUsername) : undefined);

      if (existing) {
        existing.wordsCount = Math.max(existing.wordsCount, summary.wordsCount);
        existing.streakDays = Math.max(existing.streakDays, summary.streakDays);
        existing.maxStreakDays = Math.max(existing.maxStreakDays || 0, summary.maxStreakDays || 0);
        existing.lastActiveAt = Math.max(existing.lastActiveAt || 0, summary.lastActiveAt || 0);
        if (summary.name && (!existing.name || existing.name === existing.email.split('@')[0])) {
          existing.name = summary.name;
        }
        if (summary.avatarUrl && !existing.avatarUrl) {
          existing.avatarUrl = summary.avatarUrl;
        }
        if (summary.targetLanguage && existing.targetLanguage === 'he' && summary.targetLanguage !== 'he') {
          existing.targetLanguage = summary.targetLanguage;
        }
        if (cleanEmail.includes('@') && (!existing.email.includes('@') || existing.email.endsWith('@vocabpulse.com'))) {
          existing.email = cleanEmail;
        }
      } else {
        if (cleanEmail) userMap.set(cleanEmail, summary);
        if (cleanUsername) userMap.set(cleanUsername, summary);
      }
    });

    return Array.from(new Set(userMap.values()));
  } catch (err) {
    console.error('Error fetching admin profiles from Firestore:', err);
    return [];
  }
}

/**
 * Delete user from Cloud Firestore collections
 */
export async function deleteUserFromFirestore(emailOrId: string): Promise<boolean> {
  if (!emailOrId) return false;
  const cleanEmail = emailOrId.toLowerCase().trim();
  const canonicalKey = getCanonicalEmailKey(cleanEmail);
  try {
    await deleteDoc(doc(db, 'publicProfiles', canonicalKey));
    await deleteDoc(doc(db, 'users', canonicalKey));
    await deleteDoc(doc(db, 'emailIndex', canonicalKey));
    return true;
  } catch (e) {
    console.warn('deleteUserFromFirestore error:', e);
    return false;
  }
}




