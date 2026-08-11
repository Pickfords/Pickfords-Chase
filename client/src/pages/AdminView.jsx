import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';

export default function AdminView() {
  const [pin, setPin] = useState(localStorage.getItem('pf_admin_pin') || '');
  const [pinLocked, setPinLocked] = useState(!!localStorage.getItem('pf_admin_pin'));
  const [backendStatus, setBackendStatus] = useState('checking'); // checking | awake | waking | unreachable

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      const start = Date.now();
      try {
        await api.health();
        if (cancelled) return;
        // Render free tier takes 20-50s to wake from sleep - a health
        // check that takes noticeably longer than a normal round trip
        // almost always means it was asleep and just woke up.
        setBackendStatus(Date.now() - start > 4000 ? 'waking' : 'awake');
      } catch {
        if (!cancelled) setBackendStatus('unreachable');
      }
    }
    ping();
    const interval = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const [contestantName, setContestantName] = useState('');
  const [chaserName, setChaserName] = useState('Phil');
  const [activeGame, setActiveGame] = useState(null); // { gameId, state }
  const [createError, setCreateError] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [liveDistance, setLiveDistance] = useState(2);
  const [liveOutcome, setLiveOutcome] = useState(null);

  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    refreshLeaderboard();
    function onReveal(r) {
      setLiveResults((prev) => [...prev, r]);
      setLiveDistance(r.distanceAfter);
    }
    function onGameOver(summary) {
      setLiveOutcome(summary);
    }
    socket.on('leaderboardUpdate', setLeaderboard);
    socket.on('reveal', onReveal);
    socket.on('gameOver', onGameOver);
    return () => {
      socket.off('leaderboardUpdate', setLeaderboard);
      socket.off('reveal', onReveal);
      socket.off('gameOver', onGameOver);
    };
  }, []);

  function refreshLeaderboard() {
    api.getLeaderboard(10).then(setLeaderboard).catch(() => {});
  }

  function savePin(e) {
    e.preventDefault();
    localStorage.setItem('pf_admin_pin', pin);
    setPinLocked(true);
  }

  function createGame(e) {
    e.preventDefault();
    setCreateError('');
    socket.emit('admin:createGame', { contestantName, chaserName, adminPin: pin }, (res) => {
      if (res?.error) return setCreateError(res.error);
      setActiveGame({ gameId: res.gameId, state: res.state });
      setLiveResults([]);
      setLiveDistance(2);
      setLiveOutcome(null);
      socket.emit('joinGame', { gameId: res.gameId, role: 'admin' }, () => {});
    });
  }

  function startNext() {
    if (!activeGame) return;
    socket.emit('admin:startNextQuestion', { gameId: activeGame.gameId, adminPin: pin }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  return (
    <div className="pf-shell">
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span>CHASER</span> <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>· ADMIN</span>
        </div>
        <BackendStatusBadge status={backendStatus} />
      </div>

      {!pinLocked ? (
        <div className="pf-center-stage">
          <form onSubmit={savePin} className="pf-card" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="pf-eyebrow">ADMIN ACCESS</div>
            <input
              className="pf-input"
              type="password"
              placeholder="Admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            <button className="pf-btn pf-btn-primary" type="submit">
              Continue
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <GameControlCard
            activeGame={activeGame}
            contestantName={contestantName}
            setContestantName={setContestantName}
            chaserName={chaserName}
            setChaserName={setChaserName}
            createGame={createGame}
            createError={createError}
            startNext={startNext}
            liveResults={liveResults}
            liveDistance={liveDistance}
            liveOutcome={liveOutcome}
          />
          <LeaderboardCard leaderboard={leaderboard} onRefresh={refreshLeaderboard} pin={pin} />
          <DynamicQuestionsCard />
          <DrawPoolCard pin={pin} />
        </div>
      )}
    </div>
  );
}

function GameControlCard({
  activeGame,
  contestantName,
  setContestantName,
  chaserName,
  setChaserName,
  createGame,
  createError,
  startNext,
  liveResults,
  liveDistance,
  liveOutcome,
}) {
  const finished = liveOutcome != null;
  return (
    <div className="pf-card">
      <div className="pf-eyebrow" style={{ marginBottom: 12 }}>
        GAME CONTROL
      </div>

      {!activeGame || finished ? (
        <form onSubmit={createGame} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="pf-input"
            placeholder="Contestant name"
            value={contestantName}
            onChange={(e) => setContestantName(e.target.value)}
            required
          />
          <input className="pf-input" placeholder="Chaser name" value={chaserName} onChange={(e) => setChaserName(e.target.value)} />
          {createError && <div style={{ color: 'var(--pf-red-600)', fontSize: 13 }}>{createError}</div>}
          <button className="pf-btn pf-btn-primary" type="submit">
            {finished ? 'Start next chase' : 'Create game'}
          </button>
        </form>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>JOIN CODE</span>
            <span className="pf-mono" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--pf-gold-400)' }}>
              {activeGame.gameId}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 14 }}>
            <span>
              Contestant: <strong>{activeGame.state.contestantName}</strong>
            </span>
            <span>
              Gap: <strong style={{ color: 'var(--pf-gold-400)' }}>{liveDistance}</strong>
            </span>
          </div>
          <button className="pf-btn pf-btn-primary" onClick={startNext} disabled={liveResults.length >= 6}>
            {liveResults.length === 0 ? 'Start question 1' : `Start question ${liveResults.length + 1}`}
          </button>

          {liveResults.length > 0 && (
            <table style={{ width: '100%', marginTop: 18, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.5)' }}>
                  <th>Q</th>
                  <th>Contestant</th>
                  <th>Chaser</th>
                  <th>Gap after</th>
                </tr>
              </thead>
              <tbody>
                {liveResults.map((r) => (
                  <tr key={r.slot} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '6px 0' }}>{r.slot}</td>
                    <td style={{ color: r.contestantCorrect ? 'var(--pf-gold-400)' : 'var(--pf-red-600)' }}>
                      {r.contestantCorrect ? '✓' : '✗'} {(r.contestantResponseMs / 1000).toFixed(2)}s
                    </td>
                    <td style={{ color: r.chaserCorrect ? 'var(--pf-gold-400)' : 'var(--pf-red-600)' }}>
                      {r.chaserCorrect ? '✓' : '✗'} {(r.chaserResponseMs / 1000).toFixed(2)}s
                    </td>
                    <td>{r.distanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {finished && (
            <div style={{ marginTop: 16, fontWeight: 700, color: liveOutcome.outcome === 'escaped' ? 'var(--pf-gold-400)' : 'var(--pf-red-600)' }}>
              {liveOutcome.contestantName} {liveOutcome.outcome === 'escaped' ? 'ESCAPED' : 'was CAUGHT'} — {liveOutcome.score} pts
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardCard({ leaderboard, onRefresh, pin }) {
  async function handleVoid(id) {
    if (!confirm('Remove this result from the leaderboard? (marks void, does not delete)')) return;
    await api.voidGame(pin, id);
    onRefresh();
  }
  return (
    <div className="pf-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="pf-eyebrow">LEADERBOARD</div>
        <button className="pf-btn pf-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            <th>#</th>
            <th>Name</th>
            <th>Badge</th>
            <th>Score</th>
            <th>Time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, i) => (
            <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '8px 0' }}>{i + 1}</td>
              <td>{row.contestant_name}</td>
              <td style={{ fontSize: 12, color: 'var(--pf-gold-400)' }}>{row.final_badge || '—'}</td>
              <td>{Number(row.score).toFixed(0)}</td>
              <td className="pf-mono" style={{ fontSize: 12 }}>
                {(row.cumulative_response_ms / 1000).toFixed(1)}s
              </td>
              <td>
                <button className="pf-btn pf-btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleVoid(row.id)}>
                  Void
                </button>
              </td>
            </tr>
          ))}
          {leaderboard.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '14px 0', color: 'rgba(255,255,255,0.4)' }}>
                No completed chases yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DynamicQuestionsCard() {
  const [questions, setQuestions] = useState([]);
  const [checked, setChecked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pf_dynamic_checked') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    api.getDynamicQuestions().then(setQuestions).catch(() => {});
  }, []);

  function toggle(id) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem('pf_dynamic_checked', JSON.stringify(next));
  }

  const reviewedCount = questions.filter((q) => checked[q.id]).length;

  return (
    <div className="pf-card">
      <div className="pf-eyebrow" style={{ marginBottom: 6 }}>
        DYNAMIC QUESTION RE-CHECK
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>
        {reviewedCount}/{questions.length} reverified before the event. Tick off as you confirm each threshold/date is still current.
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q) => (
          <label key={q.id} style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!checked[q.id]} onChange={() => toggle(q.id)} style={{ marginTop: 3 }} />
            <span>
              <strong>{q.id}</strong> — {q.question}
              <br />
              <a href={q.source} target="_blank" rel="noreferrer" style={{ color: 'var(--pf-blue-400)', fontSize: 12 }}>
                {q.source}
              </a>{' '}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>· last verified {q.lastVerified}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function BackendStatusBadge({ status }) {
  const map = {
    checking: { label: 'Checking backend…', color: 'rgba(255,255,255,0.5)' },
    awake: { label: 'Backend awake', color: 'var(--pf-green-500)' },
    waking: { label: 'Backend waking up…', color: 'var(--pf-gold-400)' },
    unreachable: { label: 'Backend unreachable', color: 'var(--pf-red-600)' },
  };
  const s = map[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      <span style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}

function DrawPoolCard({ pin }) {
  const [pool, setPool] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(null);

  async function loadPool() {
    setError('');
    try {
      const rows = await api.getDrawPool(pin);
      setPool(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  async function select(gameId) {
    await api.recordDrawSelection(pin, { gameId, selectedBy: 'admin', note });
    setConfirmed(gameId);
  }

  return (
    <div className="pf-card">
      <div className="pf-eyebrow" style={{ marginBottom: 12 }}>
        TOP-5 PRIZE DRAW
      </div>
      {!pool ? (
        <button className="pf-btn pf-btn-primary" onClick={loadPool}>
          Load top 5 escaped contestants
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {pool.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: confirmed === row.id ? 'rgba(240,184,75,0.15)' : 'rgba(255,255,255,0.04)',
                }}
              >
                <span>
                  {row.contestant_name} — {Number(row.score).toFixed(0)} pts
                </span>
                <button className="pf-btn pf-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => select(row.id)}>
                  {confirmed === row.id ? 'Selected ✓' : 'Select'}
                </button>
              </div>
            ))}
            {pool.length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No escaped contestants yet.</div>}
          </div>
          <input className="pf-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div style={{ color: 'var(--pf-red-600)', fontSize: 13, marginTop: 8 }}>{error}</div>}
        </>
      )}
    </div>
  );
}
