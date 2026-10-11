export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type WordCategory = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

export type SessionType = 'daily' | 'rusty' | 'new_words' | 'rusty_review' | 'recent_review' | 'exam';

export type TokenDirection = 'to_target' | 'from_target';

export interface HierarchyTokenScore {
  hardPoints?: number;
  oldPoints?: number;
  lastSeenAt?: number;
  firstIntroducedAt?: number;
}

export interface ReviewHierarchyDatabase {
  // Key format: `${wordId}:${direction}` e.g. "word123:to_target"
  tokens?: Record<string, HierarchyTokenScore>;
}

export interface ReviewHierarchiesData {
  rustyReview?: ReviewHierarchyDatabase;
  recentReview?: ReviewHierarchyDatabase;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
  voiceLang?: string;
  script?: string;
}

export interface WordItem {
  id: string;
  targetWord: string;
  translation: string; // The single most common, primary translation
  alternativeTranslations?: string[]; // Other accepted translations/synonyms
  transliteration?: string;
  partOfSpeech?: string;
  exampleTarget?: string;
  exampleTranslation?: string;
  level: CEFRLevel;
  numericLevel?: number; // 1 to 60
  languagePairKey: string; // e.g. "he-en"
  category?: WordCategory;
}

export interface WordProgress {
  wordId: string;
  targetWord: string;
  translation: string;
  alternativeTranslations?: string[];
  transliteration?: string;
  partOfSpeech?: string;
  exampleTarget?: string;
  exampleTranslation?: string;
  level: CEFRLevel;
  numericLevel?: number; // 1 to 60
  languagePairKey: string;
  category: WordCategory; // 'red' | 'orange' | 'yellow' | 'green' | 'blue'
  cleanSessionsCount: number; // Number of sessions completed with 0 errors
  timesReviewed: number;
  timesCorrect: number;
  timesIncorrect: number;
  consecutiveCorrect: number;
  isHard: boolean; // Flagged as hard if failed or user marked
  hardScore?: number; // Net points in Hard hierarchy: +1 on mistake, -1 on correct answer (min 0)
  difficultyScore: number; // 0 (easiest) to 10 (hardest)
  firstLearnedAt?: number; // Timestamp when word was first introduced/learned
  introducedAt?: number; // Alias for introduction timestamp
  lastReviewedAt: number;
  nextReviewAt: number;
  intervalDays: number;
  history: Array<{
    timestamp: number;
    wasCorrect: boolean;
    userAnswer?: string;
  }>;
  manuallyLearned?: boolean; // Set to true if word was manually shifted to learned in Word Bank, false/undefined if learned via study session
}

export interface SessionHistoryEntry {
  sessionId: string;
  completedAt: number; // Unix timestamp in ms
  dateStr: string; // YYYY-MM-DD in the user's local timezone
  sessionType: SessionType;
  cardsCount: number;
  correctCount: number;
  incorrectCount: number;
  targetLanguage?: string;
  level?: CEFRLevel;
  numericLevel?: number;
}

export interface CharacterAvatarConfig {
  characterId: string; // 'bear' | 'fox' | 'bunny' | 'cat' | 'owl' | 'dog'
  hairStyle: string; // 'bald' | 'short' | 'mid_curly' | 'bob' | 'bun' | 'long' | 'wavy'
  hairColor: string; // hex color
  skinTone: string; // hex color
  eyeStyle: string; // 'sparkle' | 'cartoon' | 'curved' | 'round' | 'wink' | 'stars'
  eyeColor: string; // hex color
  eyebrowStyle?: string; // 'none' | 'gentle' | 'arched' | 'straight' | 'dots' | 'inquisitive'
  noseStyle: string; // 'button' | 'curve' | 'triangle' | 'oval' | 'dot' | 'drop'
  mouthStyle: string; // 'broad_smile' | 'gentle' | 'laugh' | 'smirk' | 'open_o' | 'tongue'
  glassesStyle: string; // 'none' | 'round' | 'rect' | 'thick' | 'sunglasses' | 'cat_eye'
  glassesColor: string; // hex color
  hatStyle?: string; // 'none' | 'beret' | 'party_hat' | 'bowler' | 'beanie' | 'crown' | 'cap'
  hatColor?: string; // hex color
  bgColor: string; // hex color
}

