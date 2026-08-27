import './badgecard.css';
import winnerMascotImg from '../assets/mascot-winner.png';
import caughtMascotImg from '../assets/mascot-caught.jpg';

// 'incomplete' (running out of the 10-question reserve without escaping) is
// counted as 'caught' by the engine - the contestant didn't get away in
// time - so this only ever sees these two outcomes.
const COPY = {
  escaped: { stateClass: 'escaped', noBadgeText: 'NO TIER CLEARED', footer: 'Escaped the Chaser 🏆' },
  caught: {
    stateClass: 'caught',
    noBadgeText: (
      <>
        Time to do your <span className="pf-badgecard-gmpd">GMPD</span>!?!
      </>
    ),
    footer: 'Caught by the Chaser — worthy effort',
  },
};

export default function BadgeCard({ contestantName, outcome, finalBadge, score, correctCount, totalSlots = 6 }) {
  const copy = COPY[outcome] || COPY.caught;
  return (
    <div className="pf-badgecard-wrap">
      <div className={`pf-badgecard ${copy.stateClass}`}>
        <div className="pf-badgecard-eyebrow pf-mono">PICKFORDS GLOBAL MOBILITY CHASER</div>
        <div className="pf-badgecard-name">{contestantName}</div>
        {finalBadge ? (
          <div className="pf-badgecard-badge">{finalBadge}</div>
        ) : (
          <div className="pf-badgecard-badge muted">{copy.noBadgeText}</div>
        )}
        <div className="pf-badgecard-stats">
          <div>
            <span className="pf-badgecard-stat-value">{score.toFixed(0)}</span>
            <span className="pf-badgecard-stat-label pf-mono">POINTS</span>
          </div>
          <div>
            <span className="pf-badgecard-stat-value">
              {correctCount}/{totalSlots}
            </span>
            <span className="pf-badgecard-stat-label pf-mono">CORRECT</span>
          </div>
        </div>
        <div className="pf-badgecard-footer">{copy.footer}</div>
      </div>
      {outcome === 'escaped' && <img src={winnerMascotImg} alt="" aria-hidden="true" className="pf-badgecard-mascot" />}
      {outcome === 'caught' && <img src={caughtMascotImg} alt="" aria-hidden="true" className="pf-badgecard-mascot pf-badgecard-mascot-caught" />}
    </div>
  );
}
