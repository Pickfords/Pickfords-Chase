import { useEffect, useState } from 'react';
import './displayframe.css';

/**
 * Wraps a big-screen /display/* page meant for a 55" TV mounted in
 * portrait. Content inside is authored assuming a tall, narrow box using
 * %/cqh/cqw units (see displayframe.css and the pages themselves) - this
 * component's only job is making sure that box is the right SHAPE no
 * matter how the physical screen is actually wired up:
 *
 * - If the OS/graphics driver already outputs true portrait resolution,
 *   leave rotation at 0 - the frame is just the normal viewport.
 * - If the screen is mechanically mounted sideways but the OS/browser
 *   still thinks it's landscape (common on kiosk hardware you can't
 *   reconfigure), the rotate button compensates entirely in CSS, no OS
 *   access needed - click it until the content reads upright.
 *
 * Rotation is remembered per screen (storageKey) in this browser's
 * localStorage, so a reload/relaunch on the same physical device keeps
 * whatever orientation was last set there.
 */
export default function DisplayFrame({ storageKey, children }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if ([0, 90, 180, 270].includes(saved)) setRotation(saved);
    } catch {
      // localStorage unavailable (private window, storage blocked) - fine, just defaults to 0
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(rotation));
    } catch {}
  }, [rotation, storageKey]);

  const swapped = rotation === 90 || rotation === 270;

  return (
    <div className="pf-display-viewport">
      <div
        className="pf-display-frame"
        style={{
          width: swapped ? '100vh' : '100vw',
          height: swapped ? '100vw' : '100vh',
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className="pf-rotate-btn"
        onClick={() => setRotation((r) => (r + 90) % 360)}
        title="Rotate screen 90°"
        aria-label="Rotate screen 90 degrees"
      >
        ⟳
      </button>
    </div>
  );
}
