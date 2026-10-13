import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import DisplayFrame from '../components/DisplayFrame';
import LeaderboardTable from '../components/LeaderboardTable';
import IdleVehicles from '../components/IdleVehicles';
import { useIdleVehicles } from '../hooks/useIdleVehicles';
import relocationChaseLogo from '../assets/relocation-chase-logo.png';
import './leaderboarddisplay.css';

// Served as static files from client/public/media (not JS imports) - these
// clips (17MB/86MB) have no business going through Vite's asset/JS
// bundling pipeline, they just need a stable URL Vercel serves verbatim.
// Keyed 1/2 to match the on-screen selector button.
const FILLER_VIDEOS = {
  1: '/media/leaderboard-filler-1.mp4',
  2: '/media/leaderboard-filler-2.mp4',
};

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
  const [selectedVideo, setSelectedVideo] = useState(1);

  function toggleSelectedVideo() {
    setSelectedVideo((n) => (n === 1 ? 2 : 1));
  }

  // Switching the selector mid-playback should actually switch what's on
  // screen, not just queue it up for next time - reload the (new) src and,
  // if it was already playing, keep playing. Also fires once harmlessly on
  // mount (videoPlaying is false then, so the .play() branch is skipped).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (videoPlaying) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo]);

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
          <div className="pf-ld-video-controls">
            <button type="button" className="pf-ld-video-btn" onClick={playVideo} title="Play video" aria-label="Play filler video on loop">
              ▶
            </button>
            <button
              type="button"
              className="pf-ld-video-select-btn"
              onClick={toggleSelectedVideo}
              title="Switch which video plays"
              aria-label={`Video ${selectedVideo} selected - tap to switch`}
            >
              {selectedVideo}
            </button>
          </div>
        )}
        <video
          ref={videoRef}
          src={FILLER_VIDEOS[selectedVideo]}
          className={`pf-ld-video-overlay ${videoPlaying ? 'visible' : ''}`}
          loop
          playsInline
          aria-hidden={!videoPlaying}
        />
      </div>
    </DisplayFrame>
  );
}
