// Simple assertion-based test, no test framework dependency (run with plain node).
const assert = require('assert');
const { selectGameQuestions, recordUsage } = require('../src/questionEngine.js');
const questions = require('../src/data/questions.json');

const usage = new Map();
const N = 2000;

for (let i = 0; i < N; i++) {
  const game = selectGameQuestions(questions, usage);

  const diffs = game.map((q) => q.difficulty);
  assert.strictEqual(diffs[0], 1, 'slot 1 must be difficulty 1');
  assert.strictEqual(diffs[1], 2, 'slot 2 must be difficulty 2');
  assert.ok([2, 3].includes(diffs[2]), 'slot 3 must be difficulty 2 or 3');
  assert.strictEqual(diffs[3], 3, 'slot 4 must be difficulty 3');
  assert.strictEqual(diffs[4], 4, 'slot 5 must be difficulty 4');
  assert.strictEqual(diffs[5], 5, 'slot 6 must be difficulty 5');

  const catCount = {};
  for (const q of game) catCount[q.category] = (catCount[q.category] || 0) + 1;
  assert.ok(Object.values(catCount).every((c) => c <= 2), 'no category should appear more than twice: ' + JSON.stringify(catCount));

  const ids = new Set(game.map((q) => q.id));
  assert.strictEqual(ids.size, 6, 'no duplicate question within a single game');

  recordUsage(usage, game);
}

assert.strictEqual(usage.size, 60, 'every question should get used at least once over ' + N + ' games');

console.log(`questionEngine.test.js: PASS (${N} simulated games, 0 failures)`);
