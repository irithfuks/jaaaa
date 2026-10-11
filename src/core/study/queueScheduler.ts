import { StudyCard, SessionQueueItem, WordStage, WordStudyState, SessionType } from '../../types';
import { normalizeTranslationText } from '../../utils/translationChecker';

export interface ScheduleSpacedTasksParams {
  remainingQueue: SessionQueueItem[];
  itemToInsert: SessionQueueItem | null;
  currentWordId: string;
  sessionCards: StudyCard[];
  wordStates: Record<string, WordStudyState>;
  activeDirection: 'known' | 'target' | 'mixed' | 'both';
  isSameWord: (idA: string, idB: string) => boolean;
  desiredSpacing?: number; // 2 for first retry after mistake, 5 for second retry
}

/**
 * Pure function to check if two words refer to the same root word (by ID or normalized Hebrew text or translation)
 */
export function checkSameWordEquality(
  cardA: StudyCard | undefined,
  cardB: StudyCard | undefined
): boolean {
  if (!cardA || !cardB) return false;
  if (cardA.word.id === cardB.word.id) return true;
  const keyA = normalizeTranslationText(cardA.word.targetWord);
  const keyB = normalizeTranslationText(cardB.word.targetWord);
  if (keyA && keyB && keyA === keyB) return true;
  const transA = cardA.word.translation.trim().toLowerCase();
  const transB = cardB.word.translation.trim().toLowerCase();
  if (transA && transB && transA === transB) return true;
  return false;
}

/**
 * Helper to check if a word is being introduced for the first time
 */
export function isCardTotallyNew(card: StudyCard): boolean {
  const prog = card.progress;
  if (prog) {
    const timesReviewed = prog.timesReviewed ?? 0;
    const cleanCount = prog.cleanSessionsCount ?? 0;
    const historyLen = prog.history?.length ?? 0;
    const consecutive = prog.consecutiveCorrect ?? 0;
    const lastReviewed = prog.lastReviewedAt ?? 0;
    if (timesReviewed > 0 || cleanCount > 0 || historyLen > 0 || consecutive > 0 || lastReviewed > 0) {
      return false;
    }
  }
  if (card.category && card.category !== 'red') {
    return false;
  }
  return Boolean(card.isNew);
}

export interface BuildInitialSessionQueueParams {
  sessionCards: StudyCard[];
  activeDirection: 'both' | 'target' | 'known';
  sessionType?: SessionType;
}

/**
 * Builds the initial session queue adhering to the strict pedagogical rules:
 * 1. For each word tested in both directions:
 *    - to_target (Stage 3, target language) ALWAYS comes before from_target (Stage 2, familiar language).
 *      Never start with from_target, to prevent revealing the spelling beforehand.
 *    - to_target and from_target are spaced far apart (at least 5 words in between, and preferably more).
 *    - The order of to_target words is randomized.
 *    - The order of from_target words is independently randomized (not an identical repetition of to_target!).
 * 2. For totally new words, Stage 1 (multiple choice introduction) comes first, followed by to_target and then from_target.
 * 3. Applies across daily sessions, recent review, and rusty review.
 */
