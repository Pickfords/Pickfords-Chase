// gameEngine.js
//
// Server-authoritative state machine for one "chase". One instance of
// GameEngine holds ALL live games in memory (Map keyed by gameId) - fine
// for a single-event, single-server deployment. Finished games are
// persisted to Postgres by the caller (see index.js) once GAME_OVER fires.
//
// ============================================================================
// DESIGN ASSUMPTION - the "catch" mechanic
// ============================================================================
// The brief specifies the 6-question difficulty ladder, the badge names,
// and "if the Chaser catches you, you're out" - but not the exact
// distance/catch-up rule used in the real show. We use a simple, documented
// rule so it's easy to tune in one place (HEAD_START below) without asking Phil
// to re-explain the whole show mechanic:
//
//   distance = HEAD_START + (contestant correct answers so far)
//                          - (chaser correct answers so far)
//
//   - Distance is recalculated after every question is revealed.
//   - If distance drops to 0 or below, the Chaser has caught the
//     contestant: game ends immediately (status = 'caught'). The
//     contestant keeps the badge for the last question they survived.
//   - If the contestant completes all 6 questions with distance still
//     positive, they "escape" and win the top badge (#MobilityLegend),
//     regardless of their raw score (score decides leaderboard rank, not
//     survival).
//
// HEAD_START=2 means the Chaser must out-answer the contestant by 2 net
// correct answers to catch them - gives contestants a fighting chance
// while keeping the Chaser a real threat. Change the constant to retune.
// ============================================================================

const { selectGameQuestions, recordUsage } = require('./questionEngine');

const HEAD_START = 2;
const QUESTION_TIMEOUT_MS = 10_000;
// Pause between the final reveal and the gameOver/badge screen, so a
// contestant caught (or escaping) on the last question actually gets to
// read the explanation instead of it being instantly replaced.
const FINISH_DELAY_MS = 4_000;

const BADGES = [
  '#MobilityMover', // survived Q1
  '#GlobalNavigator', // survived Q2
  '#MobilityPro', // survived Q3
  '#GlobalMobilityExpert', // survived Q4
  '#MobilityMastermind', // survived Q5
  '#MobilityLegend', // survived Q6 - full escape
];

function scoreForAnswer(isCorrect, responseTimeMs) {
  if (!isCorrect) return 0;
  const seconds = responseTimeMs / 1000;
  const bonus = Math.max(0, 10 - seconds);
  return Math.round((50 + bonus) * 100) / 100; // 2dp
}

class GameEngine {
  constructor({ io, allQuestions, usageCounts, onGameFinished }) {
    this.io = io;
    this.allQuestions = allQuestions;
    this.usageCounts = usageCounts;
    this.onGameFinished = onGameFinished; // callback(gameSummary) for DB persistence
    this.games = new Map();
  }

  createGame({ gameId, contestantName, chaserName = 'The Chaser', excludeIds }) {
    const questions = selectGameQuestions(this.allQuestions, this.usageCounts, { excludeIds });
    recordUsage(this.usageCounts, questions);

    const game = {
      id: gameId,
      contestantName,
      chaserName,
      status: 'lobby', // lobby | question_active | revealed | caught | escaped
      questions, // full objects incl. correctAnswer - server only, never sent whole
      currentSlotIndex: -1, // 0-based, -1 = not started
      distance: HEAD_START,
      locks: { contestant: null, chaser: null }, // {answer, responseTimeMs, lockedAt}
      results: [], // per-question outcome log
      contestantScore: 0,
      questionStartTs: null,
      timeoutHandle: null,
      createdAt: Date.now(),
      finishedAt: null,
      finalBadge: null,
      outcome: null,
    };
    this.games.set(gameId, game);
    return this.publicState(game);
  }

  getGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`Unknown gameId: ${gameId}`);
    return game;
  }

  // ---- flow control -------------------------------------------------

  startNextQuestion(gameId) {
    const game = this.getGame(gameId);
    if (game.status === 'caught' || game.status === 'escaped') {
      throw new Error('Game already finished');
    }
    game.currentSlotIndex += 1;
    if (game.currentSlotIndex >= game.questions.length) {
      throw new Error('No more questions - game should already be finished');
    }
    game.locks = { contestant: null, chaser: null };
    game.status = 'question_active';
    game.questionStartTs = Date.now();

    const q = game.questions[game.currentSlotIndex];
    const publicQuestion = {
      slot: game.currentSlotIndex + 1,
      totalSlots: game.questions.length,
      category: q.category,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      badgeLabel: BADGES[game.currentSlotIndex],
      timeLimitMs: QUESTION_TIMEOUT_MS,
      serverStartTs: game.questionStartTs,
    };

    this.io.to(this._room(gameId)).emit('question', publicQuestion);

    game.timeoutHandle = setTimeout(() => {
      this._forceTimeouts(gameId);
    }, QUESTION_TIMEOUT_MS + 250); // small grace for network jitter

    return publicQuestion;
  }

  lockAnswer(gameId, role, answer) {
    const game = this.getGame(gameId);
    if (game.status !== 'question_active') return; // ignore late/duplicate locks
    if (game.locks[role]) return; // already locked
    if (!['contestant', 'chaser'].includes(role)) throw new Error('bad role');

    const responseTimeMs = Math.min(Date.now() - game.questionStartTs, QUESTION_TIMEOUT_MS);
    game.locks[role] = { answer, responseTimeMs, lockedAt: Date.now() };

    // Tell the room this role locked in, WITHOUT revealing their answer yet.
    this.io.to(this._room(gameId)).emit('lockedIn', { role });

    if (game.locks.contestant && game.locks.chaser) {
      clearTimeout(game.timeoutHandle);
      this._reveal(gameId);
    }
  }

  _forceTimeouts(gameId) {
    const game = this.getGame(gameId);
    if (game.status !== 'question_active') return;
    for (const role of ['contestant', 'chaser']) {
      if (!game.locks[role]) {
        game.locks[role] = { answer: null, responseTimeMs: QUESTION_TIMEOUT_MS, lockedAt: Date.now() };
        this.io.to(this._room(gameId)).emit('lockedIn', { role, timedOut: true });
      }
    }
    this._reveal(gameId);
  }

  _reveal(gameId) {
    const game = this.getGame(gameId);
    const slotIndex = game.currentSlotIndex;
    const q = game.questions[slotIndex];

    const contestantCorrect = game.locks.contestant.answer === q.correctAnswer;
    const chaserCorrect = game.locks.chaser.answer === q.correctAnswer;

    const contestantPoints = scoreForAnswer(contestantCorrect, game.locks.contestant.responseTimeMs);
    game.contestantScore += contestantPoints;

    game.distance += (contestantCorrect ? 1 : 0) - (chaserCorrect ? 1 : 0);

    const resultEntry = {
      slot: slotIndex + 1,
      questionId: q.id,
      category: q.category,
      difficulty: q.difficulty,
      correctAnswer: q.correctAnswer,
      contestantAnswer: game.locks.contestant.answer,
      contestantCorrect,
      contestantResponseMs: game.locks.contestant.responseTimeMs,
      contestantPoints,
      chaserAnswer: game.locks.chaser.answer,
      chaserCorrect,
      chaserResponseMs: game.locks.chaser.responseTimeMs,
      distanceAfter: game.distance,
      explanation: q.explanation,
      source: q.source,
    };
    game.results.push(resultEntry);
    game.status = 'revealed';

    this.io.to(this._room(gameId)).emit('reveal', {
      ...resultEntry,
      contestantScoreSoFar: game.contestantScore,
    });

    const caught = game.distance <= 0;
    const lastQuestion = slotIndex === game.questions.length - 1;

    if (caught) {
      game.status = 'caught';
      game.finalBadge = slotIndex > 0 ? BADGES[slotIndex - 1] : null; // null = caught on Q1, no badge earned
      game.outcome = 'caught';
      setTimeout(() => this._finish(gameId), FINISH_DELAY_MS);
    } else if (lastQuestion) {
      game.status = 'escaped';
      game.finalBadge = BADGES[slotIndex]; // #MobilityLegend
      game.outcome = 'escaped';
      setTimeout(() => this._finish(gameId), FINISH_DELAY_MS);
    }
    // otherwise: wait for admin (or auto-advance) to call startNextQuestion
  }

  _finish(gameId) {
    const game = this.getGame(gameId);
    game.finishedAt = Date.now();
    const cumulativeResponseMs = game.results.reduce((sum, r) => sum + r.contestantResponseMs, 0);

    const summary = {
      gameId,
      contestantName: game.contestantName,
      chaserName: game.chaserName,
      outcome: game.outcome, // 'caught' | 'escaped'
      finalBadge: game.finalBadge,
      score: game.contestantScore,
      cumulativeResponseMs,
      questionsAnswered: game.results.length,
      correctCount: game.results.filter((r) => r.contestantCorrect).length,
      createdAt: game.createdAt,
      finishedAt: game.finishedAt,
    };

    this.io.to(this._room(gameId)).emit('gameOver', summary);
    if (this.onGameFinished) this.onGameFinished(summary);
  }

  // ---- helpers --------------------------------------------------------

  _room(gameId) {
    return `game:${gameId}`;
  }

  publicState(game) {
    // Safe-to-send snapshot (no correct answers / unrevealed data) - used on
    // (re)join so a refreshed tablet can resync mid-game.
    return {
      id: game.id,
      contestantName: game.contestantName,
      chaserName: game.chaserName,
      status: game.status,
      currentSlotIndex: game.currentSlotIndex,
      totalSlots: game.questions.length,
      distance: game.distance,
      contestantScore: game.contestantScore,
      results: game.results, // already-revealed rounds only, safe
      finalBadge: game.finalBadge,
      outcome: game.outcome,
    };
  }
}

module.exports = { GameEngine, BADGES, HEAD_START, QUESTION_TIMEOUT_MS, scoreForAnswer };
