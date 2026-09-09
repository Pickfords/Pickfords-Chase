import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './holdtohomebutton.css';

const HOLD_MS = 3000;

// Always-visible escape hatch on the contestant/Chaser tablets - touch and
// hold for 3s to bail out to the home page from ANY point in the game
// (mid-question, waiting, game-over, wherever), not just the explicit
// "Back to home" button that only appears once a game has actually ended.
// Requires a deliberate hold (not a tap) so it can't be triggered by an
// accidental brush against the corner of the screen during play.
export default function HoldToHomeButton() {
  const navigate = useNavigate();
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef(null);

  const start = useCallback(() => {
    setHolding(true);
    timeoutRef.current = setTimeout(() => navigate('/'), HOLD_MS);
  }, [navigate]);

  const cancel = useCallback(() => {
    setHolding(false);
    clearTimeout(timeoutRef.current);
  }, []);

  return (
    <button
      type="button"
      className="pf-hold-home"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      title="Hold for 3s to return to the home page"
      aria-label="Hold for 3 seconds to return to the home page"
    >
      <svg viewBox="0 0 36 36" className="pf-hold-home-ring">
        <circle cx="18" cy="18" r="15.5" className="pf-hold-home-ring-track" />
        <circle cx="18" cy="18" r="15.5" className={`pf-hold-home-ring-fill ${holding ? 'filling' : ''}`} />
      </svg>
      <span className="pf-hold-home-icon">⟳</span>
    </button>
  );
}
