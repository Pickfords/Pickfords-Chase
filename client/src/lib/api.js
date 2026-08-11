const BASE = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

async function request(path, { adminPin, ...opts } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (adminPin) headers['x-admin-pin'] = adminPin;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/api/health'),
  getLeaderboard: (limit = 10) => request(`/api/leaderboard?limit=${limit}`),
  getDrawPool: (adminPin) => request('/api/draw-pool', { adminPin }),
  recordDrawSelection: (adminPin, body) =>
    request('/api/draw-selection', { method: 'POST', body: JSON.stringify(body), adminPin }),
  voidGame: (adminPin, gameId) => request(`/api/games/${gameId}/void`, { method: 'POST', adminPin }),
  getDynamicQuestions: () => request('/api/dynamic-questions'),
};
