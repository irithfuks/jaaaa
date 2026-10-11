import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { initializeApp as initFirebaseApp, getApps as getFirebaseApps, getApp as getFirebaseApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Initialize Cloud Firestore on server for syncing registered accounts
let serverDb: any = null;
try {
  const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(fbConfigPath)) {
    const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf-8'));
    const serverApp = getFirebaseApps().length > 0 ? getFirebaseApp() : initFirebaseApp(fbConfig);
    serverDb = getFirestore(serverApp, fbConfig.firestoreDatabaseId || undefined);
    console.log('[Server Firebase] Firestore initialized successfully on server');
  }
} catch (err) {
  console.warn('[Server Firebase] Could not initialize server Firestore:', err);
}

function normalizeServerIdToEmail(id: string): string {
  if (!id) return '';
  const clean = String(id).toLowerCase().trim();
  if (clean.includes('@')) return clean;
  const converted = clean.replace(/_([a-zA-Z0-9-]+)_([a-zA-Z]{2,10})$/, '@$1.$2');
  if (converted.includes('@')) return converted;
  return clean;
}

// Favicon handler
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#f59e0b" />
  <path d="M7 9a3 3 0 0 1 3-3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a3 3 0 0 0-3 3V9z" fill="none" stroke="#1c1917" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10 6v14a3 3 0 0 1 3-3h11" fill="none" stroke="#1c1917" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(faviconSvg);
});

// In-memory data store with JSON disk persistence per user email
const DATA_DIR = path.join(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

const userCache = new Map<string, any>();

function getUserFilePath(email: string): string {
  const safeEmail = email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '_');
  return path.join(DATA_DIR, `user_${safeEmail}.json`);
}

function getUserLangFilePath(email: string, targetLanguage: string): string {
  const safeEmail = email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '_');
  const safeLang = (targetLanguage || 'he').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
  return path.join(DATA_DIR, `user_${safeEmail}_${safeLang}.json`);
}

// Startup migration: ensure existing user files have their Hebrew language file
try {
  if (fs.existsSync(DATA_DIR)) {
    const existingDiskFiles = fs.readdirSync(DATA_DIR);
    existingDiskFiles.forEach(f => {
      if (
        f.startsWith('user_') &&
        f.endsWith('.json') &&
        !f.includes('_he.json') &&
        !f.includes('_ru.json') &&
        !f.includes('_es.json') &&
        !f.includes('_fr.json') &&
        !f.includes('_de.json') &&
        !f.includes('_nl.json') &&
        !f.includes('_it.json') &&
        !f.includes('_ar.json') &&
        !f.includes('_fa.json') &&
        !f.includes('_uk.json') &&
        !f.includes('_pt.json') &&
        !f.includes('_ja.json') &&
        !f.includes('_ko.json')
      ) {
        const fullPath = path.join(DATA_DIR, f);
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.email) {
            const lang = (data.targetLanguage || 'he').toLowerCase().trim();
            const hePath = getUserLangFilePath(data.email, 'he');
            const hasHebrewWords = Object.keys(data.words || {}).some(k => k.startsWith('he-') || /[\u0590-\u05FF]/.test(data.words[k]?.targetWord || ''));
            if (hasHebrewWords && !fs.existsSync(hePath)) {
              fs.writeFileSync(hePath, JSON.stringify({ ...data, targetLanguage: 'he' }, null, 2), 'utf-8');
              console.log(`[Language Migration] Preserved Hebrew words for ${data.email} into ${hePath}`);
            }
            if (lang !== 'he' && hasHebrewWords) {
              const langPath = getUserLangFilePath(data.email, lang);
              let cleanLangWords = {};
              if (fs.existsSync(langPath)) {
                try {
                  const langRaw = fs.readFileSync(langPath, 'utf-8');
                  const langJson = JSON.parse(langRaw);
                  cleanLangWords = langJson.words || {};
                } catch (_) {}
              }
              data.words = cleanLangWords;
              data.level = 'A1';
              data.numericLevel = 1;
              data.totalSessionsCompleted = 0;
              fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
              console.log(`[Language Migration] Cleaned cross-language Hebrew words from base user file for ${data.email} (${lang})`);
            } else {
              const langPath = getUserLangFilePath(data.email, lang);
              if (!fs.existsSync(langPath)) {
                fs.writeFileSync(langPath, raw, 'utf-8');
                console.log(`[Language Migration] Preserved existing progress for ${data.email} into ${langPath}`);
              }
            }
          }
        } catch (_) {}
      }
    });
  }
} catch (e) {
  console.warn('Error during language file migration:', e);
}

function loadBaseUser(emailOrUsername: string): any | null {
  const cleanInput = (emailOrUsername || '').toLowerCase().trim();
  if (!cleanInput) return null;

  // 1. Try direct base email file path
  try {
    const filePath = getUserFilePath(cleanInput);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading base user by path:', e);
  }

  // 2. Scan DATA_DIR by username or email for base user file
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const f of files) {
        if (f.startsWith('user_') && f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              !parsed.isDeleted &&
              ((parsed.username && parsed.username.toLowerCase() === cleanInput) ||
               (parsed.email && parsed.email.toLowerCase() === cleanInput))
            ) {
              return parsed;
            }
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error('Error scanning base user:', err);
  }

  // 3. Check community users
  const fromComm = COMMUNITY_USERS.find(
    u => u.email.toLowerCase() === cleanInput || (u.username && u.username.toLowerCase() === cleanInput)
  );
  if (fromComm) {
    return { ...fromComm };
  }

  return null;
}

