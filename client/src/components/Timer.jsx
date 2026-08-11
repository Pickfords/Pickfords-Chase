import { useEffect, useRef, useState } from 'react';
import { serverNow } from '../lib/socket';
import './timer.css';

/**
 * Renders a countdown ring driven by SERVER time (see lib/socket.js
 * syncClock), not the device's own clock - two tablets with slightly
 * different system clocks must still show the same countdown.
 *
 * When `locked` becomes true, the ring fades and "LOCKED IN" appears,
 * per the brief's exact sequencing.
 */
export default function Timer({ serverStartTs, timeLimitMs, locked, timedOut }) {
  const [remainingMs, setRemainingMs] = useState(timeLimitMs);
  const rafRef = useRef();

  useEffect(() => {
    if (locked) return undefined;
    function tick() {
      const elapsed = serverNow() - serverStartTs;
      const remaining = Math.max(0, timeLimitMs - elapsed);
      setRemainingMs(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [serverStartTs, timeLimitMs, locked]);

  const seconds = remainingMs / 1000;
  const fraction = Math.max(0, Math.min(1, remainingMs / timeLimitMs));
  const urgency = seconds <= 3 ? 'urgent' : seconds <= 6 ? 'warn' : 'calm';

  const size = 148;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className={`pf-timer ${locked ? 'locked' : ''}`}>
      {!locked && (
        <svg width={size} height={size} className={`pf-timer-ring ${urgency}`}>
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="pf-timer-track" fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="pf-timer-progress"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      )}
      <div className="pf-timer-label">
        {locked ? (
          <span className="pf-timer-locked pf-mono">{timedOut ? "TIME'S UP" : 'LOCKED IN'}</span>
        ) : (
          <span className="pf-timer-seconds pf-mono">{seconds.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
}
