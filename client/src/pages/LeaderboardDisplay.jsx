import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import DisplayFrame from '../components/DisplayFrame';
import LeaderboardTable from '../components/LeaderboardTable';
import IdleVehicles from '../components/IdleVehicles';
import { useIdleVehicles } from '../hooks/useIdleVehicles';
import relocationChaseLogo from '../assets/relocation-chase-logo.png';
import './leaderboarddisplay.css';

// Served as a static file from client/public/media (not a JS import) - a
// ~17MB video has no business going through Vite's asset/JS bundling
// pipeline, it just needs a stable URL Vercel serves verbatim.
const FILLER_VIDEO_SRC = '/media/leaderboard-filler.mp4';

// Any of these counts as "someone's back at the screen" - deliberately
// broad (pointerdown covers mouse/touch/pen clicks and taps in one event,
// wheel/touchmove catch a scroll gesture that doesn't also fire a tap,
// keydown covers a remote/keyboard) rather than just 'click', since this
// is meant to get out of the way at the first sign of any interaction.
const DISMISS_EVENTS = ['pointerdown', 'wheel', 'touchmove', 'keydown'];

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

  const videoRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  function playVideo() {
    setVideoPlaying(true);
    const v = videoRef.current;
    if (v) {
      // Calling .play() here (inside the click handler itself, not after a
      // state update re-renders) keeps it inside the same user-gesture call
      // stack the browser's autoplay-with-sound policy requires - letting
      // the <video autoPlay> attribute do it on mount instead is not
      // reliably treated as "triggered by a gesture" and can get the audio
      // silently blocked.
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }

  function stopVideo() {
    setVideoPlaying(false);
    videoRef.current?.pause();
  }

  // Any click/tap/scroll/key anywhere on the screen while the video is up
  // ends it and drops back to the normal leaderboard.
  useEffect(() => {
    if (!videoPlaying) return undefined;
    DISMISS_EVENTS.forEach((evt) => window.addEventListener(evt, stopVideo, { capture: true }));
    return () => {
      DISMISS_EVENTS.forEach((evt) => window.removeEventListener(evt, stopVideo, { capture: true }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPlaying]);

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

        {!videoPlaying && (
          <button type="button" className="pf-ld-video-btn" onClick={playVideo} title="Play video" aria-label="Play filler video on loop">
            ▶
          </button>
        )}
        <video
          ref={videoRef}
          src={FILLER_VIDEO_SRC}
          className={`pf-ld-video-overlay ${videoPlaying ? 'visible' : ''}`}
          loop
          playsInline
          aria-hidden={!videoPlaying}
        />
      </div>
    </DisplayFrame>
  );
}
