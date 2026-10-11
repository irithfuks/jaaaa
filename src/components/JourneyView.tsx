import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { UserProfile, WordItem, WordProgress, StudyCard, WordCategory, SavedSessionState, SessionType } from '../types';
import {
  getLanguage,
  getVocabularyForNumericLevel,
} from '../data/languages';
import { getLocalizedWordItem } from '../data/vocabularyBank';
import { getWordCategory, isWordLearnedInSession } from '../utils/srs';
import {
  buildNewWordsSessionCards,
  buildRustyReviewSessionCards,
  buildRecentReviewSessionCards,
  buildExamSessionCards,
} from '../utils/reviewHierarchy';
import {
  Crown,
  Star,
  Check,
  Play,
  X,
  BookOpen,
  Brain,
  Lightbulb,
  Settings,
  Sparkles,
  GraduationCap,
  Award,
  Move,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface JourneyViewProps {
  profile: UserProfile;
  savedDailySession?: SavedSessionState | null;
  onStartLesson: (
    level: number,
    ballIndex: number,
    lessonIndex: number,
    cards: StudyCard[],
    sessionType?: SessionType
  ) => void;
  onStartExam?: (level: number) => void;
  onStartDailyPractice?: (
    level: number,
    ballIndex: number,
    lessonIndex: number
  ) => void;
  onContinueDailyPractice?: (
    level: number,
    ballIndex: number,
    lessonIndex: number
  ) => void;
  onStartRustyReview?: (
    count?: number,
    direction?: 'both' | 'target' | 'known'
  ) => void;
  onOpenWordBank?: () => void;
  onBackToDashboard?: () => void;
}

// Vivid, cheerful colors with 3D bottom borders and matching colored dotted paths
interface LevelTheme {
  id: string;
  name: string;
  bannerBg: string; // Vivid color with 3D bottom border, shadow, and white text
  dotStroke: string; // Colorful stroke for the SVG dotted line
}

const LEVEL_THEMES: LevelTheme[] = [
  {
    id: 'emerald',
    name: 'Smaragdgroen',
    bannerBg: 'bg-emerald-500 border-b-4 border-emerald-700 text-white shadow-md shadow-emerald-950/20',
    dotStroke: 'text-emerald-400 dark:text-emerald-500',
  },
  {
    id: 'teal',
    name: 'Petrol / Teal',
    bannerBg: 'bg-teal-500 border-b-4 border-teal-700 text-white shadow-md shadow-teal-950/20',
    dotStroke: 'text-teal-400 dark:text-teal-500',
  },
  {
    id: 'sky',
    name: 'Hemelsblauw',
    bannerBg: 'bg-sky-500 border-b-4 border-sky-700 text-white shadow-md shadow-sky-950/20',
    dotStroke: 'text-sky-400 dark:text-sky-500',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    bannerBg: 'bg-indigo-500 border-b-4 border-indigo-700 text-white shadow-md shadow-indigo-950/20',
    dotStroke: 'text-indigo-400 dark:text-indigo-500',
  },
  {
    id: 'purple',
    name: 'Paars',
    bannerBg: 'bg-purple-500 border-b-4 border-purple-700 text-white shadow-md shadow-purple-950/20',
    dotStroke: 'text-purple-400 dark:text-purple-500',
  },
  {
    id: 'rose',
    name: 'Roze',
    bannerBg: 'bg-rose-500 border-b-4 border-rose-700 text-white shadow-md shadow-rose-950/20',
    dotStroke: 'text-rose-400 dark:text-rose-500',
  },
  {
    id: 'amber',
    name: 'Warm Goud',
    bannerBg: 'bg-amber-500 border-b-4 border-amber-700 text-white shadow-md shadow-amber-950/20',
    dotStroke: 'text-amber-400 dark:text-amber-500',
  },
  {
    id: 'orange',
    name: 'Oranje',
    bannerBg: 'bg-orange-500 border-b-4 border-orange-700 text-white shadow-md shadow-orange-950/20',
    dotStroke: 'text-orange-400 dark:text-orange-500',
  },
];

function getLevelTheme(lvl: number): LevelTheme {
  const index = Math.abs(Math.floor(lvl - 1)) % LEVEL_THEMES.length;
  return LEVEL_THEMES[index];
}

// Generate SVG arc path for a circle segment
function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

export interface JourneyPathNode {
  x: number;
  y: number;
  offsetX: number;
}

export const BASE_JOURNEY_WIDTH = 360;
const CENTER_X = 180;
const START_Y = 56;
const STEP_Y = 108; // Compact vertical spacing as requested
const EXAM_GAP_Y = 120; // Natural breathing room before exam node

// Curated organic path archetypes (rhythms) for varying trails across levels.
// Buttons do not stand in rigid fixed columns; they meander organically like a scenic trail.
// Consecutive buttons maintain generous horizontal separation (averaging 120px - 160px),
// specifically ensuring Button 4 (New words) and Button 5 (Rusty review) are far apart horizontally.
interface PatternNode {
  off: number;
  dy: number;
}

const JOURNEY_PATTERNS: PatternNode[][] = [
  // Pattern 0: Direct adaptation of user's diagram with wide horizontal spread between 4 & 5
  [
    { off: 40, dy: 0 },    // 0: top center-right
    { off: -80, dy: 2 },   // 1: left
    { off: 28, dy: -2 },   // 2: center
    { off: 88, dy: 1 },    // 3: far-right
    { off: -65, dy: 2 },   // 4: left flank (New words)
    { off: 78, dy: -2 },   // 5: right flank (Rusty words)
    { off: -82, dy: 1 },   // 6: left flank
    { off: 45, dy: -2 },   // 7: center-right
    { off: 88, dy: 2 },    // 8: far-right
    { off: -75, dy: -1 },  // 9: left flank
    { off: 60, dy: 2 },    // 10: right flank
    { off: -38, dy: -1 },  // 11: center-left
    { off: 72, dy: 2 },    // 12: right flank
    { off: -60, dy: -1 },  // 13: left flank
    { off: 0, dy: 0 },     // 14: Exam node (centered destination)
  ],
  // Pattern 1: Winding mountain path (distinct alternate route)
  [
    { off: -42, dy: 0 },
    { off: 75, dy: -2 },
    { off: -20, dy: 2 },
    { off: -88, dy: 1 },
    { off: 65, dy: -2 },
    { off: -78, dy: 2 },
    { off: 42, dy: -1 },
    { off: -50, dy: 2 },
    { off: 88, dy: -2 },
    { off: -76, dy: 1 },
    { off: 40, dy: -2 },
    { off: -25, dy: 2 },
    { off: 70, dy: -1 },
    { off: -55, dy: 2 },
    { off: 0, dy: 0 },
  ],
  // Pattern 2: Cascading river arcs
  [
    { off: 25, dy: 0 },
    { off: -75, dy: 2 },
    { off: 35, dy: -2 },
    { off: 88, dy: 1 },
    { off: -68, dy: 2 },
    { off: 75, dy: -2 },
    { off: -82, dy: 1 },
    { off: 48, dy: -1 },
    { off: 86, dy: 2 },
    { off: -48, dy: -2 },
    { off: 62, dy: 1 },
    { off: -22, dy: 2 },
    { off: 68, dy: -1 },
    { off: -65, dy: 2 },
    { off: 0, dy: 0 },
  ],
  // Pattern 3: Canyon slalom
  [
    { off: -72, dy: 0 },
    { off: 45, dy: 2 },
    { off: -30, dy: -2 },
    { off: 88, dy: 1 },
    { off: -70, dy: 2 },
    { off: 72, dy: -2 },
    { off: -85, dy: 1 },
    { off: 42, dy: -1 },
    { off: 84, dy: 2 },
    { off: -65, dy: -2 },
    { off: 52, dy: 1 },
    { off: -22, dy: 2 },
    { off: 75, dy: -1 },
    { off: -60, dy: 2 },
    { off: 0, dy: 0 },
  ],
  // Pattern 4: Panoramic double meander
  [
    { off: 52, dy: 0 },
    { off: -78, dy: -2 },
    { off: 36, dy: 2 },
    { off: 88, dy: -1 },
    { off: -68, dy: 2 },
    { off: 74, dy: -2 },
    { off: -85, dy: 1 },
    { off: 42, dy: -1 },
    { off: 86, dy: 2 },
    { off: -72, dy: -2 },
    { off: 45, dy: 1 },
    { off: -30, dy: 2 },
    { off: 65, dy: -1 },
    { off: -55, dy: 2 },
    { off: 0, dy: 0 },
  ],
];

/**
 * Generates organic, aesthetic, and logically flowing node coordinates for any level.
 * Features deterministic natural wandering so buttons don't stay in the exact same spots,
 * keeping each level distinct and enjoyable to explore.
 */
export function getLevelNodes(lvl: number, buttonCount: number = 14): JourneyPathNode[] {
  const pIdx = Math.abs(lvl - 1) % JOURNEY_PATTERNS.length;
  const basePattern = JOURNEY_PATTERNS[pIdx];

  const nodes: JourneyPathNode[] = [];

  for (let idx = 0; idx < buttonCount; idx++) {
    const item = basePattern[idx] || basePattern[idx % (basePattern.length - 1)] || { off: 0, dy: 0 };
    const wiggleX = Math.sin(lvl * 2.7 + idx * 1.9) * 5;
    const wiggleY = Math.cos(lvl * 2.1 + idx * 2.3) * 3;

    const rawOffset = item.off + wiggleX;
    const offsetX = Math.max(-100, Math.min(100, Math.round(rawOffset)));
    const y = START_Y + idx * STEP_Y + item.dy + wiggleY;

    nodes.push({
      x: CENTER_X + offsetX,
      y: Math.round(y),
      offsetX,
    });
  }

  // The Exam Node (positioned right after the final button, centered)
  const examY = buttonCount === 0
    ? START_Y + EXAM_GAP_Y
    : START_Y + (buttonCount - 1) * STEP_Y + EXAM_GAP_Y;

  nodes.push({
    x: CENTER_X,
    y: Math.round(examY),
    offsetX: 0,
  });

  return nodes;
}

export function getJourneyLevelHeight(buttonCount: number = 14): number {
  if (buttonCount === 0) {
    return START_Y + EXAM_GAP_Y + 68;
  }
  return START_Y + (buttonCount - 1) * STEP_Y + EXAM_GAP_Y + 68;
}

export interface JourneyPathHandle {
  segIdx: number;
  point: 1 | 2;
  x: number;
  y: number;
}

export interface SegmentControlPoints {
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

export interface TangentArm {
  p1: { x: number; y: number };
  cp1: { x: number; y: number };
  p2: { x: number; y: number };
  cp2: { x: number; y: number };
}

/**
 * Generates an organic, fluid SVG path connecting the nodes.
 *
 * Guarantees:
 * - 2 editable points per segment (Point 1 and Point 2) allowing true 'S' curves and custom waves.
 * - Both points can be pushed anywhere (up, down, left, right).
 * - Dotted line departs from center of button and enters center of next button.
 */
export function getLevelPathData(
  lvl: number,
  nodes: JourneyPathNode[],
  sharpnessScore = 5,
  customControlPoints?: Record<number, SegmentControlPoints>
): { pathD: string; handles: JourneyPathHandle[]; arms: TangentArm[] } {
  const n = nodes.length;
  if (n <= 1) return { pathD: '', handles: [], arms: [] };

  const first = nodes[0];
  // Smooth natural lead-in from top center (180, 14) entering vertically into node 0
  let d = `M 180 14 C 180 ${first.y * 0.5}, ${first.x} ${first.y * 0.6}, ${first.x} ${first.y}`;
  const handles: JourneyPathHandle[] = [];
  const arms: TangentArm[] = [];

  // Default natural gentle arch offsets for a playful, scenic trail
  const defaultBows = [22, -20, 24, -22, 20, -24, 22, -20, 22, -20, 18, -16];

  for (let i = 0; i < n - 1; i++) {
    const p1 = nodes[i];
    const p2 = nodes[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const bow = defaultBows[i % defaultBows.length];

    const segCP = customControlPoints?.[i];

    // Point 1: top / departure bend
    const cp1 = segCP?.cp1 || {
      x: Math.round(p1.x + dx * 0.25 + nx * bow),
      y: Math.round(p1.y + dy * 0.35),
    };

    // Point 2: bottom / arrival bend
    const cp2 = segCP?.cp2 || {
      x: Math.round(p2.x - dx * 0.25 + nx * (bow * 0.7)),
      y: Math.round(p2.y - dy * 0.35),
    };

    d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;

    handles.push({ segIdx: i, point: 1, x: cp1.x, y: cp1.y });
    handles.push({ segIdx: i, point: 2, x: cp2.x, y: cp2.y });
    arms.push({ p1, cp1, p2, cp2 });
  }

  // Smooth lead-out downwards from final node towards the next level
  const last = nodes[n - 1];
  d += ` L ${last.x} ${last.y + 44}`;
  return { pathD: d, handles, arms };
}

export function getLevelPathD(
  lvl: number,
  nodes: JourneyPathNode[],
  sharpnessScore = 5,
  customControlPoints?: Record<number, SegmentControlPoints>
): string {
  return getLevelPathData(lvl, nodes, sharpnessScore, customControlPoints).pathD;
}

// Default Level 1 nodes for backward compatibility
export const JOURNEY_PATH_NODES: JourneyPathNode[] = getLevelNodes(1, 12);
export const NODE_OFFSETS = JOURNEY_PATH_NODES.map((n) => n.offsetX);
export const BALL_OFFSETS = NODE_OFFSETS.slice(0, 12);
export const JOURNEY_TOTAL_HEIGHT = START_Y + 11 * STEP_Y + EXAM_GAP_Y + 68;
export const JOURNEY_PATH_D = getLevelPathD(1, JOURNEY_PATH_NODES);

export function generateCurvedPath(nodes: JourneyPathNode[]): string {
  return getLevelPathD(1, nodes);
}

export interface JourneyButtonDef {
  type: 'new_words' | 'rusty_review' | 'recent_review';
  sessionType: SessionType;
  sessions: number;
  title: string;
  subtitle: string;
  badgeText: string;
  colorTheme: 'emerald' | 'purple' | 'indigo';
  buttonBg: string;
  activeRing: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const JOURNEY_BUTTONS: JourneyButtonDef[] = [
  // 1. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 2. Rusty Review (3 sessies)
  {
    type: 'rusty_review',
    sessionType: 'rusty_review',
    sessions: 3,
    title: 'Rusty Review',
    subtitle: 'Memory review (learned words)',
    badgeText: 'Rusty review',
    colorTheme: 'purple',
    buttonBg: 'bg-purple-600 border-b-4 border-purple-800 shadow-purple-600/25',
    activeRing: 'ring-4 ring-purple-400/35',
    icon: Brain,
  },
  // 3. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 4. Recent Review (3 sessies)
  {
    type: 'recent_review',
    sessionType: 'recent_review',
    sessions: 3,
    title: 'Recent Review',
    subtitle: 'Current level & previous level',
    badgeText: 'Recent review',
    colorTheme: 'indigo',
    buttonBg: 'bg-indigo-600 border-b-4 border-indigo-800 shadow-indigo-600/25',
    activeRing: 'ring-4 ring-indigo-400/35',
    icon: Lightbulb,
  },
  // 5. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 6. Rusty Review (3 sessies)
  {
    type: 'rusty_review',
    sessionType: 'rusty_review',
    sessions: 3,
    title: 'Rusty Review',
    subtitle: 'Memory review (learned words)',
    badgeText: 'Rusty review',
    colorTheme: 'purple',
    buttonBg: 'bg-purple-600 border-b-4 border-purple-800 shadow-purple-600/25',
    activeRing: 'ring-4 ring-purple-400/35',
    icon: Brain,
  },
  // 7. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 8. Recent Review (3 sessies)
  {
    type: 'recent_review',
    sessionType: 'recent_review',
    sessions: 3,
    title: 'Recent Review',
    subtitle: 'Current level & previous level',
    badgeText: 'Recent review',
    colorTheme: 'indigo',
    buttonBg: 'bg-indigo-600 border-b-4 border-indigo-800 shadow-indigo-600/25',
    activeRing: 'ring-4 ring-indigo-400/35',
    icon: Lightbulb,
  },
  // 9. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 10. Rusty Review (3 sessies)
  {
    type: 'rusty_review',
    sessionType: 'rusty_review',
    sessions: 3,
    title: 'Rusty Review',
    subtitle: 'Memory review (learned words)',
    badgeText: 'Rusty review',
    colorTheme: 'purple',
    buttonBg: 'bg-purple-600 border-b-4 border-purple-800 shadow-purple-600/25',
    activeRing: 'ring-4 ring-purple-400/35',
    icon: Brain,
  },
  // 11. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 12. Recent Review (3 sessies)
  {
    type: 'recent_review',
    sessionType: 'recent_review',
    sessions: 3,
    title: 'Recent Review',
    subtitle: 'Current level & previous level',
    badgeText: 'Recent review',
    colorTheme: 'indigo',
    buttonBg: 'bg-indigo-600 border-b-4 border-indigo-800 shadow-indigo-600/25',
    activeRing: 'ring-4 ring-indigo-400/35',
    icon: Lightbulb,
  },
  // 13. New Words (4 sessies)
  {
    type: 'new_words',
    sessionType: 'new_words',
    sessions: 4,
    title: 'New Words',
    subtitle: '4 new words + 6 recent review',
    badgeText: 'New words',
    colorTheme: 'emerald',
    buttonBg: 'bg-emerald-500 border-b-4 border-emerald-700 shadow-emerald-500/25',
    activeRing: 'ring-4 ring-emerald-400/35',
    icon: BookOpen,
  },
  // 14. Rusty Review (3 sessies)
  {
    type: 'rusty_review',
    sessionType: 'rusty_review',
    sessions: 3,
    title: 'Rusty Review',
    subtitle: 'Memory review (learned words)',
    badgeText: 'Rusty review',
    colorTheme: 'purple',
    buttonBg: 'bg-purple-600 border-b-4 border-purple-800 shadow-purple-600/25',
    activeRing: 'ring-4 ring-purple-400/35',
    icon: Brain,
  },
];

export const TOTAL_LEVEL_SESSIONS = 49; // 7*4 + 7*3 = 49 sessions per level

/**
 * Computes how many new word sessions in this level are skipped because words were manually marked learned in Word Bank.
 * Each 4 manually learned words skips 1 daily session from the very back of the level.
 */
export function getSkippedNewWordSessionsCount(profile: UserProfile, lvl: number): number {
  const levelWords = getVocabularyForNumericLevel(
    profile.targetLanguage,
    lvl,
    profile.knownLanguage || 'en'
  );

  const manuallyLearnedCount = levelWords.filter((w) => {
    const p = profile.words?.[w.id];
    if (!p) return false;
    return p.category === 'blue' && (p.manuallyLearned === true || !isWordLearnedInSession(p));
  }).length;

  return Math.min(28, Math.floor(manuallyLearnedCount / 4));
}

/**
 * Dynamically computes the buttons for a level.
 * Rule: Er mogen GEEN buttons verdwijnen!
 * All 14 buttons remain visible in every level.
 * Overbodige sessies worden met zwarte streepjes gemarkeerd, en overbodige knoppen worden donkergrijs.
 */
export function getLevelButtons(_profile?: UserProfile, _lvl?: number): JourneyButtonDef[] {
  return JOURNEY_BUTTONS;
}

export interface LevelSessionStats {
  totalSessions: number;          // Total sessions in the level (49)
  blackSessionsCount: number;     // Sessions marked black / skipped
  activeSessionsCount: number;    // Total sessions excluding black sessions
  completedSessionsCount: number; // Actual sessions completed by user in this level
  progressPercent: number;        // (completedSessionsCount / activeSessionsCount) * 100
}

/**
 * Calculates level session statistics according to the explicit rule:
 * "het percentage moet gaan over het aantal sessies dat ik heb gedaan gedeeld door het totaal aantal sessies (exclusief de zwarte sessies die niet meer meetellen).
 * Handmatige mastered woorden worden NIET meegeteld als voltooide sessies."
 */
export function getLevelSessionStats(profile: UserProfile, lvl: number): LevelSessionStats {
  const userNumLevel = profile.numericLevel || 1;
  const levelButtons = getLevelButtons(profile, lvl);
  const totalSessions = levelButtons.reduce((acc, b) => acc + b.sessions, 0);
  const isExamPassed = Boolean(profile.passedExams?.[lvl]);

  const skippedNewWordSessions = getSkippedNewWordSessionsCount(profile, lvl);

  // Helper to compute black sessions on any new words button (by ball index)
  const getNewWordsBlackCount = (targetBallIdx: number): number => {
    const nwIdx = Math.floor(targetBallIdx / 2);
    let blackCount = 0;
    for (let s = 0; s < 4; s++) {
      const globalIdx = nwIdx * 4 + s;
      if (globalIdx >= (28 - skippedNewWordSessions)) {
        blackCount++;
      }
    }
    return blackCount;
  };

  let blackSessionsCount = 0;

  for (let i = 0; i < levelButtons.length; i++) {
    const b = levelButtons[i];
    if (b.type === 'new_words') {
      blackSessionsCount += getNewWordsBlackCount(i);
    } else {
      const precedingNwIdx = i - 1;
      const precedingNwBlackCount = precedingNwIdx >= 0 ? getNewWordsBlackCount(precedingNwIdx) : 0;
      const isPrecedingNwFullyBlack = precedingNwIdx >= 0 && precedingNwBlackCount >= (levelButtons[precedingNwIdx]?.sessions ?? 4);
      if (isPrecedingNwFullyBlack) {
        blackSessionsCount += b.sessions;
      }
    }
  }

  const activeSessionsCount = Math.max(0, totalSessions - blackSessionsCount);

  // If level is passed, all active sessions are considered completed: 100%
  if (isExamPassed || lvl < userNumLevel) {
    return {
      totalSessions,
      blackSessionsCount,
      activeSessionsCount,
      completedSessionsCount: activeSessionsCount,
      progressPercent: 100,
    };
  }

  // If level is locked/future, 0%
  if (lvl > userNumLevel) {
    return {
      totalSessions,
      blackSessionsCount,
      activeSessionsCount,
      completedSessionsCount: 0,
      progressPercent: 0,
    };
  }

  // Active level: calculate actual sessions completed by user
  // Do NOT count manual mastered words as completed sessions!
  const levelWords = getVocabularyForNumericLevel(
    profile.targetLanguage,
    lvl,
    profile.knownLanguage || 'en'
  );

  // Words actually learned in daily sessions (excluding manual mastered words)
  const sessionLearnedWords = levelWords.filter((w) => {
    const p = profile.words?.[w.id];
    return p && isWordLearnedInSession(p);
  });
  const nwSessionsFromWords = Math.ceil(sessionLearnedWords.length / 4);

  let userCompletedSessions = 0;

  for (let i = 0; i < levelButtons.length; i++) {
    const b = levelButtons[i];
    if (b.type === 'new_words') {
      const nwIdx = Math.floor(i / 2);
      const btnBlack = getNewWordsBlackCount(i);
      const btnActive = Math.max(0, b.sessions - btnBlack);
      if (btnActive > 0) {
        // Sessions completed on this button from words learned in sessions:
        const fromWords = Math.min(btnActive, Math.max(0, nwSessionsFromWords - nwIdx * 4));
        // Sessions completed from button click tracking:
        const fromTracking = Math.min(
          btnActive,
          Math.max(0, profile.journeyProgress?.completedSessionsByButton?.[`${lvl}_${i}`] || 0)
        );
        userCompletedSessions += Math.max(fromWords, fromTracking);
      }
    } else {
      const precedingNwIdx = i - 1;
      const precedingNwBlackCount = precedingNwIdx >= 0 ? getNewWordsBlackCount(precedingNwIdx) : 0;
      const isPrecedingNwFullyBlack = precedingNwIdx >= 0 && precedingNwBlackCount >= (levelButtons[precedingNwIdx]?.sessions ?? 4);

      if (!isPrecedingNwFullyBlack) {
        // Check if user has advanced past this review:
        const nextNwBallIdx = i + 1;
        const nextNwIdx = Math.floor(nextNwBallIdx / 2);
        const hasAdvancedPast =
          nextNwBallIdx < levelButtons.length &&
          (nextNwIdx * 4 < nwSessionsFromWords ||
            (profile.journeyProgress?.completedSessionsByButton?.[`${lvl}_${nextNwBallIdx}`] ?? 0) > 0);

        if (hasAdvancedPast) {
          userCompletedSessions += b.sessions;
        } else {
          const fromBtn = profile.journeyProgress?.completedSessionsByButton?.[`${lvl}_${i}`] || 0;
          userCompletedSessions += Math.min(b.sessions, Math.max(0, fromBtn));
        }
      }
    }
  }

  const completedSessionsCount = Math.min(activeSessionsCount, Math.max(0, userCompletedSessions));
  const progressPercent = activeSessionsCount > 0
    ? Math.round((completedSessionsCount / activeSessionsCount) * 100)
    : 100;

  return {
    totalSessions,
    blackSessionsCount,
    activeSessionsCount,
    completedSessionsCount,
    progressPercent,
  };
}

/**
 * Calculates total completed sessions in level `lvl` chronologically.
 * Excludes black/skipped sessions from being falsely counted as completed sessions.
 */
export function getLevelCompletedSessions(profile: UserProfile, lvl: number): number {
  return getLevelSessionStats(profile, lvl).completedSessionsCount;
}

export const JourneyView: React.FC<JourneyViewProps> = ({
  profile,
  savedDailySession,
  onStartLesson,
  onStartExam,
  onStartDailyPractice,
  onContinueDailyPractice,
  onStartRustyReview,
}) => {
  const userNumLevel = profile.numericLevel || 1;
  const maxUnlockedLevel = profile.maxUnlockedNumericLevel || userNumLevel;
  const targetLang = getLanguage(profile.targetLanguage, profile.knownLanguage);

  // Active level currently frozen in place at top of screen
  const [visibleLevel, setVisibleLevel] = useState<number>(userNumLevel);

  // Lesson preview drawer state
  const [activeBallModal, setActiveBallModal] = useState<{
    level: number;
    ballIndex: number;
  } | null>(null);

  // Custom Rusty Review modal state in Journey
  const [isCustomRustyOpen, setIsCustomRustyOpen] = useState(false);
  const [customWordCount, setCustomWordCount] = useState(10);
  const [customDirection, setCustomDirection] = useState<'both' | 'target' | 'known'>('both');

  // Manual mouse drag & route customization state
  const [isEditMode, setIsEditMode] = useState(false);
  const [customLevelNodes, setCustomLevelNodes] = useState<Record<number, JourneyPathNode[]>>(() => {
    try {
      const saved = localStorage.getItem('journey_user_custom_nodes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [customLevelControlPoints, setCustomLevelControlPoints] = useState<Record<number, Record<number, SegmentControlPoints>>>(() => {
    try {
      const saved = localStorage.getItem('journey_user_custom_cps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [sharpnessScore, setSharpnessScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('journey_user_sharpness_score');
      return saved ? Number(saved) : 5;
    } catch {
      return 5;
    }
  });
  const [draggingItem, setDraggingItem] = useState<{
    type: 'node' | 'cp1' | 'cp2';
    lvl: number;
    idx: number;
  } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [skipToast, setSkipToast] = useState<string | null>(null);
  const skipToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for auto-scrolling
  const levelContainerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Render list of levels (around user level, with range 1 to 60)
  const renderedLevels = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i + 1);
  }, []);

  // Precompute organic path and nodes for all levels so each level has its own unique, aesthetic journey trail
  const levelDataMap = useMemo(() => {
    const map: Record<
      number,
      {
        nodes: JourneyPathNode[];
        pathD: string;
        handles: JourneyPathHandle[];
        arms: TangentArm[];
        buttons: JourneyButtonDef[];
      }
    > = {};
    for (const lvl of renderedLevels) {
      const buttons = getLevelButtons(profile, lvl);
      const baseNodes = getLevelNodes(lvl, buttons.length);
      const customNodes = customLevelNodes[lvl];
      const nodes = customNodes && customNodes.length === baseNodes.length ? customNodes : baseNodes;
      const cps = customLevelControlPoints[lvl];
      const data = getLevelPathData(lvl, nodes, sharpnessScore, cps);
      map[lvl] = {
        nodes,
        pathD: data.pathD,
        handles: data.handles,
        arms: data.arms,
        buttons,
      };
    }
    return map;
  }, [renderedLevels, profile, customLevelNodes, customLevelControlPoints, sharpnessScore]);

  // Pointer drag event handlers for mouse manipulation of button positions
  const handleBallPointerDown = (e: React.PointerEvent, lvl: number, ballIdx: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingItem({ type: 'node', lvl, idx: ballIdx });
  };

  // Pointer drag event handlers for mouse manipulation of curve control points (Point 1 and Point 2)
  const handleControlPointPointerDown = (e: React.PointerEvent, lvl: number, segIdx: number, point: 1 | 2) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingItem({ type: point === 1 ? 'cp1' : 'cp2', lvl, idx: segIdx });
  };

  // Global window listener: enables 100% reliable 2D dragging across the entire screen
  useEffect(() => {
    if (!draggingItem) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const canvas = document.getElementById(`journey-canvas-${draggingItem.lvl}`);
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      if (draggingItem.type === 'node') {
        const clampedX = Math.max(38, Math.min(BASE_JOURNEY_WIDTH - 38, rawX));
        const clampedY = Math.max(35, Math.min(JOURNEY_TOTAL_HEIGHT - 35, rawY));

        setCustomLevelNodes((prev) => {
          const baseNodes = prev[draggingItem.lvl] || getLevelNodes(draggingItem.lvl, getLevelButtons(profile, draggingItem.lvl).length);
          const updatedNodes = baseNodes.map((n, idx) => {
            if (idx === draggingItem.idx) {
              return {
                x: Math.round(clampedX),
                y: Math.round(clampedY),
                offsetX: Math.round(clampedX - CENTER_X),
              };
            }
            return n;
          });
          return { ...prev, [draggingItem.lvl]: updatedNodes };
        });
      } else if (draggingItem.type === 'cp1') {
        // Dragging Point 1 (departure bend): moves UP, DOWN, LEFT, RIGHT
        const clampedX = Math.max(10, Math.min(BASE_JOURNEY_WIDTH - 10, rawX));
        const clampedY = Math.max(10, Math.min(JOURNEY_TOTAL_HEIGHT - 10, rawY));

        setCustomLevelControlPoints((prev) => ({
          ...prev,
          [draggingItem.lvl]: {
            ...(prev[draggingItem.lvl] || {}),
            [draggingItem.idx]: {
              ...(prev[draggingItem.lvl]?.[draggingItem.idx] || {}),
              cp1: { x: Math.round(clampedX), y: Math.round(clampedY) },
            },
          },
        }));
      } else if (draggingItem.type === 'cp2') {
        // Dragging Point 2 (arrival bend): moves UP, DOWN, LEFT, RIGHT
        const clampedX = Math.max(10, Math.min(BASE_JOURNEY_WIDTH - 10, rawX));
        const clampedY = Math.max(10, Math.min(JOURNEY_TOTAL_HEIGHT - 10, rawY));

        setCustomLevelControlPoints((prev) => ({
          ...prev,
          [draggingItem.lvl]: {
            ...(prev[draggingItem.lvl] || {}),
            [draggingItem.idx]: {
              ...(prev[draggingItem.lvl]?.[draggingItem.idx] || {}),
              cp2: { x: Math.round(clampedX), y: Math.round(clampedY) },
            },
          },
        }));
      }
    };

    const handleWindowPointerUp = () => {
      setDraggingItem(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [draggingItem]);

  const handleSaveCustomRoute = (lvl: number) => {
    try {
      localStorage.setItem('journey_user_custom_nodes', JSON.stringify(customLevelNodes));
      localStorage.setItem('journey_user_custom_cps', JSON.stringify(customLevelControlPoints));
      localStorage.setItem('journey_user_sharpness_score', String(sharpnessScore));
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 2200);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetCustomRoute = (lvl: number) => {
    setCustomLevelNodes((prev) => {
      const next = { ...prev };
      delete next[lvl];
      try {
        localStorage.setItem('journey_user_custom_nodes', JSON.stringify(next));
      } catch {}
      return next;
    });
    setCustomLevelControlPoints((prev) => {
      const next = { ...prev };
      delete next[lvl];
      try {
        localStorage.setItem('journey_user_custom_cps', JSON.stringify(next));
      } catch {}
      return next;
    });
    setSharpnessScore(5);
    try {
      localStorage.setItem('journey_user_sharpness_score', '5');
    } catch {}
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2200);
  };

  // Helper preset: instantly creates playful alternating S-curves on all segments of the active level
  const handleApplySCurves = (lvl: number) => {
    const nodes = customLevelNodes[lvl] || getLevelNodes(lvl, getLevelButtons(profile, lvl).length);
    const n = nodes.length;
    const newCPs: Record<number, SegmentControlPoints> = {};
    for (let i = 0; i < n - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      // S-curve: Point 1 sweeps to one side (+), Point 2 sweeps to opposite side (-)
      const sign = i % 2 === 0 ? 1 : -1;
      newCPs[i] = {
        cp1: {
          x: Math.max(15, Math.min(BASE_JOURNEY_WIDTH - 15, Math.round(p1.x + dx * 0.25 + sign * 42))),
          y: Math.round(p1.y + dy * 0.32),
        },
        cp2: {
          x: Math.max(15, Math.min(BASE_JOURNEY_WIDTH - 15, Math.round(p2.x - dx * 0.25 - sign * 42))),
          y: Math.round(p2.y - dy * 0.32),
        },
      };
    }
    setCustomLevelControlPoints((prev) => ({
      ...prev,
      [lvl]: newCPs,
    }));
  };

  // Smoothly scroll to a specific level section
  const scrollToLevel = (targetLvl: number) => {
    const el = document.getElementById(`journey-level-section-${targetLvl}`);
    if (el) {
      const headerOffset = 135;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  };

  // Scroll listener: detects which level section is currently active,
  // automatically changing the level field as you scroll down into the next level
  useEffect(() => {
    let animationFrameId: number;

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        // Trigger line sits around 140px from viewport top
        const triggerY = 140;

        let currentLvl = 1;
        for (let lvl = 1; lvl <= renderedLevels.length; lvl++) {
          const el = document.getElementById(`journey-level-section-${lvl}`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY) {
            currentLvl = lvl;
          } else {
            break;
          }
        }

        setVisibleLevel((prev) => (prev !== currentLvl ? currentLvl : prev));
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderedLevels]);

  // Auto-scroll when the popover opens so that 'start' is smoothly and comfortably in view
  useEffect(() => {
    if (!activeBallModal) return;
    const timer = setTimeout(() => {
      if (popoverRef.current) {
        const rect = popoverRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const isCutOffBottom = rect.bottom > viewportHeight - 50;
        const isCutOffTop = rect.top < 85;

        if (isCutOffBottom || isCutOffTop) {
          popoverRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [activeBallModal]);

  // Exact per-button status and session completion calculation:
  const getButtonStatus = useCallback(
    (lvl: number, ballIdx: number, levelButtons: JourneyButtonDef[]) => {
      const btnDef = levelButtons[ballIdx];
      if (!btnDef) {
        return {
          completedSessions: 0,
          isCompleted: false,
          isDarkGrey: false,
          blackSessionsCount: 0,
          activeSessionsCount: 0,
          sessionsDetails: [] as Array<{ isDone: boolean; isBlack: boolean }>,
        };
      }

      const skippedNewWordSessions = getSkippedNewWordSessionsCount(profile, lvl);

      // Helper to compute black sessions on any new words button (by ball index)
      const getNewWordsBlackCount = (targetBallIdx: number): number => {
        const nwIdx = Math.floor(targetBallIdx / 2); // 0 to 6
        let blackCount = 0;
        for (let s = 0; s < 4; s++) {
          const globalIdx = nwIdx * 4 + s;
          if (globalIdx >= (28 - skippedNewWordSessions)) {
            blackCount++;
          }
        }
        return blackCount;
      };

      let blackSessionsCount = 0;
      let isDarkGrey = false;

      if (btnDef.type === 'new_words') {
        blackSessionsCount = getNewWordsBlackCount(ballIdx);
        // Rule: "Wat gebeurt er als alle 4 de sessies van een button zwart zijn? dan wordt die hele button donker... donker grijs"
        isDarkGrey = blackSessionsCount >= btnDef.sessions;
      } else {
        // Review button (rusty_review or recent_review):
        // Rule: Rusty review / recent review only become black if they are located BETWEEN a fully black daily session and the exam.
        // If a rusty/recent review is BEFORE a black button, you still have to complete it.
        // If a daily button has 1 (or 2 or 3) black dashes, it is not fully black, and the review must still be completed.
        const precedingNwIdx = ballIdx - 1;
        const precedingNwBlackCount = precedingNwIdx >= 0 ? getNewWordsBlackCount(precedingNwIdx) : 0;
        const isPrecedingNwFullyBlack = precedingNwIdx >= 0 && precedingNwBlackCount >= levelButtons[precedingNwIdx].sessions;

        isDarkGrey = isPrecedingNwFullyBlack;
        blackSessionsCount = isDarkGrey ? btnDef.sessions : 0;
      }

      const activeSessionsCount = isDarkGrey ? 0 : Math.max(0, btnDef.sessions - blackSessionsCount);

      // If level is already passed:
      if (lvl < userNumLevel) {
        return {
          completedSessions: activeSessionsCount,
          isCompleted: true,
          isDarkGrey,
          blackSessionsCount,
          activeSessionsCount,
          sessionsDetails: Array.from({ length: btnDef.sessions }).map((_, s) => ({
            isDone: true,
            isBlack: isDarkGrey || (
              btnDef.type === 'new_words'
                ? ((Math.floor(ballIdx / 2) * 4 + s) >= (28 - skippedNewWordSessions))
                : isDarkGrey
            ),
          })),
        };
      }

      // If level is not yet unlocked:
      if (lvl > userNumLevel) {
        return {
          completedSessions: 0,
          isCompleted: false,
          isDarkGrey,
          blackSessionsCount,
          activeSessionsCount,
          sessionsDetails: Array.from({ length: btnDef.sessions }).map((_, s) => ({
            isDone: false,
            isBlack: isDarkGrey || (
              btnDef.type === 'new_words'
                ? ((Math.floor(ballIdx / 2) * 4 + s) >= (28 - skippedNewWordSessions))
                : isDarkGrey
            ),
          })),
        };
      }

      // Current level:
      if (isDarkGrey) {
        return {
          completedSessions: 0,
          isCompleted: true, // Skipped buttons are treated as completed so progression can reach level exam
          isDarkGrey: true,
          blackSessionsCount,
          activeSessionsCount: 0,
          sessionsDetails: Array.from({ length: btnDef.sessions }).map(() => ({
            isDone: true,
            isBlack: true,
          })),
        };
      }

      const levelWords = getVocabularyForNumericLevel(
        profile.targetLanguage,
        lvl,
        profile.knownLanguage || 'en'
      );

      // Count words actually learned in daily sessions (excluding manual mastered words)
      const sessionLearnedWordsCount = levelWords.filter((w) => {
        const p = profile.words?.[w.id];
        return p && isWordLearnedInSession(p);
      }).length;

      const completedNwSessions = Math.floor(sessionLearnedWordsCount / 4);

      if (btnDef.type === 'new_words') {
        const nwIdx = Math.floor(ballIdx / 2); // 0 to 6

        let completed = 0;
        const sessionsDetails = Array.from({ length: btnDef.sessions }).map((_, s) => {
          const globalIdx = nwIdx * 4 + s;
          const isBlack = globalIdx >= (28 - skippedNewWordSessions);
          const isDone = isBlack || (globalIdx < completedNwSessions);
          if (!isBlack && isDone) {
            completed++;
          }
          return { isDone, isBlack };
        });

        const isCompleted = activeSessionsCount === 0 || completed >= activeSessionsCount;

        return {
          completedSessions: completed,
          isCompleted,
          isDarkGrey: false,
          blackSessionsCount,
          activeSessionsCount,
          sessionsDetails,
        };
      } else {
        // Review button (rusty_review or recent_review):
        // Rule: You can ONLY do review after finishing the daily sessions before it.
        // If the daily sessions before this review are not finished yet, this review button CANNOT be completed!
        // It must show its sessions around it so you see that it still needs to be done.
        const precedingNwIdx = ballIdx - 1;
        const precNwIndex = Math.floor(precedingNwIdx / 2);
        const precedingNwBlackCount = precedingNwIdx >= 0 ? getNewWordsBlackCount(precedingNwIdx) : 0;
        const precNwActiveSessions = levelButtons[precedingNwIdx].sessions - precedingNwBlackCount;

        // Is the preceding daily NW button completely finished with all its active sessions?
        const isPrecedingNwDone = precedingNwIdx >= 0 && (
          (precNwIndex * 4 + precNwActiveSessions) <= completedNwSessions
        );

        let completed = 0;
        if (isPrecedingNwDone) {
          // Check if user has progressed past this review into next daily NW:
          const nextNwBallIdx = ballIdx + 1;
          const nextNwIndex = Math.floor(nextNwBallIdx / 2);
          const hasAdvancedPastThisReview = nextNwBallIdx < levelButtons.length && (nextNwIndex * 4 < completedNwSessions);

          if (hasAdvancedPastThisReview) {
            completed = btnDef.sessions;
          } else {
            // Currently at this review button: take sessions actually completed on this button
            const fromBtn = profile.journeyProgress?.completedSessionsByButton?.[`${lvl}_${ballIdx}`] || 0;
            completed = Math.min(btnDef.sessions, Math.max(0, fromBtn));
          }
        } else {
          // Preceding daily sessions are NOT finished yet!
          // Therefore this review button is NOT finished!
          completed = 0;
        }

        const isCompleted = activeSessionsCount === 0 || completed >= activeSessionsCount;

        const sessionsDetails = Array.from({ length: btnDef.sessions }).map((_, s) => ({
          isDone: s < completed,
          isBlack: false,
        }));

        return {
          completedSessions: completed,
          isCompleted,
          isDarkGrey: false,
          blackSessionsCount: 0,
          activeSessionsCount,
          sessionsDetails,
        };
      }
    },
    [profile, userNumLevel]
  );

  // Total completed sessions for a level
  const getCompletedLessonsForLevel = useCallback(
    (lvl: number): number => {
      return getLevelCompletedSessions(profile, lvl);
    },
    [profile]
  );

  // Scroll to active level on mount so that the user starts directly at their current level
  useEffect(() => {
    if (userNumLevel <= 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const timer = setTimeout(() => {
      scrollToLevel(userNumLevel);
    }, 80);

    return () => clearTimeout(timer);
  }, [userNumLevel]);

  // Launches session based on button type:
  const handleLaunchButtonSession = (lvl: number, ballIdx: number, sessionInButton: number) => {
    setActiveBallModal(null);
    const levelButtons = getLevelButtons(profile, lvl);
    const ballStatus = getButtonStatus(lvl, ballIdx, levelButtons);
    if (ballStatus.isCompleted) {
      return;
    }

    const btnDef = levelButtons[ballIdx];
    const actualSessionToLaunch = ballStatus.completedSessions;

    let cards: StudyCard[] = [];
    if (btnDef.type === 'new_words') {
      const priorNewWordsSessions = levelButtons.slice(0, ballIdx)
        .filter((b) => b.type === 'new_words')
        .reduce((acc, b) => acc + b.sessions, 0);
      const overallNewWordIndex = priorNewWordsSessions + actualSessionToLaunch;
      cards = buildNewWordsSessionCards(profile, lvl, overallNewWordIndex);
    } else if (btnDef.type === 'rusty_review') {
      cards = buildRustyReviewSessionCards(profile, 10);
    } else {
      cards = buildRecentReviewSessionCards(profile, 10);
    }

    onStartLesson(lvl, ballIdx, actualSessionToLaunch, cards, btnDef.sessionType);
  };

  // Launches Level Exam session (25 tokens you did wrong the most amount of times)
  const handleLaunchExamSession = (lvl: number) => {
    setActiveBallModal(null);
    const levelButtons = getLevelButtons(profile, lvl);
    if (onStartExam) {
      onStartExam(lvl);
      return;
    }
    const cards = buildExamSessionCards(profile, lvl, 25);
    onStartLesson(lvl, levelButtons.length, 0, cards, 'exam');
  };

  // Info for the currently visible level in the frozen level field
  const visibleTheme = getLevelTheme(visibleLevel);
  const visibleLevelStats = getLevelSessionStats(profile, visibleLevel);
  const visibleProgressPercent = visibleLevelStats.progressPercent;
  const visibleLessonsCompleted = visibleLevelStats.completedSessionsCount;
  const visibleTotalSessions = visibleLevelStats.activeSessionsCount;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-28">
      {/* 
        DOMINANT WHITESPACE MASK:
        Seamlessly covers the gap between the black bar and the Level Card.
        Matches the page background with NO borders, shadows, or frames.
        Buttons scrolling past the Level Card go behind this mask (z-30)
        and are completely hidden from the whitespace.
      */}
      <div className="fixed top-14 sm:top-16 left-0 right-0 h-3.5 sm:h-4.5 bg-stone-50 dark:bg-stone-950 z-30 pointer-events-none" />

      {/* 
        FROZEN LEVEL FIELD:
        Stays frozen at the exact same place at the top of the journey view.
        Standalone 3D card floating cleanly with NO weird surrounding white box.
      */}
      <div className="fixed top-[70px] sm:top-[82px] left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-xl mx-auto px-4 pointer-events-auto">
          <div
            className={`rounded-2xl py-2.5 px-4 sm:px-5 transition-all duration-300 flex items-center justify-between gap-3 ${visibleTheme.bannerBg}`}
          >
            {/* Bold Level title in crisp white letters */}
            <span className="font-display font-extrabold text-base sm:text-lg text-white tracking-wide">
              Level {visibleLevel}
            </span>

            {/* Progress percentage & mini bar */}
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-xs sm:text-sm text-white">
                {visibleProgressPercent}%
              </span>
              <div className="w-16 sm:w-20 h-2 bg-black/25 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${visibleProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Route Bewerken (Manual mouse drag) button on the left */}
      <div className="fixed top-36 sm:top-40 left-0 right-0 max-w-xl mx-auto px-4 pointer-events-none z-20 flex justify-start">
        <button
          type="button"
          onClick={() => {
            setIsEditMode((prev) => !prev);
            setActiveBallModal(null);
          }}
          className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md border transition-all active:scale-95 cursor-pointer select-none ${
            isEditMode
              ? 'bg-amber-400 border-amber-500 text-stone-950 shadow-amber-500/30 ring-2 ring-amber-300 font-bold'
              : 'bg-white/95 dark:bg-stone-900/95 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:border-amber-400 font-semibold'
          }`}
          title="Versleep buttons met je muis om de route handmatig aan te passen"
        >
          <Move className={`w-4 h-4 ${isEditMode ? 'text-stone-950 animate-pulse' : 'text-amber-500'}`} />
          <span className="text-xs">
            {isEditMode ? 'Klaar met bewerken' : 'Route bewerken'}
          </span>
        </button>
      </div>

      {/* Floating Route Editor Controls at bottom when edit mode is active */}
      {isEditMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 dark:bg-stone-900/95 text-white backdrop-blur-md border border-amber-500/40 shadow-2xl shadow-stone-950/60 rounded-2xl p-3 flex flex-wrap items-center gap-3 text-xs max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <div className="flex items-center gap-2 text-stone-200 font-bold shrink-0">
            <span className="text-amber-300 font-extrabold">2 Punten per bocht:</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-stone-950 font-black text-[10px]">
              1 Bovenbocht
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-400 text-stone-950 font-black text-[10px]">
              2 Onderbocht
            </span>
          </div>

          {/* Quick preset for automatic S-curves */}
          <button
            type="button"
            onClick={() => handleApplySCurves(visibleLevel)}
            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-400/40 text-amber-200 font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Zet automatisch wisselende S-bochten op dit level"
          >
            ~ S-bochten toepassen
          </button>

          {/* Scherpte / Spitsheid Score */}
          <div className="flex items-center gap-2 border-l border-stone-700 pl-3">
            <span className="text-stone-300 font-medium">Scherpte:</span>
            <button
              type="button"
              onClick={() => setSharpnessScore((s) => Math.max(1, s - 1))}
              className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 active:scale-95 flex items-center justify-center font-bold text-white cursor-pointer"
              title="Ronder / minder spits"
            >
              -
            </button>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-stone-800 border border-stone-700">
              <span className="font-mono font-black text-amber-300 text-sm">{sharpnessScore}</span>
              <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">
                {sharpnessScore <= 2 ? 'Rond' : sharpnessScore <= 4 ? 'Vloeiend' : sharpnessScore <= 6 ? 'Normaal' : sharpnessScore <= 8 ? 'Scherp' : 'Spits'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSharpnessScore((s) => Math.min(10, s + 1))}
              className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 active:scale-95 flex items-center justify-center font-bold text-white cursor-pointer"
              title="Spitser / scherper"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => handleSaveCustomRoute(visibleLevel)}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-stone-950 font-extrabold rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-500/30"
              title="Sla route en punten op"
            >
              Opslaan
            </button>
            <button
              type="button"
              onClick={() => handleResetCustomRoute(visibleLevel)}
              className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300 hover:text-white font-medium rounded-xl transition-all cursor-pointer flex items-center gap-1"
              title="Herstel naar standaard"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="px-2.5 py-1.5 bg-stone-700 hover:bg-stone-600 active:scale-95 text-white font-medium rounded-xl transition-all cursor-pointer"
            >
              Sluit
            </button>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {saveSuccessMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-stone-950 font-extrabold text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-1.5 animate-in fade-in duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Route succesvol opgeslagen!</span>
        </div>
      )}

      {/* Floating persistent Review Rusty Words badge */}
      {onStartRustyReview && (
        <div className="fixed top-36 sm:top-40 left-0 right-0 max-w-xl mx-auto px-4 pointer-events-none z-20 flex justify-end">
          <div className="pointer-events-auto max-sm:translate-x-5 sm:translate-x-[60%] flex flex-col gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-br from-purple-700 via-indigo-600 to-indigo-800 dark:from-purple-800 dark:via-indigo-700 dark:to-indigo-900 text-white shadow-xl shadow-indigo-950/30 border border-purple-300/40 border-b-2 sm:border-b-3 border-b-indigo-950 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 hover:shadow-indigo-600/30 transition-all select-none">
            {/* Top row: Yellow Brain + Title */}
            <div className="flex items-center gap-2.5">
              <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 fill-amber-300/30 stroke-[2.2] shrink-0 drop-shadow-sm" />
              <span className="font-semibold text-sm sm:text-base text-white tracking-tight whitespace-nowrap drop-shadow-xs">
                Review Rusty Words
              </span>
            </div>

            {/* Bottom row: Start and Settings buttons */}
            <div className="flex items-center gap-2 w-full pt-0.5">
              <button
                type="button"
                onClick={() => onStartRustyReview(10, 'both')}
                className="flex-[2] py-1.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                title="Start review"
              >
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                <span className="text-xs font-semibold">Start</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCustomRustyOpen(true)}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs hover:shadow-sm"
                title="Aangepaste instellingen"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPEN JOURNEY PATH: The balls flow openly down the screen, not enclosed in box cards */}
      <div ref={levelContainerRef} className="max-w-xl mx-auto px-4 pt-20 sm:pt-24">
        {renderedLevels.map((lvl) => {
          const theme = getLevelTheme(lvl);
          const completedLessons = getCompletedLessonsForLevel(lvl);
          const isExamPassed = Boolean(profile.passedExams?.[lvl]);
          const isLvlComplete = isExamPassed;
          const isCurrentLevel = lvl === userNumLevel;
          // You can only go to the next level after passing the exam
          const isLevelUnlocked = lvl === 1 || Boolean(profile.passedExams?.[lvl - 1]);
          const isLocked = !isLevelUnlocked || lvl > maxUnlockedLevel;

          return (
            <div
              key={lvl}
              id={`journey-level-section-${lvl}`}
              className="relative py-2"
            >
              {/* Bescheiden grijze tekst - niet dikgedrukt - tussen de levels */}
              <div className="py-4 text-center text-xs font-normal text-stone-400 dark:text-stone-500 tracking-wider select-none">
                level {lvl}
              </div>

              {/* The Winding Path + Level Exam Node */}
              {(() => {
                const levelButtons = levelDataMap[lvl]?.buttons || getLevelButtons(profile, lvl);
                const levelData = levelDataMap[lvl] || {
                  nodes: getLevelNodes(lvl, levelButtons.length),
                  pathD: '',
                  buttons: levelButtons,
                };
                const levelNodes = levelData.nodes;
                const levelPathD = levelData.pathD;
                const totalLevelSessions = levelButtons.reduce((acc, b) => acc + b.sessions, 0);
                const levelCanvasHeight = getJourneyLevelHeight(levelButtons.length);

                return (
                  <div
                    id={`journey-canvas-${lvl}`}
                    className="relative w-[360px] max-w-full mx-auto touch-none"
                    style={{ height: `${levelCanvasHeight}px` }}
                  >
                    {/* Connecting SVG Dotted Line with theme stroke and organic arches */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none z-0"
                      viewBox={`0 0 ${BASE_JOURNEY_WIDTH} ${levelCanvasHeight}`}
                      preserveAspectRatio="none"
                    >
                      {/* Subtle organic track underlay for tactile 3D depth */}
                      {levelPathD && (
                        <path
                          d={levelPathD}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="6"
                          strokeDasharray="2 13"
                          strokeLinecap="round"
                          className="text-stone-300/40 dark:text-stone-800/60 translate-y-0.5"
                        />
                      )}
                      {/* Main colorful dotted trail with organic arches (boogjes) */}
                      {levelPathD && (
                        <path
                          d={levelPathD}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4.5"
                          strokeDasharray="2 13"
                          strokeLinecap="round"
                          className={theme.dotStroke}
                        />
                      )}

                      {/* Tangent control arms connecting buttons to Point 1 and Point 2 in Edit Mode */}
                      {isEditMode && levelData.arms?.map((arm, i) => (
                        <g key={`arm-${i}`} className="opacity-40 pointer-events-none">
                          <line
                            x1={arm.p1.x}
                            y1={arm.p1.y}
                            x2={arm.cp1.x}
                            y2={arm.cp1.y}
                            stroke="#f59e0b"
                            strokeWidth="1.5"
                            strokeDasharray="2 3"
                          />
                          <line
                            x1={arm.p2.x}
                            y1={arm.p2.y}
                            x2={arm.cp2.x}
                            y2={arm.cp2.y}
                            stroke="#10b981"
                            strokeWidth="1.5"
                            strokeDasharray="2 3"
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Draggable 2 Control Points Per Segment for S-curves and Arches (Shown in Edit Mode) */}
                    {isEditMode && levelData.handles?.map((h) => {
                      const isCp1 = h.point === 1;
                      const isDraggingThis =
                        draggingItem?.lvl === lvl &&
                        draggingItem?.idx === h.segIdx &&
                        draggingItem?.type === (isCp1 ? 'cp1' : 'cp2');

                      return (
                        <div
                          key={`cp-${h.segIdx}-${h.point}`}
                          onPointerDown={(e) => handleControlPointPointerDown(e, lvl, h.segIdx, h.point)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-move touch-none select-none p-2 ${
                            isDraggingThis ? 'scale-125 z-30' : ''
                          }`}
                          style={{
                            left: `${(h.x / BASE_JOURNEY_WIDTH) * 100}%`,
                            top: `${h.y}px`,
                          }}
                          title={`Sleep Punt ${h.point} (${isCp1 ? 'bovenbocht' : 'onderbocht'}) om een S-bocht te vormen`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs transition-all shadow-md ${
                              isDraggingThis
                                ? isCp1
                                  ? 'bg-amber-400 ring-4 ring-amber-300 text-stone-950 scale-125 shadow-amber-400/50 animate-pulse'
                                  : 'bg-emerald-400 ring-4 ring-emerald-300 text-stone-950 scale-125 shadow-emerald-400/50 animate-pulse'
                                : isCp1
                                ? 'bg-amber-500 hover:bg-amber-400 border border-amber-300 text-stone-950 hover:scale-115'
                                : 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-300 text-stone-950 hover:scale-115'
                            }`}
                          >
                            {h.point}
                          </div>
                          {/* Live tooltip */}
                          <div
                            className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-stone-900/95 text-[10px] ${
                              isCp1 ? 'text-amber-300' : 'text-emerald-300'
                            } font-bold whitespace-nowrap pointer-events-none shadow-md border border-stone-700 transition-opacity ${
                              isDraggingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            Punt {h.point} ({isCp1 ? 'Bovenbocht' : 'Onderbocht'})
                          </div>
                        </div>
                      );
                    })}

                    {levelButtons.map((btnDef, ballIdx) => {
                      const ballNum = ballIdx + 1;
                      const ballStatus = getButtonStatus(lvl, ballIdx, levelButtons);
                      const completedInBall = ballStatus.completedSessions;
                      const isBallCompleted = ballStatus.isCompleted;

                      // Unlocking logic:
                      const isPriorAllCompleted =
                        ballIdx === 0 ||
                        Array.from({ length: ballIdx }).every((_, i) => getButtonStatus(lvl, i, levelButtons).isCompleted);
                      const isBallActive = !ballStatus.isDarkGrey && !isBallCompleted && isPriorAllCompleted && !isLocked;
                      const isBallLocked = !ballStatus.isDarkGrey && !isBallCompleted && !isBallActive;
                      const isFinalBall = ballIdx === levelButtons.length - 1;
                      const node = levelNodes[ballIdx] || { x: CENTER_X, y: 100, offsetX: 0 };
                      const offsetX = node.offsetX;
                      const isNearCenter = Math.abs(offsetX) <= 25;
                      const isPopoverOpen = (isBallActive || isBallCompleted) && activeBallModal?.level === lvl && activeBallModal?.ballIndex === ballIdx;
                      const firstUnfinished = ballStatus.sessionsDetails.findIndex((s) => !s.isDone && !s.isBlack);
                      const activeLessonIdx = firstUnfinished >= 0 ? firstUnfinished : Math.min(Math.max(0, ballStatus.activeSessionsCount - 1), completedInBall);
                      const BtnIcon = btnDef.icon;

                      return (
                        <div
                          key={ballIdx}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 ${isPopoverOpen ? 'z-30' : 'z-10'} flex flex-col items-center group`}
                          style={{
                            left: `${(node.x / BASE_JOURNEY_WIDTH) * 100}%`,
                            top: `${node.y}px`,
                          }}
                        >
                          {/* Hover Tooltip when hovering over the button showing 'Rusty Review', 'Recent Review', or 'New Words' */}
                          {!isPopoverOpen && (
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-stone-900/95 dark:bg-stone-800 text-white text-xs font-bold tracking-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30 shadow-lg border border-stone-700/60 drop-shadow-md select-none flex items-center gap-1.5">
                              {ballStatus.isDarkGrey ? (
                                <span className="text-stone-300">Deze knop wordt overgeslagen omdat je de woorden al kende</span>
                              ) : ballStatus.blackSessionsCount > 0 ? (
                                <span>{btnDef.title} ({ballStatus.blackSessionsCount} overgeslagen)</span>
                              ) : isBallCompleted ? (
                                <span>{btnDef.title} (Voltooid)</span>
                              ) : (
                                <span>{btnDef.title}</span>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-stone-900/95 dark:border-t-stone-800" />
                            </div>
                          )}

                          {/* Duolingo-style Pop-up Bubble placed compactly to side of the ball, 100% opaque */}
                          {isPopoverOpen && (
                            <div
                              ref={popoverRef}
                              className={`absolute z-40 flex items-center animate-bubble-pop select-none pointer-events-auto ${
                                isNearCenter
                                  ? 'bottom-full mb-3 left-1/2 -translate-x-1/2'
                                  : offsetX < 0
                                  ? 'top-1/2 -translate-y-1/2 left-full ml-3.5'
                                  : 'top-1/2 -translate-y-1/2 right-full mr-3.5'
                              }`}
                            >
                              {/* 100% Opaque Solid Deep Midnight Card with integrated organic pointer arrow */}
                              <div className="relative w-[150px] rounded-2xl bg-[#181824] dark:bg-[#181824] text-white shadow-xl shadow-stone-950/40 border border-stone-700/80 border-b-2 sm:border-b-3 border-b-stone-950 flex flex-col items-center gap-1.5 p-2.5 sm:p-3 text-center">
                                {/* Organic Speech Bubble Pointer emerging towards the ball */}
                                {isNearCenter ? (
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-[#181824]" />
                                ) : offsetX < 0 ? (
                                  <svg
                                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-2.5 h-4 pointer-events-none drop-shadow-xs rotate-180"
                                    viewBox="0 0 10 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M 0 1 Q 4 5 10 8 Q 4 11 0 15 Z"
                                      fill="#181824"
                                    />
                                    <path
                                      d="M 0 1 Q 4 5 10 8 Q 4 11 0 15"
                                      stroke="#57534e"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-4 pointer-events-none drop-shadow-xs"
                                    viewBox="0 0 10 16"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M 0 1 Q 4 5 10 8 Q 4 11 0 15 Z"
                                      fill="#181824"
                                    />
                                    <path
                                      d="M 0 1 Q 4 5 10 8 Q 4 11 0 15"
                                      stroke="#57534e"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                )}

                            <div className="flex items-center gap-1.5 justify-center">
                              <BtnIcon className={`w-4 h-4 ${
                                btnDef.colorTheme === 'emerald'
                                  ? 'text-emerald-400'
                                  : btnDef.colorTheme === 'purple'
                                  ? 'text-purple-400'
                                  : 'text-indigo-400'
                              }`} />
                              <span className="font-bold text-xs text-white tracking-tight whitespace-nowrap">
                                {btnDef.title}
                              </span>
                            </div>

                            <span className="text-[11px] text-stone-400 font-medium">
                              Sessie {Math.min(ballStatus.activeSessionsCount, activeLessonIdx + 1)} van {ballStatus.activeSessionsCount}
                              {ballStatus.blackSessionsCount > 0 && ` (${ballStatus.blackSessionsCount} overgeslagen)`}
                            </span>

                            {isLocked ? (
                              <div className="w-full mt-1 px-2 py-1.5 rounded-xl font-semibold text-[10px] text-amber-300/90 bg-stone-800/80 text-center leading-tight">
                                Slaag eerst voor Level {lvl - 1} Examen
                              </div>
                            ) : isBallLocked ? (
                              <div className="w-full mt-1 px-2 py-1.5 rounded-xl font-semibold text-[10px] text-stone-400 bg-stone-800/80 text-center leading-tight">
                                Voltooi eerst eerdere knoppen
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLaunchButtonSession(lvl, ballIdx, activeLessonIdx);
                                }}
                                className={`w-full mt-1 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                  btnDef.colorTheme === 'emerald'
                                    ? 'bg-emerald-400 hover:bg-emerald-300 text-stone-950 shadow-emerald-400/20'
                                    : btnDef.colorTheme === 'purple'
                                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/25'
                                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/25'
                                }`}
                                title={`Start ${btnDef.title}`}
                              >
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                                <span>{isBallCompleted ? "Herhaal" : savedDailySession && btnDef.type === 'new_words' ? "Continue" : "Start"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* The Ball Container with exact segment count based on btnDef.sessions */}
                      <button
                        type="button"
                        onPointerDown={(e) => (isEditMode ? handleBallPointerDown(e, lvl, ballIdx) : undefined)}
                        onClick={
                          isEditMode
                            ? undefined
                            : ballStatus.isDarkGrey
                            ? () => {
                                setSkipToast('Deze knop wordt overgeslagen omdat je de woorden al kende');
                                if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
                                skipToastTimeoutRef.current = setTimeout(() => setSkipToast(null), 2500);
                              }
                            : isBallActive
                            ? () => {
                                setActiveBallModal((prev) =>
                                  prev?.level === lvl && prev?.ballIndex === ballIdx
                                    ? null
                                    : { level: lvl, ballIndex: ballIdx }
                                );
                              }
                            : undefined
                        }
                        tabIndex={isBallActive || isBallCompleted || ballStatus.isDarkGrey || isEditMode ? 0 : -1}
                        aria-disabled={!isBallActive && !isBallCompleted && !ballStatus.isDarkGrey && !isEditMode}
                        className={`relative w-24 h-24 flex items-center justify-center rounded-full transition-transform focus:outline-none opacity-100 ${
                          ballStatus.isDarkGrey
                            ? 'bg-stone-800/40 dark:bg-stone-900/80 border-2 border-stone-600/50 shadow-inner cursor-default'
                            : isBallCompleted
                            ? 'bg-transparent border-0 shadow-none cursor-pointer hover:scale-105 active:scale-95'
                            : 'bg-white dark:bg-stone-900 shadow-md border-2 border-stone-200 dark:border-stone-800'
                        } ${
                          isEditMode
                            ? draggingItem?.type === 'node' && draggingItem?.lvl === lvl && draggingItem?.idx === ballIdx
                              ? 'cursor-grabbing scale-110 ring-4 ring-amber-400 shadow-xl shadow-amber-400/30 z-30'
                              : 'cursor-grab hover:scale-105 hover:ring-2 hover:ring-amber-400/80 ring-1 ring-amber-400/40'
                            : ballStatus.isDarkGrey
                            ? 'cursor-default'
                            : isBallActive
                            ? 'cursor-pointer hover:scale-105 active:scale-95'
                            : isBallCompleted
                            ? 'cursor-pointer hover:scale-105 active:scale-95'
                            : 'cursor-default select-none'
                        }`}
                        title={
                          isEditMode
                            ? `Sleep ${btnDef.title} met je muis`
                            : ballStatus.isDarkGrey
                            ? 'Deze knop wordt overgeslagen omdat je de woorden al kende'
                            : isBallCompleted
                            ? `${btnDef.title} (Voltooid)`
                            : btnDef.title
                        }
                      >
                        {/* SVG Circular Border with exact segments based on btnDef.sessions - shown unless completed without any black dashes */}
                        {(!isBallCompleted || ballStatus.isDarkGrey || ballStatus.blackSessionsCount > 0) && (
                          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 96 96">
                            {ballStatus.sessionsDetails.map((seg, segIdx) => {
                              const segSpan = 360 / btnDef.sessions;
                              const startAngle = segIdx * segSpan + 6;
                              const endAngle = (segIdx + 1) * segSpan - 6;
                              const d = describeArc(48, 48, 41, startAngle, endAngle);

                              const strokeColor = seg.isBlack
                                ? 'stroke-stone-950 dark:stroke-black'
                                : seg.isDone
                                ? 'stroke-amber-400 dark:stroke-amber-300'
                                : 'stroke-stone-300 dark:stroke-stone-700';

                              return (
                                <path
                                  key={segIdx}
                                  d={d}
                                  fill="none"
                                  strokeWidth="5.5"
                                  strokeLinecap="round"
                                  className={`transition-all duration-300 ${strokeColor} ${seg.isBlack ? 'pointer-events-auto cursor-help' : ''}`}
                                >
                                  {seg.isBlack && (
                                    <title>deze sessie wordt overgeslagen omdat je de woorden al kende</title>
                                  )}
                                </path>
                              );
                            })}
                          </svg>
                        )}

                        {/* 3D Duolingo-style Node Button:
                            - Dark grey: skipped button with visible contours and muted symbol
                            - Completed: fully filled solid button (w-20 h-20), NO session borders, NO checkmarks, symbol clearly visible in white!
                            - Active/Locked: w-16 h-16 button nested inside the session segments ring */}
                        <div
                          className={`rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-all opacity-100 ${
                            ballStatus.isDarkGrey
                              ? 'w-16 h-16 bg-[#3f3f46] dark:bg-[#3f3f46] border-b-4 border-[#27272a] text-stone-400 shadow-stone-950/20'
                              : isBallCompleted
                              ? `w-20 h-20 ${btnDef.buttonBg}`
                              : isBallActive
                              ? `w-16 h-16 ${btnDef.buttonBg} ${btnDef.activeRing}`
                              : 'w-16 h-16 bg-stone-200 dark:bg-stone-800 border-b-4 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                          }`}
                        >
                          {ballStatus.isDarkGrey ? (
                            <BtnIcon className="w-7 h-7 stroke-[2.3] text-stone-400 dark:text-stone-400 opacity-60" />
                          ) : isBallCompleted ? (
                            isFinalBall ? (
                              <Crown className="w-10 h-10 text-yellow-100 fill-yellow-200 stroke-[2.5]" />
                            ) : (
                              <BtnIcon className="w-9 h-9 text-white stroke-[2.5]" />
                            )
                          ) : isBallActive ? (
                            isFinalBall ? (
                              <Crown className="w-8 h-8 text-yellow-200 fill-yellow-300 animate-pulse stroke-[2.5]" />
                            ) : (
                              <BtnIcon className="w-7 h-7 text-white stroke-[2.5]" />
                            )
                          ) : (
                            <BtnIcon
                              className={`w-7 h-7 stroke-[2.3] transition-colors ${
                                btnDef.colorTheme === 'emerald'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : btnDef.colorTheme === 'purple'
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-indigo-600 dark:text-indigo-400'
                              }`}
                            />
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}

                {/* Level Exam Node (At the end of the level) */}
                {(() => {
                  const isExamPassed = Boolean(profile.passedExams?.[lvl]);
                  const allButtonsCompleted = levelButtons.every((_, i) => getButtonStatus(lvl, i, levelButtons).isCompleted);
                  const isReadyForExam = allButtonsCompleted;
                  const isExamPopoverOpen = activeBallModal?.level === lvl && activeBallModal?.ballIndex === levelButtons.length;
                  const examNode = levelNodes[levelButtons.length] || levelNodes[levelNodes.length - 1] || { x: CENTER_X, y: 100, offsetX: 0 };

                  return (
                    <div
                      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isExamPopoverOpen ? 'z-30' : 'z-10'} flex flex-col items-center`}
                      style={{
                        left: `${(examNode.x / BASE_JOURNEY_WIDTH) * 100}%`,
                        top: `${examNode.y}px`,
                      }}
                    >
                      {/* Duolingo-style Pop-up Bubble for Exam */}
                      {isExamPopoverOpen && (
                        <div
                          ref={popoverRef}
                          className="absolute bottom-full mb-3 z-40 flex items-center animate-bubble-pop select-none pointer-events-auto"
                        >
                          <div className="relative w-[180px] rounded-2xl bg-[#181824] text-white shadow-2xl shadow-stone-950/60 border border-amber-500/50 border-b-3 border-b-stone-950 flex flex-col items-center gap-1.5 p-3 text-center">
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-[#181824]" />

                            <div className="flex items-center gap-1.5 justify-center">
                              <GraduationCap className="w-4 h-4 text-amber-400" />
                              <span className="font-bold text-xs text-white tracking-tight whitespace-nowrap">
                                Level {lvl} Examen
                              </span>
                            </div>

                            <span className="text-[11px] text-amber-300 font-bold">
                              25 vragen • Max. 2 fouten
                            </span>

                            <p className="text-[10px] text-stone-400 leading-tight">
                              {isExamPassed
                                ? "Je bent geslaagd! Je kunt het examen zo vaak doen als je wilt."
                                : isReadyForExam
                                ? `Slaag voor het examen om Level ${lvl + 1} te ontgrendelen!`
                                : `Voltooi alle actieve knoppen om het examen te ontgrendelen.`}
                            </p>

                            {isReadyForExam || isExamPassed ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLaunchExamSession(lvl);
                                }}
                                className="w-full mt-1 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 shadow-amber-400/25"
                              >
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                                <span>{isExamPassed ? "Examen Opnieuw" : "Start Examen"}</span>
                              </button>
                            ) : (
                              <div className="w-full mt-1 px-2.5 py-1.5 rounded-xl font-semibold text-[11px] text-stone-400 bg-stone-800/80 text-center">
                                Nog niet beschikbaar
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Exam Node Button */}
                      <button
                        type="button"
                        onPointerDown={(e) => (isEditMode ? handleBallPointerDown(e, lvl, levelButtons.length) : undefined)}
                        onClick={
                          isEditMode
                            ? undefined
                            : () => {
                                setActiveBallModal((prev) =>
                                  prev?.level === lvl && prev?.ballIndex === levelButtons.length
                                    ? null
                                    : { level: lvl, ballIndex: levelButtons.length }
                                );
                              }
                        }
                        className={`relative w-24 h-24 flex items-center justify-center rounded-full transition-transform focus:outline-none group bg-white dark:bg-stone-900 shadow-md border-2 border-stone-200 dark:border-stone-800 opacity-100 ${
                          isEditMode
                            ? draggingItem?.type === 'node' && draggingItem?.lvl === lvl && draggingItem?.idx === levelButtons.length
                              ? 'cursor-grabbing scale-110 ring-4 ring-amber-400 shadow-xl shadow-amber-400/30 z-30'
                              : 'cursor-grab hover:scale-105 hover:ring-2 hover:ring-amber-400/80 ring-1 ring-amber-400/40'
                            : 'cursor-pointer hover:scale-105 active:scale-95'
                        }`}
                        title={isEditMode ? `Sleep Examen knop met je muis` : `Level ${lvl} Examen (25 vragen, max. 2 fouten)`}
                      >
                        <div
                          className={`w-18 h-18 rounded-full flex flex-col items-center justify-center font-bold shadow-lg transition-all opacity-100 ${
                            isExamPassed
                              ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-b-4 border-amber-800 text-stone-950 shadow-amber-500/30'
                              : isReadyForExam
                              ? 'bg-gradient-to-b from-amber-500 to-amber-600 border-b-4 border-amber-800 text-stone-950 shadow-amber-500/40 ring-4 ring-amber-400/35'
                              : 'bg-stone-200 dark:bg-stone-800 border-b-4 border-stone-300 dark:border-stone-700 shadow-md text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isExamPassed ? (
                            <>
                              <Award className="w-8 h-8 text-stone-950 stroke-[2.3]" />
                              <span className="text-[9px] font-black uppercase tracking-wider text-stone-950">
                                Geslaagd
                              </span>
                            </>
                          ) : isReadyForExam ? (
                            <>
                              <GraduationCap className="w-8 h-8 text-stone-950 animate-bounce stroke-[2.3]" />
                              <span className="text-[9px] font-black uppercase tracking-wider text-stone-950">
                                Examen
                              </span>
                            </>
                          ) : (
                            <>
                              <GraduationCap className="w-8 h-8 stroke-[2.2]" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">
                                Examen
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      );
        })}
      </div>

      {/* Transparent backdrop for dismissing popover on click outside */}
      {activeBallModal && (
        <div
          className="fixed inset-0 z-20 bg-transparent"
          onClick={() => setActiveBallModal(null)}
        />
      )}

      {/* Custom Rusty Review Configuration Dialog */}
      {isCustomRustyOpen && onStartRustyReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Review Rusty Words
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomRustyOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Word count slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-400">
                <span>Aantal woorden:</span>
                <span className="font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  {customWordCount} woorden
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={customWordCount}
                onChange={(e) => setCustomWordCount(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Direction */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400 block">
                Antwoorden in:
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => {
                    if (customDirection === 'both') setCustomDirection('known');
                    else if (customDirection === 'known') setCustomDirection('both');
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                    customDirection === 'both' || customDirection === 'target'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
                  }`}
                  title={targetLang.name}
                >
                  {targetLang.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customDirection === 'both') setCustomDirection('target');
                    else if (customDirection === 'target') setCustomDirection('both');
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                    customDirection === 'both' || customDirection === 'known'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700'
                  }`}
                >
                  {profile.knownLanguage?.toUpperCase() || 'NL'}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCustomRustyOpen(false);
                  onStartRustyReview(customWordCount, customDirection);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-500/25 border-b-2 border-indigo-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Review</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCustomRustyOpen(false)}
                className="py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toast notification when tapping skipped / dark-grey buttons */}
      {skipToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 dark:bg-stone-800 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-stone-700 flex items-center gap-2 animate-in fade-in zoom-in-95 select-none pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{skipToast}</span>
        </div>
      )}
    </div>
  );
};
