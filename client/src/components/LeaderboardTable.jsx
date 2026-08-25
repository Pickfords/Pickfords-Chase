export default function LeaderboardTable({ leaderboard, onVoid }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          <th>#</th>
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
            <td style={{ padding: '8px 0' }}>{i + 1}</td>
            <td>{row.contestant_name}</td>
            <td style={{ fontSize: 12, color: 'var(--pf-gold-400)' }}>{row.final_badge || '—'}</td>
            <td>{Number(row.score).toFixed(0)}</td>
            <td className="pf-mono" style={{ fontSize: 12 }}>
              {(row.cumulative_response_ms / 1000).toFixed(1)}s
            </td>
            {onVoid && (
              <td>
                <button className="pf-btn pf-btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onVoid(row.id)}>
                  Void
                </button>
              </td>
            )}
          </tr>
        ))}
        {leaderboard.length === 0 && (
          <tr>
            <td colSpan={onVoid ? 6 : 5} style={{ padding: '14px 0', color: 'rgba(255,255,255,0.4)' }}>
              No completed chases yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
