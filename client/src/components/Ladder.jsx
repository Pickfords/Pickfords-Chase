import { useEffect, useRef, useState } from 'react';
import './ladder.css';

// How long the blink highlight stays on after a placement reveal - see the
// useEffect below.
const BLINK_MS = 1200;

// Fallback only - real games always get the tier list from the server
// (gameState.badges, see gameEngine.js publicState) so the client never has
// its own copy to drift out of sync with the engine's BADGES array.
const FALLBACK_BADGES = ['#MobilityMover', '#GlobalNavigator', '#MobilityPro', '#GlobalMobilityExpert', '#MobilityMastermind', '#MobilityLegend'];

const HEAD_START = 2; // must match server/src/gameEngine.js HEAD_START

/**
 * currentSlot: how many badge tiers the CONTESTANT has actually cleared (0
 *   .. rungs.length) - a correct-answer count, not a question number, since
 *   a wrong answer leaves both players standing still.
 * distance: contestant's live lead over the Chaser (see gameEngine.js).
 * variant: 'compact' (default, private per-player sidebar) or 'funnel'
 *   (bigger, theatrical treatment for the public Chaser display screen).
 *   All badge hashtags are always visible on every tile.
 *
 * The track, top-to-bottom: CHASER START (where the Chaser begins, HEAD_START
 * tiles above the Contestant) -> ... -> #MobilityMover (the Contestant's own
 * starting tile) -> ... -> #MobilityLegend (bottom). Both players move DOWN
 * one tile per correct answer of their own.
 *
 * Colour language (funnel variant): a tile the Contestant has fully cleared
 * is green; a tile the Chaser is on or has already passed is red (wins over
 * green if both apply); the tile the Contestant is CURRENTLY on is blue -
 * gold instead if that tile is #MobilityLegend (i.e. they've just cleared
 * the whole ladder). No separate marker icon denotes the Contestant's
 * position any more - the tile colour itself is the indicator. The Chaser
 * still gets a marker icon, since the red trail alone doesn't show exactly
 * where within it they currently are.
 *
 * Both positions are placed on one shared absolute tile index (0 = Chaser
 * Start, at the top). The Contestant starts HEAD_START tiles below that,
 * standing on #MobilityMover; the Chaser starts at tile 0 and needs
 * HEAD_START correct answers just to draw level with the Contestant's start.
 * This is the same distance = HEAD_START + contestantCorrect - chaserCorrect
 * used by gameEngine.js - the "gap" shown above the track and the
 * tile-distance between the two positions below are always the same number,
 * and hitting distance <= 0 (caught) is exactly the two landing on the same
 * tile.
 *
 * revealTick: bump this (any changing value) once per placement reveal, so
 *   the blink below fires even when NEITHER marker actually moved (e.g. both
 *   sides got the question wrong) - blink is tied to "a reveal happened",
 *   not to the derived positions changing, since those can legitimately
 *   stay identical across a reveal.
 * legendRevealed: while the Contestant sits on #MobilityLegend, false shows
 *   a blue tile with a pulsing gold outline (arrived, not yet confirmed);
 *   true (the default, used everywhere except the public Chaser display's
 *   staged reveal) shows the tile solid gold and pulsing.
 */
