// Font sizes/padding are all relative (em) rather than fixed px, so this
// scales naturally with whatever font-size its container sets - a small
// fixed size on the admin's compact card, a big cqh-based size on the
// public /display/leaderboard screen (see LeaderboardDisplay.jsx).
export default function LeaderboardTable({ leaderboard, onVoid }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1em' }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontSize: '0.85em' }}>
          <th style={{ paddingBottom: '0.5em' }}>#</th>
          <th>Name</th>
          <th>Badge</th>
          <th>Score</th>
          <th>Time</th>
          {onVoid && <th />}
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((row, i) => (
          <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <td style={{ padding: '0.9em 0' }}>{i + 1}</td>
            <td>{row.contestant_name}</td>
            <td style={{ fontSize: '0.85em', color: 'var(--pf-gold-400)' }}>{row.final_badge || '—'}</td>
            <td>{Number(row.score).toFixed(0)}</td>
            <td className="pf-mono" style={{ fontSize: '0.85em' }}>
              {(row.cumulative_response_ms / 1000).toFixed(1)}s
            </td>
            {onVoid && (
              <td>
                <button className="pf-btn pf-btn-ghost" style={{ padding: '0.3em 0.6em', fontSize: '0.8em' }} onClick={() => onVoid(row.id)}>
                  Void
                </button>
              </td>
            )}
          </tr>
        ))}
        {leaderboard.length === 0 && (
          <tr>
            <td colSpan={onVoid ? 6 : 5} style={{ padding: '1em 0', color: 'rgba(255,255,255,0.4)' }}>
              No completed chases yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
