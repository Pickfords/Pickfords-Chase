import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import Timer from '../components/Timer';
import QuestionCard from '../components/QuestionCard';
import LeaderboardTable from '../components/LeaderboardTable';

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

  const [activeGame, setActiveGame] = useState(null); // { gameId, state }
  const [createError, setCreateError] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [liveDistance, setLiveDistance] = useState(2);
  const [liveOutcome, setLiveOutcome] = useState(null);
  // Three-stage release: `question` (text only) -> `answers` (options + timer) ->
  // `awaitingPlacement` (both locked in, waiting for the admin's 3rd click before
  // the public Chaser screen animates the funnel position).
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [awaitingPlacement, setAwaitingPlacement] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    refreshLeaderboard();
    function onQuestion(q) {
      setQuestion(q);
      setAnswers(null);
      setAwaitingPlacement(false);
    }
    function onAnswersReleased(a) {
      setAnswers(a);
    }
    function onReveal(r) {
      setQuestion(null);
      setAnswers(null);
      setAwaitingPlacement(true);
      setLiveResults((prev) => [...prev, r]);
      setLiveDistance(r.distanceAfter);
    }
    function onPlacementRevealed() {
      setAwaitingPlacement(false);
    }
    function onGameOver(summary) {
      setLiveOutcome(summary);
      setAwaitingPlacement(false);
    }
    function onPlayersUpdated(payload) {
      setActiveGame((prev) => (prev ? { ...prev, state: { ...prev.state, ...payload } } : prev));
    }
    function onTimeExtended({ timeLimitMs }) {
      setAnswers((prev) => (prev ? { ...prev, timeLimitMs } : prev));
    }
    socket.on('leaderboardUpdate', setLeaderboard);
    socket.on('question', onQuestion);
    socket.on('answersReleased', onAnswersReleased);
    socket.on('reveal', onReveal);
    socket.on('placementRevealed', onPlacementRevealed);
    socket.on('gameOver', onGameOver);
    socket.on('playersUpdated', onPlayersUpdated);
    socket.on('timeExtended', onTimeExtended);
    return () => {
      socket.off('leaderboardUpdate', setLeaderboard);
      socket.off('question', onQuestion);
      socket.off('answersReleased', onAnswersReleased);
      socket.off('reveal', onReveal);
      socket.off('placementRevealed', onPlacementRevealed);
      socket.off('gameOver', onGameOver);
      socket.off('playersUpdated', onPlayersUpdated);
      socket.off('timeExtended', onTimeExtended);
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
    socket.emit('admin:createGame', { adminPin: pin }, (res) => {
      if (res?.error) return setCreateError(res.error);
      setActiveGame({ gameId: res.gameId, state: res.state });
      setLiveResults([]);
      setLiveDistance(2);
      setLiveOutcome(null);
      setQuestion(null);
      setAnswers(null);
      setAwaitingPlacement(false);
      socket.emit('joinGame', { gameId: res.gameId, role: 'admin' }, () => {});
    });
  }

  function releaseQuestion() {
    if (!activeGame) return;
    socket.emit('admin:releaseQuestion', { gameId: activeGame.gameId, adminPin: pin }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  function releaseAnswers() {
    if (!activeGame) return;
    socket.emit('admin:releaseAnswers', { gameId: activeGame.gameId, adminPin: pin }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  function revealPlacement() {
    if (!activeGame) return;
    socket.emit('admin:revealPlacement', { gameId: activeGame.gameId, adminPin: pin }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  function addTime() {
    if (!activeGame) return;
    socket.emit('admin:addTime', { gameId: activeGame.gameId, adminPin: pin }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  return (
    <div className="pf-shell">
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span className="pf-word-relo">RELO</span> <span className="pf-word-chaser">CHASER</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>· ADMIN</span>
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
            createGame={createGame}
            createError={createError}
            releaseQuestion={releaseQuestion}
            releaseAnswers={releaseAnswers}
            revealPlacement={revealPlacement}
            addTime={addTime}
            question={question}
            answers={answers}
            awaitingPlacement={awaitingPlacement}
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
  createGame,
  createError,
  releaseQuestion,
  releaseAnswers,
  revealPlacement,
  addTime,
  question,
  answers,
  awaitingPlacement,
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

      {finished && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Game ended — start a new game</div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 700,
              color: liveOutcome.outcome === 'escaped' ? 'var(--pf-gold-400)' : 'var(--pf-red-600)',
            }}
          >
            {liveOutcome.contestantName} {liveOutcome.outcome === 'escaped' ? 'ESCAPED' : 'was CAUGHT'} — {liveOutcome.score} pts
          </div>
        </div>
      )}

      {!activeGame || finished ? (
        <form onSubmit={createGame} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {createError && <div style={{ color: 'var(--pf-red-600)', fontSize: 13 }}>{createError}</div>}
          <button className="pf-btn pf-btn-primary" type="submit">
            {finished ? 'Start new game' : 'Start game'}
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
              Chaser: <strong>{activeGame.state.chaserName}</strong>
            </span>
            <span>
              Gap: <strong style={{ color: 'var(--pf-gold-400)' }}>{liveDistance}</strong>
            </span>
          </div>

          {answers ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QuestionCard question={{ ...question, ...answers }} selectedAnswer={null} onSelect={() => {}} locked />
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <Timer serverStartTs={answers.serverStartTs} timeLimitMs={answers.timeLimitMs} locked={false} />
                <button className="pf-btn pf-btn-ghost" onClick={addTime}>
                  Add 5 seconds
                </button>
              </div>
            </div>
          ) : question ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QuestionCard question={question} selectedAnswer={null} onSelect={() => {}} locked />
              <button className="pf-btn pf-btn-primary" onClick={releaseAnswers}>
                Release answers
              </button>
            </div>
          ) : awaitingPlacement ? (
            <button className="pf-btn pf-btn-primary" onClick={revealPlacement}>
              Reveal placement
            </button>
          ) : (
            <button className="pf-btn pf-btn-primary" onClick={releaseQuestion} disabled={liveResults.length >= 10}>
              {liveResults.length === 0 ? 'Release question 1' : `Release question ${liveResults.length + 1}`}
            </button>
          )}

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
      <LeaderboardTable leaderboard={leaderboard} onVoid={handleVoid} />
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