export interface LanguageProgress {
  targetLanguage: string;
  level: CEFRLevel;
  numericLevel?: number; // 1 to 60
  maxUnlockedNumericLevel?: number;
  levelVerified?: boolean;
  levelScore?: number;
  words?: Record<string, WordProgress>;
  journeyProgress?: {
    completedLessonsByLevel?: Record<number, number>;
    completedSessionsByButton?: Record<string, number>;
  };
  reviewHierarchies?: ReviewHierarchiesData;
  passedExams?: Record<number, { passedAt: number; mistakes: number }>;
  tokenMistakeCounts?: Record<string, number>;
  unlockedLevels?: CEFRLevel[];
  totalSessionsCompleted?: number;
  lastActiveAt?: number;
}

export interface UserProfile {
  email: string;
  name: string;
  username?: string; // unique username/handle without @, e.g. "irithfuks"
  passwordHash?: string; // base64 password hash for account authentication
  avatarUrl?: string;
  avatarConfig?: CharacterAvatarConfig;
  targetLanguage: string; // e.g. "he"
  knownLanguage: string; // e.g. "en"
  level: CEFRLevel;
  numericLevel?: number; // 1 to 60 (A1: 1-10, A2: 11-20, B1: 21-30, B2: 31-40, C1: 41-50, C2: 51-60)
  maxUnlockedNumericLevel?: number; // Highest unlocked level the user can access
  levelVerified: boolean;
  levelScore?: number; // Score out of 10
  createdAt: number;
  lastActiveAt: number;
  lastActiveDateStr?: string; // YYYY-MM-DD for streak tracking
  words: Record<string, WordProgress>; // wordId -> progress
  totalSessionsCompleted: number;
  streakDays: number;
  currentStreak?: number;
  maxStreakDays?: number;
  sessionHistory?: SessionHistoryEntry[];
  following?: string[]; // array of emails
  followers?: string[]; // array of emails
  pools?: FriendPool[];
  journeyProgress?: {
    // Key: numeric level number (e.g. 1) -> completed lessons count (0 to 36)
    completedLessonsByLevel?: Record<number, number>;
    // Key: `${level}_${ballIndex}` -> count of sessions actually completed via Journey
    completedSessionsByButton?: Record<string, number>;
  };
  reviewHierarchies?: ReviewHierarchiesData;
  passedExams?: Record<number, { passedAt: number; mistakes: number }>; // numeric level -> exam pass record
  tokenMistakeCounts?: Record<string, number>; // Key: `${wordId}:${direction}` -> count of mistakes
  unlockedLevels?: CEFRLevel[]; // Levels user is permitted to do, e.g. ['A1'] by default, higher levels unlocked via test (>= 16/20)
  isAdmin?: boolean; // Whether the user is an app administrator / owner (e.g. irithfuks@gmail.com)
  emailVerified?: boolean;
  emailVerifiedAt?: number;
  languages?: Record<string, LanguageProgress>; // Saved progress per language
}

export interface AdminUserSummary {
  email: string;
  username: string;
  name: string;
  avatarUrl?: string;
  hasPassword: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: number;
  targetLanguage: string;
  knownLanguage?: string;
  level: CEFRLevel;
  numericLevel?: number;
  createdAt?: number;
  lastActiveAt?: number;
  streakDays: number;
  maxStreakDays?: number;
  totalSessionsCompleted: number;
  wordsCount: number;
  masteredCount: number;
  learningCount: number;
  followersCount: number;
  followingCount: number;
  isAdmin: boolean;
}

export interface AdminStats {
  totalRegistered: number;
  totalWordsLearned: number;
  totalSessions: number;
  activeTodayCount: number;
  languageCounts: Record<string, number>;
  levelCounts: Record<string, number>;
}

export interface HistoryChartData {
  labels: string[];
  fullLabels?: string[];
  values: number[];
  average?: number;
  averageExact?: string;
  total?: number;
}

export interface PublicUserProfile {
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  targetLanguage: string;
  knownLanguage?: string;
  level: CEFRLevel;
  numericLevel?: number;
  currentStreak?: number;
  streakDays: number;
  maxStreakDays?: number;
  lastActiveDateStr?: string;
  totalWordsLearned: number;
  totalSessionsCompleted: number;
  weeklyNewWordsCount: number;
  isFollowing?: boolean;
  isFollower?: boolean;
  following?: string[];
  followers?: string[];
  followingUsers?: PublicUserProfile[];
  followersUsers?: PublicUserProfile[];
  past7DaysHistory?: HistoryChartData;
  weeklyHistory?: HistoryChartData; // backwards compatibility alias
  cumulativeHistory?: HistoryChartData;
  words?: Record<string, any>;
  weeklyWords?: WeeklyLearnedWord[];
  createdAt?: number;
}

export interface WeeklyLearnedWord {
  id: string;
  targetWord: string;
  translation: string;
  transliteration?: string;
  partOfSpeech?: string;
  level?: string;
  numericLevel?: number;
  learnedAt: number;
}

