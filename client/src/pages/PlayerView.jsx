import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import Timer from '../components/Timer';
import Ladder from '../components/Ladder';
import QuestionCard from '../components/QuestionCard';
import BadgeCard from '../components/BadgeCard';
import { RedFlashOverlay, ConfettiOverlay, END_EFFECT_DURATION_MS } from '../components/EndEffects';

const ROLE_COPY = {
  contestant: { title: 'CONTESTANT', accent: 'You' },
  chaser: { title: 'THE CHASER', accent: 'Chaser' },
};

export default function PlayerView({ role }) {
  const { code: codeFromUrl } = useParams();
  const navigate = useNavigate();
  const copy = ROLE_COPY[role];

  const [code, setCode] = useState(codeFromUrl || '');
  const [name, setName] = useState(role === 'chaser' ? 'The Chaser' : '');
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [gameState, setGameState] = useState(null);

  const chaserName = gameState?.chaserName || 'the Chaser';
  const displayTitle = role === 'chaser' && gameState?.chaserName ? `THE CHASER — ${gameState.chaserName.toUpperCase()}` : copy.title;
  const waitText = role === 'contestant' ? `Waiting for ${chaserName}'s answer…` : 'Waiting for the contestant…';

  // `question` holds stage-1 (text/category/badge only); `answers` holds
  // stage-2 (options + timer), merged into one object for QuestionCard once
  // both have arrived - see activeQuestion below.
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [myLocked, setMyLocked] = useState(false);
  const [otherLocked, setOtherLocked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [endEffect, setEndEffect] = useState(null); // 'flash' | 'confetti' | null
  const endEffectTimeout = useRef(null);
  // Bumped on every 'reveal' - Ladder uses this to blink the relevant
  // tile(s) even when neither marker actually moved (e.g. both sides got
  // the question wrong).
  const [revealTick, setRevealTick] = useState(0);

  useEffect(() => {
    function onQuestion(q) {
      setQuestion(q);
      setAnswers(null);
      setSelected(null);
      setMyLocked(false);
      setOtherLocked(false);
      setTimedOut(false);
      setReveal(null);
    }
    function onAnswersReleased(a) {
      setAnswers(a);
    }
    function onLockedIn({ role: whoLocked, timedOut: to }) {
      if (whoLocked === role) {
        setMyLocked(true);
        if (to) setTimedOut(true);
      } else {
        setOtherLocked(true);
      }
    }
    function onReveal(payload) {
      setReveal(payload);
      setRevealTick((t) => t + 1);
    }
    // Hold the current view on screen a beat longer, with a full-screen
    // effect over it, before cutting to the BadgeCard result - matches the
    // public Chaser display so the players themselves get a clear signal
    // the game just ended, not just a silent screen swap.
    function onGameOver(summary) {
      setEndEffect(summary.outcome === 'escaped' ? 'confetti' : 'flash');
      clearTimeout(endEffectTimeout.current);
      endEffectTimeout.current = setTimeout(() => {
        setEndEffect(null);
        setGameOver(summary);
      }, END_EFFECT_DURATION_MS);
    }
    function onPlayersUpdated(payload) {
      setGameState((prev) => (prev ? { ...prev, ...payload } : prev));
    }
    function onTimeExtended({ timeLimitMs }) {
      setAnswers((prev) => (prev ? { ...prev, timeLimitMs } : prev));
    }
    socket.on('question', onQuestion);
    socket.on('answersReleased', onAnswersReleased);
    socket.on('lockedIn', onLockedIn);
    socket.on('reveal', onReveal);
    socket.on('gameOver', onGameOver);
    socket.on('playersUpdated', onPlayersUpdated);
    socket.on('timeExtended', onTimeExtended);
    return () => {
      clearTimeout(endEffectTimeout.current);
      socket.off('question', onQuestion);
      socket.off('answersReleased', onAnswersReleased);
      socket.off('lockedIn', onLockedIn);
      socket.off('reveal', onReveal);
      socket.off('gameOver', onGameOver);
      socket.off('playersUpdated', onPlayersUpdated);
      socket.off('timeExtended', onTimeExtended);
    };
  }, [role]);

  function join(e) {
    e?.preventDefault();
    setJoinError('');
    socket.emit('joinGame', { gameId: code.trim(), role, name: name.trim() }, (res) => {
      if (res?.error) {
        setJoinError(res.error);
        return;
      }
      setJoined(true);
      setGameState(res.state);
      navigate(`/play/${role}/${code.trim()}`, { replace: true });
    });
  }

  function lockIn() {
    if (!selected || myLocked || !answers) return;
    socket.emit('lockAnswer', { gameId: code.trim(), role, answer: selected });
  }

  // -------------------------------------------------------------- render
  if (!joined) {
    return (
      <div className="pf-shell">
        <TopBar />
        <div className="pf-center-stage">
          <div className="pf-eyebrow">{copy.title}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0 }}>Enter the game code</h1>
          <form onSubmit={join} className="pf-card" style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              className="pf-input"
              placeholder={role === 'contestant' ? 'Your name' : 'Chaser name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="pf-input pf-mono"
              style={{ fontSize: 28, textAlign: 'center', letterSpacing: '0.2em' }}
              maxLength={4}
              inputMode="numeric"
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {joinError && <div style={{ color: 'var(--pf-red-600)', fontSize: 14 }}>{joinError}</div>}
            <button className="pf-btn pf-btn-primary" type="submit" disabled={code.trim().length !== 4 || !name.trim()}>
              Join game
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="pf-shell">
        <TopBar />
        <div className="pf-center-stage">
          <BadgeCard
            contestantName={gameOver.contestantName}
            outcome={gameOver.outcome}
            finalBadge={gameOver.finalBadge}
            score={gameOver.score}
            correctCount={gameOver.correctCount}
            totalSlots={gameOver.questionsAnswered}
          />
        </div>
      </div>
    );
  }

  if (!question && !reveal) {
    return (
      <div className="pf-shell">
        {endEffect === 'flash' && <RedFlashOverlay />}
        {endEffect === 'confetti' && <ConfettiOverlay />}
        <TopBar />
        <div className="pf-center-stage">
          <div className="pf-eyebrow">{displayTitle}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: 0 }}>
            Waiting for the game to start…
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Game code: {code}</p>
        </div>
      </div>
    );
  }

  const activeQuestion = question ? { ...question, ...(answers || {}) } : null;
  // Ladder position is a correct-answer count, not a question number - see
  // Ladder.jsx. Before the first reveal, fall back to the count from the
  // join-time snapshot (0 for a fresh game, or whatever it was on rejoin).
  const currentSlot = reveal ? reveal.contestantCorrectCount : gameState?.contestantCorrectCount ?? 0;
  const distance = reveal ? reveal.distanceAfter : gameState?.distance ?? 2;

  return (
    <div className="pf-shell">
      {endEffect === 'flash' && <RedFlashOverlay />}
      {endEffect === 'confetti' && <ConfettiOverlay />}
      <TopBar />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Ladder
            currentSlot={currentSlot}
            distance={distance}
            badges={gameState?.badges}
            caught={gameOver?.outcome === 'caught'}
            revealTick={revealTick}
          />
        </div>

        <div className="pf-center-stage" style={{ padding: 0 }}>
          {reveal ? (
            <>
              <QuestionCard
                question={activeQuestion}
                selectedAnswer={role === 'contestant' ? reveal.contestantAnswer : reveal.chaserAnswer}
                onSelect={() => {}}
                locked
                revealedCorrectAnswer={reveal.correctAnswer}
                outlineAnswer={role === 'chaser' ? reveal.chaserAnswer : undefined}
              />
              <RevealSummary role={role} reveal={reveal} />
            </>
          ) : answers ? (
            <>
              <QuestionCard question={activeQuestion} selectedAnswer={selected} onSelect={setSelected} locked={myLocked} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 8 }}>
                <Timer serverStartTs={answers.serverStartTs} timeLimitMs={answers.timeLimitMs} locked={myLocked} timedOut={timedOut} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                  <button className="pf-btn pf-btn-primary" disabled={!selected || myLocked} onClick={lockIn}>
                    Lock in
                  </button>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                    {myLocked ? (otherLocked ? 'Revealing…' : waitText) : 'Select an answer, then lock in.'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <QuestionCard question={activeQuestion} selectedAnswer={null} onSelect={() => {}} locked />
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 16 }}>Waiting for the host to reveal the answers…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RevealSummary({ role, reveal }) {
  const meCorrect = role === 'contestant' ? reveal.contestantCorrect : reveal.chaserCorrect;
  const myTime = role === 'contestant' ? reveal.contestantResponseMs : reveal.chaserResponseMs;
  return (
    <div className="pf-card" style={{ maxWidth: 640, textAlign: 'left', marginTop: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: meCorrect ? 'var(--pf-gold-400)' : 'var(--pf-red-600)' }}>
        {meCorrect ? 'Correct' : 'Incorrect'} · {(myTime / 1000).toFixed(2)}s
      </div>
      <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 16, lineHeight: 1.5 }}>{reveal.explanation}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Source: {reveal.source}</div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="pf-topbar">
      <div className="pf-wordmark">
        PICKFORDS <span className="pf-word-relo">RELO</span> <span className="pf-word-chaser">CHASER</span>
      </div>
    </div>
  );
}
