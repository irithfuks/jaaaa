import { SessionHistoryEntry, UserProfile, HistoryChartData, WeeklyLearnedWord } from '../types';
export type { WeeklyLearnedWord };
import { isWordLearnedInSession, isWordLearned, isWordForTargetLanguage } from './srs';

/**
 * Returns YYYY-MM-DD in the user's local timezone.
 * Accepts a Date object, a millisecond timestamp, or defaults to the current moment.
 */
export function getLocalDateString(d: Date | number = new Date()): string {
  const dateObj = typeof d === 'number' ? new Date(d) : (d instanceof Date ? d : new Date());
  if (isNaN(dateObj.getTime())) {
    const fallback = new Date();
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, '0');
    const day = String(fallback.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Given two YYYY-MM-DD date strings (local dates),
 * calculates date2 - date1 in calendar days without DST jitter.
 */
export function getCalendarDaysDiff(dateStrEarlier: string, dateStrLater: string): number {
  if (!dateStrEarlier || !dateStrLater) return NaN;
  const parts1 = dateStrEarlier.split('-').map(Number);
  const parts2 = dateStrLater.split('-').map(Number);

  if (parts1.length < 3 || parts2.length < 3 || parts1.some(isNaN) || parts2.some(isNaN)) {
    return NaN;
  }

  const [y1, m1, d1] = parts1;
  const [y2, m2, d2] = parts2;

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Extracts and sorts all distinct practice dates (YYYY-MM-DD in local time)
 * from user profile session history, lastActiveDateStr, and words history.
 */
export function extractDistinctPracticeDates(
  profile: Partial<Pick<UserProfile, 'lastActiveDateStr' | 'lastActiveAt' | 'sessionHistory' | 'totalSessionsCompleted' | 'words'>> | null | undefined
): string[] {
  if (!profile) return [];

  const dateSet = new Set<string>();

  // 1. Check logged sessions
  if (Array.isArray(profile.sessionHistory)) {
    for (const s of profile.sessionHistory) {
      if (s.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(s.dateStr)) {
        dateSet.add(s.dateStr);
      } else if (s.completedAt && typeof s.completedAt === 'number') {
        dateSet.add(getLocalDateString(s.completedAt));
      }
    }
  }

  // 2. Check explicit lastActiveDateStr
  if (profile.lastActiveDateStr && /^\d{4}-\d{2}-\d{2}$/.test(profile.lastActiveDateStr)) {
    dateSet.add(profile.lastActiveDateStr);
  }

  // 3. Fallback: if user has completed sessions, include lastActiveAt date
  if ((profile.totalSessionsCompleted || 0) > 0 && profile.lastActiveAt) {
    dateSet.add(getLocalDateString(profile.lastActiveAt));
  }

  // 4. Fallback: check word review timestamps if dateSet is still empty but sessions were done
  if (dateSet.size === 0 && (profile.totalSessionsCompleted || 0) > 0 && profile.words) {
    for (const w of Object.values(profile.words)) {
      if (w.lastReviewedAt) {
        dateSet.add(getLocalDateString(w.lastReviewedAt));
      }
    }
  }

  return Array.from(dateSet).sort();
}

/**
 * Returns previous calendar day YYYY-MM-DD.
 */
export function getPreviousCalendarDayStr(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const prevUtc = Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000;
  const prevD = new Date(prevUtc);
  const prevY = prevD.getUTCFullYear();
  const prevM = String(prevD.getUTCMonth() + 1).padStart(2, '0');
  const prevDay = String(prevD.getUTCDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevDay}`;
}

/**
 * Helper to count consecutive calendar days backward starting from anchorDateStr.
 */
export function countConsecutiveDaysBackward(anchorDateStr: string, practiceDatesSet: Set<string>): number {
  let count = 0;
  let curDateStr = anchorDateStr;

  while (practiceDatesSet.has(curDateStr)) {
    count++;
    curDateStr = getPreviousCalendarDayStr(curDateStr);
  }

  return count;
}

/**
 * Checks if the user completed a practice session today in the user's local timezone.
 * Returns true IF AND ONLY IF a session was actually completed today.
 */
export function isDailyPracticeCompletedToday(
  profile: Partial<Pick<UserProfile, 'lastActiveDateStr' | 'totalSessionsCompleted' | 'sessionHistory'>> | null | undefined,
  clientTodayStr?: string
): boolean {
  if (!profile || (profile.totalSessionsCompleted || 0) <= 0) return false;
  const todayStr = (clientTodayStr && /^\d{4}-\d{2}-\d{2}$/.test(clientTodayStr))
    ? clientTodayStr
    : getLocalDateString();

  if (Array.isArray(profile.sessionHistory) && profile.sessionHistory.length > 0) {
    return profile.sessionHistory.some(s => {
      const sDate = s.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(s.dateStr)
        ? s.dateStr
        : (s.completedAt ? getLocalDateString(s.completedAt) : null);
      return sDate === todayStr;
    });
  }

  return profile.lastActiveDateStr === todayStr;
}

/**
 * Resolves the most recent practice date string (YYYY-MM-DD) from user profile data.
 */
export function getLatestPracticeDateStr(
  profile: Partial<Pick<UserProfile, 'lastActiveDateStr' | 'lastActiveAt' | 'sessionHistory' | 'totalSessionsCompleted'>> | null | undefined
): string | null {
  if (!profile) return null;

  let latestDate: string | null = null;

  if (Array.isArray(profile.sessionHistory) && profile.sessionHistory.length > 0) {
    for (const s of profile.sessionHistory) {
      const sDate = s.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(s.dateStr)
        ? s.dateStr
        : (s.completedAt ? getLocalDateString(s.completedAt) : null);
      if (sDate && (!latestDate || sDate > latestDate)) {
        latestDate = sDate;
      }
    }
  }

  if (!latestDate && profile.lastActiveDateStr && /^\d{4}-\d{2}-\d{2}$/.test(profile.lastActiveDateStr)) {
    if ((profile.totalSessionsCompleted || 0) > 0) {
      latestDate = profile.lastActiveDateStr;
    }
  }

  if (!latestDate && profile.lastActiveAt && (profile.totalSessionsCompleted || 0) > 0) {
    latestDate = getLocalDateString(profile.lastActiveAt);
  }

  return latestDate;
}

/**
 * Calculates the user's current effective streak based on calendar dates in local time.
 * 
 * Strict Daily Streak Rules:
 * - You have from 00:00:00 till 23:59:59 to do a session on a given day.
 * - If you did a session TODAY (diff === 0): streak is active and completed for today (colored flame).
 * - If you did a session YESTERDAY (diff === 1): streak is still intact and alive (uncolored flame,
 *   waiting for today's session to be completed).
 * - If you did NOT do a session yesterday (diff >= 2): yesterday expired without practice.
 *   The streak is broken and resets to 0!
 */
export function calculateCurrentStreak(
  profile: Partial<Pick<UserProfile, 'lastActiveDateStr' | 'streakDays' | 'currentStreak' | 'totalSessionsCompleted' | 'sessionHistory' | 'lastActiveAt' | 'words'>> | null | undefined,
  clientTodayStr?: string
): number {
  if (!profile || (profile.totalSessionsCompleted || 0) <= 0) {
    return 0;
  }

  const todayStr = (clientTodayStr && /^\d{4}-\d{2}-\d{2}$/.test(clientTodayStr))
    ? clientTodayStr
    : getLocalDateString();

  const practiceDates = extractDistinctPracticeDates(profile);
  if (practiceDates.length === 0) {
    return 0;
  }
  const practiceDatesSet = new Set(practiceDates);

  const isDoneToday = isDailyPracticeCompletedToday(profile, todayStr);
  const yesterdayStr = getPreviousCalendarDayStr(todayStr);

  // If user did NOT practice today:
  // Must check if yesterday was completed. If yesterday was missed, streak broke to 0!
  if (!isDoneToday) {
    const didPracticeYesterday = practiceDatesSet.has(yesterdayStr);
    if (!didPracticeYesterday) {
      // Check difference to latest practice date
      const latestDate = practiceDates[practiceDates.length - 1];
      const diff = getCalendarDaysDiff(latestDate, todayStr);
      if (diff >= 2 || isNaN(diff)) {
        return 0; // Missed yesterday, streak is 0
      }
    }
  }

  // Anchor date: today if practiced today, otherwise yesterday
  const anchorDateStr = isDoneToday ? todayStr : yesterdayStr;
  const consecutiveDays = countConsecutiveDaysBackward(anchorDateStr, practiceDatesSet);

  const stored = typeof profile.currentStreak === 'number' 
    ? profile.currentStreak 
    : (typeof profile.streakDays === 'number' ? profile.streakDays : 0);

  // Return the true consecutive streak (at least consecutiveDays, or stored if user has intact streak)
  return Math.max(consecutiveDays, stored > 0 && consecutiveDays > 0 ? stored : 0, 1);
}

/**
 * Updates streak and logs session into session history when user completes a session.
 * 
 * Rules:
 * - ANY completed session (daily, new_words, review, exam) counts as daily practice for that day!
 * - If yesterday was missed (streak was 0), completing today starts a new streak at 1.
 * - If yesterday was completed, completing today's session advances the streak by +1.
 * - If already completed today, maintains current streak for today (does not double increment on the same day).
 * - maxStreakDays preserves their highest personal best streak ever achieved.
 */
export function advanceStreakOnSessionComplete(
  profile: UserProfile,
  sessionLog?: Partial<SessionHistoryEntry>
): {
  streakDays: number;
  maxStreakDays: number;
  lastActiveDateStr: string;
  sessionHistory: SessionHistoryEntry[];
} {
  const now = Date.now();
  const todayStr = getLocalDateString(now);

  // 1. Check if user already completed a session today BEFORE this new one:
  const alreadyDoneToday = isDailyPracticeCompletedToday(profile, todayStr);

  // 2. Prepare new session log
  const newEntry: SessionHistoryEntry = {
    sessionId: sessionLog?.sessionId || `sess_${now}_${Math.random().toString(36).slice(2, 8)}`,
    completedAt: now,
    dateStr: todayStr,
    sessionType: sessionLog?.sessionType || 'daily',
    cardsCount: sessionLog?.cardsCount ?? 0,
    correctCount: sessionLog?.correctCount ?? 0,
    incorrectCount: sessionLog?.incorrectCount ?? 0,
    targetLanguage: sessionLog?.targetLanguage || profile.targetLanguage,
    level: sessionLog?.level || profile.level,
    numericLevel: sessionLog?.numericLevel || profile.numericLevel,
  };

  const existingHistory = Array.isArray(profile.sessionHistory) ? profile.sessionHistory : [];
  const updatedHistory = [...existingHistory, newEntry].slice(-200);

  // 3. Compute distinct practice dates including this new session
  const updatedDates = extractDistinctPracticeDates({
    ...profile,
    sessionHistory: updatedHistory,
    lastActiveDateStr: todayStr,
    totalSessionsCompleted: (profile.totalSessionsCompleted || 0) + 1,
  });
  const updatedDatesSet = new Set(updatedDates);
  const consecutiveDays = countConsecutiveDaysBackward(todayStr, updatedDatesSet);

  let newStreak: number;
  if (alreadyDoneToday) {
    // User already completed a session today earlier! Maintain current streak for today
    const current = calculateCurrentStreak(profile, todayStr);
    newStreak = Math.max(current, consecutiveDays, 1);
  } else {
    // First session of today!
    const yesterdayStr = getPreviousCalendarDayStr(todayStr);
    const hadYesterday = updatedDatesSet.has(yesterdayStr);

    if (hadYesterday) {
      // Streak continues! Add 1 to previous streak
      const prevStreak = calculateCurrentStreak(profile, todayStr);
      newStreak = Math.max(prevStreak + 1, consecutiveDays, 1);
    } else {
      // Brand new streak (or restarted after a missed day)
      newStreak = Math.max(consecutiveDays, 1);
    }
  }

  // maxStreakDays preserves their highest personal best streak ever
  const maxStreakDays = Math.max(
    profile.maxStreakDays || 0,
    profile.streakDays || 0,
    profile.currentStreak || 0,
    newStreak
  );

  return {
    streakDays: newStreak,
    maxStreakDays,
    lastActiveDateStr: todayStr,
    sessionHistory: updatedHistory,
  };
}

/**
 * Returns the Unix timestamp (ms) for Monday 00:00:00 of the current week.
 * The poule cycle starts Monday at 00:00 and finishes Sunday at 23:59.
 */
export function getStartOfCurrentWeekTimestamp(referenceDate: Date = new Date()): number {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Retrieves the full list of words the user learned during the current weekly sprint (since Monday 00:00:00).
 * Specification: "in ranking horen alleen woorden te staan die ik via daily sessies heb geleerd, 
 * of die ik handmatig naar 'geleerd' heb verplaatst".
 * 
 * Strict constraints:
 * 1. Only words belonging to the specified targetLanguage (never leak words from other languages!).
 * 2. Only learned words (via daily practice sessions OR manually moved to 'geleerd').
 * 3. Words in category 'red' (unlearned / new) are NEVER counted.
 * 4. Learned during current week sprint (learnedAt >= Monday 00:00:00).
 */
export function getWeeklyLearnedWordsList(
  words?: Record<string, any>,
  referenceDate: Date = new Date(),
  targetLanguage?: string
): WeeklyLearnedWord[] {
  if (!words || typeof words !== 'object') return [];
  const mondayMs = getStartOfCurrentWeekTimestamp(referenceDate);
  const cleanTargetLang = targetLanguage ? targetLanguage.toLowerCase().trim() : undefined;

  const list: WeeklyLearnedWord[] = [];
  Object.values(words).forEach((w: any) => {
    if (!w) return;

    // 1. Language isolation: words must belong to targetLanguage
    if (cleanTargetLang && !isWordForTargetLanguage(w, cleanTargetLang)) {
      return;
    }

    // 2. Unlearned words (red category) NEVER count in the ranking
    if (w.category === 'red') return;

    // 3. Must be learned via daily session OR manually moved to 'geleerd'
    const hasBeenLearned = w.manuallyLearned === true || isWordLearnedInSession(w) || isWordLearned(w);
    if (!hasBeenLearned) return;

    const firstLearned = w.firstLearnedAt || w.introducedAt || w.firstIntroducedAt ||
      (Array.isArray(w.history) && w.history.length > 0 && typeof w.history[0]?.timestamp === 'number'
        ? w.history[0].timestamp
        : (w.lastReviewedAt || 0));

    if (firstLearned >= mondayMs) {
      list.push({
        id: w.wordId || w.id || '',
        targetWord: w.targetWord || '',
        translation: w.translation || '',
        transliteration: w.transliteration || '',
        partOfSpeech: w.partOfSpeech || '',
        level: w.level || 'A1',
        numericLevel: typeof w.numericLevel === 'number'
          ? w.numericLevel
          : (parseInt(w.numericLevel, 10) || (typeof w.levelNumber === 'number' ? w.levelNumber : undefined)),
        learnedAt: firstLearned,
      });
    }
  });

  // Sorteer op recentst geleerd eerst
  list.sort((a, b) => b.learnedAt - a.learnedAt);
  return list;
}

/**
 * Calculates how many words the user learned during the current weekly poule sprint (since Monday 00:00:00).
 * Strictly mirrors getWeeklyLearnedWordsList(words, referenceDate, targetLanguage).length.
 */
export function calculateWeeklyNewWordsCount(
  words?: Record<string, any>, 
  referenceDate?: Date,
  targetLanguage?: string
): number {
  return getWeeklyLearnedWordsList(words, referenceDate, targetLanguage).length;
}

/**
 * Evaluates whether a user's stored weeklyNewWordsCount is still valid for the current week sprint.
 * If the user has not been active since Monday 00:00:00 of the current week,
 * they learned 0 new words during this week sprint!
 */
export function getEffectiveWeeklyNewWordsCount(
  user: {
    weeklyNewWordsCount?: number;
    lastActiveDateStr?: string;
    lastActiveAt?: number;
    updatedAt?: number;
    words?: Record<string, any>;
    targetLanguage?: string;
  } | null | undefined,
  referenceDate: Date = new Date(),
  targetLanguage?: string
): number {
  if (!user) return 0;
  const effectiveLang = targetLanguage || user.targetLanguage;
  if (user.words && typeof user.words === 'object' && Object.keys(user.words).length > 0) {
    return calculateWeeklyNewWordsCount(user.words, referenceDate, effectiveLang);
  }
  const rawCount = user.weeklyNewWordsCount || 0;
  if (rawCount <= 0) return 0;

  const mondayMs = getStartOfCurrentWeekTimestamp(referenceDate);
  const lastActiveTime = user.lastActiveAt || user.updatedAt || 0;
  
  // If we have a timestamp and it's before Monday 00:00, count is 0
  if (lastActiveTime > 0 && lastActiveTime < mondayMs) {
    return 0;
  }

  // If we have a date string, compare with Monday's date string
  if (user.lastActiveDateStr) {
    const mondayDateStr = getLocalDateString(mondayMs);
    if (user.lastActiveDateStr < mondayDateStr) {
      return 0;
    }
  }

  return rawCount;
}

const DUTCH_DAY_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const DUTCH_DAY_FULL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DUTCH_MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DUTCH_MONTH_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * Calculates words learned per day over the past 7 days (non-cumulative).
 * Exactly maps Monday x, Tuesday x, etc. up to today.
 * Accounts with no activity will have strictly 0 for all days.
 */
export function calculatePast7DaysWordStats(
  words?: Record<string, any>,
  referenceDate: Date = new Date()
): HistoryChartData {
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
      if (w.manuallyLearned === true) return;
      if (!isWordLearnedInSession(w)) return;

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

/**
 * Calculates cumulative words learned since user started.
 * Accurately tracks progression from start (strictly 0) to current total across 5 points:
 * 1. Start (count = 0, month)
 * 2. 1/4 progress (de helft van de helft)
 * 3. 1/2 progress (op de helft, month)
 * 4. 4/5 progress
 * 5. Nu (where the user is right now, month)
 */
export function calculateCumulativeWordStats(
  words?: Record<string, any>,
  createdAt?: number,
  referenceDate: Date = new Date()
): HistoryChartData {
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

  // If user has learned 0 words: return 5 flat zeroes starting at 0
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

  // Determine beginning timestamp
  const earliestWordTs = validTimestamps[0] || nowTs;
  const startTs = createdAt && createdAt <= earliestWordTs ? createdAt : earliestWordTs;
  const timeSpanMs = Math.max(1000, nowTs - startTs);

  // 5 exact points: Start (0), 1/4 (25%), 1/2 (50%), 4/5 (80%), Nu (100%)
  const fractions = [0, 0.25, 0.50, 0.80, 1.0];
  const points = fractions.map((frac, idx) => {
    const t = startTs + timeSpanMs * frac;
    const d = new Date(t);
    const monthShort = DUTCH_MONTH_SHORT[d.getMonth()];
    const capMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

    // Only show month on begin (idx 0), middle (idx 2), and end (idx 4)
    let label = '';
    if (idx === 0 || idx === 2 || idx === 4) {
      label = capMonth;
    }

    let count = 0;
    let fullLabel = '';
    if (idx === 0) {
      // Must always start at 0
      count = 0;
      fullLabel = `Start (${d.getDate()} ${monthShort})`;
    } else if (idx === 4) {
      // Reaches totalWords
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
