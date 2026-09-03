// Simple assertion-based test, no test framework dependency (run with plain node).
const assert = require('assert');
const { selectGameQuestions, recordUsage } = require('../src/questionEngine.js');
const questions = require('../src/data/questions.json');

const usage = new Map();
const N = 2000;

for (let i = 0; i < N; i++) {
  const game = selectGameQuestions(questions, usage);

  const diffs = game.map((q) => q.difficulty);
  const expectedDiffs = [1, 2, 3, 3, 4, 5, 4, 4, 5, 5];
  assert.deepStrictEqual(diffs, expectedDiffs, 'difficulty ladder must match the core 1-6 progression plus 4 recovery slots');

  const catCount = {};
  for (const q of game) catCount[q.category] = (catCount[q.category] || 0) + 1;
  assert.ok(Object.values(catCount).every((c) => c <= 2), 'no category should appear more than twice: ' + JSON.stringify(catCount));

  const ids = new Set(game.map((q) => q.id));
  assert.strictEqual(ids.size, 10, 'no duplicate question within a single game');

  recordUsage(usage, game);
}

assert.strictEqual(usage.size, questions.length, 'every question should get used at least once over ' + N + ' games');

console.log(`questionEngine.test.js: PASS (${N} simulated games, 0 failures)`);
