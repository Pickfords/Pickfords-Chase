import './ladder.css';

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
 *   (bigger, theatrical treatment for the public Chaser display screen -
 *   only the tile the contestant currently occupies shows its badge name;
 *   every other badge tile's hashtag stays hidden).
 *
 * The track, top-to-bottom: CHASER START (where the Chaser begins, HEAD_START
 * tiles above the Contestant) -> ... -> #MobilityMover (the Contestant's own
 * starting tile) -> ... -> #MobilityLegend (bottom). Both players move DOWN
 * one tile per correct answer of their own. A tile the Contestant has fully
 * cleared shows green; a tile the Chaser is on or has already passed shows
 * red (both can apply to the same tile at once).
 *
 * Both markers are placed on one shared absolute tile index (0 = Chaser
 * Start, at the top). The Contestant starts HEAD_START tiles below that,
 * standing on #MobilityMover; the Chaser starts at tile 0 and needs
 * HEAD_START correct answers just to draw level with the Contestant's start.
 * This is the same distance = HEAD_START + contestantCorrect - chaserCorrect
 * used by gameEngine.js - the "gap" shown above the track and the
 * tile-distance between the two markers below are always the same number,
 * and hitting distance <= 0 (caught) is exactly the two markers landing on
 * the same tile.
 */
export default function Ladder({ currentSlot = 0, distance = HEAD_START, caught = false, badges = FALLBACK_BADGES, variant = 'compact' }) {
  const rungs = badges.length ? badges : FALLBACK_BADGES;
  const totalTiles = HEAD_START + rungs.length; // Chaser-start zone + badge tiers
  const clampAbs = (n) => Math.max(0, Math.min(totalTiles - 1, n));
  const clampedSlot = Math.max(0, Math.min(rungs.length, currentSlot));

  const contestantAbs = clampAbs(HEAD_START + clampedSlot);
  const chaserAbs = clampAbs(clampedSlot - distance + HEAD_START);

  const funnel = variant === 'funnel';

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
          // Chaser: on it now, or already passed it, turns red - can overlap
          // with "cleared" if both have gotten that far.
          const isChaserPassed = tile.isBadge && absoluteIndex <= chaserAbs;
          const isCaughtTile = caught && isContestantHere && isChaserHere;
          const widthPct = funnel ? 100 - (absoluteIndex / (tiles.length - 1)) * 45 : 100; // tapers top to bottom
          const showLabel = !funnel || !tile.isBadge || isContestantHere;
          return (
            <div
              key={tile.key}
              className={`pf-rung ${isCleared ? 'cleared' : ''} ${isChaserPassed ? 'chaser-passed' : ''} ${isCaughtTile ? 'caught-tile' : ''} ${tile.muted ? 'pf-rung-muted' : ''}`}
              style={funnel ? { width: `${widthPct}%` } : undefined}
            >
              <div className="pf-rung-markers">
                {isChaserHere && (
                  <span className="pf-marker chaser" title="Chaser">
                    {funnel ? '▼' : 'C'}
                  </span>
                )}
                {isContestantHere && (
                  <span className="pf-marker contestant" title={funnel ? 'Contestant' : 'You'}>
                    {funnel ? 'C' : 'Y'}
                  </span>
                )}
              </div>
              <div className={`pf-rung-label ${tile.muted ? 'muted' : ''}`}>{showLabel ? tile.label : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
