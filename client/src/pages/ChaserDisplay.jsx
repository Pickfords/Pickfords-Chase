import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import Ladder from '../components/Ladder';
import BadgeCard from '../components/BadgeCard';
import { RedFlashOverlay, ConfettiOverlay } from '../components/EndEffects';

const END_EFFECT_DURATION_MS = 2800;

// Public, no-controls funnel-diagram screen (the show's chase-diagram
// visual) for the venue's big screen. Auto-follows whichever game is
// currently live - no join code. Only moves the Chaser/Contestant markers
// on 'placementRevealed' (the admin's 3rd release button), never on
// 'reveal', so the audience-facing suspense survives even though the
// players' own tablets already know the answer.
export default function ChaserDisplay() {
  const [contestantName, setContestantName] = useState('Contestant');
  const [chaserName, setChaserName] = useState('The Chaser');
  const [badges, setBadges] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [distance, setDistance] = useState(2);
  const [caught, setCaught] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | question | active | awaiting
  const [liveSlot, setLiveSlot] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [endEffect, setEndEffect] = useState(null); // 'flash' | 'confetti' | null
  const endEffectTimeout = useRef(null);

  useEffect(() => {
    function applyGame(gameId, state) {
      clearTimeout(endEffectTimeout.current);
      setContestantName(state.contestantName);
      setChaserName(state.chaserName);
      setBadges(state.badges);
      setCurrentSlot(state.contestantCorrectCount);
      setDistance(state.distance);
      setCaught(state.outcome === 'caught');
      setPhase('idle');
      setLiveSlot(null);
      setGameOver(null);
      setEndEffect(null);
      socket.emit('joinGame', { gameId, role: 'display' }, () => {});
    }

    api.getActiveGame().then(({ gameId, state }) => {
      if (gameId) applyGame(gameId, state);
    });

    function onActiveGameChanged({ gameId, state }) {
      applyGame(gameId, state);
    }
    function onPlayersUpdated(payload) {
      setContestantName(payload.contestantName);
      setChaserName(payload.chaserName);
    }
    function onQuestion(q) {
      setLiveSlot(q);
      setPhase('question');
      setGameOver(null);
    }
    function onAnswersReleased() {
      setPhase('active');
    }
    function onReveal() {
      setPhase('awaiting');
    }
    function onPlacementRevealed(p) {
      setCurrentSlot(p.contestantCorrectCount);
      setDistance(p.distance);
      setCaught(p.caught);
      setPhase('idle');
    }
    // Hold the funnel view on screen a beat longer, with a full-screen effect
    // over it, before cutting to the BadgeCard result - a flash of red for a
    // catch (this includes running out of the 10-question reserve, which the
    // engine also counts as "caught"), a burst of confetti for an escape.
    function onGameOver(summary) {
      setEndEffect(summary.outcome === 'escaped' ? 'confetti' : 'flash');
      clearTimeout(endEffectTimeout.current);
      endEffectTimeout.current = setTimeout(() => {
        setEndEffect(null);
        setGameOver(summary);
      }, END_EFFECT_DURATION_MS);
    }

    socket.on('activeGameChanged', onActiveGameChanged);
    socket.on('playersUpdated', onPlayersUpdated);
    socket.on('question', onQuestion);
    socket.on('answersReleased', onAnswersReleased);
    socket.on('reveal', onReveal);
    socket.on('placementRevealed', onPlacementRevealed);
    socket.on('gameOver', onGameOver);
    return () => {
      clearTimeout(endEffectTimeout.current);
      socket.off('activeGameChanged', onActiveGameChanged);
      socket.off('playersUpdated', onPlayersUpdated);
      socket.off('question', onQuestion);
      socket.off('answersReleased', onAnswersReleased);
      socket.off('reveal', onReveal);
      socket.off('placementRevealed', onPlacementRevealed);
      socket.off('gameOver', onGameOver);
    };
  }, []);

  const phaseLabel = {
    idle: null,
    question: `Q${liveSlot?.slot} · ${liveSlot?.category} — question on screen`,
    active: `Q${liveSlot?.slot} — the clock is running…`,
    awaiting: 'Answers locked in — revealing placement…',
  }[phase];

  return (
    <div className="pf-shell pf-chaser-display">
      {endEffect === 'flash' && <RedFlashOverlay />}
      {endEffect === 'confetti' && <ConfettiOverlay />}
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span>CHASER</span>
        </div>
      </div>

      {gameOver ? (
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
      ) : (
        <div className="pf-center-stage">
          <div style={{ display: 'flex', gap: 48, fontSize: 20, marginBottom: 8 }}>
            <span>
              Contestant: <strong>{contestantName}</strong>
            </span>
            <span>
              Chaser: <strong style={{ color: 'var(--pf-red-600)' }}>{chaserName}</strong>
            </span>
          </div>
          {phaseLabel && <div className="pf-eyebrow" style={{ fontSize: 15, marginBottom: 8 }}>{phaseLabel}</div>}
          <Ladder currentSlot={currentSlot} distance={distance} caught={caught} badges={badges || undefined} variant="funnel" />
        </div>
      )}
    </div>
  );
}
