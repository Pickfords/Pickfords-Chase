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

// --- contestant aces every question, chaser wrong every time -> escapes with max score ---
{
  const engine = makeEngine();
  engine.createGame({ gameId: 'g1', contestantName: 'Jane Doe' });
  for (let i = 0; i < 10; i++) {
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
  assert.strictEqual(g.contestantScore, 600); // 10 x 60 (instant + correct)
  console.log('scenario A (full escape): PASS');
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
  assert.strictEqual(g.finalBadge, '#MobilityMover', 'should keep the Q1 badge, having survived question 1');
  console.log('scenario B (caught): PASS');
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

console.log('gameEngine.test.js: ALL PASS');
