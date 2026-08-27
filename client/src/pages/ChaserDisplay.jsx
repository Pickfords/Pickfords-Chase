import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import DisplayFrame from '../components/DisplayFrame';
import Ladder from '../components/Ladder';
import BadgeCard from '../components/BadgeCard';
import IdleVehicles from '../components/IdleVehicles';
import { RedFlashOverlay, ConfettiOverlay, END_EFFECT_DURATION_MS } from '../components/EndEffects';
import { useIdleVehicles } from '../hooks/useIdleVehicles';
import './chaserdisplay.css';

// Public, no-controls funnel-diagram screen (the show's chase-diagram
// visual) for a 55" portrait-mounted venue screen. Auto-follows whichever
// game is currently live - no join code. Only moves the Chaser/Contestant
// markers on 'placementRevealed' (the admin's 3rd release button), never
// on 'reveal', so the audience-facing suspense survives even though the
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
  // Bumped on every real game event - the idle-vehicle animation watches
  // this and only plays after 10s with no change to it (see useIdleVehicles).
  const [activityTick, setActivityTick] = useState(0);
  const bump = () => setActivityTick((t) => t + 1);
  const vehicle = useIdleVehicles(activityTick);
  // Bumped on every placement reveal specifically (not every game event) -
  // Ladder uses this to blink the relevant tile(s) even when neither marker
  // actually moved (e.g. both sides got the question wrong).
  const [revealTick, setRevealTick] = useState(0);
  // False for a beat right after arriving on #MobilityLegend, before the
  // gold "confirmed" reveal - see onPlacementRevealed below.
  const [legendRevealed, setLegendRevealed] = useState(true);
  const legendTimeout = useRef(null);
  const LEGEND_TEASE_MS = 1400;

  useEffect(() => {
    function applyGame(gameId, state) {
      clearTimeout(endEffectTimeout.current);
      clearTimeout(legendTimeout.current);
      bump();
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
      setLegendRevealed(true);
      socket.emit('joinGame', { gameId, role: 'display' }, () => {});
    }

    api.getActiveGame().then(({ gameId, state }) => {
      if (gameId) applyGame(gameId, state);
    });

    function onActiveGameChanged({ gameId, state }) {
      applyGame(gameId, state);
    }
    function onPlayersUpdated(payload) {
      bump();
      setContestantName(payload.contestantName);
      setChaserName(payload.chaserName);
    }
    function onQuestion(q) {
      bump();
      setLiveSlot(q);
      setPhase('question');
      setGameOver(null);
    }
    function onAnswersReleased() {
      bump();
      setPhase('active');
    }
    function onReveal() {
      bump();
      setPhase('awaiting');
    }
    function onPlacementRevealed(p) {
      bump();
      setRevealTick((t) => t + 1);
      setCurrentSlot(p.contestantCorrectCount);
      setDistance(p.distance);
      setCaught(p.caught);
      setPhase('idle');
      clearTimeout(legendTimeout.current);
      if (p.escaped) {
        // Arrive on #MobilityLegend blue-with-gold-outline first, THEN flip
        // to solid gold - this happens well within the ~4s the server waits
        // before gameOver fires, so it's a distinct beat before the
        // confetti/cut-to-card, not a race against it.
        setLegendRevealed(false);
        legendTimeout.current = setTimeout(() => setLegendRevealed(true), LEGEND_TEASE_MS);
      } else {
        setLegendRevealed(true);
      }
    }
    // Hold the funnel view on screen a beat longer, with a full-screen effect
    // over it, before cutting to the BadgeCard result - a flash of red for a
    // catch (this includes running out of the 10-question reserve, which the
    // engine also counts as "caught"), a burst of confetti for an escape.
    function onGameOver(summary) {
      bump();
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
      clearTimeout(legendTimeout.current);
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
    <DisplayFrame storageKey="pf_chaser_display_rotation">
      <div className="pf-shell pf-chaser-display">
        {endEffect === 'flash' && <RedFlashOverlay />}
        {endEffect === 'confetti' && <ConfettiOverlay />}
        <IdleVehicles vehicle={vehicle} />
        <div className="pf-cd-topbar">
          <div className="pf-cd-wordmark">
            PICKFORDS <span className="pf-word-relo">RELO</span> <span className="pf-word-chaser">CHASER</span>
          </div>
        </div>

        {gameOver ? (
          <div className="pf-cd-stage">
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
          <div className="pf-cd-stage">
            <div className="pf-cd-names">
              <span>
                Contestant: <strong>{contestantName}</strong>
              </span>
              <span className="pf-cd-chaser-name">
                Chaser: <strong>{chaserName}</strong>
              </span>
            </div>
            {phaseLabel && <div className="pf-cd-phase pf-eyebrow">{phaseLabel}</div>}
            <div className="pf-cd-ladder-wrap">
              <Ladder
                currentSlot={currentSlot}
                distance={distance}
                caught={caught}
                badges={badges || undefined}
                variant="funnel"
                revealTick={revealTick}
                legendRevealed={legendRevealed}
              />
            </div>
          </div>
        )}
      </div>
    </DisplayFrame>
  );
}
