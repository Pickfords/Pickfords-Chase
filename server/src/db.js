// db.js - thin Postgres access layer. Uses `pg`'s Pool directly rather than
// an ORM: the query surface here is small and fixed, so an ORM would add a
// dependency without saving much code.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
});

// schema.sql is all `CREATE ... IF NOT EXISTS`, so running it on every boot
// is a safe no-op once the tables exist - this is what previously required
// a manual psql/Neon-console run after every fresh DB (see Handover.md).
async function runMigrations() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

async function saveFinishedGame(summary) {
  const {
    gameId,
    contestantName,
    chaserName,
    outcome,
    finalBadge,
    score,
    cumulativeResponseMs,
    questionsAnswered,
    correctCount,
    createdAt,
    finishedAt,
  } = summary;

  await pool.query(
    `INSERT INTO games
      (id, contestant_name, chaser_name, outcome, final_badge, score,
       cumulative_response_ms, questions_answered, correct_count, created_at, finished_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      gameId,
      contestantName,
      chaserName,
      outcome,
      finalBadge,
      score,
      cumulativeResponseMs,
      questionsAnswered,
      correctCount,
      new Date(createdAt),
      new Date(finishedAt),
    ]
  );
}

async function saveQuestionResults(gameId, results) {
  if (!results.length) return;
  const values = [];
  const rows = results.map((r, i) => {
    const base = i * 12;
    values.push(
      gameId,
      r.slot,
      r.questionId,
      r.category,
      r.difficulty,
      r.contestantAnswer,
      r.contestantCorrect,
      r.contestantResponseMs,
      r.contestantPoints,
      r.chaserAnswer,
      r.chaserCorrect,
      r.chaserResponseMs
    );
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12})`;
  });
  // NOTE: 12 columns per row (gameId..chaserResponseMs) - base step must match
  // the placeholder count per row, or rows silently share placeholders.
  await pool.query(
    `INSERT INTO question_results
      (game_id, slot, question_id, category, difficulty, contestant_answer,
       contestant_correct, contestant_response_ms, contestant_points,
       chaser_answer, chaser_correct, chaser_response_ms)
     VALUES ${rows.join(',')}`,
    values
  );
}

async function getLeaderboard(limit = 10) {
  const { rows } = await pool.query(
    `SELECT id, contestant_name, outcome, final_badge, score, cumulative_response_ms, finished_at
     FROM games
     WHERE is_void = FALSE
     ORDER BY score DESC, cumulative_response_ms ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getTopFiveForDraw() {
  const { rows } = await pool.query(
    `SELECT id, contestant_name, outcome, final_badge, score, cumulative_response_ms
     FROM games
     WHERE is_void = FALSE AND outcome = 'escaped'
     ORDER BY score DESC, cumulative_response_ms ASC
     LIMIT 5`
  );
  return rows;
}

async function recordDrawSelection({ gameId, selectedBy, note }) {
  await pool.query(
    `INSERT INTO draw_selections (selected_game_id, selected_by, note) VALUES ($1,$2,$3)`,
    [gameId, selectedBy || null, note || null]
  );
}

async function voidGame(gameId) {
  await pool.query(`UPDATE games SET is_void = TRUE WHERE id = $1`, [gameId]);
}

// Rebuilds today's usage-count map from the DB - used on server restart so
// question rotation stays fair even if the process gets redeployed mid-event.
async function loadUsageCounts() {
  const { rows } = await pool.query(
    `SELECT question_id, COUNT(*)::int AS uses
     FROM question_results
     JOIN games ON games.id = question_results.game_id
     WHERE games.created_at > now() - interval '18 hours'
     GROUP BY question_id`
  );
  const map = new Map();
  for (const r of rows) map.set(r.question_id, r.uses);
  return map;
}

module.exports = {
  pool,
  runMigrations,
  saveFinishedGame,
  saveQuestionResults,
  getLeaderboard,
  getTopFiveForDraw,
  recordDrawSelection,
  voidGame,
  loadUsageCounts,
};
