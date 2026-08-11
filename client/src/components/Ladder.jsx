import './ladder.css';

const RUNGS = [
  '#MobilityMover',
  '#GlobalNavigator',
  '#MobilityPro',
  '#GlobalMobilityExpert',
  '#MobilityMastermind',
  '#MobilityLegend',
];

const HEAD_START = 2; // must match server/src/gameEngine.js HEAD_START

/**
 * currentSlot: 0 (not started) .. 6 (finished last question)
 * distance: contestant's live lead over the Chaser (see gameEngine.js) -
 *   this is the number actually shown; the Chaser marker position below
 *   is a visual approximation derived from it, not an independent value.
 */
export default function Ladder({ currentSlot = 0, distance = HEAD_START, caught = false }) {
  const clamp = (n) => Math.max(0, Math.min(RUNGS.length, n));
  const contestantRung = clamp(currentSlot);
  const chaserRung = clamp(currentSlot - distance + HEAD_START);

  return (
    <div className="pf-ladder" role="img" aria-label={`Contestant at level ${contestantRung} of ${RUNGS.length}, gap to Chaser ${distance}`}>
      <div className="pf-ladder-gap pf-mono">
        <span className="pf-ladder-gap-label">GAP</span>
        <span className={`pf-ladder-gap-value ${distance <= 1 ? 'critical' : ''}`}>{distance}</span>
      </div>

      <div className="pf-ladder-track">
        {[...RUNGS].reverse().map((label, i) => {
          const rungIndex = RUNGS.length - i; // top row = 6, bottom = 1
          const isContestantHere = rungIndex === contestantRung && contestantRung > 0;
          const isChaserHere = rungIndex === chaserRung && chaserRung > 0;
          const isCleared = rungIndex <= contestantRung && !caught;
          return (
            <div key={label} className={`pf-rung ${isCleared ? 'cleared' : ''}`}>
              <div className="pf-rung-markers">
                {isChaserHere && <span className="pf-marker chaser" title="Chaser">C</span>}
                {isContestantHere && <span className="pf-marker contestant" title="You">Y</span>}
              </div>
              <div className="pf-rung-label">{label}</div>
            </div>
          );
        })}
        <div className="pf-rung pf-rung-start">
          <div className="pf-rung-markers">
            {contestantRung === 0 && <span className="pf-marker contestant" title="You">Y</span>}
            {chaserRung === 0 && <span className="pf-marker chaser" title="Chaser">C</span>}
          </div>
          <div className="pf-rung-label muted">START</div>
        </div>
      </div>
    </div>
  );
}
