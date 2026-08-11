import './badgecard.css';

export default function BadgeCard({ contestantName, outcome, finalBadge, score, correctCount, totalSlots = 6 }) {
  const escaped = outcome === 'escaped';
  return (
    <div className={`pf-badgecard ${escaped ? 'escaped' : 'caught'}`}>
      <div className="pf-badgecard-eyebrow pf-mono">PICKFORDS GLOBAL MOBILITY CHASER</div>
      <div className="pf-badgecard-name">{contestantName}</div>
      {finalBadge ? (
        <div className="pf-badgecard-badge">{finalBadge}</div>
      ) : (
        <div className="pf-badgecard-badge muted">CAUGHT ON QUESTION 1</div>
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
      <div className="pf-badgecard-footer">
        {escaped ? 'Escaped the Chaser 🏆' : 'Caught by the Chaser — worthy effort'}
      </div>
    </div>
  );
}
