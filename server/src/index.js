// index.js - Pickfords Global Mobility Chaser server.
//
// Single Node process serves:
//   - the built React app (contestant / chaser / admin views, split by route)
//   - a small REST API for admin actions + leaderboard reads
//   - Socket.io for the real-time game (server-authoritative timers & scoring)
//
// See ../README.md for environment variables and deployment notes.

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { GameEngine } = require('./gameEngine');
const db = require('./db');
const allQuestions = require('./data/questions.json');

const PORT = process.env.PORT || 4000;
const ADMIN_PIN = process.env.ADMIN_PIN || null; // set this in production!

// The frontend now deploys separately on Vercel (see ../README.md), so this
// server is a standalone API + Socket.io host on Render. FRONTEND_URL
// should be the Vercel deployment's origin, e.g.
// "https://pickfords-chaser.vercel.app". Comma-separate multiple origins
// (prod + preview URLs) if needed. Falls back to "*" so local dev / a
// same-origin fallback still works without extra config.
const allowedOrigins = (process.env.FRONTEND_URL || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// In-memory usage tracker for the question rotation algorithm. Rebuilt
// from Postgres on boot so a redeploy mid-event doesn't reset fairness.
let usageCounts = new Map();

const engine = new GameEngine({
  io,
  allQuestions,
  usageCounts,
  onGameFinished: async (summary) => {
    try {
      const game = engine.getGame(summary.gameId);
      await db.saveFinishedGame(summary);
      await db.saveQuestionResults(summary.gameId, game.results);
      const leaderboard = await db.getLeaderboard(10);
      io.emit('leaderboardUpdate', leaderboard);
    } catch (err) {
      // Never let a DB hiccup take down a live game in front of an audience -
      // log it and keep going; the in-memory result is still on-screen and
      // can be manually reconciled later from question_results if needed.
      console.error('Failed to persist finished game', summary.gameId, err);
    }
  },
});

// Short numeric join codes are far faster to key into a touchscreen than a
// UUID, and collisions are a non-issue at this event's scale (a handful of
// concurrent games at most).
function generateGameCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (engine.games.has(code));
  return code;
}

function requireAdminPin(req, res, next) {
  if (!ADMIN_PIN) return next(); // no PIN configured -> open (dev mode only!)
  if (req.headers['x-admin-pin'] === ADMIN_PIN) return next();
  return res.status(401).json({ error: 'Invalid or missing admin PIN' });
}

// ---------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await db.getLeaderboard(Number(req.query.limit) || 10);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

app.get('/api/draw-pool', requireAdminPin, async (req, res) => {
  try {
    const rows = await db.getTopFiveForDraw();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load draw pool' });
  }
});

app.post('/api/draw-selection', requireAdminPin, async (req, res) => {
  const { gameId, selectedBy, note } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId required' });
  try {
    await db.recordDrawSelection({ gameId, selectedBy, note });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record draw selection' });
  }
});

app.post('/api/games/:gameId/void', requireAdminPin, async (req, res) => {
  try {
    await db.voidGame(req.params.gameId);
    const leaderboard = await db.getLeaderboard(10);
    io.emit('leaderboardUpdate', leaderboard);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to void game' });
  }
});

// Dynamic-question QC: list every "Dynamic" question and its last-verified
// date, so whoever is reverifying tax thresholds/dates before the event has
// a single checklist instead of hunting through the spreadsheet.
app.get('/api/dynamic-questions', (req, res) => {
  const dynamic = allQuestions
    .filter((q) => q.status === 'Dynamic')
    .map(({ id, category, question, source, lastVerified }) => ({
      id,
      category,
      question,
      source,
      lastVerified,
    }));
  res.json(dynamic);
});

// ---------------------------------------------------------------------
// Socket.io - real-time game layer
// ---------------------------------------------------------------------

io.on('connection', (socket) => {
  // Lets each client estimate its clock offset from the server, so the
  // on-screen countdown (driven by the server's serverStartTs) stays
  // visually accurate even if a tablet's system clock is off. The client
  // measures round-trip time around this call and compensates - see
  // client/src/lib/socket.js `syncClock()`.
  socket.on('clock:sync', (clientSentAt, ack) => {
    ack?.(Date.now());
  });

  socket.on('admin:createGame', ({ contestantName, chaserName, adminPin }, ack) => {
    if (ADMIN_PIN && adminPin !== ADMIN_PIN) {
      return ack?.({ error: 'Invalid admin PIN' });
    }
    try {
      const gameId = generateGameCode();
      const state = engine.createGame({ gameId, contestantName, chaserName });
      ack?.({ ok: true, gameId, state });
    } catch (err) {
      console.error(err);
      ack?.({ error: err.message });
    }
  });

  socket.on('joinGame', ({ gameId, role }, ack) => {
    if (!['contestant', 'chaser', 'admin'].includes(role)) {
      return ack?.({ error: 'Invalid role' });
    }
    try {
      const game = engine.getGame(gameId);
      socket.join(`game:${gameId}`);
      socket.data.gameId = gameId;
      socket.data.role = role;
      ack?.({ ok: true, state: engine.publicState(game) });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('admin:startNextQuestion', ({ gameId, adminPin }, ack) => {
    if (ADMIN_PIN && adminPin !== ADMIN_PIN) return ack?.({ error: 'Invalid admin PIN' });
    try {
      const q = engine.startNextQuestion(gameId);
      ack?.({ ok: true, question: q });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('lockAnswer', ({ gameId, role, answer }) => {
    try {
      engine.lockAnswer(gameId, role, answer);
    } catch (err) {
      socket.emit('errorMessage', { error: err.message });
    }
  });

  socket.on('disconnect', () => {
    // Deliberately not clearing game state on disconnect - a tablet losing
    // WiFi mid-question should NOT end the game. The 10s server-side
    // timeout (see gameEngine._forceTimeouts) already covers a player who
    // never comes back for that question; reconnecting mid-game re-syncs
    // via the joinGame handler above.
  });
});

// ---------------------------------------------------------------------
// Static frontend (optional) - only relevant if you deploy the client
// alongside this server (e.g. a single combined deployment). In the
// recommended Vercel+Render+Neon split, the client is a separate Vercel
// deployment and this block simply won't find a dist/ folder, so it's
// skipped in favour of a small JSON root response.
// ---------------------------------------------------------------------
const fs = require('fs');
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ ok: true, service: 'pickfords-chaser-server', note: 'Frontend is deployed separately (Vercel).' });
  });
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async () => {
  try {
    usageCounts = await db.loadUsageCounts();
    engine.usageCounts = usageCounts;
    console.log(`Loaded usage counts for ${usageCounts.size} questions from today's games.`);
  } catch (err) {
    console.warn('Could not load usage counts from DB (starting fresh). Is DATABASE_URL set?', err.message);
  }

  server.listen(PORT, () => {
    console.log(`Pickfords Chaser server listening on :${PORT}`);
    if (!ADMIN_PIN) {
      console.warn('WARNING: ADMIN_PIN is not set - admin endpoints are open. Set ADMIN_PIN before the event.');
    }
  });
})();