export function buildInitialSessionQueue({
  sessionCards,
  activeDirection,
  sessionType,
}: BuildInitialSessionQueueParams): SessionQueueItem[] {
  if (!sessionCards || sessionCards.length === 0) return [];

  // Exam mode: each card evaluated once in its specific direction
  if (sessionType === 'exam') {
    return sessionCards.map((card, idx) => {
      const initialStage: WordStage = card.hierarchyDirection === 'from_target' ? 2 : 3;
      return {
        id: `${card.word.id}-exam-${idx}`,
        wordId: card.word.id,
        stage: initialStage,
      };
    });
  }

  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // Single direction: Target only (Stage 3)
  if (activeDirection === 'target') {
    const shuffled = shuffle(sessionCards);
    return shuffled.map((card, idx) => ({
      id: `${card.word.id}-s3-init-${idx}`,
      wordId: card.word.id,
      stage: 3,
    }));
  }

  // Single direction: Known only (Stage 2)
  if (activeDirection === 'known') {
    const shuffled = shuffle(sessionCards);
    return shuffled.map((card, idx) => {
      const isNew = isCardTotallyNew(card);
      return {
        id: `${card.word.id}-s2-init-${idx}`,
        wordId: card.word.id,
        stage: isNew ? 1 : 2,
      };
    });
  }

  // Default 'both' direction mode (Daily sessions, Recent review, Rusty review):
  // Every word must be tested in BOTH directions: to_target (Stage 3) first, then from_target (Stage 2)
  const N = sessionCards.length;
  // Desired minimum words in between: at least 5 words (or max possible for small batches)
  const effectiveMinBetween = Math.min(5, Math.max(1, N - 2));

  let bestToCards: StudyCard[] = [];
  let bestFromCards: StudyCard[] = [];
  let foundValidSchedule = false;

  // Randomized constraint solver: find a pair of permutations such that:
  // 1. toCards is a randomized order
  // 2. fromCards is a randomized order
  // 3. fromCards is NOT identical to toCards
  // 4. For every card: (N + fromPos) - toPos >= effectiveMinBetween + 1 (at least effectiveMinBetween words in between!)
  for (let attempt = 0; attempt < 500; attempt++) {
    const toCards = shuffle(sessionCards);
    const remaining = shuffle(sessionCards);
    const fromCards: StudyCard[] = [];
    let valid = true;

    for (let j = 0; j < N; j++) {
      // Find candidate cards from remaining where distance is >= effectiveMinBetween + 1
      const validCandidates = remaining.filter((c) => {
        const toPos = toCards.findIndex((tc) => tc.word.id === c.word.id);
        const dist = N + j - toPos;
        return dist >= effectiveMinBetween + 1;
      });

      if (validCandidates.length === 0) {
        valid = false;
        break;
      }

      // Pick randomly among valid candidates to keep order unpredictable
      const chosen = validCandidates[Math.floor(Math.random() * validCandidates.length)];
      fromCards.push(chosen);
      const remIdx = remaining.findIndex((c) => c.word.id === chosen.word.id);
      remaining.splice(remIdx, 1);
    }

    if (valid) {
      // Ensure fromCards does not repeat the exact same sequence as toCards
      const isIdentical = N > 2 && toCards.every((c, idx) => c.word.id === fromCards[idx].word.id);
      if (!isIdentical) {
        bestToCards = toCards;
        bestFromCards = fromCards;
        foundValidSchedule = true;
        break;
      }
    }
  }

  // Fallback if needed
  if (!foundValidSchedule) {
    bestToCards = shuffle(sessionCards);
    const offset = Math.max(effectiveMinBetween + 1, Math.floor(N / 2));
    bestFromCards = bestToCards.map((_, i) => bestToCards[(i + offset) % N]);
  }

  const initialQueue: SessionQueueItem[] = [];

  // 1. For brand-new words (red category with isTotallyNewWord), add Stage 1 multiple choice at the very start
  const newCards = sessionCards.filter((c) => isCardTotallyNew(c));
  newCards.forEach((c, idx) => {
    initialQueue.push({
      id: `${c.word.id}-s1-intro-${idx}`,
      wordId: c.word.id,
      stage: 1,
    });
  });

  // 2. Add all to_target (Stage 3, target language) tasks in randomized order
  bestToCards.forEach((card, idx) => {
    initialQueue.push({
      id: `${card.word.id}-s3-init-${idx}`,
      wordId: card.word.id,
      stage: 3,
    });
  });

  // 3. Add all from_target (Stage 2, familiar language) tasks in independently randomized order
  bestFromCards.forEach((card, idx) => {
    initialQueue.push({
      id: `${card.word.id}-s2-init-${idx}`,
      wordId: card.word.id,
      stage: 2,
    });
  });

  return initialQueue;
}

/**
 * Spaced queue scheduler enforcing:
 * 1. Never ask the same word twice in a row (neither English->Hebrew nor Hebrew->English).
 * 2. Maintain at least 5 (or as many as available) words in between before asking the same word again.
 * 3. If there are not enough words left in the queue, fill in with buffer spacer words from the session list.
 */
