import './ladder.css';

// Fallback only - real games always get the tier list from the server
// (gameState.badges, see gameEngine.js publicState) so the client never has
// its own copy to drift out of sync with the engine's BADGES array.
const FALLBACK_BADGES = ['#MobilityMover', '#GlobalNavigator', '#MobilityPro', '#GlobalMobilityExpert', '#MobilityMastermind', '#MobilityLegend'];

const HEAD_START = 2; // must match server/src/gameEngine.js HEAD_START

/**
 * currentSlot: how many badge tiers the CONTESTANT has actually cleared (0
 *   .. rungs.length) - this is a correct-answer count, not a question
 *   number, since a wrong answer leaves both players standing still.
 * distance: contestant's live lead over the Chaser (see gameEngine.js) -
 *   this is the number actually shown; the Chaser marker position below
 *   is a visual approximation derived from it, not an independent value.
 * variant: 'compact' (default, private per-player sidebar) or 'funnel'
 *   (bigger, theatrical treatment for the public Chaser display screen -
 *   red arrow marker, and only the tile the contestant currently occupies
 *   shows its badge name - every other tile's hashtag stays hidden).
 *
 * Rendered top-to-bottom as START -> #MobilityMover -> ... -> #MobilityLegend,
 * matching the show's diagram: both players move DOWN the track as they
 * answer correctly, with Legend as the final (bottom-most) tile.
 */
export default function Ladder({ currentSlot = 0, distance = HEAD_START, caught = false, badges = FALLBACK_BADGES, variant = 'compact' }) {
  const rungs = badges.length ? badges : FALLBACK_BADGES;
  const clamp = (n) => Math.max(0, Math.min(rungs.length, n));
  const contestantRung = clamp(currentSlot);
  const chaserRung = clamp(currentSlot - distance + HEAD_START);
  const funnel = variant === 'funnel';

  return (
    <div
      className={`pf-ladder ${funnel ? 'pf-ladder-funnel' : ''}`}
      role="img"
      aria-label={`Contestant at level ${contestantRung} of ${rungs.length}, gap to Chaser ${distance}`}
    >
      <div className="pf-ladder-gap pf-mono">
        <span className="pf-ladder-gap-label">GAP</span>
        <span className={`pf-ladder-gap-value ${distance <= 1 ? 'critical' : ''}`}>{distance}</span>
      </div>

      <div className="pf-ladder-track">
        <div className="pf-rung pf-rung-start" style={funnel ? { width: '100%' } : undefined}>
          <div className="pf-rung-markers">
            {contestantRung === 0 && <span className="pf-marker contestant" title="You">Y</span>}
            {chaserRung === 0 && (
              <span className="pf-marker chaser" title="Chaser">
                {funnel ? '▼' : 'C'}
              </span>
            )}
          </div>
          <div className="pf-rung-label muted">START</div>
        </div>

        {rungs.map((label, i) => {
          const rungIndex = i + 1; // first tile below START = 1, last (bottom) = rungs.length
          const isContestantHere = rungIndex === contestantRung && contestantRung > 0;
          const isChaserHere = rungIndex === chaserRung && chaserRung > 0;
          const isCleared = rungIndex <= contestantRung && !caught;
          const widthPct = funnel ? 100 - ((i + 1) / rungs.length) * 40 : 100; // narrows toward the bottom (Legend)
          const showLabel = !funnel || rungIndex === contestantRung;
          return (
            <div key={label} className={`pf-rung ${isCleared ? 'cleared' : ''}`} style={funnel ? { width: `${widthPct}%` } : undefined}>
              <div className="pf-rung-markers">
                {isChaserHere && (
                  <span className="pf-marker chaser" title="Chaser">
                    {funnel ? '▼' : 'C'}
                  </span>
                )}
                {isContestantHere && <span className="pf-marker contestant" title="You">Y</span>}
              </div>
              <div className="pf-rung-label">{showLabel ? label : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
