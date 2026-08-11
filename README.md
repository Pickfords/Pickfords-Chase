# Pickfords Global Mobility Chaser

A real-time, three-device implementation of a Chase-style game for the Expat
Academy event, built from the 60-question bank Shivay put together.

```
pickfords-chaser/
  server/     Node + Express + Socket.io - the game engine, deploys to Render
  client/     React + Vite - the 3 device views, deploys to Vercel
  schema.sql  Postgres schema - run once against Neon
```

---

## 1. Why three platforms, not just Vercel

Vercel's free (and even paid) serverless functions are built to run for a
few seconds and then exit - they don't hold open the kind of long-lived
WebSocket connection Socket.io needs for a live, multi-minute game session
across three simultaneous devices. Vercel is genuinely excellent at what
this app *does* need on the frontend side (static React hosting, instant
global CDN, free SSL, preview deployments), so:

| Piece | Platform | Why |
|---|---|---|
| React frontend (3 views) | **Vercel** (free) | Static build, perfect fit |
| Node/Express/Socket.io server | **Render** (free) | Persistent process, supports WebSockets |
| Postgres (leaderboard, audit log) | **Neon** (free) | Serverless Postgres, generous free tier |

This is the standard pattern for "real-time app on free tiers" - Vercel
themselves point WebSocket-heavy apps elsewhere for exactly this reason.

**The one thing to budget for:** Render's free tier sleeps a service after
15 minutes with no traffic, and takes 20-50 seconds to wake back up on the
next request. For a quiet expo stand between chases, that's a real risk of
a contestant standing at a dead screen while Render wakes up. Two ways to
handle it, cheapest first:

1. **Free, manual:** ping `https://your-service.onrender.com/api/health`
   every 10 minutes throughout the event using a free uptime pinger (e.g.
   UptimeRobot, cron-job.org) pointed at that URL. Keeps it permanently
   warm at no cost. Set this up the morning of the event and cancel it
   after.
2. **~$1-2, safest:** upgrade the Render service to the Starter plan for
   just the day of the event (prorated hourly), then downgrade back to
   free afterwards. No sleep, no cold start, no risk in front of an
   audience.

The Admin dashboard has a live "Backend awake / waking up / unreachable"
indicator in the top bar precisely so Chris can see this at a glance
before contestants start queuing.

---

## 2. Deploy Postgres (Neon) — do this first

1. Create a free project at [neon.tech](https://neon.tech).
2. Open the SQL editor (or `psql` using the connection string Neon gives
   you) and run the contents of `schema.sql`.
3. In your Neon project's **Connection Details**, toggle **Pooled
   connection** and copy that connection string (it routes through
   PgBouncer, which plays nicer with a server that opens a small
   persistent connection pool). It looks like:
   ```
   postgres://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
   You'll paste this into Render as `DATABASE_URL` in the next step.

---

## 3. Deploy the server (Render)

**Option A - Blueprint (recommended):** push this repo to GitHub, then in
Render choose **New +  → Blueprint** and point it at the repo. It reads
`render.yaml` and creates the service for you; you just need to fill in
the "sync: false" env vars it prompts for (see below).

**Option B - manual:** **New + → Web Service**, connect the repo, and set:
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

Either way, set these environment variables on the service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon **pooled** connection string from step 2 |
| `PGSSL` | `true` |
| `ADMIN_PIN` | a real PIN for Chris's admin device (not the placeholder!) |
| `FRONTEND_URL` | your Vercel URL, added *after* step 4 - comes back here |

Deploy, then confirm `https://your-service.onrender.com/api/health` returns
`{"ok":true}`.

---

## 4. Deploy the frontend (Vercel)

1. **New Project**, import the same repo, set **Root Directory** to
   `client`. Vercel auto-detects Vite from `vercel.json`.
2. Add an environment variable:
   - `VITE_SERVER_URL` = your Render URL from step 3, e.g.
     `https://pickfords-chaser-server.onrender.com`
3. Deploy. Vercel gives you a URL like
   `https://pickfords-chaser.vercel.app`.
4. **Go back to Render** and set `FRONTEND_URL` to that Vercel URL, then
   redeploy the Render service so CORS allows it.

---

## 5. Local development

```bash
# terminal 1 - Postgres
docker compose -f docker-compose.dev.yml up -d
psql "postgres://postgres:postgres@localhost:5432/pickfords_chaser" -f server/schema.sql

# terminal 2 - server
cd server
cp .env.example .env   # edit DATABASE_URL to the local one, PGSSL=false
npm install
npm run dev             # http://localhost:4000

# terminal 3 - client
cd client
npm install
npm run dev              # http://localhost:5173, proxies /api and /socket.io to :4000
```

Run the test suite any time with `cd server && npm test` - it covers the
question-selection algorithm (2,000 simulated games) and the full game
state machine (scoring, catch mechanic, timeouts).

> **Note on this build:** I wrote and hand-reviewed every file, and ran the
> full backend test suite repeatedly in a sandboxed environment without
> internet access - so `questionEngine.js` and `gameEngine.js` are genuinely
> verified. I could **not** run `npm install` for the React/Vite/Socket.io
> client-side dependencies in that same sandbox (no network access), so the
> frontend build itself is unverified beyond a careful manual read-through.
> Please run `npm install && npm run build` in the `client` folder as your
> first real smoke test, ideally a few days before the event, not the
> morning of.

---

## 6. Event-day runbook

1. Warm up the Render service (see section 1) at least 10 minutes before
   contestants start.
2. Open the admin dashboard on Chris's device, enter the `ADMIN_PIN`,
   confirm the backend status badge shows **awake**.
3. Work through the **Dynamic Question Re-check** checklist before the
   event opens - 19 questions in the bank are tagged "Dynamic" (tax
   thresholds, immigration figures, dates) and should be reconfirmed
   against their source link.
4. For each contestant: enter their name (and Phil's, if it ever isn't
   "Phil") → **Create game** → read the 4-digit join code out loud →
   contestant and chaser each open the site on their own device, tap
   their role, enter the code.
5. Once both are joined, tap **Start question 1**. The server handles
   everything else automatically (timers, lock-in, reveal, scoring,
   catch/escape, leaderboard update) until the chase ends.
6. **Void** button on the leaderboard removes a bad run (test games,
   technical restarts) without deleting the audit trail.
7. At prize-draw time: **Load top 5 escaped contestants**, pick the winner,
   optionally leave a note - it's logged with a timestamp for reference.

---

## 7. Design decisions worth knowing about

- **Catch-up mechanic** (`server/src/gameEngine.js`, top comment): the
  brief specified the badges and "if the Chaser catches you, you're out"
  but not the exact distance rule. I implemented: contestant starts 2
  questions "ahead"; the gap changes by +1/-1 each round based on who
  answers correctly; gap reaching 0 = caught. It's isolated to one
  constant (`HEAD_START`) if you want it easier or harder.
- **Scoring:** 50 pts + up to 10 bonus pts (10 − seconds, floored at 0) per
  *correct* answer only, per your confirmation. Max possible score is 360
  (6 × 60), not 330 - flagging since that's different from the original
  back-of-envelope number in your email.
- **Ladder visual:** the Chaser's marker position on the ladder is a visual
  approximation derived from the numeric gap, not an independently tracked
  value - the gap number next to it is the source of truth contestants
  should trust.
- **Question rotation:** usage counts are rebuilt from Postgres on every
  server restart (`loadUsageCounts` in `db.js`), so a Render redeploy
  mid-event doesn't reset fairness back to zero.
#   P i c k f o r d s - C h a s e  
 # Pickfords-Chase