export function scheduleSpacedTasks({
  remainingQueue,
  itemToInsert,
  currentWordId,
  sessionCards,
  wordStates,
  activeDirection,
  isSameWord,
  desiredSpacing,
}: ScheduleSpacedTasksParams): SessionQueueItem[] {
  // Helper to pick a spacer card from the active session cards
  const pickSpacerCard = (excludedIds: Set<string>): StudyCard | null => {
    const candidates = sessionCards.filter((c) => {
      for (const exId of excludedIds) {
        if (isSameWord(c.word.id, exId)) return false;
      }
      return true;
    });
    if (candidates.length === 0) return null;

    // 1st Preference: words that had any mistake in this session
    const mistaken = candidates.filter((c) => {
      const st = wordStates[c.word.id];
      return Boolean(st?.hadMistakeAtAnyStage || (st?.mistakesCount ?? 0) > 0);
    });
    if (mistaken.length > 0) {
      return mistaken[Math.floor(Math.random() * mistaken.length)];
    }

    // 2nd Preference: any other card from this session
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const createSpacerTask = (card: StudyCard): SessionQueueItem => {
    // Spacers should be typing in Hebrew or Dutch/English, never multiple choice
    const stage: WordStage =
      activeDirection === 'known'
        ? 2
        : activeDirection === 'target'
        ? 3
        : Math.random() < 0.5
        ? 2
        : 3;
    return {
      id: `${card.word.id}-spacer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      wordId: card.word.id,
      stage,
      isBufferReview: true,
    };
  };

  if (!itemToInsert) {
    const cleanQueue = [...remainingQueue];
    // Ensure the immediate next task in the queue is never the same word as currentWordId
    if (cleanQueue.length > 0 && isSameWord(cleanQueue[0].wordId, currentWordId)) {
      const diffIdx = cleanQueue.findIndex((item) => !isSameWord(item.wordId, currentWordId));
      if (diffIdx > 0) {
        const [diffItem] = cleanQueue.splice(diffIdx, 1);
        cleanQueue.unshift(diffItem);
      } else {
        // No other word exists in queue! Insert a spacer card in front so cleanQueue[0] is not asked immediately
        const spacer = pickSpacerCard(new Set([currentWordId]));
        if (spacer) {
          cleanQueue.unshift(createSpacerTask(spacer));
        }
      }
    }
    return cleanQueue;
  }

  // We have an item to insert for currentWordId.
  // Case 1: First retry immediately after mistake: "zet er 2 woorden tussen, en herhaal het woord dat je fout deed"
  if (desiredSpacing === 2) {
    const leadingOthers: SessionQueueItem[] = [];
    const restOfTasks: SessionQueueItem[] = [];

    for (const item of remainingQueue) {
      if (!isSameWord(item.wordId, currentWordId) && leadingOthers.length < 2) {
        leadingOthers.push(item);
      } else {
        restOfTasks.push(item);
      }
    }

    // Ensure exactly 2 spacer/other cards in front
    const excluded = new Set<string>([currentWordId, ...leadingOthers.map((t) => t.wordId)]);
    while (leadingOthers.length < 2 && sessionCards.length > 1) {
      const spacer = pickSpacerCard(excluded) || pickSpacerCard(new Set([currentWordId]));
      if (spacer) {
        excluded.add(spacer.word.id);
        leadingOthers.push(createSpacerTask(spacer));
      } else {
        break;
      }
    }

    // Ensure itemToInsert is not immediately followed by currentWordId in restOfTasks
    if (restOfTasks.length > 0 && isSameWord(restOfTasks[0].wordId, currentWordId)) {
      const diffIdx = restOfTasks.findIndex((t) => !isSameWord(t.wordId, currentWordId));
      if (diffIdx > 0) {
        const [diffItem] = restOfTasks.splice(diffIdx, 1);
        restOfTasks.unshift(diffItem);
      } else {
        const spacer = pickSpacerCard(new Set([currentWordId]));
        if (spacer) {
          restOfTasks.unshift(createSpacerTask(spacer));
        }
      }
    }

    return [...leadingOthers, itemToInsert, ...restOfTasks];
  }

  // Case 2: Subsequent retry: "vervolgens moeten er minstens 5 maar woorden tussen zitten en herhaal je het opnieuw"
  const targetSpacing = Math.max(5, desiredSpacing ?? 5);
  const leadingOthers: SessionQueueItem[] = [];
  const restOfTasks: SessionQueueItem[] = [];

  for (const item of remainingQueue) {
    if (!isSameWord(item.wordId, currentWordId) && leadingOthers.length < targetSpacing) {
      leadingOthers.push(item);
    } else {
      restOfTasks.push(item);
    }
  }

  // If remaining other items were fewer than targetSpacing (5), inject spacer cards to guarantee at least 5 words in between
  const excluded = new Set<string>([currentWordId]);
  if (leadingOthers.length > 0) {
    excluded.add(leadingOthers[leadingOthers.length - 1].wordId);
  }
  while (leadingOthers.length < targetSpacing && sessionCards.length > 1) {
    const spacer = pickSpacerCard(excluded) || pickSpacerCard(new Set([currentWordId]));
    if (spacer) {
      excluded.clear();
      excluded.add(currentWordId);
      excluded.add(spacer.word.id);
      leadingOthers.push(createSpacerTask(spacer));
    } else {
      break;
    }
  }

  // Ensure itemToInsert is not immediately followed by currentWordId in restOfTasks
  if (restOfTasks.length > 0 && isSameWord(restOfTasks[0].wordId, currentWordId)) {
    const diffIdx = restOfTasks.findIndex((t) => !isSameWord(t.wordId, currentWordId));
    if (diffIdx > 0) {
      const [diffItem] = restOfTasks.splice(diffIdx, 1);
      restOfTasks.unshift(diffItem);
    } else {
      const spacer = pickSpacerCard(new Set([currentWordId]));
      if (spacer) {
        restOfTasks.unshift(createSpacerTask(spacer));
      }
    }
  }

  return [...leadingOthers, itemToInsert, ...restOfTasks];
}

