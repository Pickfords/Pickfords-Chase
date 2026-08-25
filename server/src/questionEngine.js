// questionEngine.js
//
// Selects 10 questions for one "chase" from the 60-question bank, honouring:
//   1. The difficulty ladder: two questions per difficulty tier, 1 through 5
//   2. No more than 2 questions from the same category in one chase
//   3. Fair rotation across the event day - questions used less often today
//      are preferred, so no contestant gets an easy repeat of what the
//      previous contestant just saw.
//
// The pool is small (2 questions per category per difficulty), so a naive
// random pick can paint itself into a corner (e.g. picks both Tax
// questions at difficulty 1 *and* difficulty 2, then has nothing left for
// slot 3 without breaking the 2-per-category rule if Tax also owns a
// level-3 pair). We use backtracking to guarantee a valid chase always
// exists, since the maths on this question bank works out but a naive
// greedy picker can still fail on bad luck.

// 10-question ladder (client's confirmed "ultimate rule": max 10 questions,
// 100s budget at 10s/question) - two slots per difficulty tier 1-5. Verified
// feasible against the current 60-question bank (6 categories x 5
// difficulties x 2 questions each) with MAX_PER_CATEGORY=2 below.
const DIFFICULTY_LADDER = [
  { slot: 1, difficulties: [1] },
  { slot: 2, difficulties: [1] },
  { slot: 3, difficulties: [2] },
  { slot: 4, difficulties: [2] },
  { slot: 5, difficulties: [3] },
  { slot: 6, difficulties: [3] },
  { slot: 7, difficulties: [4] },
  { slot: 8, difficulties: [4] },
  { slot: 9, difficulties: [5] },
  { slot: 10, difficulties: [5] },
];

const MAX_PER_CATEGORY = 2;

/**
 * @param {Array} allQuestions - full 60-question bank
 * @param {Map<string, number>} usageCounts - questionId -> times used today
 * @param {Object} [opts]
 * @param {Set<string>} [opts.excludeIds] - never pick these (e.g. flagged dynamic questions not yet reverified)
 * @returns {Array} 10 selected question objects, in slot order
 */
function selectGameQuestions(allQuestions, usageCounts, opts = {}) {
  const excludeIds = opts.excludeIds || new Set();
  const pool = allQuestions.filter((q) => !excludeIds.has(q.id));

  // Sort candidates within a slot by "freshness": least-used-today first,
  // with a random tiebreaker so equally-fresh questions don't always come
  // back in the same order.
  const usageOf = (q) => usageCounts.get(q.id) || 0;
  const shuffledByFreshness = (candidates) =>
    [...candidates]
      .map((q) => ({ q, jitter: Math.random() }))
      .sort((a, b) => usageOf(a.q) - usageOf(b.q) || a.jitter - b.jitter)
      .map((x) => x.q);

  function candidatesForSlot(slotDifficulties, chosenSoFar) {
    const categoryCount = {};
    for (const q of chosenSoFar) {
      categoryCount[q.category] = (categoryCount[q.category] || 0) + 1;
    }
    const chosenIds = new Set(chosenSoFar.map((q) => q.id));
    const raw = pool.filter(
      (q) =>
        slotDifficulties.includes(q.difficulty) &&
        !chosenIds.has(q.id) &&
        (categoryCount[q.category] || 0) < MAX_PER_CATEGORY
    );
    return shuffledByFreshness(raw);
  }

  function backtrack(slotIndex, chosenSoFar) {
    if (slotIndex === DIFFICULTY_LADDER.length) {
      return chosenSoFar;
    }
    const { difficulties } = DIFFICULTY_LADDER[slotIndex];
    const candidates = candidatesForSlot(difficulties, chosenSoFar);

    for (const candidate of candidates) {
      const result = backtrack(slotIndex + 1, [...chosenSoFar, candidate]);
      if (result) return result;
    }
    return null; // dead end, caller backtracks
  }

  const result = backtrack(0, []);
  if (!result) {
    throw new Error(
      'Could not assemble a valid 10-question chase from the available pool ' +
        '(check excludeIds is not removing too many questions).'
    );
  }
  return result;
}

/**
 * Convenience for the game engine: bump usage counts after a game is
 * assigned, so the *next* game prefers fresher questions.
 */
function recordUsage(usageCounts, selectedQuestions) {
  for (const q of selectedQuestions) {
    usageCounts.set(q.id, (usageCounts.get(q.id) || 0) + 1);
  }
}

module.exports = { selectGameQuestions, recordUsage, DIFFICULTY_LADDER, MAX_PER_CATEGORY };
