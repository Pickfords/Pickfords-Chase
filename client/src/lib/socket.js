import { io } from 'socket.io-client';

// In the split deployment (Vercel frontend + Render backend), the client
// and server are on different origins, so the server URL must be
// explicit - set VITE_SERVER_URL in Vercel's project env vars to your
// Render service URL, e.g. https://pickfords-chaser.onrender.com
// Falls back to same-origin ('/') for local dev via the Vite proxy, or a
// combined single-server deployment.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '/';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

// --------------------------------------------------------------------
// Clock offset estimation
// --------------------------------------------------------------------
// The server stamps `serverStartTs` when a question goes live. Each
// device's countdown must be rendered against *server* time, not its own
// clock, or a tablet with a skewed system clock would show a different
// countdown to what the server is actually enforcing. This does a quick
// round-trip measurement and keeps a running offset estimate.

let clockOffsetMs = 0; // serverTime - localTime, best estimate

export function syncClock() {
  return new Promise((resolve) => {
    const t0 = Date.now();
    socket.emit('clock:sync', t0, (serverNow) => {
      const t1 = Date.now();
      const rtt = t1 - t0;
      const estimatedServerTimeAtT1 = serverNow + rtt / 2;
      clockOffsetMs = estimatedServerTimeAtT1 - t1;
      resolve(clockOffsetMs);
    });
  });
}

export function serverNow() {
  return Date.now() + clockOffsetMs;
}

socket.on('connect', () => {
  syncClock();
});
