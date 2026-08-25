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
// The brief specifies the 10-question difficulty ladder, the badge names,
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
//   - If the contestant completes all 10 questions with distance still
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
const ADD_TIME_MS = 5_000;
// Pause between the final reveal and the gameOver/badge screen, so a
// contestant caught (or escaping) on the last question actually gets to
// read the explanation instead of it being instantly replaced.
const FINISH_DELAY_MS = 4_000;

// Tiers 7-9 are PLACEHOLDER names pending real copy from the client (only
// the original 6 plus the #MobilityLegend top tier were ever confirmed) -
// swap the strings below once they send the finalized 10-tier list.
const BADGES = [
  '#MobilityMover', // survived Q1
  '#GlobalNavigator', // survived Q2
  '#MobilityPro', // survived Q3
  '#GlobalMobilityExpert', // survived Q4
  '#MobilityMastermind', // survived Q5
  '#MobilityChampion', // survived Q6 - PLACEHOLDER
  '#MobilityElite', // survived Q7 - PLACEHOLDER
  '#MobilityIcon', // survived Q8 - PLACEHOLDER
  '#MobilityVanguard', // survived Q9 - PLACEHOLDER
  '#MobilityLegend', // survived Q10 - full escape
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
    // The gameId the public/iPad display screens (role: 'display') follow
    // with no join code - always "whichever game was created most recently".
    this.activeGameId = null;
  }

  createGame({ gameId, contestantName = 'Contestant', chaserName = 'The Chaser', excludeIds }) {
    const questions = selectGameQuestions(this.allQuestions, this.usageCounts, { excludeIds });
    recordUsage(this.usageCounts, questions);

    const game = {
      id: gameId,
      contestantName,
      chaserName,
      status: 'lobby', // lobby | question_shown | question_active | revealed | caught | escaped
      questions, // full objects incl. correctAnswer - server only, never sent whole
      currentSlotIndex: -1, // 0-based, -1 = not started
      distance: HEAD_START,
      locks: { contestant: null, chaser: null }, // {answer, responseTimeMs, lockedAt}
      results: [], // per-question outcome log
      contestantScore: 0,
      questionStartTs: null,
      timeLimitMs: QUESTION_TIMEOUT_MS, // grows if the admin adds time mid-question
      timeoutHandle: null,
      // True once the admin has clicked "Reveal placement" for the current
      // question - gates both the public Chaser-screen funnel animation and
      // whether a new question can be released.
      placementRevealed: true,
      createdAt: Date.now(),
      finishedAt: null,
      finalBadge: null,
      outcome: null,
    };
    this.games.set(gameId, game);
    this.activeGameId = gameId;
    return this.publicState(game);
  }

  getGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`Unknown gameId: ${gameId}`);
    return game;
  }

  // Contestant/chaser set their own display name from their join screen -
  // the admin no longer collects names up front. Ignored if blank so a
  // reconnect without retyping a name doesn't wipe out what was already set.
  setPlayerName(gameId, role, name) {
    const game = this.getGame(gameId);
    if (!['contestant', 'chaser'].includes(role)) return;
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    if (role === 'contestant') game.contestantName = trimmed;
    else game.chaserName = trimmed;
    this.io.to(this._room(gameId)).emit('playersUpdated', {
      contestantName: game.contestantName,
      chaserName: game.chaserName,
    });
  }

  // ---- flow control -------------------------------------------------

  // Stage 1 of 3: shows the category/badge/question text only, on every
  // screen (private tablets + public displays) - no options, no timer yet.
  // Requires the previous question's placement to have been revealed first,
  // so the admin can't skip past the funnel-diagram suspense.
  releaseQuestion(gameId) {
    const game = this.getGame(gameId);
    if (game.status === 'caught' || game.status === 'escaped') {
      throw new Error('Game already finished');
    }
    if (game.status === 'question_shown' || game.status === 'question_active') {
      throw new Error('A question is already in progress');
    }
    if (!game.placementRevealed) {
      throw new Error('Reveal the previous placement before releasing the next question');
    }
    game.currentSlotIndex += 1;
    if (game.currentSlotIndex >= game.questions.length) {
      throw new Error('No more questions - game should already be finished');
    }
    game.locks = { contestant: null, chaser: null };
    game.status = 'question_shown';
    game.placementRevealed = false;
    game.questionStartTs = null;
    game.timeLimitMs = QUESTION_TIMEOUT_MS;

    const q = game.questions[game.currentSlotIndex];
    const publicQuestion = {
      slot: game.currentSlotIndex + 1,
      totalSlots: game.questions.length,
      category: q.category,
      difficulty: q.difficulty,
      question: q.question,
      badgeLabel: BADGES[game.currentSlotIndex],
    };

    this.io.to(this._room(gameId)).emit('question', publicQuestion);
    return publicQuestion;
  }

  // Stage 2 of 3: reveals the multiple-choice options and starts the 10s
  // timer. Split out from releaseQuestion so the host can read the question
  // aloud before the clock (and the pressure) starts.
  releaseAnswers(gameId) {
    const game = this.getGame(gameId);
    if (game.status !== 'question_shown') {
      throw new Error('No released question waiting for its answers');
    }
    game.status = 'question_active';
    game.questionStartTs = Date.now();

    const q = game.questions[game.currentSlotIndex];
    const publicAnswers = {
      slot: game.currentSlotIndex + 1,
      totalSlots: game.questions.length,
      options: q.options,
      timeLimitMs: game.timeLimitMs,
      serverStartTs: game.questionStartTs,
    };

    this.io.to(this._room(gameId)).emit('answersReleased', publicAnswers);

    game.timeoutHandle = setTimeout(() => {
      this._forceTimeouts(gameId);
    }, game.timeLimitMs + 250); // small grace for network jitter

    return publicAnswers;
  }

  // Admin can extend a live question by ADD_TIME_MS (e.g. for a contestant
  // who's clearly still reading). Reschedules the timeout against the same
  // questionStartTs so the countdown stays server-authoritative.
  addTime(gameId) {
    const game = this.getGame(gameId);
    if (game.status !== 'question_active') return;
    game.timeLimitMs += ADD_TIME_MS;
    clearTimeout(game.timeoutHandle);
    const remaining = Math.max(0, game.timeLimitMs - (Date.now() - game.questionStartTs)) + 250;
    game.timeoutHandle = setTimeout(() => this._forceTimeouts(gameId), remaining);
    this.io.to(this._room(gameId)).emit('timeExtended', { timeLimitMs: game.timeLimitMs });
  }

  lockAnswer(gameId, role, answer) {
    const game = this.getGame(gameId);
    if (game.status !== 'question_active') return; // ignore late/duplicate locks
    if (game.locks[role]) return; // already locked
    if (!['contestant', 'chaser'].includes(role)) throw new Error('bad role');

    const responseTimeMs = Math.min(Date.now() - game.questionStartTs, game.timeLimitMs);
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
        game.locks[role] = { answer: null, responseTimeMs: game.timeLimitMs, lockedAt: Date.now() };
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
    game.placementRevealed = false;

    // Correct/incorrect + explanation reveal privately on the Contestant and
    // Chaser tablets the instant both lock in - unchanged from before. The
    // caught/escaped determination and the public funnel-screen animation
    // are deliberately held back until the admin clicks "Reveal placement"
    // (see revealPlacement below), so the show-style suspense survives on
    // the big screen even though the players already know their own result.
    this.io.to(this._room(gameId)).emit('reveal', {
      ...resultEntry,
      contestantScoreSoFar: game.contestantScore,
    });
  }

  // Stage 3 of 3: admin-triggered. Determines caught/escaped from the
  // distance already computed in _reveal, and broadcasts the funnel
  // position update that the public Chaser display animates on.
  revealPlacement(gameId) {
    const game = this.getGame(gameId);
    if (game.status !== 'revealed') {
      throw new Error('No revealed answer waiting for a placement update');
    }
    const slotIndex = game.currentSlotIndex;
    const caught = game.distance <= 0;
    const lastQuestion = slotIndex === game.questions.length - 1;

    if (caught) {
      game.status = 'caught';
      game.finalBadge = slotIndex > 0 ? BADGES[slotIndex - 1] : null; // null = caught on Q1, no badge earned
      game.outcome = 'caught';
    } else if (lastQuestion) {
      game.status = 'escaped';
      game.finalBadge = BADGES[slotIndex]; // #MobilityLegend
      game.outcome = 'escaped';
    }
    game.placementRevealed = true;

    this.io.to(this._room(gameId)).emit('placementRevealed', {
      slot: slotIndex + 1,
      distance: game.distance,
      badgeLabel: BADGES[slotIndex],
      caught,
      escaped: !caught && lastQuestion,
    });

    if (caught || lastQuestion) {
      setTimeout(() => this._finish(gameId), FINISH_DELAY_MS);
    }
    // otherwise: wait for admin to call releaseQuestion for the next slot
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
      placementRevealed: game.placementRevealed,
      // Sourced from here (not re-hardcoded client-side) so the funnel
      // display and the private per-player ladder can never drift apart.
      badges: BADGES,
    };
  }
}

module.exports = { GameEngine, BADGES, HEAD_START, QUESTION_TIMEOUT_MS, scoreForAnswer };