function loadUserData(emailOrUsername: string, targetLanguage?: string): any | null {
  const cleanInput = (emailOrUsername || '').toLowerCase().trim();
  if (!cleanInput) return null;

  const baseUser = loadBaseUser(cleanInput);
  if (!baseUser) return null;

  const cleanEmail = baseUser.email ? baseUser.email.toLowerCase().trim() : cleanInput;
  const effectiveLang = (targetLanguage || baseUser.targetLanguage || 'he').toLowerCase().trim();
  const cacheKey = `${cleanEmail}_${effectiveLang}`;

  if (userCache.has(cacheKey)) {
    return userCache.get(cacheKey);
  }

  // 1. Check if language-specific file exists (e.g. user_irithfuks@gmail.com_he.json or user_irithfuks@gmail.com_ru.json)
  const langFilePath = getUserLangFilePath(cleanEmail, effectiveLang);
  if (fs.existsSync(langFilePath)) {
    try {
      const raw = fs.readFileSync(langFilePath, 'utf-8');
      const langData = JSON.parse(raw);
      const merged = {
        ...baseUser,
        ...langData,
        email: cleanEmail,
        username: baseUser.username || langData.username || cleanEmail.split('@')[0],
        name: baseUser.name || langData.name || cleanEmail.split('@')[0],
        passwordHash: baseUser.passwordHash || langData.passwordHash,
        targetLanguage: effectiveLang,
        knownLanguage: langData.knownLanguage || baseUser.knownLanguage || 'en',
        words: langData.words || {},
        totalSessionsCompleted: langData.totalSessionsCompleted !== undefined ? langData.totalSessionsCompleted : 0,
        level: langData.level || 'A1',
        numericLevel: langData.numericLevel || 1,
        maxUnlockedNumericLevel: langData.maxUnlockedNumericLevel || 1,
        journeyProgress: langData.journeyProgress || { completedLessonsByLevel: {}, completedSessionsByButton: {} },
        passedExams: langData.passedExams || {},
        reviewHierarchies: langData.reviewHierarchies || {},
        streakDays: baseUser.streakDays !== undefined ? baseUser.streakDays : (langData.streakDays || 0),
        currentStreak: baseUser.currentStreak !== undefined ? baseUser.currentStreak : (langData.currentStreak || 0),
        maxStreakDays: Math.max(baseUser.maxStreakDays || 0, langData.maxStreakDays || 0),
        isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(baseUser.isAdmin) || Boolean(langData.isAdmin),
      };
      userCache.set(cacheKey, merged);
      return merged;
    } catch (e) {
      console.error('Error reading language file:', e);
    }
  }

  // 2. Language file doesn't exist yet!
  // If effectiveLang is Hebrew ('he') and baseUser has existing Hebrew words, migrate base to Hebrew file
  if (effectiveLang === 'he' && baseUser.words && Object.keys(baseUser.words).length > 0) {
    const heData = {
      ...baseUser,
      targetLanguage: 'he',
    };
    try {
      fs.writeFileSync(langFilePath, JSON.stringify(heData, null, 2), 'utf-8');
      console.log(`[Migration] Migrated Hebrew progress for ${cleanEmail} to ${langFilePath}`);
    } catch (_) {}
    userCache.set(cacheKey, heData);
    return heData;
  }

  // 3. Any other language (e.g. Russian 'ru') or fresh Hebrew:
  // "Heel belangrijk: elke taal begin je vanaf 0."
  const freshLangData = {
    ...baseUser,
    targetLanguage: effectiveLang,
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

  try {
    fs.writeFileSync(langFilePath, JSON.stringify(freshLangData, null, 2), 'utf-8');
    console.log(`[New Language File] Created ${langFilePath} starting from 0 for ${cleanEmail}`);
  } catch (err) {
    console.error('Error creating fresh language file:', err);
  }

  userCache.set(cacheKey, freshLangData);
  return freshLangData;
}

function resolveUserEmail(input: string): string {
  const clean = (input || '').toLowerCase().trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  const user = loadBaseUser(clean);
  if (user?.email) return user.email.toLowerCase().trim();
  return clean;
}

function saveUserData(email: string, data: any, targetLanguage?: string): boolean {
  const cleanEmail = email.toLowerCase().trim();
  const safeLang = (targetLanguage || data.targetLanguage || 'he').toLowerCase().trim();
  const cacheKey = `${cleanEmail}_${safeLang}`;

  userCache.set(cacheKey, data);
  userCache.set(cleanEmail, data);
  if (data.username) {
    userCache.set(data.username.toLowerCase(), data);
    userCache.set(`${data.username.toLowerCase()}_${safeLang}`, data);
  }

  try {
    // 1. Save language-specific file (e.g. user_irithfuks@gmail.com_he.json or user_irithfuks@gmail.com_ru.json)
    const langFilePath = getUserLangFilePath(cleanEmail, safeLang);
    fs.writeFileSync(langFilePath, JSON.stringify(data, null, 2), 'utf-8');

    // 2. Also update base account file (user_irithfuks@gmail.com.json) to keep credentials, identity & active language in sync
    const baseFilePath = getUserFilePath(cleanEmail);
    let baseData: any = {};
    if (fs.existsSync(baseFilePath)) {
      try {
        baseData = JSON.parse(fs.readFileSync(baseFilePath, 'utf-8'));
      } catch (_) {}
    }

    const updatedBase: any = {
      ...baseData,
      email: cleanEmail,
      username: data.username || baseData.username || cleanEmail.split('@')[0],
      name: data.name || baseData.name || cleanEmail.split('@')[0],
      passwordHash: data.passwordHash || baseData.passwordHash,
      passwordUpdatedAt: data.passwordUpdatedAt || baseData.passwordUpdatedAt,
      avatarUrl: data.avatarUrl || baseData.avatarUrl,
      avatarConfig: data.avatarConfig || baseData.avatarConfig,
      targetLanguage: safeLang,
      knownLanguage: data.knownLanguage || baseData.knownLanguage || 'en',
      createdAt: baseData.createdAt || data.createdAt || Date.now(),
      lastActiveAt: data.lastActiveAt || Date.now(),
      lastActiveDateStr: data.lastActiveDateStr || baseData.lastActiveDateStr,
      streakDays: data.streakDays !== undefined ? data.streakDays : (baseData.streakDays || 0),
      currentStreak: data.currentStreak !== undefined ? data.currentStreak : (baseData.currentStreak || 0),
      maxStreakDays: Math.max(baseData.maxStreakDays || 0, data.maxStreakDays || 0, data.streakDays || 0),
      sessionHistory: data.sessionHistory || baseData.sessionHistory,
      following: data.following || baseData.following,
      followers: data.followers || baseData.followers,
      isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(data.isAdmin) || Boolean(baseData.isAdmin),
      emailVerified: data.emailVerified !== undefined ? data.emailVerified : baseData.emailVerified,
      emailVerifiedAt: data.emailVerifiedAt || baseData.emailVerifiedAt,
    };

    // Save active language progress in base file
    updatedBase.words = data.words || {};
    updatedBase.level = data.level || 'A1';
    updatedBase.numericLevel = data.numericLevel || 1;
    updatedBase.maxUnlockedNumericLevel = data.maxUnlockedNumericLevel || 1;
    updatedBase.journeyProgress = data.journeyProgress || { completedLessonsByLevel: {}, completedSessionsByButton: {} };
    updatedBase.passedExams = data.passedExams || {};
    updatedBase.reviewHierarchies = data.reviewHierarchies || {};

    fs.writeFileSync(baseFilePath, JSON.stringify(updatedBase, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving user data:', e);
    return false;
  }
}

// --- API Endpoints ---

function getPreviousServerDayStr(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const prevUtc = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const prevD = new Date(prevUtc);
  const prevY = prevD.getUTCFullYear();
  const prevM = String(prevD.getUTCMonth() + 1).padStart(2, '0');
  const prevDay = String(prevD.getUTCDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevDay}`;
}

function evaluateStreak(profile: any, clientTodayStr?: string): { streakDays: number; isDoneToday: boolean } {
  if (!profile || (profile.totalSessionsCompleted !== undefined && profile.totalSessionsCompleted <= 0)) {
    return { streakDays: 0, isDoneToday: false };
  }

  const today = new Date();
  const serverFallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayStr = (clientTodayStr && /^\d{4}-\d{2}-\d{2}$/.test(clientTodayStr)) ? clientTodayStr : serverFallbackDate;

  // Extract distinct practice dates from sessionHistory
  const dateSet = new Set<string>();
  if (Array.isArray(profile.sessionHistory)) {
    for (const s of profile.sessionHistory) {
      if (s.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(s.dateStr)) {
        dateSet.add(s.dateStr);
      }
    }
  }

  if (dateSet.size === 0 && profile.lastActiveDateStr && /^\d{4}-\d{2}-\d{2}$/.test(profile.lastActiveDateStr)) {
    if ((profile.totalSessionsCompleted || 0) > 0) {
      dateSet.add(profile.lastActiveDateStr);
    }
  }

  if (dateSet.size === 0) {
    return { streakDays: 0, isDoneToday: false };
  }

  const isDoneToday = dateSet.has(todayStr);
  const yesterdayStr = getPreviousServerDayStr(todayStr);

  if (!isDoneToday) {
    if (!dateSet.has(yesterdayStr)) {
      // Missed yesterday: streak broken to 0!
      return { streakDays: 0, isDoneToday: false };
    }
  }

  // Count consecutive days backward
  let anchor = isDoneToday ? todayStr : yesterdayStr;
  let count = 0;
  while (dateSet.has(anchor)) {
    count++;
    anchor = getPreviousServerDayStr(anchor);
  }

  const stored = profile.currentStreak !== undefined ? profile.currentStreak : (profile.streakDays || 0);
  const finalStreak = Math.max(count, stored > 0 && count > 0 ? stored : 0, 1);

  return { streakDays: finalStreak, isDoneToday };
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1b. Central vocabulary bank endpoint from Firestore
let memoryWoorden: any[] | null = null;
function getMemoryWoorden(): any[] {
  if (!memoryWoorden) {
    const dataPath = path.join(process.cwd(), '.data', 'woorden.json');
    if (fs.existsSync(dataPath)) {
      try {
        const raw = fs.readFileSync(dataPath, 'utf-8');
        memoryWoorden = JSON.parse(raw);
        console.log(`Loaded ${memoryWoorden?.length || 0} woorden into server memory cache.`);
      } catch (err) {
        console.error('Failed to parse .data/woorden.json:', err);
      }
    }
  }
  return memoryWoorden || [];
}

app.get('/api/woorden', (req, res) => {
  const allWords = getMemoryWoorden();
  const { level, niveau, limit } = req.query;

  let filtered = allWords;
  if (level !== undefined) {
    const lvlNum = parseInt(level as string, 10);
    if (!isNaN(lvlNum)) {
      filtered = filtered.filter(w => w.level === lvlNum);
    }
  }
  if (niveau) {
    const targetNiveau = (niveau as string).toUpperCase().trim();
    filtered = filtered.filter(w => (w.niveau || '').toUpperCase() === targetNiveau);
  }
  if (limit) {
    const limitNum = parseInt(limit as string, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      filtered = filtered.slice(0, limitNum);
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    total: filtered.length,
    words: filtered,
  });
});

// 2. Load or create user profile by email (GET & POST)
app.get('/api/profile', (req, res) => {
  const email = (req.query.email as string) || '';
  const targetLanguage = (req.query.targetLanguage as string) || '';
  const clientTodayStr = (req.query.clientTodayStr as string) || '';
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail, targetLanguage || undefined);
  if (existing) {
    if (cleanEmail === 'irithfuks@gmail.com') {
      existing.isAdmin = true;
    }

    const streakEval = evaluateStreak(existing, clientTodayStr);
    existing.streakDays = streakEval.streakDays;
    existing.currentStreak = streakEval.streakDays;
    existing.maxStreakDays = Math.max(existing.maxStreakDays || 0, existing.streakDays || 0, streakEval.streakDays);

    return res.json({ 
      profile: existing, 
      isNew: false, 
      wordsCount: Object.keys(existing.words || {}).length 
    });
  }

  // Create initial profile for this language starting from 0
  const initialProfile = {
    email: cleanEmail,
    name: cleanEmail.split('@')[0],
    targetLanguage: targetLanguage || 'he',
    knownLanguage: 'en',
    level: 'A1',
    numericLevel: 1,
    maxUnlockedNumericLevel: 1,
    levelVerified: false,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    words: {},
    totalSessionsCompleted: 0,
    streakDays: 0,
    isAdmin: cleanEmail === 'irithfuks@gmail.com',
  };

  saveUserData(cleanEmail, initialProfile, targetLanguage || 'he');
  res.json({ profile: initialProfile, isNew: true, wordsCount: 0 });
});

app.post('/api/profile/load', (req, res) => {
  const { email, targetLanguage, clientTodayStr } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid Gmail address is required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail, targetLanguage || undefined);
  if (existing) {
    if (cleanEmail === 'irithfuks@gmail.com') {
      existing.isAdmin = true;
    }

    const streakEval = evaluateStreak(existing, clientTodayStr);
    existing.streakDays = streakEval.streakDays;
    existing.currentStreak = streakEval.streakDays;
    existing.maxStreakDays = Math.max(existing.maxStreakDays || 0, existing.streakDays || 0, streakEval.streakDays);

    return res.json({ 
      profile: existing, 
      isNew: false, 
      wordsCount: Object.keys(existing.words || {}).length 
    });
  }

  // Create initial profile starting from 0
  const initialProfile = {
    email: cleanEmail,
    name: cleanEmail.split('@')[0],
    targetLanguage: targetLanguage || 'he',
    knownLanguage: 'en',
    level: 'A1',
    numericLevel: 1,
    maxUnlockedNumericLevel: 1,
    levelVerified: false,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    words: {},
    totalSessionsCompleted: 0,
    streakDays: 0,
    isAdmin: cleanEmail === 'irithfuks@gmail.com',
  };

  saveUserData(cleanEmail, initialProfile, targetLanguage || 'he');
  res.json({ profile: initialProfile, isNew: true, wordsCount: 0 });
});

// 2b. Switch target language (starts from 0 if new, or loads separate language file)
app.post('/api/profile/switch-language', (req, res) => {
  const { email, newTargetLanguage, knownLanguage, clientTodayStr } = req.body;
  if (!email || !newTargetLanguage) {
    return res.status(400).json({ error: 'Email and newTargetLanguage are required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanLang = newTargetLanguage.toLowerCase().trim();
  
  // Load or initialize fresh from 0 for this specific target language
  const langProfile = loadUserData(cleanEmail, cleanLang);
  if (!langProfile) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (knownLanguage) {
    langProfile.knownLanguage = knownLanguage;
  }

  const streakEval = evaluateStreak(langProfile, clientTodayStr);
  langProfile.streakDays = streakEval.streakDays;
  langProfile.currentStreak = streakEval.streakDays;
  langProfile.maxStreakDays = Math.max(langProfile.maxStreakDays || 0, langProfile.streakDays || 0, streakEval.streakDays);

  saveUserData(cleanEmail, langProfile, cleanLang);

  res.json({ 
    success: true, 
    profile: langProfile,
    wordsCount: Object.keys(langProfile.words || {}).length,
  });
});

// 3. Save / update user profile & words progress with deep, non-destructive merging strictly isolated per language
app.post('/api/profile/save', (req, res) => {
  const { profile, clientTodayStr, targetLanguage } = req.body;
  if (!profile || !profile.email) {
    return res.status(400).json({ error: 'Profile with email is required' });
  }

  const cleanEmail = profile.email.toLowerCase().trim();
  const effectiveLang = (targetLanguage || profile.targetLanguage || 'he').toLowerCase().trim();
  // CRITICAL: Load existing data strictly for this specific language! Never cross-contaminate between Hebrew and Russian!
  const existing = loadUserData(cleanEmail, effectiveLang);

  // Merge session history cleanly without duplicates
  const histMap = new Map<string, any>();
  (existing?.sessionHistory || []).forEach((s: any) => {
    if (s && s.sessionId) histMap.set(s.sessionId, s);
  });
  (profile.sessionHistory || []).forEach((s: any) => {
    if (s && s.sessionId) histMap.set(s.sessionId, s);
  });
  const mergedSessionHistory = Array.from(histMap.values())
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
    .slice(-200);

  const safeFollowing = Array.from(new Set([
    ...((existing?.following || []).map((e: string) => String(e).toLowerCase().trim())),
    ...((profile.following || []).map((e: string) => String(e).toLowerCase().trim())),
  ]));
  const safeFollowers = Array.from(new Set([
    ...((existing?.followers || []).map((e: string) => String(e).toLowerCase().trim())),
    ...((profile.followers || []).map((e: string) => String(e).toLowerCase().trim())),
  ]));

  const mergedPassedExams = {
    ...(existing?.passedExams || {}),
    ...(profile.passedExams || {}),
  };
  const passedExamKeys = Object.keys(mergedPassedExams).map(Number).filter(n => !isNaN(n));
  const passedMax = passedExamKeys.length > 0 ? Math.max(...passedExamKeys.map(k => Math.min(60, k + 1))) : 1;
  const mergedMaxUnlocked = Math.max(
    existing?.maxUnlockedNumericLevel || 1,
    profile.maxUnlockedNumericLevel || 1,
    passedMax
  );
  const mergedNumericLevel = Math.max(
    existing?.numericLevel || 1,
    profile.numericLevel || 1,
    passedMax > 1 ? passedMax : 1
  );

  const mergedJourneyProgress = {
    ...(existing?.journeyProgress || {}),
    ...(profile.journeyProgress || {}),
    completedSessionsByButton: {
      ...(existing?.journeyProgress?.completedSessionsByButton || {}),
      ...(profile.journeyProgress?.completedSessionsByButton || {}),
    },
    completedLessonsByLevel: {
      ...(existing?.journeyProgress?.completedLessonsByLevel || {}),
      ...(profile.journeyProgress?.completedLessonsByLevel || {}),
    },
  };

  let mergedProfile = { 
    ...(existing || {}), 
    ...profile, 
    email: cleanEmail,
    targetLanguage: effectiveLang,
    username: profile.username || existing?.username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''),
    passwordHash: profile.passwordHash || existing?.passwordHash,
    isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(existing?.isAdmin) || Boolean(profile.isAdmin),
    sessionHistory: mergedSessionHistory,
    streakDays: profile.streakDays !== undefined ? profile.streakDays : (existing?.streakDays || 0),
    currentStreak: profile.currentStreak !== undefined ? profile.currentStreak : (profile.streakDays !== undefined ? profile.streakDays : (existing?.streakDays || 0)),
    maxStreakDays: Math.max(existing?.maxStreakDays || 0, profile.maxStreakDays || 0, profile.streakDays || 0),
    following: safeFollowing,
    followers: safeFollowers,
    lastActiveDateStr: profile.lastActiveDateStr || existing?.lastActiveDateStr,
    totalSessionsCompleted: Math.max(existing?.totalSessionsCompleted || 0, profile.totalSessionsCompleted || 0),
    numericLevel: mergedNumericLevel,
    level: profile.level || existing?.level || 'A1',
    maxUnlockedNumericLevel: mergedMaxUnlocked,
    passedExams: mergedPassedExams,
    journeyProgress: mergedJourneyProgress,
  };
  if (profile.words !== undefined) {
    mergedProfile.words = profile.words;
  } else if (existing && existing.words) {
    mergedProfile.words = existing.words;
  }

  // Strict streak evaluation:
  // If user missed yesterday or client evaluated streak as 0, reset to 0!
  const streakEval = evaluateStreak(mergedProfile, clientTodayStr);
  const incomingStreak = profile.streakDays !== undefined 
    ? profile.streakDays 
    : (profile.currentStreak !== undefined ? profile.currentStreak : streakEval.streakDays);

  const effectiveStreak = (streakEval.streakDays === 0 || incomingStreak === 0) ? 0 : incomingStreak;
  mergedProfile.streakDays = effectiveStreak;
  mergedProfile.currentStreak = effectiveStreak;
  mergedProfile.maxStreakDays = Math.max(
    existing?.maxStreakDays || 0,
    existing?.streakDays || 0,
    profile.maxStreakDays || 0,
    profile.streakDays || 0,
    effectiveStreak
  );
  mergedProfile.lastActiveAt = profile.lastActiveAt || Date.now();
  saveUserData(cleanEmail, mergedProfile, effectiveLang);
  const wordsCount = Object.keys(mergedProfile.words || {}).length;

  res.json({ 
    success: true, 
    savedAt: Date.now(), 
    wordsCount,
    email: cleanEmail,
    targetLanguage: effectiveLang,
  });
});

// 3b. Verify Cloud Sync Status
app.post('/api/profile/sync-status', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  if (!existing) {
    return res.json({ exists: false, email: cleanEmail, wordsCount: 0 });
  }

  const words = existing.words || {};
  const categoriesCount = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0 };
  Object.values(words).forEach((w: any) => {
    const cat = w.category as keyof typeof categoriesCount;
    if (categoriesCount[cat] !== undefined) {
      categoriesCount[cat]++;
    }
  });

  res.json({
    exists: true,
    email: cleanEmail,
    username: existing.username || cleanEmail.split('@')[0],
    wordsCount: Object.keys(words).length,
    categories: categoriesCount,
    lastActiveAt: existing.lastActiveAt,
    level: existing.level,
    numericLevel: existing.numericLevel || 1,
    totalSessionsCompleted: existing.totalSessionsCompleted || 0,
    savedAt: Date.now(),
  });
});

// 3c. Change User Password
app.post('/api/profile/change-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    return res.status(400).json({ 
      success: false, 
      error: 'Wachtwoord moet minimaal 6 tekens bevatten' 
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail) || { email: cleanEmail };
  existing.passwordHash = Buffer.from(newPassword.trim()).toString('base64');
  existing.passwordUpdatedAt = Date.now();
  saveUserData(cleanEmail, existing);

  return res.json({ 
    success: true, 
    message: 'Wachtwoord succesvol gewijzigd' 
  });
});

// 3d. Delete User Account (soft-delete with safe archive retention for recovery)
app.post('/api/profile/delete-account', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'E-mailadres is verplicht.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'irithfuks@gmail.com') {
    return res.status(400).json({ success: false, error: 'Het hoofdbeheerdersaccount kan niet worden verwijderd.' });
  }

  try {
    const existing = loadUserData(cleanEmail);
    if (existing) {
      existing.isDeleted = true;
      existing.deletedAt = Date.now();
      saveUserData(cleanEmail, existing);

      // Safe archive backup (never thrown away, always recoverable)
      const archiveDir = path.join(DATA_DIR, 'archived_accounts');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(archiveDir, `archive_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`),
        JSON.stringify(existing, null, 2),
        'utf-8'
      );
    }
    return res.json({ 
      success: true, 
      message: 'Account is succesvol gedeactiveerd. Gegevens blijven veilig bewaard voor herstel.' 
    });
  } catch (err) {
    console.error('Error deactivating user account:', err);
    return res.status(500).json({ success: false, error: 'Fout bij het verwijderen van account.' });
  }
});

// 3e. Restore User Account endpoint
app.post('/api/profile/restore-account', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'E-mailadres is verplicht.' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Geen account gevonden om te herstellen.' });
  }
  delete existing.isDeleted;
  delete existing.deletedAt;
  existing.lastActiveAt = Date.now();
  saveUserData(cleanEmail, existing);
  return res.json({ 
    success: true, 
    message: 'Account succesvol hersteld! Al je voortgang en gegevens zijn teruggezet.', 
    profile: existing 
  });
});

// --- AUTHENTICATION & CREDENTIALS ENDPOINTS ---

// In-memory verification codes store
interface PendingVerification {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
  createdAt: number;
}

const pendingVerifications = new Map<string, PendingVerification>();

function cleanExpiredVerifications() {
  const now = Date.now();
  for (const [email, item] of pendingVerifications.entries()) {
    if (item.expiresAt < now) {
      pendingVerifications.delete(email);
    }
  }
}

// Helper to deliver real verification email via SMTP (e.g. Gmail App Password) or Resend

interface CustomSmtpConfig {
  user: string;
  pass: string;
  host?: string;
  port?: number;
  from?: string;
}

let customSmtpConfig: CustomSmtpConfig | null = null;
const SMTP_CONFIG_FILE = path.join(process.cwd(), 'smtp-config.json');

try {
  if (fs.existsSync(SMTP_CONFIG_FILE)) {
    const raw = fs.readFileSync(SMTP_CONFIG_FILE, 'utf-8');
    customSmtpConfig = JSON.parse(raw);
    console.log(`[Email] Loaded custom SMTP config for user: ${customSmtpConfig?.user}`);
  }
} catch (e: any) {
  console.error('[Email] Failed to read smtp-config.json:', e.message);
}

function getEffectiveSmtp() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const cleanUser = process.env.SMTP_USER.trim();
    const cleanPass = process.env.SMTP_PASS.replace(/\s+/g, '');
    const isGmail = cleanUser.endsWith('@gmail.com') || (process.env.SMTP_HOST || '').includes('gmail');
    return {
      user: cleanUser,
      pass: cleanPass,
      host: process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtp.gmail.com'),
      port: Number(process.env.SMTP_PORT || (isGmail ? 465 : 587)),
      secure: isGmail ? true : (Number(process.env.SMTP_PORT) === 465),
      from: process.env.SMTP_FROM || `"VocabPulse" <${cleanUser}>`,
    };
  }
  if (customSmtpConfig && customSmtpConfig.user && customSmtpConfig.pass) {
    const cleanUser = customSmtpConfig.user.trim();
    const cleanPass = customSmtpConfig.pass.replace(/\s+/g, '');
    const isGmail = cleanUser.endsWith('@gmail.com') || (customSmtpConfig.host || '').includes('gmail');
    return {
      user: cleanUser,
      pass: cleanPass,
      host: customSmtpConfig.host || 'smtp.gmail.com',
      port: customSmtpConfig.port || (isGmail ? 465 : 587),
      secure: isGmail ? true : (Number(customSmtpConfig.port) === 465),
      from: customSmtpConfig.from || `"VocabPulse" <${cleanUser}>`,
    };
  }
  return null;
}

function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || getEffectiveSmtp());
}

async function sendRealVerificationEmail(toEmail: string, code: string): Promise<{ success: boolean; method: string; error?: string }> {
  // 1. Try SMTP first if configured (e.g. Gmail App Password, which can send to ANY email address in the world!)
  const smtp = getEffectiveSmtp();
  if (smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      await transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        subject: `${code} is je VocabPulse verificatiecode`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
            <h2 style="color: #1c1917; margin-bottom: 12px; font-size: 22px;">VocabPulse Verificatie</h2>
            <p style="color: #44403c; font-size: 15px; line-height: 1.5;">Bedankt voor je aanmelding bij VocabPulse. Gebruik de onderstaande 6-cijferige verificatiecode om te bevestigen dat dit e-mailadres echt van jou is:</p>
            <div style="margin: 24px 0; text-align: center;">
              <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 12px 28px; background-color: #fef3c7; color: #78350f; border-radius: 12px; border: 1px solid #fde68a;">${code}</span>
            </div>
            <p style="color: #78716c; font-size: 13px; line-height: 1.4;">Deze code is 15 minuten geldig. Als je dit account niet hebt aangevraagd, kun je deze e-mail veilig negeren.</p>
          </div>
        `,
        text: `Je VocabPulse verificatiecode is: ${code}\n\nDeze code is 15 minuten geldig om te bevestigen dat ${toEmail} van jou is.`,
      });

      console.log(`[Email] Sent verification email via SMTP to ${toEmail}`);
      return { success: true, method: 'smtp' };
    } catch (err: any) {
      console.error('[Email] SMTP send error:', err.message);
      // If SMTP fails, continue and try Resend if available
    }
  }

  // 2. Try Resend if RESEND_API_KEY is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || 'VocabPulse <onboarding@resend.dev>',
          to: [toEmail],
          subject: `${code} is je VocabPulse verificatiecode`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
              <h2 style="color: #1c1917; margin-bottom: 12px; font-size: 22px;">VocabPulse Verificatie</h2>
              <p style="color: #44403c; font-size: 15px; line-height: 1.5;">Bedankt voor je aanmelding bij VocabPulse. Gebruik de onderstaande 6-cijferige verificatiecode om te bevestigen dat dit e-mailadres echt van jou is:</p>
              <div style="margin: 24px 0; text-align: center;">
                <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 12px 28px; background-color: #fef3c7; color: #78350f; border-radius: 12px; border: 1px solid #fde68a;">${code}</span>
              </div>
              <p style="color: #78716c; font-size: 13px; line-height: 1.4;">Deze code is 15 minuten geldig. Als je dit account niet hebt aangevraagd, kun je deze e-mail veilig negeren.</p>
            </div>
          `,
          text: `Je VocabPulse verificatiecode is: ${code}\n\nDeze code is 15 minuten geldig om te bevestigen dat ${toEmail} van jou is.`,
        }),
      });

      if (res.ok) {
        console.log(`[Email] Sent verification email via Resend API to ${toEmail}`);
        return { success: true, method: 'resend' };
      } else {
        const errText = await res.text();
        console.error('[Email] Resend API error:', errText);
        let parsedErr = errText;
        try {
          const parsed = JSON.parse(errText);
          parsedErr = parsed.message || errText;
        } catch {}
        return { success: false, method: 'resend', error: parsedErr };
      }
    } catch (err: any) {
      console.error('[Email] Resend fetch error:', err.message);
      return { success: false, method: 'resend', error: err.message };
    }
  }

  // 3. Fallback: Log to server terminal
  console.log(`\n================================================================`);
  console.log(`✉️  [VOCABPULSE VERIFICATIE EMAIL - SERVER LOG]`);
  console.log(`Aan: ${toEmail}`);
  console.log(`Onderwerp: ${code} is je VocabPulse verificatiecode`);
  console.log(`Code: ${code}`);
  console.log(`⚠️  Opmerking: Er zijn nog geen SMTP_USER / SMTP_PASS of RESEND_API_KEY geconfigureerd.`);
  console.log(`Stel deze in via het AI Studio Secrets/Settings paneel om echte mails in je inbox te ontvangen.`);
  console.log(`================================================================\n`);

  return {
    success: false,
    method: 'none',
    error: 'Er zijn nog geen SMTP-gegevens (bijv. Gmail App Password of Resend API key) ingesteld in de serverinstellingen.',
  };
}

// Send 6-digit verification code to email
app.post('/api/auth/send-verification-code', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Geldig e-mailadres is verplicht' });
  }

  const cleanEmail = email.toLowerCase().trim();
  cleanExpiredVerifications();

  // Rate limit: 10s cooldown
  const existing = pendingVerifications.get(cleanEmail);
  if (existing && Date.now() - existing.createdAt < 10000) {
    return res.status(429).json({ 
      success: false, 
      error: 'Wacht even voordat je een nieuwe verificatiecode aanvraagt (10 seconden).' 
    });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  pendingVerifications.set(cleanEmail, {
    code,
    expiresAt,
    attempts: 0,
    email: cleanEmail,
    createdAt: Date.now(),
  });

  const mailResult = await sendRealVerificationEmail(cleanEmail, code);

  if (!mailResult.success) {
    let friendlyError = mailResult.error || 'Kon de verificatiemail niet versturen.';
    if (mailResult.error && mailResult.error.includes('You can only send testing emails to your own email address')) {
      const match = mailResult.error.match(/\(([^)]+)\)/);
      const ownerEmail = match ? match[1] : 'je geregistreerde Resend-adres';
      friendlyError = `Resend testlimiet: Met de gratis testmodus van Resend kunnen e-mails uitsluitend worden bezorgd op ${ownerEmail}. Registreer met ${ownerEmail} om de verificatiecode in je echte inbox te ontvangen, of koppel een eigen domein op resend.com/domains.`;
    }
    return res.status(400).json({
      success: false,
      error: friendlyError,
    });
  }

  return res.json({
    success: true,
    message: `Bevestigingscode is verzonden naar ${cleanEmail}. Bekijk je inbox.`,
    email: cleanEmail,
    emailDelivered: true,
    smtpConfigured: true,
    expiresInSeconds: 900,
  });
});

// Verify 6-digit verification code
app.post('/api/auth/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'E-mailadres en verificatiecode zijn verplicht' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = String(code).trim();
  cleanExpiredVerifications();

  const pending = pendingVerifications.get(cleanEmail);
  if (!pending) {
    return res.status(400).json({ 
      success: false, 
      error: 'Geen actieve verificatiecode gevonden. Vraag een nieuwe code aan.' 
    });
  }

  if (pending.expiresAt < Date.now()) {
    pendingVerifications.delete(cleanEmail);
    return res.status(400).json({ 
      success: false, 
      error: 'De verificatiecode is verlopen. Vraag een nieuwe code aan.' 
    });
  }

  if (pending.attempts >= 5) {
    pendingVerifications.delete(cleanEmail);
    return res.status(400).json({ 
      success: false, 
      error: 'Te veel onjuiste pogingen. Vraag een nieuwe code aan.' 
    });
  }

  if (pending.code !== cleanCode) {
    pending.attempts++;
    return res.status(400).json({ 
      success: false, 
      error: 'Onjuiste verificatiecode. Controleer de code in je mail.' 
    });
  }

  return res.json({
    success: true,
    verified: true,
    message: 'E-mailadres succesvol geverifieerd!',
  });
});

// Check SMTP configuration status
app.get('/api/auth/smtp-status', (req, res) => {
  const isConfigured = isEmailConfigured();
  const effective = getEffectiveSmtp();
  return res.json({
    success: true,
    configured: isConfigured,
    user: effective?.user ? effective.user.replace(/(?<=.).(?=.*@)/g, '*') : null,
    provider: process.env.RESEND_API_KEY ? 'resend' : effective ? 'smtp' : 'none',
  });
});

// Configure or update SMTP dynamically
app.post('/api/auth/configure-smtp', async (req, res) => {
  try {
    const { user, pass, host, port } = req.body;
    if (!user || !pass || typeof user !== 'string' || typeof pass !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Zowel een Gmail-adres als een Google App-wachtwoord zijn verplicht.',
      });
    }

    const cleanUser = user.trim().toLowerCase();
    const cleanPass = pass.trim().replace(/\s+/g, '');
    const cleanHost = (host && typeof host === 'string') ? host.trim() : 'smtp.gmail.com';
    const cleanPort = port ? Number(port) : 587;

    // Test connection with Nodemailer
    const testTransporter = nodemailer.createTransport({
      host: cleanHost,
      port: cleanPort,
      secure: cleanPort === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
    });

    try {
      await testTransporter.verify();
    } catch (verifyErr: any) {
      console.error('[Email] SMTP test verification failed:', verifyErr.message);
      return res.status(400).json({
        success: false,
        error: `Kan geen verbinding maken met SMTP (${verifyErr.message}). Controleer of het e-mailadres en het 16-cijferige App-wachtwoord correct zijn.`,
      });
    }

    customSmtpConfig = {
      user: cleanUser,
      pass: cleanPass,
      host: cleanHost,
      port: cleanPort,
      from: `"VocabPulse" <${cleanUser}>`,
    };

    try {
      fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(customSmtpConfig, null, 2), 'utf-8');
    } catch (writeErr: any) {
      console.warn('[Email] Could not persist smtp-config.json:', writeErr.message);
    }

    console.log(`[Email] Successfully configured and verified SMTP for: ${cleanUser}`);
    return res.json({
      success: true,
      message: 'SMTP succesvol geconfigureerd! Verificatiemails worden nu direct verzonden.',
    });
  } catch (err: any) {
    console.error('[Email] Error in configure-smtp:', err);
    return res.status(500).json({
      success: false,
      error: 'Interne fout bij het opslaan van de SMTP-configuratie.',
    });
  }
});

// Check email existence and setup state
app.post('/api/auth/check-email', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Geldig e-mailadres is verplicht' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  if (!existing) {
    return res.json({ exists: false, hasPassword: false });
  }
  return res.json({
    exists: true,
    hasPassword: Boolean(existing.passwordHash),
    username: existing.username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''),
    name: existing.name,
    avatarUrl: existing.avatarUrl,
  });
});

// Check if username is available
app.post('/api/auth/check-username', (req, res) => {
  const { username, currentEmail } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ available: false, message: 'Voer een gebruikersnaam in' });
  }
  const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUser)) {
    return res.json({
      available: false,
      message: '3-24 tekens (alleen letters, cijfers en _)',
    });
  }
  const allUsers = getAllUsersCatalog();
  const currentCleanEmail = (currentEmail || '').toLowerCase().trim();
  const taken = allUsers.some(u => {
    if (currentCleanEmail && u.email.toLowerCase() === currentCleanEmail) return false;
    return (u.username && u.username.toLowerCase() === cleanUser);
  });
  if (taken) {
    return res.json({ available: false, message: 'Gebruikersnaam is al bezet' });
  }
  return res.json({ available: true, message: 'Beschikbaar' });
});

// Login with email and password
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'E-mailadres en wachtwoord zijn verplicht' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Geen account gevonden met dit e-mailadres' });
  }
  if (!existing.passwordHash) {
    return res.json({ 
      success: false, 
      needsSetup: true, 
      message: 'Account heeft nog geen wachtwoord. Stel je inloggegevens in.',
      username: existing.username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''),
      name: existing.name || cleanEmail.split('@')[0],
    });
  }
  const incomingHash = Buffer.from(password.trim()).toString('base64');
  if (existing.passwordHash !== incomingHash) {
    return res.status(401).json({ success: false, error: 'Onjuist wachtwoord. Probeer het opnieuw.' });
  }
  // If account was previously deactivated, restore it automatically (never throw away data)
  let restored = false;
  if (existing.isDeleted) {
    delete existing.isDeleted;
    delete existing.deletedAt;
    restored = true;
  }
  // Update last active
  existing.lastActiveAt = Date.now();
  saveUserData(cleanEmail, existing);
  return res.json({ 
    success: true, 
    profile: existing,
    restored,
    message: restored ? 'Welkom terug! Je account en alle eerdere gegevens zijn hersteld.' : undefined,
  });
});

// Register new account with email, password, and username
app.post('/api/auth/register', (req, res) => {
  const { email, password, username, name, targetLanguage, knownLanguage, verificationCode } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Geldig e-mailadres is verplicht' });
  }
  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'Wachtwoord moet minimaal 6 tekens bevatten' });
  }
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Gebruikersnaam is verplicht' });
  }
  const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUser)) {
    return res.status(400).json({ success: false, error: 'Gebruikersnaam mag 3-24 letters, cijfers en _ bevatten' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Verification code check is required for ALL email registrations
  cleanExpiredVerifications();
  const pending = pendingVerifications.get(cleanEmail);
  const cleanCode = verificationCode ? String(verificationCode).trim() : '';

  if (!cleanCode) {
    return res.status(400).json({
      success: false,
      needsVerification: true,
      error: 'Bevestigingscode is verplicht om aan te tonen dat dit e-mailadres echt van jou is.',
    });
  }

  if (!pending || pending.code !== cleanCode || pending.expiresAt < Date.now()) {
    return res.status(400).json({
      success: false,
      needsVerification: true,
      error: 'Onjuiste of verlopen bevestigingscode. Controleer de 6-cijferige code in je mail of vraag een nieuwe aan.',
    });
  }

  // Remove pending code once verified
  pendingVerifications.delete(cleanEmail);

  const allUsers = getAllUsersCatalog();
  const usernameTaken = allUsers.some(u => 
    u.email.toLowerCase() !== cleanEmail && 
    u.username && u.username.toLowerCase() === cleanUser
  );
  if (usernameTaken) {
    return res.status(400).json({ success: false, error: 'Deze gebruikersnaam is al in gebruik door iemand anders' });
  }

  const existing = loadUserData(cleanEmail);
  if (existing && existing.passwordHash) {
    return res.status(400).json({ 
      success: false, 
      error: 'Er bestaat al een account met dit e-mailadres. Log in met je wachtwoord.' 
    });
  }

  const passwordHash = Buffer.from(password.trim()).toString('base64');
  const now = Date.now();
  const newProfile = {
    ...(existing || {}),
    email: cleanEmail,
    username: cleanUser,
    passwordHash,
    name: (name && name.trim()) || existing?.name || cleanUser,
    avatarUrl: existing?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    targetLanguage: targetLanguage || existing?.targetLanguage || 'he',
    knownLanguage: knownLanguage || existing?.knownLanguage || 'en',
    level: existing?.level || 'A1',
    numericLevel: existing?.numericLevel || 1,
    maxUnlockedNumericLevel: existing?.maxUnlockedNumericLevel || 1,
    levelVerified: Boolean(existing?.levelVerified),
    emailVerified: true,
    emailVerifiedAt: now,
    createdAt: existing?.createdAt || now,
    lastActiveAt: now,
    words: existing?.words || {},
    totalSessionsCompleted: existing?.totalSessionsCompleted || 0,
    streakDays: existing?.streakDays || 0,
    following: existing?.following || [],
    followers: existing?.followers || [],
  };

  saveUserData(cleanEmail, newProfile);
  return res.json({ success: true, profile: newProfile });
});

// Set credentials for an existing account without password (e.g. migration)
app.post('/api/auth/set-credentials', (req, res) => {
  const { email, password, username, name } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ success: false, error: 'E-mailadres, wachtwoord en gebruikersnaam zijn verplicht' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUser)) {
    return res.status(400).json({ success: false, error: 'Gebruikersnaam mag 3-24 letters, cijfers en _ bevatten' });
  }

  const allUsers = getAllUsersCatalog();
  const usernameTaken = allUsers.some(u => 
    u.email.toLowerCase() !== cleanEmail && 
    u.username && u.username.toLowerCase() === cleanUser
  );
  if (usernameTaken) {
    return res.status(400).json({ success: false, error: 'Deze gebruikersnaam is al in gebruik' });
  }

  const existing = loadUserData(cleanEmail) || { email: cleanEmail };
  existing.username = cleanUser;
  existing.passwordHash = Buffer.from(password.trim()).toString('base64');
  if (name && name.trim()) {
    existing.name = name.trim();
  }
  existing.passwordUpdatedAt = Date.now();
  existing.lastActiveAt = Date.now();
  saveUserData(cleanEmail, existing);

  return res.json({ success: true, profile: existing });
});

// Check if a Google/Gmail account already exists
app.post('/api/auth/google-check', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Geldig e-mailadres is verplicht' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  if (existing && existing.username) {
    return res.json({ success: true, exists: true, profile: existing });
  }
  return res.json({ success: true, exists: false, email: cleanEmail });
});

// Register new account with Google credentials plus required Naam, Email, and Gebruikersnaam
app.post('/api/auth/google-register', (req, res) => {
  const { email, name, username, avatarUrl, targetLanguage, knownLanguage, verificationCode } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Geldig e-mailadres is verplicht' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Naam is verplicht' });
  }
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Gebruikersnaam is verplicht' });
  }

  const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUser)) {
    return res.status(400).json({ success: false, error: 'Gebruikersnaam mag 3-24 letters, cijfers en _ bevatten' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Verification code check is required for ALL registrations
  cleanExpiredVerifications();
  const pending = pendingVerifications.get(cleanEmail);
  const cleanCode = verificationCode ? String(verificationCode).trim() : '';

  if (!cleanCode) {
    return res.status(400).json({
      success: false,
      needsVerification: true,
      error: 'Bevestigingscode is verplicht om aan te tonen dat dit e-mailadres echt van jou is.',
    });
  }

  if (!pending || pending.code !== cleanCode || pending.expiresAt < Date.now()) {
    return res.status(400).json({
      success: false,
      needsVerification: true,
      error: 'Onjuiste of verlopen bevestigingscode. Controleer de 6-cijferige code in je mail of vraag een nieuwe aan.',
    });
  }

  // Remove pending code once verified
  pendingVerifications.delete(cleanEmail);

  const allUsers = getAllUsersCatalog();
  const usernameTaken = allUsers.some(u => 
    u.email.toLowerCase() !== cleanEmail && 
    u.username && u.username.toLowerCase() === cleanUser
  );
  if (usernameTaken) {
    return res.status(400).json({ success: false, error: 'Deze gebruikersnaam is al in gebruik door iemand anders' });
  }

  const existing = loadUserData(cleanEmail);
  const now = Date.now();
  const newProfile = {
    ...(existing || {}),
    email: cleanEmail,
    name: name.trim(),
    username: cleanUser,
    avatarUrl: existing?.avatarUrl || avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    targetLanguage: targetLanguage || existing?.targetLanguage || 'he',
    knownLanguage: knownLanguage || existing?.knownLanguage || 'en',
    level: existing?.level || 'A1',
    numericLevel: existing?.numericLevel || 1,
    maxUnlockedNumericLevel: existing?.maxUnlockedNumericLevel || 1,
    levelVerified: Boolean(existing?.levelVerified),
    emailVerified: true,
    emailVerifiedAt: now,
    isAdmin: cleanEmail === 'irithfuks@gmail.com',
    isGoogleUser: true,
    passwordHash: req.body.password && typeof req.body.password === 'string' && req.body.password.trim().length >= 6
      ? Buffer.from(req.body.password.trim()).toString('base64')
      : existing?.passwordHash,
    createdAt: existing?.createdAt || now,
    lastActiveAt: now,
    words: existing?.words || {},
    totalSessionsCompleted: existing?.totalSessionsCompleted || 0,
    streakDays: existing?.streakDays || 0,
    following: existing?.following || [],
    followers: existing?.followers || [],
  };

  saveUserData(cleanEmail, newProfile);
  return res.json({ success: true, profile: newProfile });
});

// Login or Register directly with Google/Gmail account
app.post('/api/auth/google-login', (req, res) => {
  const { email, name, avatarUrl, allowCreate } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Geldig e-mailadres is verplicht' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = loadUserData(cleanEmail);
  const now = Date.now();

  if (existing && existing.username) {
    if (existing.isDeleted) {
      delete existing.isDeleted;
      delete existing.deletedAt;
    }
    if (cleanEmail === 'irithfuks@gmail.com') {
      existing.isAdmin = true;
    }
    if (name && (!existing.name || existing.name === cleanEmail.split('@')[0])) {
      existing.name = name.trim();
    }
    if (avatarUrl && !existing.avatarUrl) {
      existing.avatarUrl = avatarUrl;
    }
    existing.isGoogleUser = true;
    existing.lastActiveAt = now;
    saveUserData(cleanEmail, existing);
    return res.json({ success: true, profile: existing, isNew: false });
  }

  // Automatic account creation for Google/Gmail users if not yet created
  const customUsername = (req.body.username || '').trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 24);
  const cleanUser = customUsername || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 24) || 'user';
  const allUsers = getAllUsersCatalog();
  let finalUser = cleanUser;
  if (!customUsername && allUsers.some(u => u.username && u.username.toLowerCase() === finalUser)) {
    finalUser = `${cleanUser}_${Math.floor(100 + Math.random() * 900)}`;
  }

  const newProfile = {
    email: cleanEmail,
    name: name?.trim() || cleanEmail.split('@')[0],
    username: finalUser,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    targetLanguage: 'he',
    knownLanguage: 'en',
    level: 'A1',
    numericLevel: 1,
    maxUnlockedNumericLevel: 1,
    levelVerified: false,
    isAdmin: cleanEmail === 'irithfuks@gmail.com',
    isGoogleUser: true,
    createdAt: now,
    lastActiveAt: now,
    words: {},
    totalSessionsCompleted: 0,
    streakDays: 0,
    following: [],
    followers: [],
  };

  saveUserData(cleanEmail, newProfile);
  return res.json({ success: true, profile: newProfile, isNew: true });
});

// --- ADMIN / BEHEERDERS ENDPOINTS ---

// Check if a user has admin privileges
function isUserAdmin(email: string): boolean {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === 'irithfuks@gmail.com') return true;
  const user = loadUserData(cleanEmail);
  return Boolean(user?.isAdmin);
}

// 1. Get all registered accounts and aggregate stats (combines local disk and Cloud Firestore)
app.get('/api/admin/users', async (req, res) => {
  const currentEmail = ((req.query.currentEmail as string) || '').toLowerCase().trim();
  if (!currentEmail || !isUserAdmin(currentEmail)) {
    return res.status(403).json({ error: 'Toegang geweigerd. Alleen voor de beheerder (irithfuks@gmail.com).' });
  }

  const registeredUsersMap = new Map<string, any>();

  // A. Scan local disk DATA_DIR
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      files.forEach((f) => {
        if (f.startsWith('user_') && f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
            const data = JSON.parse(raw);
            if (data && (data.email || data.username)) {
              const cleanEmail = (data.email || '').toLowerCase().trim();
              const cleanUser = (data.username || '').toLowerCase().trim();
              const words = data.words || {};
              const wordsList = Object.values(words) as any[];
              const totalWordsCount = wordsList.length;
              const masteredWordsCount = wordsList.filter((w: any) => w.category === 'blue' || (w.intervalDays && w.intervalDays >= 21)).length;
              const learningWordsCount = wordsList.filter((w: any) => w.category === 'red' || w.category === 'orange').length;

              // Determine the most recently studied language from words or targetLanguage
              let mostRecentLanguage = data.targetLanguage || 'he';
              let latestWordReview = 0;
              wordsList.forEach((w: any) => {
                if (w.lastReviewedAt && w.lastReviewedAt > latestWordReview) {
                  latestWordReview = w.lastReviewedAt;
                  if (w.languagePairKey) {
                    const pairLang = w.languagePairKey.split('-')[0];
                    if (pairLang) mostRecentLanguage = pairLang;
                  }
                }
              });

              const maxStreakDays = Math.max(data.maxStreakDays || 0, data.streakDays || 0);

              const summary = {
                email: cleanEmail,
                username: data.username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''),
                name: data.name || cleanEmail.split('@')[0],
                avatarUrl: data.avatarUrl || undefined,
                hasPassword: Boolean(data.passwordHash),
                targetLanguage: mostRecentLanguage,
                knownLanguage: data.knownLanguage || 'en',
                level: data.level || 'A1',
                numericLevel: data.numericLevel || 1,
                createdAt: data.createdAt || null,
                lastActiveAt: data.lastActiveAt || null,
                streakDays: data.streakDays || 0,
                maxStreakDays: maxStreakDays,
                totalSessionsCompleted: data.totalSessionsCompleted || 0,
                wordsCount: totalWordsCount,
                masteredCount: masteredWordsCount,
                learningCount: learningWordsCount,
                followersCount: (data.followers || []).length,
                followingCount: (data.following || []).length,
                isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(data.isAdmin),
                emailVerified: Boolean(data.emailVerified),
                emailVerifiedAt: data.emailVerifiedAt || null,
              };

              if (cleanEmail) registeredUsersMap.set(cleanEmail, summary);
              if (cleanUser) registeredUsersMap.set(cleanUser, summary);
            }
          } catch (e) {
            console.error('Error parsing user file for admin:', f, e);
          }
        }
      });
    }
  } catch (err) {
    console.error('Error reading DATA_DIR for admin:', err);
  }

  // B. Query Cloud Firestore publicProfiles and sync missing accounts
  if (serverDb) {
    try {
      const snap = await getDocs(collection(serverDb, 'publicProfiles'));
      snap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const rawEmail = d.email || d.ownerEmail || normalizeServerIdToEmail(docSnap.id);
        const email = (rawEmail || '').toLowerCase().trim();
        const username = (d.username || '').toLowerCase().trim();
        const cleanEmail = email.includes('@') ? email : (username ? `${username}@vocabpulse.com` : `${docSnap.id}@vocabpulse.com`);
        const cleanUser = d.username || cleanEmail.split('@')[0];

        const wordsCount = typeof d.totalWordsLearned === 'number' ? d.totalWordsLearned : 0;
        const streakEval = evaluateStreak({
          ...d,
          lastActiveDateStr: d.lastActiveDateStr,
          lastActiveAt: d.lastActiveAt || d.updatedAt,
          totalSessionsCompleted: d.totalSessionsCompleted,
          streakDays: d.streakDays,
          currentStreak: d.currentStreak,
        });
        const streak = streakEval.streakDays;

        const firestoreSummary = {
          email: cleanEmail,
          username: cleanUser,
          name: d.name || cleanUser,
          avatarUrl: d.avatarUrl || undefined,
          hasPassword: false,
          targetLanguage: d.targetLanguage || 'he',
          knownLanguage: d.knownLanguage || 'en',
          level: d.level || 'A1',
          numericLevel: d.numericLevel || 1,
          createdAt: d.createdAt || d.updatedAt || null,
          lastActiveAt: d.lastActiveAt || d.updatedAt || null,
          streakDays: streak,
          maxStreakDays: Math.max(d.maxStreakDays || 0, d.streakDays || 0, streak),
          totalSessionsCompleted: d.totalSessionsCompleted || 0,
          wordsCount: wordsCount,
          masteredCount: 0,
          learningCount: 0,
          followersCount: Array.isArray(d.followers) ? d.followers.length : 0,
          followingCount: Array.isArray(d.following) ? d.following.length : 0,
          isAdmin: cleanEmail === 'irithfuks@gmail.com' || Boolean(d.isAdmin),
          emailVerified: false,
          emailVerifiedAt: null,
        };

        const existing = (cleanEmail ? registeredUsersMap.get(cleanEmail) : undefined) ||
                         (cleanUser ? registeredUsersMap.get(cleanUser) : undefined);

        if (existing) {
          existing.wordsCount = Math.max(existing.wordsCount || 0, firestoreSummary.wordsCount);
          existing.streakDays = streak;
          existing.maxStreakDays = Math.max(existing.maxStreakDays || 0, firestoreSummary.maxStreakDays);
          existing.totalSessionsCompleted = Math.max(existing.totalSessionsCompleted || 0, firestoreSummary.totalSessionsCompleted);
          existing.lastActiveAt = Math.max(existing.lastActiveAt || 0, firestoreSummary.lastActiveAt || 0);
          if (firestoreSummary.name && (!existing.name || existing.name === existing.email.split('@')[0])) {
            existing.name = firestoreSummary.name;
          }
          if (firestoreSummary.avatarUrl && !existing.avatarUrl) {
            existing.avatarUrl = firestoreSummary.avatarUrl;
          }
          if (firestoreSummary.targetLanguage && existing.targetLanguage === 'he' && firestoreSummary.targetLanguage !== 'he') {
            existing.targetLanguage = firestoreSummary.targetLanguage;
          }
          if (cleanEmail.includes('@') && (!existing.email.includes('@') || existing.email.endsWith('@vocabpulse.com'))) {
            existing.email = cleanEmail;
          }
        } else {
          if (cleanEmail) registeredUsersMap.set(cleanEmail, firestoreSummary);
          if (cleanUser) registeredUsersMap.set(cleanUser, firestoreSummary);

          // Cache on server disk
          try {
            const diskPath = getUserFilePath(cleanEmail);
            if (!fs.existsSync(diskPath)) {
              fs.writeFileSync(diskPath, JSON.stringify({
                ...firestoreSummary,
                words: {},
              }, null, 2), 'utf-8');
            }
          } catch (_) {}
        }
      });
    } catch (fbErr) {
      console.warn('Error fetching Firestore publicProfiles in server admin route:', fbErr);
    }
  }

  const registeredUsers = Array.from(new Set(registeredUsersMap.values()));

  // Sort by last active or created at descending
  registeredUsers.sort((a, b) => {
    const timeA = b.lastActiveAt || b.createdAt || 0;
    const timeB = a.lastActiveAt || a.createdAt || 0;
    return timeA - timeB;
  });

  const totalRegistered = registeredUsers.length;
  const totalWordsLearned = registeredUsers.reduce((sum, u) => sum + (u.wordsCount || 0), 0);
  const totalSessions = registeredUsers.reduce((sum, u) => sum + (u.totalSessionsCompleted || 0), 0);

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const activeTodayCount = registeredUsers.filter((u) => u.lastActiveAt && u.lastActiveAt > oneDayAgo).length;

  const languageCounts: Record<string, number> = {};
  const levelCounts: Record<string, number> = {};

  registeredUsers.forEach((u) => {
    if (u.targetLanguage) {
      languageCounts[u.targetLanguage] = (languageCounts[u.targetLanguage] || 0) + 1;
    }
    if (u.level) {
      levelCounts[u.level] = (levelCounts[u.level] || 0) + 1;
    }
  });

  return res.json({
    success: true,
    stats: {
      totalRegistered,
      totalWordsLearned,
      totalSessions,
      activeTodayCount,
      languageCounts,
      levelCounts,
    },
    users: registeredUsers,
    communityCount: COMMUNITY_USERS.length,
  });
});

// 2. Get detailed user profile and word stats for admin inspection
app.get('/api/admin/user/:email', async (req, res) => {
  const currentEmail = ((req.query.currentEmail as string) || '').toLowerCase().trim();
  if (!currentEmail || !isUserAdmin(currentEmail)) {
    return res.status(403).json({ error: 'Toegang geweigerd. Alleen voor de beheerder.' });
  }

  const targetEmail = (req.params.email || '').toLowerCase().trim();
  let userData = loadUserData(targetEmail);

  // If not on disk, check Firestore directly
  if (!userData && serverDb) {
    try {
      const canonicalKey = targetEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docSnap = await getDoc(doc(serverDb, 'publicProfiles', canonicalKey));
      if (docSnap.exists()) {
        userData = docSnap.data();
      }
    } catch (_) {}
  }

  if (!userData) {
    return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  }

  // Sanitize: do not expose passwordHash
  const safeData = { ...userData };
  delete safeData.passwordHash;
  safeData.maxStreakDays = Math.max(userData.maxStreakDays || 0, userData.streakDays || 0);

  // Determine most recent studied language
  let mostRecentLanguage = userData.targetLanguage || 'he';
  let latestWordReview = 0;
  const wordsList = Object.values(userData.words || {}) as any[];
  wordsList.forEach((w: any) => {
    if (w.lastReviewedAt && w.lastReviewedAt > latestWordReview) {
      latestWordReview = w.lastReviewedAt;
      if (w.languagePairKey) {
        const pairLang = w.languagePairKey.split('-')[0];
        if (pairLang) mostRecentLanguage = pairLang;
      }
    }
  });
  safeData.targetLanguage = mostRecentLanguage;

  return res.json({ success: true, user: safeData });
});

// 3. Delete registered user (admin only)
app.post('/api/admin/delete-user', async (req, res) => {
  const { currentEmail, targetEmail } = req.body;
  const cleanAdmin = (currentEmail || '').toLowerCase().trim();
  const cleanTarget = (targetEmail || '').toLowerCase().trim();

  if (!cleanAdmin || !isUserAdmin(cleanAdmin)) {
    return res.status(403).json({ error: 'Toegang geweigerd. Alleen voor de beheerder.' });
  }

  if (cleanTarget === 'irithfuks@gmail.com') {
    return res.status(400).json({ error: 'Het hoofdbeheerdersaccount kan niet worden verwijderd.' });
  }

  let deleted = false;
  try {
    const filePath = getUserFilePath(cleanTarget);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
    userCache.delete(cleanTarget);

    // Also delete from Firestore if serverDb is available
    if (serverDb) {
      const canonicalKey = cleanTarget.replace(/[^a-zA-Z0-9_-]/g, '_');
      try {
        await deleteDoc(doc(serverDb, 'publicProfiles', canonicalKey));
        await deleteDoc(doc(serverDb, 'users', canonicalKey));
        await deleteDoc(doc(serverDb, 'emailIndex', canonicalKey));
        deleted = true;
      } catch (fbDelErr) {
        console.warn('Error deleting user from Firestore in admin route:', fbDelErr);
      }
    }

    if (deleted) {
      return res.json({ success: true, message: `Account ${cleanTarget} is succesvol verwijderd.` });
    }
    return res.status(404).json({ error: 'Gebruiker niet gevonden op de server.' });
  } catch (err) {
    console.error('Error deleting user file:', err);
    return res.status(500).json({ error: 'Fout bij het verwijderen van account.' });
  }
});

// ---------------------------------------------------------------------------
// TRANSLATION OVERRIDES ("I was correct") STORAGE & ENDPOINTS
// ---------------------------------------------------------------------------
const OVERRIDES_FILE = path.join(DATA_DIR, 'translation_overrides.json');
const CUSTOM_TRANSLATIONS_FILE = path.join(DATA_DIR, 'custom_translations.json');

function loadOverridesData(): Record<string, any> {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const raw = fs.readFileSync(OVERRIDES_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading overrides file:', e);
  }
  return {};
}

function saveOverridesData(data: Record<string, any>) {
  try {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving overrides file:', e);
  }
}

function loadCustomTranslations(): Record<string, string[]> {
  try {
    if (fs.existsSync(CUSTOM_TRANSLATIONS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_TRANSLATIONS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading custom translations file:', e);
  }
  return {};
}

function saveCustomTranslations(data: Record<string, string[]>) {
  try {
    fs.writeFileSync(CUSTOM_TRANSLATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving custom translations file:', e);
  }
}

// 1. Record an override from any quiz or placement session
app.post('/api/translation-override', (req, res) => {
  const {
    id,
    targetWord,
    cleanTargetWord,
    targetLanguage,
    knownLanguage,
    expectedTranslation,
    alternativeTranslations,
    userTyped,
    level,
    sessionType,
    userEmail,
    transliteration,
    direction,
    timestamp,
  } = req.body;

  if (!targetWord || !expectedTranslation) {
    return res.status(400).json({ error: 'targetWord and expectedTranslation are required' });
  }

  const now = timestamp || Date.now();
  const cleanWord = (targetWord || '').replace(/[\u0591-\u05C7]/g, '').trim().toLowerCase();
  const targetLang = (targetLanguage || 'he').toLowerCase().trim();
  const overrideKey = id || `${targetLang}_${cleanWord.replace(/[\s/\\#%?&]+/g, '_')}`;

  const allOverrides = loadOverridesData();
  const existing = allOverrides[overrideKey];

  const submissionLog = {
    timestamp: now,
    userEmail: userEmail || undefined,
    userTyped: (userTyped || '').trim() || '(empty)',
    sessionType: sessionType || 'quiz',
    level: level || 'A1',
    direction: direction || 'target_to_known',
  };

  const incomingAlts = Array.isArray(alternativeTranslations) ? alternativeTranslations : [];

  if (existing) {
    existing.overrideCount = (existing.overrideCount || 0) + 1;
    existing.lastReportedAt = now;
    existing.level = level || existing.level || 'A1';
    existing.transliteration = transliteration || existing.transliteration || '';
    existing.targetWord = targetWord;
    existing.expectedTranslation = expectedTranslation;

    const altsSet = new Set([...(existing.currentAlternatives || []), ...incomingAlts]);
    existing.currentAlternatives = Array.from(altsSet);

    if (userTyped && userTyped.trim()) {
      const trimmed = userTyped.trim();
      const answers: any[] = Array.isArray(existing.typedAnswers) ? existing.typedAnswers : [];
      const matchIdx = answers.findIndex(a => a.text.toLowerCase() === trimmed.toLowerCase());
      if (matchIdx >= 0) {
        answers[matchIdx].count = (answers[matchIdx].count || 1) + 1;
        answers[matchIdx].lastUsedAt = now;
      } else {
        answers.push({ text: trimmed, count: 1, lastUsedAt: now });
      }
      existing.typedAnswers = answers;
    }

    const logs: any[] = Array.isArray(existing.recentLogs) ? existing.recentLogs : [];
    logs.unshift(submissionLog);
    existing.recentLogs = logs.slice(0, 50);

    allOverrides[overrideKey] = existing;
  } else {
    const answers: any[] = [];
    if (userTyped && userTyped.trim()) {
      answers.push({ text: userTyped.trim(), count: 1, lastUsedAt: now });
    }

    allOverrides[overrideKey] = {
      id: overrideKey,
      targetWord,
      cleanTargetWord: cleanTargetWord || cleanWord,
      targetLanguage: targetLang,
      knownLanguage: knownLanguage || 'en',
      expectedTranslation,
      currentAlternatives: incomingAlts,
      overrideCount: 1,
      status: 'pending',
      firstReportedAt: now,
      lastReportedAt: now,
      typedAnswers: answers,
      recentLogs: [submissionLog],
      level: level || 'A1',
      transliteration: transliteration || '',
    };
  }

  saveOverridesData(allOverrides);
  res.json({ success: true, override: allOverrides[overrideKey] });
});

// 2. Admin endpoint to retrieve all overrides with aggregates and language breakdown
app.get('/api/admin/translation-overrides', (req, res) => {
  const currentEmail = ((req.query.currentEmail as string) || '').toLowerCase().trim();
  // Allow irithfuks@gmail.com, any admin, or signed in users viewing the stats
  const allOverridesMap = loadOverridesData();
  const overridesList = Object.values(allOverridesMap);

  // Sort descending by overrideCount, then by lastReportedAt
  overridesList.sort((a: any, b: any) => {
    if ((b.overrideCount || 0) !== (a.overrideCount || 0)) {
      return (b.overrideCount || 0) - (a.overrideCount || 0);
    }
    return (b.lastReportedAt || 0) - (a.lastReportedAt || 0);
  });

  const languageBreakdown: Record<string, number> = {};
  let totalOverrides = 0;
  let pendingCount = 0;
  let resolvedCount = 0;

  overridesList.forEach((item: any) => {
    const count = item.overrideCount || 1;
    totalOverrides += count;
    const lang = item.targetLanguage || 'he';
    languageBreakdown[lang] = (languageBreakdown[lang] || 0) + count;
    if (item.status === 'resolved') {
      resolvedCount += 1;
    } else if (item.status === 'pending') {
      pendingCount += 1;
    }
  });

  res.json({
    success: true,
    overrides: overridesList,
    stats: {
      totalOverrides,
      uniqueWords: overridesList.length,
      pendingCount,
      resolvedCount,
      languageBreakdown,
    },
  });
});

// 3. Admin action to add translation, mark resolved, dismiss, or delete
app.post('/api/admin/translation-overrides/action', (req, res) => {
  const { overrideId, action, addedTranslation, adminEmail } = req.body;
  if (!overrideId || !action) {
    return res.status(400).json({ error: 'overrideId and action are required' });
  }

  const allOverrides = loadOverridesData();
  const item = allOverrides[overrideId];
  if (!item && action !== 'delete') {
    return res.status(404).json({ error: 'Override not found' });
  }

  const now = Date.now();

  if (action === 'delete') {
    delete allOverrides[overrideId];
    saveOverridesData(allOverrides);
    return res.json({ success: true, message: 'Record deleted' });
  }

  if (action === 'add_translation') {
    if (!addedTranslation || !addedTranslation.trim()) {
      return res.status(400).json({ error: 'addedTranslation is required for add_translation action' });
    }
    const cleanAdd = addedTranslation.trim();
    const currentAlts: string[] = Array.isArray(item.currentAlternatives) ? [...item.currentAlternatives] : [];
    if (!currentAlts.some(a => a.toLowerCase() === cleanAdd.toLowerCase())) {
      currentAlts.push(cleanAdd);
    }
    item.currentAlternatives = currentAlts;
    item.status = 'resolved';
    item.resolvedTranslation = cleanAdd;
    item.resolvedAt = now;
    item.resolvedBy = adminEmail || 'Admin';

    // Persist in custom_translations dictionary store
    const customMap = loadCustomTranslations();
    const wordKey = item.targetWord;
    const cleanKey = item.cleanTargetWord || item.targetWord.replace(/[\u0591-\u05C7]/g, '');
    
    [wordKey, cleanKey].forEach(k => {
      if (!k) return;
      const existingList = customMap[k] || [];
      if (!existingList.some(s => s.toLowerCase() === cleanAdd.toLowerCase())) {
        existingList.push(cleanAdd);
      }
      customMap[k] = existingList;
    });
    saveCustomTranslations(customMap);

  } else if (action === 'mark_resolved') {
    item.status = 'resolved';
    item.resolvedAt = now;
    item.resolvedBy = adminEmail || 'Admin';
  } else if (action === 'dismiss') {
    item.status = 'dismissed';
    item.resolvedAt = now;
    item.resolvedBy = adminEmail || 'Admin';
  } else if (action === 'reopen') {
    item.status = 'pending';
    item.resolvedAt = undefined;
    item.resolvedBy = undefined;
  }

  allOverrides[overrideId] = item;
  saveOverridesData(allOverrides);

  res.json({ success: true, override: item });
});

// 4. Retrieve all custom approved translations to patch client dictionary
app.get('/api/custom-translations', (req, res) => {
  const customMap = loadCustomTranslations();
  res.json({ success: true, translations: customMap });
});

// --- SOCIAL, FRIENDS & POOLS DATA & ENDPOINTS ---

const COMMUNITY_USERS: any[] = [];

const POOLS_FILE = path.join(DATA_DIR, 'pools.json');
function loadPoolsData(): any[] {
  try {
    if (fs.existsSync(POOLS_FILE)) {
      return JSON.parse(fs.readFileSync(POOLS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading pools:', e);
  }
  return [];
}
function savePoolsData(pools: any[]): boolean {
  try {
    fs.writeFileSync(POOLS_FILE, JSON.stringify(pools, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving pools:', e);
    return false;
  }
}

const POOL_INVITES_FILE = path.join(DATA_DIR, 'pool_invitations.json');
function loadPoolInvitesData(): any[] {
  try {
    if (fs.existsSync(POOL_INVITES_FILE)) {
      return JSON.parse(fs.readFileSync(POOL_INVITES_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading pool invites:', e);
  }
  return [];
}
function savePoolInvitesData(invites: any[]): boolean {
  try {
    fs.writeFileSync(POOL_INVITES_FILE, JSON.stringify(invites, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving pool invites:', e);
    return false;
  }
}

function isWordLearnedInSession(progress: any): boolean {
  if (!progress) return false;
  if (progress.manuallyLearned === true) return false;
  if (progress.manuallyLearned === false) {
    return (progress.timesReviewed ?? 0) > 0 || (progress.history?.length ?? 0) > 0;
  }
  const hasSessionHistory = progress.history?.some((h: any) => Boolean(h.userAnswer));
  if (hasSessionHistory) return true;
  if ((progress.timesIncorrect ?? 0) > 0 || (progress.hardScore ?? 0) > 0 || progress.isHard) {
    return true;
  }
  if (progress.category === 'orange' || progress.category === 'yellow' || progress.category === 'green') {
    return true;
  }
  if ((progress.timesReviewed ?? 0) > 1 || (progress.history?.length ?? 0) > 1) {
    return true;
  }
  return false;
}

function isWordForTargetLanguageServer(word: any, targetLang?: string): boolean {
  if (!word) return false;
  const cleanLang = (targetLang || 'he').toLowerCase().trim();

  // 1. Hebrew character script check
  if (cleanLang !== 'he' && word.targetWord && /[\u0590-\u05FF]/.test(word.targetWord)) {
    return false;
  }

  // 2. Cyrillic character script check
  if (cleanLang !== 'ru' && word.targetWord && /[\u0400-\u04FF]/.test(word.targetWord)) {
    return false;
  }

  // 3. languagePairKey check
  if (word.languagePairKey && typeof word.languagePairKey === 'string') {
    const langPrefix = word.languagePairKey.split('-')[0].toLowerCase().trim();
    if (langPrefix && langPrefix !== cleanLang) {
      return false;
    }
  }

  // 4. Word ID prefix check
  const wId = word.wordId || word.id;
  if (wId && typeof wId === 'string' && wId.includes('-')) {
    const idPrefix = wId.split('-')[0].toLowerCase().trim();
    const knownCodes = ['he', 'ru', 'es', 'fr', 'de', 'nl', 'it', 'ar', 'fa', 'uk', 'pt', 'ja', 'ko'];
    if (knownCodes.includes(idPrefix) && idPrefix !== cleanLang) {
      return false;
    }
  }

  return true;
}

function isWordLearnedServer(progress: any): boolean {
  if (!progress) return false;
  if (progress.category === 'red') return false;
  return (
    progress.manuallyLearned === true ||
    isWordLearnedInSession(progress) ||
    progress.category === 'blue' ||
    progress.category === 'green' ||
    progress.category === 'yellow' ||
    progress.category === 'orange'
  );
}

function getWeeklyLearnedWordsList(wordsData: any, targetLanguage?: string): any[] {
  if (!wordsData || typeof wordsData !== 'object') return [];
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const mondayTimestamp = monday.getTime();

  const list: any[] = [];
  const cleanTargetLang = targetLanguage ? targetLanguage.toLowerCase().trim() : undefined;

  Object.values(wordsData).forEach((w: any) => {
    if (!w) return;

    // 1. Language isolation: words must belong to targetLanguage
    if (cleanTargetLang && !isWordForTargetLanguageServer(w, cleanTargetLang)) {
      return;
    }

    // 2. Unlearned words (red category) NEVER count in the ranking
    if (w.category === 'red') return;

    // 3. Must be learned via daily practice session OR manually moved to 'geleerd'
    const hasBeenLearned = w.manuallyLearned === true || isWordLearnedInSession(w) || isWordLearnedServer(w);
    if (!hasBeenLearned) return;

    const firstLearned = w.firstLearnedAt || w.introducedAt || w.firstIntroducedAt ||
      (Array.isArray(w.history) && w.history.length > 0 && typeof w.history[0]?.timestamp === 'number'
        ? w.history[0].timestamp
        : (w.lastReviewedAt || 0));

    if (firstLearned >= mondayTimestamp) {
      list.push({
        id: w.wordId || w.id || '',
        targetWord: w.targetWord || '',
        translation: w.translation || '',
        transliteration: w.transliteration || '',
        partOfSpeech: w.partOfSpeech || '',
        level: w.level || 'A1',
        learnedAt: firstLearned,
      });
    }
  });

  list.sort((a, b) => b.learnedAt - a.learnedAt);
  return list;
}

function getWeeklyNewWordsForUser(userData: any, targetLanguage?: string): number {
  if (!userData) return 0;
  const lang = targetLanguage || userData.targetLanguage || 'he';
  return getWeeklyLearnedWordsList(userData.words, lang).length;
}

// Get all users (community + registered disk users)
function getAllUsersCatalog(): any[] {
  const usersMap = new Map<string, any>();

  // 1. Add community users
  COMMUNITY_USERS.forEach(u => usersMap.set(u.email.toLowerCase(), { ...u }));

  // 2. Read registered users from DATA_DIR
  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      const distinctEmails = new Set<string>();
      files.forEach(f => {
        if (f.startsWith('user_') && f.endsWith('.json')) {
          const rawEmail = f.replace(/^user_/, '').replace(/_[a-z]{2,5}\.json$/, '').replace(/\.json$/, '');
          const cleanEmail = rawEmail.toLowerCase().trim();
          if (cleanEmail && cleanEmail.includes('@')) {
            distinctEmails.add(cleanEmail);
          }
        }
      });

      distinctEmails.forEach(cleanEmail => {
        const baseUser = loadBaseUser(cleanEmail);
        if (!baseUser || baseUser.isDeleted) return;

        const activeLang = (baseUser.targetLanguage || 'he').toLowerCase().trim();
        const activeUserData = loadUserData(cleanEmail, activeLang) || baseUser;

        const wordsCount = Object.keys(activeUserData.words || {}).length;
        const streakEval = evaluateStreak(activeUserData);
        const streakVal = streakEval.streakDays;

        usersMap.set(cleanEmail, {
          email: cleanEmail,
          username: activeUserData.username || baseUser.username || cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, ''),
          name: activeUserData.name || baseUser.name || cleanEmail.split('@')[0],
          duolingoName: activeUserData.duolingoName || (activeUserData.name ? activeUserData.name.replace(/\s+/g, '') : undefined),
          avatarUrl: activeUserData.avatarUrl || baseUser.avatarUrl || undefined,
          targetLanguage: activeLang,
          knownLanguage: activeUserData.knownLanguage || baseUser.knownLanguage || 'en',
          level: activeUserData.level || 'A1',
          numericLevel: activeUserData.numericLevel || 1,
          currentStreak: streakVal,
          streakDays: streakVal,
          maxStreakDays: activeUserData.maxStreakDays || streakVal,
          createdAt: activeUserData.createdAt || baseUser.createdAt || 0,
          lastActiveDateStr: activeUserData.lastActiveDateStr || '',
          totalWordsLearned: wordsCount,
          totalSessionsCompleted: activeUserData.totalSessionsCompleted || 0,
          weeklyNewWordsCount: getWeeklyNewWordsForUser(activeUserData, activeLang),
          weeklyWords: getWeeklyLearnedWordsList(activeUserData.words, activeLang),
          following: activeUserData.following || baseUser.following || [],
          followers: activeUserData.followers || baseUser.followers || [],
        });
      });
    }
  } catch (e) {
    console.error('Error scanning data directory:', e);
  }

  return Array.from(usersMap.values());
}

// 3c. Search users & People you may know recommendations
app.get('/api/social/search', (req, res) => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  const currentEmail = ((req.query.currentEmail as string) || '').toLowerCase().trim();

  let currentUser = currentEmail ? loadUserData(currentEmail) : null;

  const userFollowing = new Set<string>((currentUser?.following || []).map((e: string) => e.toLowerCase()));
  const userFollowers = new Set<string>((currentUser?.followers || []).map((e: string) => e.toLowerCase()));

  const allUsers = getAllUsersCatalog();
  const cleanQ = q.replace(/^@/, '');

  if (q) {
    const filtered = allUsers
      .filter(u => {
        if (currentEmail && u.email.toLowerCase() === currentEmail) return false;
        return (
          (u.username && u.username.toLowerCase().includes(cleanQ)) ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.duolingoName && u.duolingoName.toLowerCase().includes(cleanQ)) ||
          (u.targetLanguage && u.targetLanguage.toLowerCase().includes(q))
        );
      })
      .map(u => ({
        ...u,
        isFollowing: userFollowing.has(u.email.toLowerCase()),
        isFollower: userFollowers.has(u.email.toLowerCase()),
      }));

    return res.json({ users: filtered });
  }

  // When q is empty: People you may know -> people that the people that I follow follow / are followed by
  const followersMap = computeFollowersMap(allUsers);
  const mutualConnectionScores = new Map<string, number>();

  userFollowing.forEach(friendEmail => {
    const friend = allUsers.find(u => u.email.toLowerCase() === friendEmail) || (loadUserData(friendEmail) as any);
    if (!friend) return;

    // 1. People that the people I follow follow
    const theirFollowing = (friend?.following || []).map((e: string) => e.toLowerCase().trim());
    theirFollowing.forEach((targetEmail: string) => {
      if (currentEmail && targetEmail === currentEmail) return;
      mutualConnectionScores.set(targetEmail, (mutualConnectionScores.get(targetEmail) || 0) + 1);
    });

    // 2. People that follow the people I follow (are followed by)
    const theirFollowers = (friend?.followers || followersMap.get(friendEmail) || []).map((e: string) => e.toLowerCase().trim());
    theirFollowers.forEach((followerEmail: string) => {
      if (currentEmail && followerEmail === currentEmail) return;
      mutualConnectionScores.set(followerEmail, (mutualConnectionScores.get(followerEmail) || 0) + 1);
    });
  });

  const secondDegreeUnfollowed: any[] = [];
  const secondDegreeFollowed: any[] = [];
  const addedEmails = new Set<string>();

  mutualConnectionScores.forEach((count, targetEmail) => {
    const userObj = allUsers.find(u => u.email.toLowerCase() === targetEmail);
    if (userObj && targetEmail !== currentEmail) {
      if (!userFollowing.has(targetEmail)) {
        secondDegreeUnfollowed.push({ ...userObj, mutualCount: count });
      } else {
        secondDegreeFollowed.push({ ...userObj, mutualCount: count });
      }
    }
  });

  // Sort candidates: prioritize people not followed yet, ordered by how many mutual connections link to them
  secondDegreeUnfollowed.sort((a, b) => b.mutualCount - a.mutualCount);
  secondDegreeFollowed.sort((a, b) => b.mutualCount - a.mutualCount);

  const peopleYouMayKnow: any[] = [];
  [...secondDegreeUnfollowed, ...secondDegreeFollowed].forEach(u => {
    if (!addedEmails.has(u.email.toLowerCase())) {
      addedEmails.add(u.email.toLowerCase());
      peopleYouMayKnow.push(u);
    }
  });

  // If there are few second-degree connections (e.g. user follows few people or network is starting), pad with remaining community members
  if (peopleYouMayKnow.length < 6) {
    allUsers.forEach(u => {
      const email = u.email.toLowerCase();
      if (email !== currentEmail && !addedEmails.has(email)) {
        addedEmails.add(email);
        peopleYouMayKnow.push(u);
      }
    });
  }

  const mapped = peopleYouMayKnow.map(u => ({
    ...u,
    isFollowing: userFollowing.has(u.email.toLowerCase()),
    isFollower: userFollowers.has(u.email.toLowerCase()),
  }));

  res.json({ users: mapped });
});

// Compute followers map for all users (who follows whom)
function computeFollowersMap(allUsers: any[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  allUsers.forEach(u => {
    const userEmail = u.email.toLowerCase().trim();
    if (!map.has(userEmail)) map.set(userEmail, new Set());
    (u.following || []).forEach((f: string) => {
      const target = f.toLowerCase().trim();
      if (!map.has(target)) map.set(target, new Set());
      map.get(target)!.add(userEmail);
    });
  });
  const res = new Map<string, string[]>();
  map.forEach((set, key) => res.set(key, Array.from(set)));
  return res;
}

// Shared Dutch date labels for accurate learning history
const DUTCH_DAY_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const DUTCH_DAY_FULL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DUTCH_MONTH_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// Calculate words learned per day over the past 7 days (non-cumulative)
function calculatePast7DaysWordStats(words?: Record<string, any>, referenceDate: Date = new Date()) {
  const days: { dateStr: string; label: string; fullLabel: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay();
    const label = DUTCH_DAY_SHORT[dayOfWeek];
    const fullLabel = `${DUTCH_DAY_FULL[dayOfWeek]} ${d.getDate()} ${DUTCH_MONTH_SHORT[d.getMonth()]}`;
    days.push({ dateStr, label, fullLabel, count: 0 });
  }

  if (words && typeof words === 'object') {
    Object.values(words).forEach((w: any) => {
      if (!w) return;
      const ts = w.firstLearnedAt || w.introducedAt || w.firstIntroducedAt ||
        (Array.isArray(w.history) && w.history.length > 0 && typeof w.history[0]?.timestamp === 'number'
          ? w.history[0].timestamp
          : (w.lastReviewedAt || 0));
      if (!ts) return;

      const wd = new Date(ts);
      const wDateStr = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-${String(wd.getDate()).padStart(2, '0')}`;
      const dayMatch = days.find(d => d.dateStr === wDateStr);
      if (dayMatch) {
        dayMatch.count++;
      }
    });
  }

  const labels = days.map(d => d.label);
  const fullLabels = days.map(d => d.fullLabel);
  const values = days.map(d => d.count);
  const total = values.reduce((a, b) => a + b, 0);
  const exactAvgNum = total === 0 ? 0 : Number((total / 7).toFixed(1));
  const averageExact = total === 0 ? '0' : (total % 7 === 0 ? String(total / 7) : (total / 7).toFixed(1).replace('.', ','));

  return {
    labels,
    fullLabels,
    values,
    average: exactAvgNum,
    averageExact,
    total,
  };
}

// Calculate cumulative words learned since user started (5 points: Start=0, 1/4, 1/2, 4/5, Nu)
function calculateCumulativeWordStats(words?: Record<string, any>, createdAt?: number, referenceDate: Date = new Date()) {
  const wordList = words && typeof words === 'object' ? Object.values(words) : [];
  const validTimestamps: number[] = [];

  wordList.forEach((w: any) => {
    if (!w) return;
    const ts = w.firstLearnedAt || w.introducedAt || w.firstIntroducedAt ||
      (Array.isArray(w.history) && w.history.length > 0 && typeof w.history[0]?.timestamp === 'number'
        ? w.history[0].timestamp
        : (w.lastReviewedAt || 0));
    if (typeof ts === 'number' && ts > 0) {
      validTimestamps.push(ts);
    }
  });

  validTimestamps.sort((a, b) => a - b);
  const totalWords = wordList.length;
  const nowTs = referenceDate.getTime();

  if (totalWords === 0) {
    const monthShort = DUTCH_MONTH_SHORT[referenceDate.getMonth()];
    const capMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
    return {
      labels: [capMonth, '', capMonth, '', capMonth],
      fullLabels: ['Start', '1/4', 'Halverwege', '4/5', 'Nu'],
      values: [0, 0, 0, 0, 0],
      total: 0,
      average: 0,
      averageExact: '0',
    };
  }

  const earliestWordTs = validTimestamps[0] || nowTs;
  const startTs = createdAt && createdAt <= earliestWordTs ? createdAt : earliestWordTs;
  const timeSpanMs = Math.max(1000, nowTs - startTs);

  const fractions = [0, 0.25, 0.50, 0.80, 1.0];
  const points = fractions.map((frac, idx) => {
    const t = startTs + timeSpanMs * frac;
    const d = new Date(t);
    const monthShort = DUTCH_MONTH_SHORT[d.getMonth()];
    const capMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

    let label = '';
    if (idx === 0 || idx === 2 || idx === 4) {
      label = capMonth;
    }

    let count = 0;
    let fullLabel = '';
    if (idx === 0) {
      count = 0;
      fullLabel = `Start (${d.getDate()} ${monthShort})`;
    } else if (idx === 4) {
      count = totalWords;
      fullLabel = `Nu (${d.getDate()} ${monthShort})`;
    } else {
      const checkEnd = new Date(d);
      checkEnd.setHours(23, 59, 59, 999);
      count = validTimestamps.filter(ts => ts <= checkEnd.getTime()).length;
      const stageName = idx === 1 ? '1/4' : idx === 2 ? 'Halverwege' : '4/5';
      fullLabel = `${stageName} (${d.getDate()} ${monthShort})`;
    }

    return { label, fullLabel, value: count };
  });

  return {
    labels: points.map(p => p.label),
    fullLabels: points.map(p => p.fullLabel),
    values: points.map(p => p.value),
    total: totalWords,
    average: totalWords > 0 ? Number((totalWords / 5).toFixed(1)) : 0,
    averageExact: String(totalWords),
  };
}

// 3d. Get single public profile
app.get('/api/social/profile/:email', (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();
  const currentEmail = ((req.query.currentEmail as string) || '').toLowerCase().trim();

  const currentUser = currentEmail ? loadUserData(currentEmail) : null;
  const userFollowing = new Set<string>((currentUser?.following || []).map((e: string) => e.toLowerCase()));
  const userFollowers = new Set<string>((currentUser?.followers || []).map((e: string) => e.toLowerCase()));

  const allUsers = getAllUsersCatalog();
  const followersMap = computeFollowersMap(allUsers);
  const targetUser = allUsers.find(u => u.email.toLowerCase() === targetEmail);

  if (!targetUser) {
    return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  }

  const targetFollowingEmails = (targetUser.following || []).map((e: string) => e.toLowerCase());
  const targetFollowersEmails = followersMap.get(targetEmail) || [];

  // Map each following/follower email to PublicUserProfile summary
  const followingUsers = targetFollowingEmails
    .map(email => allUsers.find(u => u.email.toLowerCase() === email))
    .filter(Boolean)
    .map(u => ({
      email: u.email,
      username: u.username,
      name: u.name,
      duolingoName: u.duolingoName,
      avatarUrl: u.avatarUrl,
      targetLanguage: u.targetLanguage,
      level: u.level,
      numericLevel: u.numericLevel,
      streakDays: u.streakDays,
      totalWordsLearned: u.totalWordsLearned,
      weeklyNewWordsCount: u.weeklyNewWordsCount,
      isFollowing: userFollowing.has(u.email.toLowerCase()),
      isFollower: userFollowers.has(u.email.toLowerCase()),
    }));

  const followersUsers = targetFollowersEmails
    .map(email => allUsers.find(u => u.email.toLowerCase() === email))
    .filter(Boolean)
    .map(u => ({
      email: u.email,
      username: u.username,
      name: u.name,
      duolingoName: u.duolingoName,
      avatarUrl: u.avatarUrl,
      targetLanguage: u.targetLanguage,
      level: u.level,
      numericLevel: u.numericLevel,
      streakDays: u.streakDays,
      totalWordsLearned: u.totalWordsLearned,
      weeklyNewWordsCount: u.weeklyNewWordsCount,
      isFollowing: userFollowing.has(u.email.toLowerCase()),
      isFollower: userFollowers.has(u.email.toLowerCase()),
    }));

  const fullTargetUser = loadUserData(targetEmail);
  const targetWords = fullTargetUser?.words || targetUser?.words || {};
  const targetCreatedAt = fullTargetUser?.createdAt || targetUser?.createdAt;

  const past7DaysHistory = calculatePast7DaysWordStats(targetWords);
  const cumulativeHistory = calculateCumulativeWordStats(targetWords, targetCreatedAt);

  res.json({
    profile: {
      ...targetUser,
      createdAt: targetCreatedAt,
      isFollowing: userFollowing.has(targetEmail),
      isFollower: userFollowers.has(targetEmail),
      following: targetFollowingEmails,
      followers: targetFollowersEmails,
      followingUsers,
      followersUsers,
      past7DaysHistory,
      weeklyHistory: past7DaysHistory, // alias
      cumulativeHistory,
    },
  });
});

// 3d-2. Get weekly learned words list for a user (visible to all pool members)
app.get('/api/social/user/:email/weekly-words', (req, res) => {
  const targetEmail = req.params.email.toLowerCase().trim();
  const targetLangParam = (req.query.targetLanguage as string) || '';
  const userData = loadUserData(targetEmail, targetLangParam || undefined);

  if (!userData) {
    const allUsers = getAllUsersCatalog();
    const u = allUsers.find(item => item.email.toLowerCase() === targetEmail);
    if (u) {
      const effectiveLang = targetLangParam || u.targetLanguage || 'he';
      const words = u.weeklyWords ? getWeeklyLearnedWordsList(u.weeklyWords, effectiveLang) : [];
      return res.json({
        email: u.email,
        name: u.name,
        targetLanguage: effectiveLang,
        count: words.length,
        words,
      });
    }
    return res.status(404).json({ error: 'Gebruiker niet gevonden', count: 0, words: [] });
  }

  const effectiveLang = targetLangParam || userData.targetLanguage || 'he';
  const wordsList = getWeeklyLearnedWordsList(userData.words, effectiveLang);
  res.json({
    email: targetEmail,
    name: userData.name || targetEmail.split('@')[0],
    targetLanguage: effectiveLang,
    count: wordsList.length,
    words: wordsList,
  });
});

// 3e. Follow / Unfollow
app.post('/api/social/follow', (req, res) => {
  const { currentEmail, targetEmail, follow } = req.body;
  if (!currentEmail || !targetEmail) {
    return res.status(400).json({ error: 'Both currentEmail and targetEmail are required' });
  }

  const cEmail = resolveUserEmail(currentEmail);
  const tEmail = resolveUserEmail(targetEmail);
  if (cEmail === tEmail) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  // Load and update current user
  let cUser = loadUserData(cEmail);
  if (!cUser) {
    cUser = { 
      email: cEmail, 
      name: cEmail.split('@')[0], 
      targetLanguage: 'he', 
      knownLanguage: 'en', 
      level: 'A1', 
      streakDays: 0, 
      currentStreak: 0, 
      following: [], 
      followers: [] 
    };
  }
  const followingList = new Set<string>((cUser.following || []).map((e: string) => e.toLowerCase()));

  if (follow) {
    followingList.add(tEmail);
  } else {
    followingList.delete(tEmail);
  }
  cUser.following = Array.from(followingList);
  saveUserData(cEmail, cUser);

  // Load and update target user if saved on disk, or initialize target user
  let tUser = loadUserData(tEmail);
  if (!tUser) {
    const fromComm = COMMUNITY_USERS.find(u => u.email.toLowerCase() === tEmail);
    tUser = fromComm 
      ? { ...fromComm } 
      : { 
          email: tEmail, 
          name: tEmail.split('@')[0], 
          targetLanguage: 'he', 
          knownLanguage: 'en', 
          level: 'A1', 
          streakDays: 0, 
          currentStreak: 0, 
          following: [], 
          followers: [] 
        };
  }
  const followersList = new Set<string>((tUser.followers || []).map((e: string) => e.toLowerCase()));
  if (follow) {
    followersList.add(cEmail);
  } else {
    followersList.delete(cEmail);
  }
  tUser.followers = Array.from(followersList);
  saveUserData(tEmail, tUser);

  res.json({
    success: true,
    following: cUser.following,
    followers: cUser.followers,
    targetFollowers: tUser.followers,
    isFollowing: follow,
  });
});

// 3f. Get user connections (Following & Followers)
app.get('/api/social/connections', (req, res) => {
  const rawEmail = ((req.query.email as string) || '').toLowerCase().trim();
  if (!rawEmail) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  const currentEmail = resolveUserEmail(rawEmail);
  const possibleIdentifiers = new Set<string>([rawEmail, currentEmail]);
  let cUser = loadUserData(currentEmail) || loadUserData(rawEmail);
  if (!cUser) {
    cUser = { email: currentEmail, following: [], followers: [] };
  } else {
    if (cUser.email) possibleIdentifiers.add(cUser.email.toLowerCase().trim());
    if (cUser.username) possibleIdentifiers.add(cUser.username.toLowerCase().trim());
    if (!cUser.following) cUser.following = [];
    if (!cUser.followers) cUser.followers = [];
  }

  const allUsers = getAllUsersCatalog();
  const allUsersMap = new Map<string, any>();
  allUsers.forEach(u => allUsersMap.set(u.email.toLowerCase(), u));

  // Compute followers map dynamically across all users so that if user A follows user B,
  // user B instantly sees user A in their followers list!
  const followersMap = computeFollowersMap(allUsers);
  const computedFollowers = Array.from(new Set([
    ...(followersMap.get(currentEmail) || []),
    ...(followersMap.get(rawEmail) || []),
  ]));

  const followingEmailsSet = new Set<string>((cUser.following || []).map((e: string) => e.toLowerCase()));
  const followersEmailsSet = new Set<string>([
    ...(cUser.followers || []).map((e: string) => e.toLowerCase()),
    ...computedFollowers.map((e: string) => e.toLowerCase())
  ]);

  const followingEmails = Array.from(followingEmailsSet);
  const followersEmails = Array.from(followersEmailsSet);

  const followingUsers = followingEmails
    .map(e => allUsersMap.get(e.toLowerCase()) || {
      email: e,
      name: e.split('@')[0],
      username: e.split('@')[0],
      targetLanguage: 'he',
      knownLanguage: 'en',
      level: 'A1',
      streakDays: 0,
      currentStreak: 0,
      totalWordsLearned: 0,
      weeklyNewWordsCount: 0,
    })
    .map(u => ({ 
      ...u, 
      currentStreak: u.currentStreak !== undefined ? u.currentStreak : (u.streakDays || 0),
      streakDays: u.currentStreak !== undefined ? u.currentStreak : (u.streakDays || 0),
      isFollowing: true,
      isFollower: followersEmailsSet.has(u.email.toLowerCase()),
    }));

  const followersUsers = followersEmails
    .map(e => allUsersMap.get(e.toLowerCase()) || {
      email: e,
      name: e.split('@')[0],
      username: e.split('@')[0],
      targetLanguage: 'he',
      knownLanguage: 'en',
      level: 'A1',
      streakDays: 0,
      currentStreak: 0,
      totalWordsLearned: 0,
      weeklyNewWordsCount: 0,
    })
    .map(u => ({ 
      ...u, 
      currentStreak: u.currentStreak !== undefined ? u.currentStreak : (u.streakDays || 0),
      streakDays: u.currentStreak !== undefined ? u.currentStreak : (u.streakDays || 0),
      isFollower: true, 
      isFollowing: followingEmailsSet.has(u.email.toLowerCase()),
    }));

  res.json({
    following: followingUsers,
    followers: followersUsers,
  });
});

// 3g. Get Friend Pools & Pending Invitations
app.get('/api/social/pools', (req, res) => {
  const rawEmail = ((req.query.email as string) || '').toLowerCase().trim();
  const currentEmail = resolveUserEmail(rawEmail);
  const possibleIdentifiers = new Set<string>([rawEmail, currentEmail]);
  const userObj = loadUserData(currentEmail) || loadUserData(rawEmail);
  if (userObj?.email) possibleIdentifiers.add(userObj.email.toLowerCase().trim());
  if (userObj?.username) possibleIdentifiers.add(userObj.username.toLowerCase().trim());

  const allUsers = getAllUsersCatalog();
  const usersMap = new Map<string, any>();
  allUsers.forEach(u => usersMap.set(u.email.toLowerCase(), u));

  let pools = loadPoolsData();

  // If no pools exist, create default pool for the current user
  if (pools.length === 0) {
    const defaultPool = {
      id: 'pool-default-weekly-sprint',
      name: 'Poule 1',
      createdBy: currentEmail || 'irithfuks@gmail.com',
      createdAt: Date.now() - 3 * 86400000,
      memberEmails: currentEmail ? [currentEmail] : ['irithfuks@gmail.com'],
      pendingEmails: [],
    };
    pools = [defaultPool];
    savePoolsData(pools);
  }

  // Filter pools where user is confirmed member or creator (supports email OR username)
  const userPools = pools.filter(p => {
    if (!rawEmail) return true;
    if (possibleIdentifiers.has(p.createdBy.toLowerCase())) return true;
    const members = (p.memberEmails || []).map((e: string) => e.toLowerCase());
    return members.some((m: string) => 
      possibleIdentifiers.has(m) || possibleIdentifiers.has(resolveUserEmail(m))
    );
  });

  // Hydrate pool members with current stats and sort by weekly words
  const hydrated = (userPools.length > 0 ? userPools : []).map(pool => {
    // Collect all member emails and any pending emails so all selected participants appear in the leaderboard
    const allCandidateEmails = [...(pool.memberEmails || []), ...(pool.pendingEmails || [])];
    const memberEmails: string[] = Array.from(new Set(allCandidateEmails.map(e => String(e).toLowerCase().trim()))).filter(Boolean);
    const poolAdminEmail = (pool.createdBy || '').toLowerCase();

    const members = memberEmails.map(email => {
      const resolvedM = resolveUserEmail(email);
      const u = usersMap.get(resolvedM) || usersMap.get(email.toLowerCase());
      const isMemberAdmin = poolAdminEmail ? (email.toLowerCase() === poolAdminEmail || resolvedM === poolAdminEmail) : false;
      const isUserCurrent = Boolean(rawEmail) && (
        possibleIdentifiers.has(email.toLowerCase()) || 
        possibleIdentifiers.has(resolvedM)
      );

      if (u) {
        return {
          email: u.email,
          name: u.name,
          avatarUrl: u.avatarUrl,
          level: u.level,
          numericLevel: u.numericLevel,
          targetLanguage: u.targetLanguage,
          weeklyNewWordsCount: u.weeklyNewWordsCount || 0,
          weeklyWords: u.weeklyWords || [],
          streakDays: u.streakDays || 0,
          isCurrentUser: isUserCurrent,
          isAdmin: isMemberAdmin,
        };
      }
      return {
        email,
        name: email.split('@')[0],
        level: 'A1',
        numericLevel: 1,
        targetLanguage: 'he',
        weeklyNewWordsCount: 0,
        streakDays: 0,
        isCurrentUser: isUserCurrent,
        isAdmin: isMemberAdmin,
      };
    });

    // Rank members descending by weekly new words count
    members.sort((a, b) => b.weeklyNewWordsCount - a.weeklyNewWordsCount);

    return {
      id: pool.id,
      name: pool.name,
      createdBy: pool.createdBy,
      createdAt: pool.createdAt,
      members,
      pendingMembers: pool.pendingEmails || [],
      isAdmin: currentEmail ? poolAdminEmail === currentEmail : false,
    };
  });

  // Also fetch any pending invitations for the current user
  let invitations: any[] = [];
  if (currentEmail) {
    const allInvites = loadPoolInvitesData();
    const userInvites = allInvites.filter(inv => inv.recipientEmail.toLowerCase() === currentEmail && inv.status === 'pending');
    invitations = userInvites.map(inv => {
      const inviterUser = usersMap.get(inv.invitedBy.toLowerCase());
      return {
        poolId: inv.poolId,
        poolName: inv.poolName,
        invitedBy: inv.invitedBy,
        invitedByName: inviterUser?.name || inv.invitedBy.split('@')[0],
        invitedAt: inv.invitedAt,
      };
    });
  }

  res.json({ pools: hydrated, invitations });
});

// 3h. Create Friend Pool (Creator is automatically the Admin)
app.post('/api/social/pools/create', (req, res) => {
  const { email, name, memberEmails } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Naam van de poule is verplicht' });
  }

  const cleanEmail = (email || '').toLowerCase().trim();
  const poolId = `pool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const poolName = name.trim();

  // Selected other members
  const rawInvited = (memberEmails || []).map((e: string) => e.toLowerCase().trim()).filter((e: string) => e && e !== cleanEmail);
  const invitedEmails = Array.from(new Set<string>(rawInvited));

  // The creator and all selected friends are immediately members of the poule
  const allMembers = Array.from(new Set<string>([
    ...(cleanEmail ? [cleanEmail] : []),
    ...invitedEmails,
  ]));

  const newPool = {
    id: poolId,
    name: poolName,
    createdBy: cleanEmail || 'anonymous',
    createdAt: Date.now(),
    memberEmails: allMembers,
    pendingEmails: [],
  };

  const pools = loadPoolsData();
  pools.unshift(newPool);
  savePoolsData(pools);

  // Store invitations for each invited member
  if (invitedEmails.length > 0) {
    const allInvites = loadPoolInvitesData();
    invitedEmails.forEach(recipient => {
      allInvites.push({
        poolId,
        poolName,
        invitedBy: cleanEmail,
        recipientEmail: recipient,
        invitedAt: Date.now(),
        status: 'accepted',
      });
    });
    savePoolInvitesData(allInvites);
  }

  res.json({ success: true, pool: newPool });
});

// 3i. Rename Pool (Everyone in the pool can adjust the name)
app.post('/api/social/pools/rename', (req, res) => {
  const { poolId, newName, email } = req.body;
  if (!poolId || !newName || !newName.trim()) {
    return res.status(400).json({ error: 'Poule ID en een geldige naam zijn verplicht' });
  }

  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ error: 'Poule niet gevonden' });
  }

  const userEmail = (email || '').toLowerCase().trim();
  const isMember = (pool.memberEmails || []).some((e: string) => e.toLowerCase() === userEmail) || pool.createdBy.toLowerCase() === userEmail;
  if (userEmail && !isMember) {
    return res.status(403).json({ error: 'Je moet lid zijn van de poule om de naam aan te passen' });
  }

  pool.name = newName.trim();
  savePoolsData(pools);

  // Also update pending invites with the new name
  const allInvites = loadPoolInvitesData();
  allInvites.forEach(inv => {
    if (inv.poolId === poolId) {
      inv.poolName = pool.name;
    }
  });
  savePoolInvitesData(allInvites);

  res.json({ success: true, poolName: pool.name });
});

// 3j. Add / Invite Members to Pool (Everyone in the pool can invite others)
app.post('/api/social/pools/invite', (req, res) => {
  const { poolId, inviteEmails, senderEmail } = req.body;
  if (!poolId || !Array.isArray(inviteEmails) || inviteEmails.length === 0) {
    return res.status(400).json({ error: 'Poule ID en vrienden om uit te nodigen zijn verplicht' });
  }

  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ error: 'Poule niet gevonden' });
  }

  const cleanSender = (senderEmail || '').toLowerCase().trim();
  const allInvites = loadPoolInvitesData();
  if (!pool.pendingEmails) pool.pendingEmails = [];

  const newlyInvited: string[] = [];
  inviteEmails.forEach((rawEmail: string) => {
    const target = (rawEmail || '').toLowerCase().trim();
    if (!target) return;
    // Don't re-invite if already member
    if ((pool.memberEmails || []).some((e: string) => e.toLowerCase() === target)) return;
    // Don't re-invite if already pending
    if (pool.pendingEmails.includes(target)) return;

    // Add to memberEmails so they immediately appear in the leaderboard
    if (!pool.memberEmails) pool.memberEmails = [];
    if (!pool.memberEmails.includes(target)) {
      pool.memberEmails.push(target);
    }

    pool.pendingEmails.push(target);
    newlyInvited.push(target);

    // Save invitation notification
    allInvites.push({
      poolId: pool.id,
      poolName: pool.name,
      invitedBy: cleanSender || pool.createdBy,
      recipientEmail: target,
      invitedAt: Date.now(),
      status: 'pending',
    });
  });

  savePoolsData(pools);
  savePoolInvitesData(allInvites);

  res.json({ success: true, newlyInvited });
});

// 3k. Respond to Pool Invitation (Accept or Decline)
app.post('/api/social/pools/invitations/respond', (req, res) => {
  const { poolId, email, action } = req.body; // action: 'accept' | 'decline'
  if (!poolId || !email || !action) {
    return res.status(400).json({ error: 'Poule ID, e-mail en actie zijn verplicht' });
  }

  const userEmail = (email || '').toLowerCase().trim();
  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);

  const allInvites = loadPoolInvitesData();
  const inviteIndex = allInvites.findIndex(
    inv => inv.poolId === poolId && inv.recipientEmail.toLowerCase() === userEmail && inv.status === 'pending'
  );

  if (inviteIndex >= 0) {
    allInvites[inviteIndex].status = action === 'accept' ? 'accepted' : 'declined';
    allInvites[inviteIndex].respondedAt = Date.now();
    savePoolInvitesData(allInvites);
  }

  if (pool) {
    // Remove from pendingEmails
    if (pool.pendingEmails) {
      pool.pendingEmails = pool.pendingEmails.filter((e: string) => e.toLowerCase() !== userEmail);
    }

    if (action === 'accept') {
      if (!pool.memberEmails) pool.memberEmails = [];
      if (!pool.memberEmails.some((e: string) => e.toLowerCase() === userEmail)) {
        pool.memberEmails.push(userEmail);
      }
    }
    savePoolsData(pools);
  }

  res.json({ success: true, action });
});

// 3l. Leave Pool (Member chooses to leave)
app.post('/api/social/pools/leave', (req, res) => {
  const { poolId, email } = req.body;
  if (!poolId || !email) {
    return res.status(400).json({ error: 'Poule ID en e-mail zijn verplicht' });
  }

  const userEmail = (email || '').toLowerCase().trim();
  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ error: 'Poule niet gevonden' });
  }

  // Remove from memberEmails and pendingEmails
  pool.memberEmails = (pool.memberEmails || []).filter((e: string) => e.toLowerCase() !== userEmail);
  if (pool.pendingEmails) {
    pool.pendingEmails = pool.pendingEmails.filter((e: string) => e.toLowerCase() !== userEmail);
  }

  // If the admin leaves, assign admin to the next member if any exist
  if (pool.createdBy.toLowerCase() === userEmail) {
    if (pool.memberEmails.length > 0) {
      pool.createdBy = pool.memberEmails[0];
    } else {
      // If pool is empty, delete pool
      const updatedPools = pools.filter(p => p.id !== poolId);
      savePoolsData(updatedPools);
      return res.json({ success: true, poolDeleted: true });
    }
  }

  savePoolsData(pools);
  res.json({ success: true, poolDeleted: false });
});

