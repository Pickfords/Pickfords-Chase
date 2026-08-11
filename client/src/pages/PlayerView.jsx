import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import Timer from '../components/Timer';
import Ladder from '../components/Ladder';
import QuestionCard from '../components/QuestionCard';
import BadgeCard from '../components/BadgeCard';

const ROLE_COPY = {
  contestant: { title: 'CONTESTANT', accent: 'You', wait: "Waiting for Phil's answer…" },
  chaser: { title: "THE CHASER — PHIL", accent: 'Chaser', wait: 'Waiting for the contestant…' },
};

export default function PlayerView({ role }) {
  const { code: codeFromUrl } = useParams();
  const navigate = useNavigate();
  const copy = ROLE_COPY[role];

  const [code, setCode] = useState(codeFromUrl || '');
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [gameState, setGameState] = useState(null);

  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [myLocked, setMyLocked] = useState(false);
  const [otherLocked, setOtherLocked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  useEffect(() => {
    function onQuestion(q) {
      setQuestion(q);
      setSelected(null);
      setMyLocked(false);
      setOtherLocked(false);
      setTimedOut(false);
      setReveal(null);
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
    }
    function onGameOver(summary) {
      setGameOver(summary);
    }
    socket.on('question', onQuestion);
    socket.on('lockedIn', onLockedIn);
    socket.on('reveal', onReveal);
    socket.on('gameOver', onGameOver);
    return () => {
      socket.off('question', onQuestion);
      socket.off('lockedIn', onLockedIn);
      socket.off('reveal', onReveal);
      socket.off('gameOver', onGameOver);
    };
  }, [role]);

  function join(e) {
    e?.preventDefault();
    setJoinError('');
    socket.emit('joinGame', { gameId: code.trim(), role }, (res) => {
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
    if (!selected || myLocked) return;
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
              className="pf-input pf-mono"
              style={{ fontSize: 28, textAlign: 'center', letterSpacing: '0.2em' }}
              maxLength={4}
              inputMode="numeric"
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            {joinError && <div style={{ color: 'var(--pf-red-600)', fontSize: 14 }}>{joinError}</div>}
            <button className="pf-btn pf-btn-primary" type="submit" disabled={code.trim().length !== 4}>
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
            totalSlots={gameOver.questionsAnswered >= 6 ? 6 : gameOver.questionsAnswered}
          />
        </div>
      </div>
    );
  }

  if (!question && !reveal) {
    return (
      <div className="pf-shell">
        <TopBar />
        <div className="pf-center-stage">
          <div className="pf-eyebrow">{copy.title}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: 0 }}>
            Waiting for the game to start…
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Game code: {code}</p>
        </div>
      </div>
    );
  }

  const currentSlot = reveal ? reveal.slot : question?.slot || 0;
  const distance = reveal ? reveal.distanceAfter : gameState?.distance ?? 2;

  return (
    <div className="pf-shell">
      <TopBar />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Ladder currentSlot={currentSlot} distance={distance} caught={gameOver?.outcome === 'caught'} />
        </div>

        <div className="pf-center-stage" style={{ padding: 0 }}>
          {reveal ? (
            <RevealPanel role={role} reveal={reveal} />
          ) : (
            <>
              <QuestionCard question={question} selectedAnswer={selected} onSelect={setSelected} locked={myLocked} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 8 }}>
                <Timer serverStartTs={question.serverStartTs} timeLimitMs={question.timeLimitMs} locked={myLocked} timedOut={timedOut} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                  <button className="pf-btn pf-btn-primary" disabled={!selected || myLocked} onClick={lockIn}>
                    Lock in
                  </button>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                    {myLocked ? (otherLocked ? 'Revealing…' : copy.wait) : 'Select an answer, then lock in.'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RevealPanel({ role, reveal }) {
  const meCorrect = role === 'contestant' ? reveal.contestantCorrect : reveal.chaserCorrect;
  const myTime = role === 'contestant' ? reveal.contestantResponseMs : reveal.chaserResponseMs;
  return (
    <div className="pf-card" style={{ maxWidth: 560, textAlign: 'left' }}>
      <div className="pf-eyebrow" style={{ marginBottom: 10 }}>
        Q{reveal.slot} RESULT
      </div>
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
        PICKFORDS <span>CHASER</span>
      </div>
    </div>
  );
}
