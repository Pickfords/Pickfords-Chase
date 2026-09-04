import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import DisplayFrame from '../components/DisplayFrame';
import LeaderboardTable from '../components/LeaderboardTable';
import IdleVehicles from '../components/IdleVehicles';
import { useIdleVehicles } from '../hooks/useIdleVehicles';
import relocationChaseLogo from '../assets/relocation-chase-logo.png';
import './leaderboarddisplay.css';

// Public, no-controls screen for a 55" portrait-mounted lobby/foyer screen -
// always shows the live leaderboard with no join code. Auto-follows
// whichever game is currently active purely to catch its 'gameOver'
// celebration; the leaderboard table itself updates from the global
// 'leaderboardUpdate' broadcast regardless of which game is live (see
// server/src/index.js).
export default function LeaderboardDisplay() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [celebration, setCelebration] = useState(null);
  // Bumped on every real update - the idle-vehicle animation watches this
  // and only plays after 10s with no change to it (see useIdleVehicles).
  const [activityTick, setActivityTick] = useState(0);
  const bump = () => setActivityTick((t) => t + 1);
  const vehicle = useIdleVehicles(activityTick);

  useEffect(() => {
    api.getLeaderboard(10).then(setLeaderboard).catch(() => {});
    api.getActiveGame().then(({ gameId }) => {
      if (gameId) socket.emit('joinGame', { gameId, role: 'display' }, () => {});
    });

    function onLeaderboardUpdate(rows) {
      bump();
      setLeaderboard(rows);
    }
    function onActiveGameChanged({ gameId }) {
      bump();
      socket.emit('joinGame', { gameId, role: 'display' }, () => {});
    }
    function onGameOver(summary) {
      bump();
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
    <DisplayFrame storageKey="pf_leaderboard_display_rotation">
      <div className="pf-shell">
        <IdleVehicles vehicle={vehicle} />
        <div className="pf-ld-topbar">
          <div className="pf-ld-wordmark">
            PICKFORDS <span className="pf-word-relo">RELO</span> <span className="pf-word-chaser">CHASER</span>{' '}
            <span className="pf-ld-wordmark-sub">· LEADERBOARD</span>
          </div>
        </div>
        <div className="pf-ld-body">
          {celebration && (
            <div className={`pf-card pf-ld-celebration ${celebration.outcome === 'escaped' ? 'escaped' : 'caught'}`}>
              {celebration.outcome === 'escaped' ? '🏆 ' : ''}
              {celebration.contestantName} {celebration.outcome === 'escaped' ? 'ESCAPED THE CHASER' : 'was caught'} — {celebration.score.toFixed(0)} pts
            </div>
          )}
          <img src={relocationChaseLogo} alt="The Relocation Chase" className="pf-ld-logo" />
          <div className="pf-ld-title">LEADERBOARD</div>
          <div className="pf-card pf-ld-table-wrap">
            <LeaderboardTable leaderboard={leaderboard} />
          </div>
        </div>
      </div>
    </DisplayFrame>
  );
}
