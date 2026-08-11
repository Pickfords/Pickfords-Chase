# Handover: Pickfords Global Mobility Chaser — CORS debugging

## What this project is
A real-time Chase-style quiz game for a Pickfords event (Expat Academy), built
across 3 synced device roles (Contestant, Chaser, Admin/data-capture) over
Socket.io. Full source in `pickfords-chaser/`:

```
pickfords-chaser/
  server/   Node + Express + Socket.io   -> deployed on Render
  client/   React + Vite (3 device views) -> deployed on Vercel
  schema.sql / server/schema.sql          -> run against Neon Postgres
  README.md                               -> full architecture + deploy walkthrough
```

Architecture reasoning: Vercel's serverless functions can't hold long-lived
WebSocket connections, so the split is deliberate — Vercel serves the static
React build only, Render runs the persistent Socket.io/Express process, Neon
is Postgres. Do not suggest collapsing this back to a single Vercel deployment
without re-litigating that constraint.

## Current live URLs
- Frontend (Vercel): `https://pickfords-chase.vercel.app`
- Backend (Render): `https://pickfords-chase.onrender.com`
- Postgres: Neon (pooled connection string, schema already applied)

## Active bug: CORS blocking every request from Vercel → Render

Browser console (captured, confirmed reproducible):
```
Access to XMLHttpRequest at 'https://pickfords-chase.onrender.com/socket.io/?EIO=4&transport=polling&t=...'
from origin 'https://pickfords-chase.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

Access to fetch at 'https://pickfords-chase.onrender.com/api/health' from origin
'https://pickfords-chase.vercel.app' has been blocked by CORS policy: Response to
preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin'
header is present on the requested resource.
```

Both plain REST (`/api/health`) and the Socket.io polling transport are blocked
the same way — consistent with the server's CORS origin allowlist simply not
matching `https://pickfords-chase.vercel.app`, not a code-level CORS bug (the
`cors` npm package silently omits the header rather than erroring when the
origin doesn't match, which is exactly what "no header present" + 200 status
looks like in devtools).

### Relevant code — `server/src/index.js`
```js
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
```

Just added (not yet confirmed deployed/checked in logs) a boot-time debug line:
```js
server.listen(PORT, () => {
  console.log(`Pickfords Chaser server listening on :${PORT}`);
  console.log(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);
  ...
```

### Where we left off / next steps
1. **Confirm what Render actually has for `FRONTEND_URL`** — check the Render
   dashboard env var value character-for-character against
   `https://pickfords-chase.vercel.app` (no trailing slash, `https://` present,
   no stray whitespace/newline from copy-paste).
2. **Check the Render deploy logs** for the `CORS allowed origins: [...]` line
   above, once that change is deployed — this tells us definitively what the
   running process thinks the allowlist is, removing guesswork.
3. Likely culprits, in rough order of likelihood:
   - `FRONTEND_URL` env var set but **Render hasn't redeployed** since it was
     added/changed (env var saves don't always force an immediate restart
     depending on settings) → trigger a manual deploy.
   - `FRONTEND_URL` has a typo/mismatch (trailing slash, http vs https, wrong
     preview-vs-production Vercel URL).
   - `FRONTEND_URL` was never set at all — should default to `'*'` per the
     code above, which *should* work; if the debug log shows `["*"]` and it's
     still failing, something else is wrong (worth re-reading the `cors`
     package's handling of literal `'*'` vs an array containing `'*'` —
     current code does `allowedOrigins.includes('*') ? '*' : allowedOrigins`
     specifically to pass the literal string `'*'` rather than an array, since
     the `cors` package needs the bare string for wildcard behavior).
4. Once origins match, re-verify both `/api/health` (fetch) and the Socket.io
   connection (admin dashboard's "Backend awake/waking/unreachable" badge,
   `client/src/pages/AdminView.jsx`) go green.

## Other known context (already resolved, for background only)
- Neon schema (`server/schema.sql`) had to be run manually via Neon's SQL
  editor — was initially missing, causing `relation "question_results" does
  not exist` on boot. Confirmed fixed.
- `ADMIN_PIN` needs to be set on Render (was flagged as open/unset earlier;
  confirm it's since been set to a real value, not the placeholder).
- Watch for a stray manually-set `PORT` env var on Render overriding Render's
  auto-injected one — should not be present; Render sets `PORT` itself.
- `client/src/lib/api.js`'s `request()` helper was fixed to only attach
  `Content-Type: application/json` when there's a request body, to avoid an
  unnecessary CORS preflight on plain GETs like `/api/health`. Unrelated to
  the current bug but already applied.

## Design assumptions worth knowing (unrelated to this bug, but relevant if asked)
- Catch-up mechanic (`server/src/gameEngine.js`, top-of-file comment): not
  fully specified in the original brief, implemented as
  `distance = HEAD_START(2) + contestantCorrect - chaserCorrect`; distance
  reaching 0 = caught. Isolated to one constant if it needs tuning.
- Scoring: 50pts + up to 10 bonus (10 − seconds, floored at 0) per *correct*
  answer only (confirmed by the user). Max score 360, not the 330 in the
  original back-of-envelope brief — flagged to the user already.
- Full test suite exists at `server/test/` (`questionEngine.test.js`,
  `gameEngine.test.js`) — run with `cd server && npm test`. Both passing as
  of last check. No test coverage exists for the CORS/deployment layer since
  that can't be exercised without live network access.

## Environment variables reference
**Render (server):** `DATABASE_URL` (Neon pooled string), `PGSSL=true`,
`ADMIN_PIN`, `FRONTEND_URL` (Vercel origin, comma-separate if multiple).
**Vercel (client):** `VITE_SERVER_URL` (Render URL, baked in at build time —
changing it requires a redeploy, not just a settings save).