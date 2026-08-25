import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import LeaderboardTable from '../components/LeaderboardTable';

// Public, no-controls screen for a lobby/foyer iPad or TV - always shows the
// live leaderboard with no join code. Auto-follows whichever game is
// currently active purely to catch its 'gameOver' celebration; the
// leaderboard table itself updates from the global 'leaderboardUpdate'
// broadcast regardless of which game is live (see server/src/index.js).
export default function LeaderboardDisplay() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null);

  useEffect(() => {
    api.getLeaderboard(10).then(setLeaderboard).catch(() => {});
    api.getActiveGame().then(({ gameId }) => {
      if (gameId) {
        setActiveGameId(gameId);
        socket.emit('joinGame', { gameId, role: 'display' }, () => {});
      }
    });

    function onLeaderboardUpdate(rows) {
      setLeaderboard(rows);
    }
    function onActiveGameChanged({ gameId }) {
      setActiveGameId(gameId);
      socket.emit('joinGame', { gameId, role: 'display' }, () => {});
    }
    function onGameOver(summary) {
      setCelebration(summary);
      setTimeout(() => setCelebration(null), 12000);
    }
    socket.on('leaderboardUpdate', onLeaderboardUpdate);
    socket.on('activeGameChanged', onActiveGameChanged);
    socket.on('gameOver', onGameOver);
    return () => {
      socket.off('leaderboardUpdate', onLeaderboardUpdate);
      socket.off('activeGameChanged', onActiveGameChanged);
      socket.off('gameOver', onGameOver);
    };
  }, []);

  return (
    <div className="pf-shell">
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span>CHASER</span> <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>· LEADERBOARD</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: '32px 48px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {celebration && (
          <div
            className="pf-card"
            style={{
              marginBottom: 24,
              textAlign: 'center',
              borderColor: celebration.outcome === 'escaped' ? 'var(--pf-gold-400)' : 'var(--pf-red-600)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
              {celebration.outcome === 'escaped' ? '🏆 ' : ''}
              {celebration.contestantName} {celebration.outcome === 'escaped' ? 'ESCAPED THE CHASER' : 'was caught'} — {celebration.score.toFixed(0)}{' '}
              pts
            </div>
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, marginBottom: 20, textAlign: 'center' }}>LEADERBOARD</div>
        <div className="pf-card">
          <LeaderboardTable leaderboard={leaderboard} />
        </div>
      </div>
    </div>
  );
}