// 3m. Remove Member from Pool (Admin only)
app.post('/api/social/pools/remove-member', (req, res) => {
  const { poolId, adminEmail, targetMemberEmail } = req.body;
  if (!poolId || !adminEmail || !targetMemberEmail) {
    return res.status(400).json({ error: 'Poule ID, admin en te verwijderen lid zijn verplicht' });
  }

  const userAdmin = (adminEmail || '').toLowerCase().trim();
  const targetEmail = (targetMemberEmail || '').toLowerCase().trim();

  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ error: 'Poule niet gevonden' });
  }

  // Check if requester is admin
  if (pool.createdBy.toLowerCase() !== userAdmin) {
    return res.status(403).json({ error: 'Alleen de beheerder (admin) van deze poule kan leden verwijderen' });
  }

  // Remove target from members and pending
  pool.memberEmails = (pool.memberEmails || []).filter((e: string) => e.toLowerCase() !== targetEmail);
  if (pool.pendingEmails) {
    pool.pendingEmails = pool.pendingEmails.filter((e: string) => e.toLowerCase() !== targetEmail);
  }

  savePoolsData(pools);
  res.json({ success: true, targetEmail });
});

// 3n. Delete Pool (Anyone who is part of the pool can delete it as requested)
app.post('/api/social/pools/delete', (req, res) => {
  const { poolId, email } = req.body;
  if (!poolId) {
    return res.status(400).json({ error: 'Poule ID is verplicht' });
  }

  const userEmail = (email || '').toLowerCase().trim();
  const pools = loadPoolsData();
  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ error: 'Poule niet gevonden' });
  }

  const isMember = !userEmail || 
    (pool.memberEmails || []).some((e: string) => e.toLowerCase() === userEmail) || 
    pool.createdBy.toLowerCase() === userEmail;

  if (!isMember) {
    return res.status(403).json({ error: 'Alleen deelnemers van deze poule kunnen hem verwijderen' });
  }

  const updatedPools = pools.filter(p => p.id !== poolId);
  savePoolsData(updatedPools);

  // Also remove pending invites for this pool
  const allInvites = loadPoolInvitesData();
  const remainingInvites = allInvites.filter(inv => inv.poolId !== poolId);
  savePoolInvitesData(remainingInvites);

  res.json({ success: true, poolId });
});

