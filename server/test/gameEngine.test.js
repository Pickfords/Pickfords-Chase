const assert = require('assert');
const { GameEngine, scoreForAnswer } = require('../src/gameEngine.js');
const questions = require('../src/data/questions.json');

// --- scoring ---
assert.strictEqual(scoreForAnswer(true, 2000), 58);
assert.strictEqual(scoreForAnswer(true, 10000), 50);
assert.strictEqual(scoreForAnswer(true, 0), 60);
assert.strictEqual(scoreForAnswer(false, 1000), 0);
assert.strictEqual(scoreForAnswer(false, 0), 0);
console.log('scoring: PASS');

function makeEngine() {
  const usage = new Map();
  return new GameEngine({
    io: { to: () => ({ emit: () => {} }) },
    allQuestions: questions,
    usageCounts: usage,
    onGameFinished: () => {},
  });
}

// --- contestant aces every question, chaser wrong every time -> escapes after
// clearing all 6 badge tiers (6 correct answers), NOT after any fixed
// question count. The 10-question bank is just a reserve. ---
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g1', contestantName: 'Jane Doe' });
  for (let i = 0; i < 6; i++) {
    engine.releaseQuestion('g1');
    engine.releaseAnswers('g1');
    const game = engine.getGame('g1');
    const q = game.questions[game.currentSlotIndex];
    engine.lockAnswer('g1', 'contestant', q.correctAnswer);
    engine.lockAnswer('g1', 'chaser', q.correctAnswer === 'A' ? 'B' : 'A');
    engine.revealPlacement('g1');
  }
  const g = engine.getGame('g1');
  assert.strictEqual(g.outcome, 'escaped');
  assert.strictEqual(g.finalBadge, '#MobilityLegend');
  assert.strictEqual(g.contestantCorrectCount, 6);
  assert.strictEqual(g.contestantScore, 360); // 6 x 60 (instant + correct)
  assert.throws(() => engine.releaseQuestion('g1'), /already finished/, 'no further questions once escaped');
  console.log('scenario A (full escape at 6 correct, question bank untouched beyond that): PASS');
}

// --- contestant always wrong, chaser always right -> caught after 2 questions (head start = 2) ---
// Also verifies caught/escaped is NOT determined until revealPlacement is called, even though
// both players already know their own correct/incorrect result via 'reveal'.
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g2', contestantName: 'John Smith' });
  let rounds = 0;
  while (true) {
    const game = engine.getGame('g2');
    if (game.status === 'caught' || game.status === 'escaped') break;
    engine.releaseQuestion('g2');
    engine.releaseAnswers('g2');
    rounds++;
    const g = engine.getGame('g2');
    const q = g.questions[g.currentSlotIndex];
    engine.lockAnswer('g2', 'contestant', q.correctAnswer === 'A' ? 'B' : 'A');
    engine.lockAnswer('g2', 'chaser', q.correctAnswer);

    const afterReveal = engine.getGame('g2');
    assert.strictEqual(afterReveal.status, 'revealed', 'placement must stay pending until revealPlacement is called');
    assert.strictEqual(afterReveal.outcome, null, 'outcome must not be set before revealPlacement');

    engine.revealPlacement('g2');
  }
  const g = engine.getGame('g2');
  assert.strictEqual(g.outcome, 'caught');
  assert.strictEqual(rounds, 2, 'should be caught exactly on the 2nd question given HEAD_START=2');
  // Badges now track correct answers, not survived rounds - this contestant
  // never got one right, so no tier was actually cleared.
  assert.strictEqual(g.finalBadge, null, 'no badge cleared - contestant was wrong on both questions before being caught');
  console.log('scenario B (caught): PASS');
}

// --- contestant gets Q1 right (clears #MobilityMover) then wrong twice while
// chaser aces everything -> caught on Q3, but keeps the one tier actually
// cleared. Verifies the BADGES[contestantCorrectCount - 1] indexing. ---
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g5', contestantName: 'Almost Amy' });

  function playRound(contestantRight) {
    engine.releaseQuestion('g5');
    engine.releaseAnswers('g5');
    const game = engine.getGame('g5');
    const q = game.questions[game.currentSlotIndex];
    engine.lockAnswer('g5', 'contestant', contestantRight ? q.correctAnswer : q.correctAnswer === 'A' ? 'B' : 'A');
    engine.lockAnswer('g5', 'chaser', q.correctAnswer);
    engine.revealPlacement('g5');
  }

  playRound(true); // distance stays 2 (both +1), contestantCorrectCount = 1
  playRound(false); // distance -> 1
  playRound(false); // distance -> 0, caught

  const g = engine.getGame('g5');
  assert.strictEqual(g.outcome, 'caught');
  assert.strictEqual(g.contestantCorrectCount, 1);
  assert.strictEqual(g.finalBadge, '#MobilityMover', 'keeps the one tier actually cleared before being caught');
  console.log('scenario E (caught after clearing one tier): PASS');
}

// --- nobody answers -> forced no-answer/incorrect for both roles ---
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g3', contestantName: 'Timeout Tim' });
  engine.releaseQuestion('g3');
  engine.releaseAnswers('g3');
  engine._forceTimeouts('g3');
  const g = engine.getGame('g3');
  const r = g.results[0];
  assert.strictEqual(r.contestantAnswer, null);
  assert.strictEqual(r.contestantCorrect, false);
  assert.strictEqual(r.contestantResponseMs, 10000);
  assert.strictEqual(r.contestantPoints, 0);
  console.log('scenario C (double timeout): PASS');
}

// --- both sides wrong every question -> distance never moves, contestant
// never clears a tier, all 10 reserve questions get used -> 'incomplete',
// not 'caught' and not 'escaped'. Points (here, zero) still recorded. ---
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g4', contestantName: 'Stalemate Sam' });
  for (let i = 0; i < 10; i++) {
    engine.releaseQuestion('g4');
    engine.releaseAnswers('g4');
    const game = engine.getGame('g4');
    const q = game.questions[game.currentSlotIndex];
    const wrong = q.correctAnswer === 'A' ? 'B' : 'A';
    engine.lockAnswer('g4', 'contestant', wrong);
    engine.lockAnswer('g4', 'chaser', wrong);
    engine.revealPlacement('g4');
  }
  const g = engine.getGame('g4');
  assert.strictEqual(g.status, 'incomplete');
  assert.strictEqual(g.outcome, 'incomplete');
  assert.strictEqual(g.finalBadge, null);
  assert.strictEqual(g.contestantCorrectCount, 0);
  assert.strictEqual(g.contestantScore, 0);
  assert.throws(() => engine.releaseQuestion('g4'), /already finished/, 'no further questions once the reserve is exhausted');
  console.log('scenario D (10-question reserve exhausted -> incomplete): PASS');
}

console.log('gameEngine.test.js: ALL PASS');