export interface FriendPoolMember {
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  level: CEFRLevel;
  numericLevel?: number;
  targetLanguage: string;
  weeklyNewWordsCount: number;
  weeklyWords?: WeeklyLearnedWord[];
  streakDays: number;
  isCurrentUser?: boolean;
  isAdmin?: boolean;
}

export interface PoolInvitation {
  poolId: string;
  poolName: string;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: number;
}

export interface FriendPool {
  id: string;
  name: string;
  createdBy: string; // admin email who created the pool
  createdAt: number;
  members: FriendPoolMember[];
  pendingMembers?: string[]; // emails of users invited who haven't accepted yet
  isAdmin?: boolean; // whether current viewing user is the admin
}

export interface PlacementTestQuestion {
  id: string;
  targetWord: string;
  expectedTranslation: string;
  alternativeTranslations?: string[];
  transliteration?: string;
  partOfSpeech?: string;
  options?: string[]; // Multiple choice options if used
  level: CEFRLevel;
}

export interface PlacementTestResult {
  totalQuestions: number;
  correctCount: number;
  level: CEFRLevel;
  passed: boolean;
  feedback: string;
  suggestedLevel: CEFRLevel;
  remainingLives?: number;
  answers: Array<{
    targetWord: string;
    expectedTranslation: string;
    userAnswer: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

export interface StudyCard {
  word: WordItem;
  category: WordCategory;
  isNew: boolean;
  progress?: WordProgress;
  hasYellowBall?: boolean;
  isRecentReviewHierarchy?: boolean;
  hierarchyDirection?: TokenDirection;
}

export type WordStage = 1 | 2 | 3;

export interface WordStudyState {
  wordId: string;
  card: StudyCard;
  category: WordCategory;
  isRedCategory: boolean;
  currentStage: WordStage;
  completedStages: {
    1: boolean;
    2: boolean;
    3: boolean;
  };
  mistakesCount: number;
  hadMistakeAtAnyStage: boolean;
  sessionHardScore?: number;
  isFullyMastered: boolean;
  finalVerificationPassed: boolean;
  history: Array<{
    stage: WordStage;
    isFinalReview?: boolean;
    userAnswer: string;
    wasCorrect: boolean;
    feedback?: string;
  }>;
}

export interface SessionQueueItem {
  id: string;
  wordId: string;
  stage: WordStage;
  isFinalReview?: boolean;
  isBufferReview?: boolean;
  retryStep?: 1 | 2; // 1 = 2 words in between, 2 = minstens 5 words in between
}

export interface SavedSessionState {
  sessionId: string;
  sessionType: SessionType;
  reviewDirection?: 'both' | 'target' | 'known'; // 'both' | 'target' (Hebrew only) | 'known' (English only)
  cards: StudyCard[];
  queue: SessionQueueItem[];
  wordStates: Record<string, WordStudyState>;
  completedTasksCount: number;
  baseExpectedTasks: number;
  savedAt: number;
  targetLanguage: string;
  knownLanguage: string;
}

export interface StudySessionResult {
  sessionId: string;
  timestamp: number;
  cardsCount: number;
  newWordsCount: number;
  reviewWordsCount: number;
  correctCount: number;
  incorrectCount: number;
  hardWordsAdded: number;
  promotedWordsCount: number;
  items: Array<{
    wordId: string;
    targetWord: string;
    translation: string;
    categoryBefore: WordCategory;
    categoryAfter: WordCategory;
    wasFirstTryClean: boolean;
    isHard: boolean;
  }>;
}

export interface TypedAnswerStat {
  text: string;
  count: number;
  lastUsedAt: number;
}

export interface OverrideSubmissionLog {
  timestamp: number;
  userEmail?: string;
  userTyped: string;
  sessionType?: string;
  level?: string;
  direction?: string;
}

export interface TranslationOverrideRecord {
  id: string; // e.g. "he_חֶשְׁבּוֹן" or "he_cheshbon"
  targetWord: string;
  cleanTargetWord: string;
  targetLanguage: string;
  knownLanguage: string;
  expectedTranslation: string;
  currentAlternatives: string[];
  overrideCount: number;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedTranslation?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  firstReportedAt: number;
  lastReportedAt: number;
  typedAnswers: TypedAnswerStat[];
  recentLogs: OverrideSubmissionLog[];
  level?: string;
  transliteration?: string;
}

export interface TranslationOverrideStats {
  totalOverrides: number;
  uniqueWords: number;
  pendingCount: number;
  resolvedCount: number;
  languageBreakdown: Record<string, number>;
}

