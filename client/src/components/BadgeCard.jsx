import './badgecard.css';

const COPY = {
  escaped: { stateClass: 'escaped', noBadgeText: 'NO TIER CLEARED', footer: 'Escaped the Chaser 🏆' },
  caught: { stateClass: 'caught', noBadgeText: 'CAUGHT BEFORE CLEARING A TIER', footer: 'Caught by the Chaser — worthy effort' },
  incomplete: {
    stateClass: 'incomplete',
    noBadgeText: 'NO TIER CLEARED',
    footer: "Ran out of questions — didn't escape in time",
  },
};

export default function BadgeCard({ contestantName, outcome, finalBadge, score, correctCount, totalSlots = 6 }) {
  const copy = COPY[outcome] || COPY.caught;
  return (
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
  );
}