// 4. Generate Level Placement Test (10 Words) to double check level
app.post('/api/placement/generate', async (req, res) => {
  const { targetLanguage, level } = req.body;
  res.json({
    fallback: true,
    questions: getFallbackPlacementQuestions(targetLanguage || 'he', level || 'A1'),
  });
});

// Helper for Hebrew orthography: treats cholam (o-sound diacritic) and vav ('ו') as equivalent
function isHebrewServer(str: string): boolean {
  return /[\u0590-\u05FF]/.test(str || '');
}

function expandHebrewVariantsServer(input: string): string[] {
  if (!input) return [];
  const results = new Set<string>();
  const rawClean = input.toLowerCase().replace(/[,;—–/\\.\'"״׳!?:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!rawClean) return [];

  const stripped = rawClean.replace(/[\u0591-\u05C7]/g, '').trim();
  if (stripped) results.add(stripped);

  // Convert holam / kamats katan / qubuts to vav ('ו')
  const withVavForO = rawClean
    .replace(/\u05D5[\u0591-\u05C7]*/g, '\u05D5')
    .replace(/([\u05D0-\u05D4\u05D6-\u05EA])([^\u05D0-\u05EA\s]*?)([\u05B9\u05BA\u05C7\u05B3\u05BB])/g, (_match, letter) => letter + '\u05D5')
    .replace(/[\u0591-\u05C7]/g, '')
    .trim();
  if (withVavForO) results.add(withVavForO);

  // Generate ktiv chaser form by dropping internal single vav
  const words = stripped.split(' ');
  const droppedVavWords = words.map(w => {
    if (w.length <= 2) return w;
    return w.replace(/(?<!^|\u05D5)\u05D5(?!\u05D5|$)/g, '');
  }).join(' ');
  if (droppedVavWords) results.add(droppedVavWords);

  return Array.from(results).filter(Boolean);
}

function stripBracketedContentServer(text: string): string {
  if (!text) return '';
  const stripped = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length > 0) return stripped;
  return text.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripGrammarMarkersServer(text: string): string {
  return text
    .replace(/^(to\s+|a\s+|an\s+|the\s+)/i, '')
    .replace(/(\s+to\s+|\s+a\s+|\s+an\s+|\s+the\s+)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areHebrewAnswersMatchingServer(userAnswer: string, expectedAnswer: string): boolean {
  if (!userAnswer || !expectedAnswer) return false;
  if (!isHebrewServer(userAnswer) && !isHebrewServer(expectedAnswer)) return false;

  const userClean = userAnswer.replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const expClean = expectedAnswer.replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  if (userClean === expClean) return true;

  const userVars = new Set(expandHebrewVariantsServer(userAnswer));
  const expVars = new Set(expandHebrewVariantsServer(expectedAnswer));
  for (const u of userVars) {
    if (expVars.has(u)) return true;
  }

  const stripInternalVav = (s: string) =>
    s.split(' ').map(w => w.length > 2 ? w.replace(/(?<!^|\u05D5)\u05D5(?!\u05D5|$)/g, '') : w).join(' ');
  if (stripInternalVav(userClean) === stripInternalVav(expClean)) return true;

  return false;
}

// 5. Intelligent Translation Checker endpoint
app.post('/api/check-translation', async (req, res) => {
  const { targetWord, promptWord, expectedTranslation, alternativeTranslations, userTranslation, targetLanguage, knownLanguage, direction } = req.body;

  if (!userTranslation || !expectedTranslation) {
    return res.status(400).json({ error: 'userTranslation and expectedTranslation are required' });
  }

  const effectiveTarget = (targetWord || promptWord || '').trim();

  // Merge any dynamically approved custom translations from the admin dashboard
  const customMap = loadCustomTranslations();
  const cleanTargetWord = effectiveTarget.replace(/[\u0591-\u05C7]/g, '').trim().toLowerCase();
  const customApproved = [
    ...(customMap[effectiveTarget] || []),
    ...(customMap[cleanTargetWord] || [])
  ];
  const mergedAlternatives = Array.from(new Set([
    ...(Array.isArray(alternativeTranslations) ? alternativeTranslations : []),
    ...customApproved
  ]));

  // Instant check: If the user typed an accepted alternative or the expected translation
  const rawUserClean = userTranslation.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const rawExpectedClean = expectedTranslation.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();

  if (rawUserClean === rawExpectedClean) {
    return res.json({
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Spot on! Correct answer.',
      matchedAlternative: userTranslation,
    });
  }

  // Brackets equivalence check: e.g. "Orange (fruit)" vs "Orange"
  // If the actual translation has something in brackets like 'Orange (fruit)',
  // always also count it correct without the thing in the brackets.
  const userNoBrackets = stripBracketedContentServer(userTranslation);
  const expectedNoBrackets = stripBracketedContentServer(expectedTranslation);
  const cleanUserNoB = userNoBrackets.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanExpNoB = expectedNoBrackets.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const userNoBStripped = stripGrammarMarkersServer(cleanUserNoB);
  const expNoBStripped = stripGrammarMarkersServer(cleanExpNoB);

  if (
    (cleanUserNoB && cleanExpNoB && (cleanUserNoB === cleanExpNoB || userNoBrackets.toLowerCase() === expectedNoBrackets.toLowerCase())) ||
    (userNoBStripped && expNoBStripped && userNoBStripped === expNoBStripped)
  ) {
    return res.json({
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Spot on! Correct answer.',
      matchedAlternative: expectedNoBrackets,
    });
  }

  // Hebrew orthographic equivalence: if user answer matches expected or any alternative via cholam ('o') vs vav ('ו')
  if (
    areHebrewAnswersMatchingServer(userTranslation, expectedTranslation) ||
    (userNoBrackets && expectedNoBrackets && areHebrewAnswersMatchingServer(userNoBrackets, expectedNoBrackets))
  ) {
    return res.json({
      isCorrect: true,
      verdict: 'correct',
      feedback: `Spot on! "${userTranslation}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
      matchedAlternative: expectedTranslation,
    });
  }

  const matchedAlt = mergedAlternatives.find(alt => {
    const cleanAlt = alt.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanAlt === rawUserClean) return true;
    const altNoB = stripBracketedContentServer(alt);
    const cleanAltNoB = altNoB.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanAltNoB && cleanUserNoB && cleanAltNoB === cleanUserNoB) return true;
    return false;
  });

  if (matchedAlt) {
    return res.json({
      isCorrect: true,
      verdict: 'correct',
      feedback: `Spot on! "${userTranslation}" is an accepted translation.`,
      matchedAlternative: matchedAlt,
    });
  }

  const matchedHebrewAlt = mergedAlternatives.find(alt => {
    if (areHebrewAnswersMatchingServer(userTranslation, alt)) return true;
    const altNoB = stripBracketedContentServer(alt);
    if (userNoBrackets && altNoB && areHebrewAnswersMatchingServer(userNoBrackets, altNoB)) return true;
    return false;
  });
  if (matchedHebrewAlt) {
    return res.json({
      isCorrect: true,
      verdict: 'correct',
      feedback: `Spot on! "${userTranslation}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.`,
      matchedAlternative: matchedHebrewAlt,
    });
  }

  const aiResult = await evaluateTranslationWithAI({
    targetWord: effectiveTarget,
    expectedTranslation,
    alternativeTranslations: mergedAlternatives,
    userTranslation,
    targetLanguage: targetLanguage || 'target',
    knownLanguage: knownLanguage || 'known',
    direction,
  });

  if (aiResult) {
    return res.json(aiResult);
  }

  // Local fallback checking if AI is unavailable
  const rawUser = userTranslation.trim().toLowerCase();
  const rawExpected = expectedTranslation.trim().toLowerCase();
  const stripHebrewVowels = (s: string) => s.replace(/[\u0591-\u05C7]/g, '');
  const cleanUser = stripHebrewVowels(rawUser).replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanExpected = stripHebrewVowels(rawExpected).replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const isExact = rawUser === rawExpected || cleanUser === cleanExpected;
  
  const rawAcceptable = [rawExpected, expectedNoBrackets, ...mergedAlternatives.map((s: string) => s.toLowerCase().trim())];
  const allAcceptable: string[] = [];
  rawAcceptable.forEach(item => {
    if (!item) return;
    item.split(/[/,;|]/).forEach(part => {
      const trimmed = part.trim();
      if (trimmed) {
        allAcceptable.push(trimmed);
        allAcceptable.push(stripHebrewVowels(trimmed));
        const pNoB = stripBracketedContentServer(trimmed);
        if (pNoB && pNoB !== trimmed) {
          allAcceptable.push(pNoB);
          allAcceptable.push(stripHebrewVowels(pNoB));
        }
      }
    });
  });

  // Common synonym expansion in fallback
  const SERVER_SYNONYMS: Record<string, string[]> = {
    'plan': ['program', 'programme', 'schedule', 'scheme', 'blueprint'],
    'program': ['plan', 'programme', 'schedule', 'scheme'],
    'תכנית': ['תוכנית', 'סדר יום', 'לוח זמנים'],
    'תוכנית': ['תכנית', 'סדר יום', 'לוח זמנים'],
    'development': ['progress', 'advancement', 'evolution', 'growth'],
    'progress': ['development', 'advancement', 'growth'],
    'answer': ['reply', 'response', 'solution'],
    'reply': ['answer', 'response'],
    'response': ['answer', 'reply'],
    'house': ['home', 'residence'],
    'home': ['house', 'residence'],
  };

  const expandedAcceptable = new Set<string>(allAcceptable);
  allAcceptable.forEach(term => {
    const clean = term.replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
    expandedAcceptable.add(clean);
    if (SERVER_SYNONYMS[clean]) {
      SERVER_SYNONYMS[clean].forEach(syn => expandedAcceptable.add(syn));
    }
  });

  const isAltMatch = Array.from(expandedAcceptable).some(alt => {
    const cleanAlt = stripHebrewVowels(alt).replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const altNoB = stripBracketedContentServer(alt);
    const cleanAltNoB = stripHebrewVowels(altNoB).replace(/[,;.\'\"״׳!?:()/\\–—]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleanAlt === cleanUser || 
           (cleanAltNoB && cleanUserNoB && cleanAltNoB === cleanUserNoB) ||
           rawUser === alt || 
           (userNoBrackets && altNoB && userNoBrackets === altNoB) ||
           stripHebrewVowels(rawUser) === stripHebrewVowels(alt) || 
           areHebrewAnswersMatchingServer(userTranslation, alt) ||
           (userNoBrackets && altNoB && areHebrewAnswersMatchingServer(userNoBrackets, altNoB));
  });

  const isCorrect = isExact || 
                    (cleanUserNoB && cleanExpNoB && cleanUserNoB === cleanExpNoB) ||
                    isAltMatch || 
                    areHebrewAnswersMatchingServer(userTranslation, expectedTranslation) ||
                    (userNoBrackets && expectedNoBrackets && areHebrewAnswersMatchingServer(userNoBrackets, expectedNoBrackets));
  res.json({
    isCorrect,
    verdict: isCorrect ? 'correct' : 'incorrect_meaning',
    feedback: isCorrect
      ? (isHebrewServer(userTranslation) ? `Spot on! "${userTranslation}" is an accepted Hebrew spelling variant with "ו" for the "o" vowel.` : 'Correct translation!')
      : `Incorrect translation. Expected "${expectedTranslation}".`,
  });
});

// Helper for AI Translation Evaluation
async function evaluateTranslationWithAI(params: {
  targetWord: string;
  expectedTranslation: string;
  alternativeTranslations?: string[];
  userTranslation: string;
  targetLanguage: string;
  knownLanguage: string;
  direction?: 'target_to_known' | 'known_to_target';
}) {
  const { targetWord, expectedTranslation, alternativeTranslations, userTranslation, targetLanguage, knownLanguage, direction } = params;
  
  // Quick guard if user and expected are already Hebrew equivalents or bracket-stripped equivalents
  const userNoB = stripBracketedContentServer(userTranslation);
  const expNoB = stripBracketedContentServer(expectedTranslation);
  if (userNoB && expNoB && userNoB.toLowerCase() === expNoB.toLowerCase()) {
    return {
      isCorrect: true,
      verdict: 'correct',
      feedback: 'Spot on! Correct answer.',
      matchedSynonym: expNoB,
    };
  }

  if (
    areHebrewAnswersMatchingServer(userTranslation, expectedTranslation) ||
    (userNoB && expNoB && areHebrewAnswersMatchingServer(userNoB, expNoB))
  ) {
    return {
      isCorrect: true,
      verdict: 'correct',
      feedback: `Spot on! "${userTranslation}" is an accepted Hebrew spelling with "ו" for the "o" vowel.`,
      matchedSynonym: expectedTranslation,
    };
  }

  // Local grading engine will handle all synonym, phonetic, and orthographic checking
  return null;
}

// 6. Verify and Evaluate Placement Test Results
app.post('/api/placement/verify', async (req, res) => {
  const { level, answers, targetLanguage, knownLanguage } = req.body;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Answers array is required' });
  }

  let correctCount = 0;
  const gradedAnswers: any[] = [];

  for (const ans of answers) {
    const userAns = (ans.userAnswer || '').trim();
    const expected = (ans.expectedTranslation || '').trim();
    
    // If client already evaluated or if we need to evaluate
    let isCorrect = ans.isCorrect;
    let feedback = ans.feedback || '';

    if (typeof isCorrect !== 'boolean') {
      const cleanUser = userAns.toLowerCase().replace(/[,;.\'\"״׳!?:()]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanExpected = expected.toLowerCase().replace(/[,;.\'\"״׳!?:()]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const isExact = cleanUser === cleanExpected;
      const isContained = expected.toLowerCase().split(/[/,;]/).some(part => {
        const p = part.replace(/[,;.\'\"״׳!?:()]/g, ' ').trim();
        return p === cleanUser;
      });
      isCorrect = isExact || isContained;
    }

    if (isCorrect) correctCount++;

    gradedAnswers.push({
      targetWord: ans.targetWord,
      expectedTranslation: ans.expectedTranslation,
      userAnswer: ans.userAnswer,
      isCorrect,
      feedback,
    });
  }

  const totalQuestions = answers.length || 10;
  const scorePercent = (correctCount / totalQuestions) * 100;
  const passed = correctCount >= 7; // 70% threshold to confirm level

  // Determine suggested level if failed
  const levelsOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentIndex = levelsOrder.indexOf(level);
  let suggestedLevel = level;

  if (!passed) {
    if (scorePercent < 40 && currentIndex > 0) {
      suggestedLevel = levelsOrder[Math.max(0, currentIndex - 1)];
    } else if (currentIndex > 0) {
      suggestedLevel = levelsOrder[currentIndex - 1];
    }
  }

  let feedback = '';
  if (passed) {
    feedback = `Verified! You scored ${correctCount}/${totalQuestions} (70%+ required). Your proficiency at level ${level} is confirmed.`;
  } else {
    feedback = `You scored ${correctCount}/${totalQuestions}. We recommend starting at ${suggestedLevel} to build solid confidence before advancing to ${level}.`;
  }

  res.json({
    totalQuestions,
    correctCount,
    level,
    passed,
    suggestedLevel,
    feedback,
    answers: gradedAnswers,
  });
});

// 6. Generate New Vocabulary Words for Study Sessions
app.post('/api/generate-vocab', (req, res) => {
  res.json({ words: [] });
});

// Fallback placement helper for Hebrew/others when offline
function getFallbackPlacementQuestions(lang: string, level: string) {
  if (lang === 'he') {
    const map: Record<string, any[]> = {
      A1: [
        { id: 'p-1', targetWord: 'שָׁלוֹם', expectedTranslation: 'Hello', alternativeTranslations: ['Peace', 'Hi'], transliteration: 'shalom', partOfSpeech: 'greeting', options: ['Hello', 'Goodbye', 'Welcome', 'Thank you'] },
        { id: 'p-2', targetWord: 'תּוֹדָה', expectedTranslation: 'Thank you', alternativeTranslations: ['Thanks'], transliteration: 'toda', partOfSpeech: 'interjection', options: ['Thank you', 'Please', 'Excuse me', 'Good morning'] },
        { id: 'p-3', targetWord: 'בַּיִת', expectedTranslation: 'House', alternativeTranslations: ['Home'], transliteration: 'bayit', partOfSpeech: 'noun', options: ['House', 'Street', 'School', 'Car'] },
        { id: 'p-4', targetWord: 'מַיִם', expectedTranslation: 'Water', transliteration: 'mayim', partOfSpeech: 'noun', options: ['Water', 'Milk', 'Wine', 'Juice'] },
        { id: 'p-5', targetWord: 'לֶחֶם', expectedTranslation: 'Bread', transliteration: 'lechem', partOfSpeech: 'noun', options: ['Bread', 'Meat', 'Fruit', 'Salt'] },
        { id: 'p-6', targetWord: 'סֵפֶר', expectedTranslation: 'Book', transliteration: 'sefer', partOfSpeech: 'noun', options: ['Book', 'Letter', 'Pen', 'Table'] },
        { id: 'p-7', targetWord: 'כֵּן', expectedTranslation: 'Yes', transliteration: 'ken', partOfSpeech: 'adverb', options: ['Yes', 'No', 'Maybe', 'Always'] },
        { id: 'p-8', targetWord: 'לֹא', expectedTranslation: 'No', alternativeTranslations: ['Not'], transliteration: 'lo', partOfSpeech: 'adverb', options: ['No', 'Yes', 'Never', 'Always'] },
        { id: 'p-9', targetWord: 'יוֹם', expectedTranslation: 'Day', transliteration: 'yom', partOfSpeech: 'noun', options: ['Day', 'Night', 'Week', 'Year'] },
        { id: 'p-10', targetWord: 'לַיְלָה', expectedTranslation: 'Night', transliteration: 'layla', partOfSpeech: 'noun', options: ['Night', 'Morning', 'Evening', 'Afternoon'] },
      ],
      A2: [
        { id: 'p-1', targetWord: 'מִשְׂפָּחָה', expectedTranslation: 'Family', transliteration: 'mishpacha', partOfSpeech: 'noun', options: ['Family', 'Friends', 'Neighborhood', 'Parents'] },
        { id: 'p-2', targetWord: 'עֲבוֹדָה', expectedTranslation: 'Work', alternativeTranslations: ['Job', 'Labor'], transliteration: 'avoda', partOfSpeech: 'noun', options: ['Work', 'Study', 'Vacation', 'Task'] },
        { id: 'p-3', targetWord: 'לִנְסוֹעַ', expectedTranslation: 'To travel', alternativeTranslations: ['To ride', 'Travel', 'Ride'], transliteration: 'linso\'a', partOfSpeech: 'verb', options: ['To travel', 'To walk', 'To fly', 'To stay'] },
        { id: 'p-4', targetWord: 'חֲנוּת', expectedTranslation: 'Store', alternativeTranslations: ['Shop'], transliteration: 'chanut', partOfSpeech: 'noun', options: ['Store', 'Market', 'Bank', 'Office'] },
        { id: 'p-5', targetWord: 'לִקְנוֹת', expectedTranslation: 'To buy', alternativeTranslations: ['Buy', 'To purchase'], transliteration: 'liknot', partOfSpeech: 'verb', options: ['To buy', 'To sell', 'To pay', 'To borrow'] },
        { id: 'p-6', targetWord: 'מְזֶג אֲוִיר', expectedTranslation: 'Weather', transliteration: 'mezeg avir', partOfSpeech: 'noun', options: ['Weather', 'Climate', 'Wind', 'Season'] },
        { id: 'p-7', targetWord: 'רְחוֹב', expectedTranslation: 'Street', alternativeTranslations: ['Road'], transliteration: 'rekhov', partOfSpeech: 'noun', options: ['Street', 'City', 'Bridge', 'Square'] },
        { id: 'p-8', targetWord: 'חָבֵר', expectedTranslation: 'Friend', alternativeTranslations: ['Pal'], transliteration: 'chaver', partOfSpeech: 'noun', options: ['Friend', 'Teacher', 'Neighbor', 'Colleague'] },
        { id: 'p-9', targetWord: 'שָׁעָה', expectedTranslation: 'Hour', alternativeTranslations: ['Time'], transliteration: 'sha\'a', partOfSpeech: 'noun', options: ['Hour', 'Minute', 'Second', 'Century'] },
        { id: 'p-10', targetWord: 'חֻפְשָׁה', expectedTranslation: 'Vacation', alternativeTranslations: ['Holiday'], transliteration: 'chufsha', partOfSpeech: 'noun', options: ['Vacation', 'Weekend', 'Break', 'Meeting'] },
      ],
      B1: [
        { id: 'p-1', targetWord: 'הִתְפַּתְּחוּת', expectedTranslation: 'Development', alternativeTranslations: ['Progress', 'Advancement', 'Growth'], transliteration: 'hitpatchut', partOfSpeech: 'noun', options: ['Development', 'Degradation', 'Discovery', 'Event'] },
        { id: 'p-2', targetWord: 'לְהַסְבִּיר', expectedTranslation: 'To explain', alternativeTranslations: ['Explain', 'To clarify'], transliteration: 'lehasbir', partOfSpeech: 'verb', options: ['To explain', 'To ask', 'To convince', 'To show'] },
        { id: 'p-3', targetWord: 'הַחְלָטָה', expectedTranslation: 'Decision', alternativeTranslations: ['Resolution', 'Choice'], transliteration: 'hachlata', partOfSpeech: 'noun', options: ['Decision', 'Opinion', 'Doubt', 'Hesitation'] },
        { id: 'p-4', targetWord: 'הִזְדַּמְּנוּת', expectedTranslation: 'Opportunity', alternativeTranslations: ['Chance'], transliteration: 'hizdamnut', partOfSpeech: 'noun', options: ['Opportunity', 'Coincidence', 'Accident', 'Advantage'] },
        { id: 'p-5', targetWord: 'סְבִיבָה', expectedTranslation: 'Environment', alternativeTranslations: ['Surroundings'], transliteration: 'sviva', partOfSpeech: 'noun', options: ['Environment', 'Nature', 'Atmosphere', 'Society'] },
        { id: 'p-6', targetWord: 'מַשְׁמָעוּת', expectedTranslation: 'Meaning', alternativeTranslations: ['Significance', 'Sense'], transliteration: 'mashma\'ut', partOfSpeech: 'noun', options: ['Meaning', 'Truth', 'Definition', 'Concept'] },
        { id: 'p-7', targetWord: 'לְהַצְלִיחַ', expectedTranslation: 'To succeed', alternativeTranslations: ['Succeed', 'To prosper'], transliteration: 'lehatzli\'ach', partOfSpeech: 'verb', options: ['To succeed', 'To fail', 'To achieve', 'To attempt'] },
        { id: 'p-8', targetWord: 'מְצִיאוּת', expectedTranslation: 'Reality', alternativeTranslations: ['Truth'], transliteration: 'metzi\'ut', partOfSpeech: 'noun', options: ['Reality', 'Illusion', 'Existence', 'Dream'] },
        { id: 'p-9', targetWord: 'הַשְׁפָּעָה', expectedTranslation: 'Influence', alternativeTranslations: ['Impact', 'Effect'], transliteration: 'hashpa\'a', partOfSpeech: 'noun', options: ['Influence', 'Inspiration', 'Change', 'Control'] },
        { id: 'p-10', targetWord: 'לְהִתְנַהֵג', expectedTranslation: 'To behave', alternativeTranslations: ['Behave', 'To act'], transliteration: 'lehitnaheg', partOfSpeech: 'verb', options: ['To behave', 'To react', 'To perform', 'To lead'] },
      ],
      B2: [
        { id: 'p-1', targetWord: 'הִשְׁתַּקְּפוּת', expectedTranslation: 'Reflection', transliteration: 'hishtakfut', partOfSpeech: 'noun', options: ['Reflection', 'Shadow', 'Appearance', 'Resemblance'] },
        { id: 'p-2', targetWord: 'מֻרְכָּבוּת', expectedTranslation: 'Complexity', alternativeTranslations: ['Intricacy'], transliteration: 'murkavut', partOfSpeech: 'noun', options: ['Complexity', 'Simplicity', 'Difficulty', 'Depth'] },
        { id: 'p-3', targetWord: 'לְהַפְנִים', expectedTranslation: 'To internalize', alternativeTranslations: ['Internalize', 'To absorb'], transliteration: 'lehafneem', partOfSpeech: 'verb', options: ['To internalize', 'To express', 'To digest', 'To memorize'] },
        { id: 'p-4', targetWord: 'עִקָּרוֹן', expectedTranslation: 'Principle', alternativeTranslations: ['Rule', 'Tenet'], transliteration: 'ikaron', partOfSpeech: 'noun', options: ['Principle', 'Hypothesis', 'Complexity', 'Tradition'] },
        { id: 'p-5', targetWord: 'הַשְׁעָרָה', expectedTranslation: 'Hypothesis', alternativeTranslations: ['Assumption'], transliteration: 'hash\'ara', partOfSpeech: 'noun', options: ['Hypothesis', 'Fact', 'Proof', 'Certainty'] },
        { id: 'p-6', targetWord: 'לְהַבְחִין', expectedTranslation: 'To distinguish', alternativeTranslations: ['To notice', 'Distinguish', 'Notice', 'Perceive'], transliteration: 'lehavchin', partOfSpeech: 'verb', options: ['To distinguish', 'To explain', 'To justify', 'To internalize'] },
        { id: 'p-7', targetWord: 'עֲקָבִיּוּת', expectedTranslation: 'Consistency', transliteration: 'akaviyut', partOfSpeech: 'noun', options: ['Consistency', 'Stability', 'Persistence', 'Discipline'] },
        { id: 'p-8', targetWord: 'סְתִירָה', expectedTranslation: 'Contradiction', alternativeTranslations: ['Inconsistency'], transliteration: 'stira', partOfSpeech: 'noun', options: ['Contradiction', 'Agreement', 'Coherence', 'Harmony'] },
        { id: 'p-9', targetWord: 'לְנַמֵּק', expectedTranslation: 'To justify', alternativeTranslations: ['Justify', 'To substantiate'], transliteration: 'lenamek', partOfSpeech: 'verb', options: ['To justify', 'To explain', 'To question', 'To argue'] },
        { id: 'p-10', targetWord: 'חֲשִׁיבוּת', expectedTranslation: 'Importance', alternativeTranslations: ['Significance'], transliteration: 'chashivut', partOfSpeech: 'noun', options: ['Importance', 'Priority', 'Value', 'Necessity'] },
      ],
      C1: [
        { id: 'p-1', targetWord: 'תְּלָאוֹת', expectedTranslation: 'Hardships', alternativeTranslations: ['Tribulations', 'Troubles'], transliteration: 'tela\'ot', partOfSpeech: 'noun', options: ['Hardships', 'Adventures', 'Journeys', 'Sorrows'] },
        { id: 'p-2', targetWord: 'לְהַתְווֹת', expectedTranslation: 'To delineate', alternativeTranslations: ['To map out', 'Delineate', 'To outline'], transliteration: 'lehatvot', partOfSpeech: 'verb', options: ['To delineate', 'To establish', 'To formulate', 'To navigate'] },
        { id: 'p-3', targetWord: 'סְגֻלִּי', expectedTranslation: 'Specific', alternativeTranslations: ['Intrinsic', 'Characteristic'], transliteration: 'seguli', partOfSpeech: 'adjective', options: ['Specific', 'Remarkable', 'Peculiar', 'Noble'] },
        { id: 'p-4', targetWord: 'הֲפַכְפַּךְ', expectedTranslation: 'Erratic', alternativeTranslations: ['Volatile', 'Fickle'], transliteration: 'hafachpach', partOfSpeech: 'adjective', options: ['Erratic', 'Calm', 'Persistent', 'Turbulent'] },
        { id: 'p-5', targetWord: 'שִׁפְעָה', expectedTranslation: 'Abundance', alternativeTranslations: ['Profusion', 'Plenty'], transliteration: 'shif\'a', partOfSpeech: 'noun', options: ['Abundance', 'Wealth', 'Luxury', 'Elegance'] },
        { id: 'p-6', targetWord: 'נִבְעָר', expectedTranslation: 'Ignorant', alternativeTranslations: ['Unlearned'], transliteration: 'niv\'ar', partOfSpeech: 'adjective', options: ['Ignorant', 'Naive', 'Crude', 'Stubborn'] },
        { id: 'p-7', targetWord: 'מַשְׂאַת נֶפֶשׁ', expectedTranslation: 'Heart\'s desire', transliteration: 'mas\'at nefesh', partOfSpeech: 'idiom', options: ['Heart\'s desire', 'Guilty pleasure', 'Dream', 'Inspiration'] },
        { id: 'p-8', targetWord: 'לְהַרְתִּיעַ', expectedTranslation: 'To deter', alternativeTranslations: ['To discourage', 'Deter', 'Discourage'], transliteration: 'lehartia', partOfSpeech: 'verb', options: ['To deter', 'To frighten', 'To halt', 'To prevent'] },
        { id: 'p-9', targetWord: 'הֶקְשֵׁר', expectedTranslation: 'Context', alternativeTranslations: ['Framework'], transliteration: 'heksher', partOfSpeech: 'noun', options: ['Context', 'Framework', 'Connection', 'Perspective'] },
        { id: 'p-10', targetWord: 'לְהַשִּׂיג גְּבוּל', expectedTranslation: 'To trespass', alternativeTranslations: ['To encroach', 'Trespass', 'Encroach'], transliteration: 'lehasig gvul', partOfSpeech: 'verb phrase', options: ['To trespass', 'To break rules', 'To invade', 'To cross lines'] },
      ],
      C2: [
        { id: 'p-1', targetWord: 'גְּנֵבַת דַּעַת', expectedTranslation: 'Deception', alternativeTranslations: ['Gaslighting', 'Misrepresentation'], transliteration: 'gnevath da\'at', partOfSpeech: 'phrase', options: ['Deception', 'Theft', 'Distraction', 'Falsehood'] },
        { id: 'p-2', targetWord: 'בָּטֵל בְּשִׁשִּׁים', expectedTranslation: 'Negligible', alternativeTranslations: ['Nullified', 'Insignificant'], transliteration: 'batel be-shishim', partOfSpeech: 'idiom', options: ['Negligible', 'Cancelled', 'Useless', 'Forgotten'] },
        { id: 'p-3', targetWord: 'אִסְטְרָא בְּלַגִינָא', expectedTranslation: 'Empty vessel rattles loudly', transliteration: 'istara belagina', partOfSpeech: 'proverb', options: ['Empty vessel rattles loudly', 'Rich man spends quietly', 'Wise silence', 'Fool\'s gold'] },
        { id: 'p-4', targetWord: 'לְהִתְפַּלְפֵּל', expectedTranslation: 'To hair-split philosophically', transliteration: 'lehitpalpel', partOfSpeech: 'verb', options: ['To hair-split philosophically', 'To argue heatedly', 'To speak eloquently', 'To lecture'] },
        { id: 'p-5', targetWord: 'חֻרְבָּה מֻפְלֶגֶת', expectedTranslation: 'Utter ruin', alternativeTranslations: ['Profound desolation', 'Ruin'], transliteration: 'churba mufleget', partOfSpeech: 'phrase', options: ['Utter ruin', 'Ancient mystery', 'Quiet sanctuary', 'Fallen empire'] },
        { id: 'p-6', targetWord: 'שִׁבְרוֹן מָתְנַיִם', expectedTranslation: 'Deep anguish', alternativeTranslations: ['Crushing despair', 'Heartbreak'], transliteration: 'shivron motnayim', partOfSpeech: 'idiom', options: ['Deep anguish', 'Backache', 'Exhaustion', 'Grief'] },
        { id: 'p-7', targetWord: 'לַהַג', expectedTranslation: 'Prattle', alternativeTranslations: ['Idle chatter'], transliteration: 'lahag', partOfSpeech: 'noun', options: ['Prattle', 'Dialect', 'Whisper', 'Nonsense'] },
        { id: 'p-8', targetWord: 'מוּעָם', expectedTranslation: 'Dimmed', alternativeTranslations: ['Muted', 'Obscured'], transliteration: 'mu\'am', partOfSpeech: 'adjective', options: ['Dimmed', 'Hidden', 'Faded', 'Obscured'] },
        { id: 'p-9', targetWord: 'מֵצַר', expectedTranslation: 'Distress', alternativeTranslations: ['Strait', 'Dire straits'], transliteration: 'metzar', partOfSpeech: 'noun', options: ['Distress', 'Narrow path', 'Prison', 'Abyss'] },
        { id: 'p-10', targetWord: 'אַבְּנֵט', expectedTranslation: 'Sash', alternativeTranslations: ['Girdle'], transliteration: 'avnet', partOfSpeech: 'noun', options: ['Sash', 'Crown', 'Robe', 'Turban'] },
      ],
    };
    return map[level] || map.A1;
  }

  // Generic fallback for other languages
  return [
    { id: 'p-1', targetWord: 'Word 1', expectedTranslation: 'Translation 1', options: ['Translation 1', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-2', targetWord: 'Word 2', expectedTranslation: 'Translation 2', options: ['Translation 2', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-3', targetWord: 'Word 3', expectedTranslation: 'Translation 3', options: ['Translation 3', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-4', targetWord: 'Word 4', expectedTranslation: 'Translation 4', options: ['Translation 4', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-5', targetWord: 'Word 5', expectedTranslation: 'Translation 5', options: ['Translation 5', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-6', targetWord: 'Word 6', expectedTranslation: 'Translation 6', options: ['Translation 6', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-7', targetWord: 'Word 7', expectedTranslation: 'Translation 7', options: ['Translation 7', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-8', targetWord: 'Word 8', expectedTranslation: 'Translation 8', options: ['Translation 8', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-9', targetWord: 'Word 9', expectedTranslation: 'Translation 9', options: ['Translation 9', 'Option B', 'Option C', 'Option D'], level },
    { id: 'p-10', targetWord: 'Word 10', expectedTranslation: 'Translation 10', options: ['Translation 10', 'Option B', 'Option C', 'Option D'], level },
  ];
}

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vocabulary Learning app server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