export default function Ladder({
  currentSlot = 0,
  distance = HEAD_START,
  caught = false,
  badges = FALLBACK_BADGES,
  variant = 'compact',
  revealTick = 0,
  legendRevealed = true,
}) {
  const rungs = badges.length ? badges : FALLBACK_BADGES;
  const totalTiles = HEAD_START + rungs.length; // Chaser-start zone + badge tiers
  const clampAbs = (n) => Math.max(0, Math.min(totalTiles - 1, n));
  const clampedSlot = Math.max(0, Math.min(rungs.length, currentSlot));

  const contestantAbs = clampAbs(HEAD_START + clampedSlot);
  const chaserAbs = clampAbs(clampedSlot - distance + HEAD_START);

  const funnel = variant === 'funnel';

  // Blink the old and new tiles whenever a placement reveal happens (or, if
  // neither marker actually moved, blink wherever they already are - "the
  // game responded" even without a visible change) - not on the very first
  // mount, just on updates. Keyed on revealTick (not the positions
  // themselves), since the positions can be IDENTICAL across a reveal.
  const [blinkTiles, setBlinkTiles] = useState(() => new Set());
  const prevPositions = useRef(null);
  const blinkTimeout = useRef(null);
  useEffect(() => {
    const prev = prevPositions.current;
    if (prev) {
      setBlinkTiles(new Set([prev.contestantAbs, prev.chaserAbs, contestantAbs, chaserAbs]));
      clearTimeout(blinkTimeout.current);
      blinkTimeout.current = setTimeout(() => setBlinkTiles(new Set()), BLINK_MS);
    }
    prevPositions.current = { contestantAbs, chaserAbs };
    return () => clearTimeout(blinkTimeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTick]);

  const tiles = [
    ...Array.from({ length: HEAD_START }, (_, i) => ({
      key: i === 0 ? 'chaser-start' : `pre-${i}`,
      label: i === 0 ? 'CHASER START' : '',
      muted: true,
      isBadge: false,
    })),
    ...rungs.map((label, i) => ({ key: label, label, muted: false, isBadge: true, badgeRung: i + 1 })),
  ];

  return (
    <div
      className={`pf-ladder ${funnel ? 'pf-ladder-funnel' : ''}`}
      role="img"
      aria-label={`Contestant has cleared ${clampedSlot} of ${rungs.length} tiers, gap to Chaser ${distance}`}
    >
      <div className="pf-ladder-gap pf-mono">
        <span className="pf-ladder-gap-label">GAP</span>
        <span className={`pf-ladder-gap-value ${distance <= 1 ? 'critical' : ''}`}>{distance}</span>
      </div>

      <div className="pf-ladder-track">
        {tiles.map((tile, absoluteIndex) => {
          const isContestantHere = absoluteIndex === contestantAbs;
          const isChaserHere = absoluteIndex === chaserAbs;
          // Contestant: fully cleared (behind their current tile) turns green.
          const isCleared = tile.isBadge && tile.badgeRung <= clampedSlot;
          // Chaser: on it now, or already passed it, turns red - including
          // the Chaser Start zone itself, not just badge tiles.
          const isChaserPassed = absoluteIndex <= chaserAbs;
          // Contestant's current tile: blue, or gold if it's the last tile
          // (#MobilityLegend - they've just cleared the whole ladder). While
          // legendRevealed is false, Legend stays blue with a pulsing gold
          // outline instead - "arrived, not yet confirmed" (see ChaserDisplay).
          const isLegendTile = isContestantHere && tile.isBadge && tile.badgeRung === rungs.length;
          const legendPending = isLegendTile && !legendRevealed;
          const legendWon = isLegendTile && legendRevealed;
          const isCurrentOther = isContestantHere && !isLegendTile;
          const isCaughtTile = caught && isContestantHere && isChaserHere;
          const isBlinking = blinkTiles.has(absoluteIndex);
          // Gentle taper (not too aggressive) - on a narrow portrait screen
          // the lower tiles still need enough width for the longest badge
          // name (#GlobalMobilityExpert) to fit without wrapping badly.
          const widthPct = funnel ? 100 - (absoluteIndex / (tiles.length - 1)) * 18 : 100; // tapers top to bottom
          return (
            <div
              key={tile.key}
              className={[
                'pf-rung',
                isCleared ? 'cleared' : '',
                isChaserPassed ? 'chaser-passed' : '',
                isCurrentOther || legendPending ? 'current-contestant' : '',
                legendPending ? 'legend-pending' : '',
                legendWon ? 'current-legend legend-won' : '',
                isCaughtTile ? 'caught-tile' : '',
                isBlinking ? 'blink' : '',
                tile.muted ? 'pf-rung-muted' : '',
              ].join(' ')}
              style={funnel ? { width: `${widthPct}%` } : undefined}
            >
              <div className="pf-rung-markers">
                {isChaserHere && (
                  <span className="pf-marker chaser" title="Chaser">
                    {funnel ? '▼' : 'C'}
                  </span>
                )}
                {isContestantHere && !funnel && (
                  <span className="pf-marker contestant" title="You">
                    Y
                  </span>
                )}
              </div>
              <div className={`pf-rung-label ${tile.muted ? 'muted' : ''}`}>{tile.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
