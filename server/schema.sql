-- Pickfords Global Mobility Chaser - Postgres schema
-- Run once against your target database before first launch:
--   psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS games (
  id                    TEXT PRIMARY KEY,
  contestant_name       TEXT NOT NULL,
  chaser_name           TEXT NOT NULL DEFAULT 'Phil',
  outcome               TEXT NOT NULL CHECK (outcome IN ('caught', 'escaped')),
  final_badge           TEXT,                 -- NULL if caught before completing Q1
  score                 NUMERIC(6,2) NOT NULL DEFAULT 0,
  cumulative_response_ms INTEGER NOT NULL DEFAULT 0,
  questions_answered    INTEGER NOT NULL DEFAULT 0,
  correct_count         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL,
  finished_at           TIMESTAMPTZ NOT NULL,
  -- soft-delete flag so admin can hide a test/void run without losing the row
  is_void                BOOLEAN NOT NULL DEFAULT FALSE
);

-- Leaderboard ordering: highest score first, fastest cumulative time breaks ties.
CREATE INDEX IF NOT EXISTS idx_games_leaderboard
  ON games (is_void, score DESC, cumulative_response_ms ASC);

-- Per-question audit log - useful for a post-event QC pass ("which
-- questions played badly / were mistimed / had ambiguous options") and
-- for reconstructing today's usage counts if the server restarts mid-event.
CREATE TABLE IF NOT EXISTS question_results (
  id                    SERIAL PRIMARY KEY,
  game_id               TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot                  INTEGER NOT NULL,
  question_id           TEXT NOT NULL,
  category              TEXT NOT NULL,
  difficulty            INTEGER NOT NULL,
  contestant_answer     TEXT,
  contestant_correct    BOOLEAN NOT NULL,
  contestant_response_ms INTEGER NOT NULL,
  contestant_points     NUMERIC(5,2) NOT NULL,
  chaser_answer         TEXT,
  chaser_correct        BOOLEAN NOT NULL,
  chaser_response_ms    INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_results_question_id
  ON question_results (question_id);

-- Records the admin's manual selection from the top-5 draw pool, so
-- there's an auditable log of who was picked and when, rather than the
-- choice living only in someone's memory of the day.
CREATE TABLE IF NOT EXISTS draw_selections (
  id                    SERIAL PRIMARY KEY,
  selected_game_id      TEXT NOT NULL REFERENCES games(id),
  selected_by           TEXT,
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
