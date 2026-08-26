import { useMemo } from 'react';
import './endeffects.css';

// Full-screen pulsing red overlay for the "caught" outcome - plays briefly
// before the display switches over to the BadgeCard result screen.
export function RedFlashOverlay() {
  return <div className="pf-end-flash" aria-hidden="true" />;
}

const CONFETTI_COLORS = ['#f0b84b', '#2c6fbf', '#2fa66a', '#d31027', '#ffffff'];

// Full-screen falling-confetti overlay for the "escaped" outcome - plays
// briefly before the display switches over to the BadgeCard result screen.
export function ConfettiOverlay({ count = 90 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 2.4 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: Math.round((Math.random() - 0.5) * 160),
      })),
    [count]
  );

  return (
    <div className="pf-end-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="pf-confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
