import { useEffect, useRef, useState } from 'react';

const IDLE_MS = 10_000;
const VEHICLE_TYPES = ['truck', 'plane', 'ship'];
// How long each vehicle takes to cross the screen - the truck is "heavy" so
// it's slow, the plane and ship move at a normal clip (see idlevehicles.css
// for the matching animation durations - keep these in sync).
const DURATION_MS = { truck: 18_000, plane: 9_000, ship: 12_000 };

/**
 * Sends a truck, plane, or ship drifting across the screen after 10s with
 * no activity (see `resetSignal` below), to keep an otherwise-static big
 * screen feeling alive between questions/games. Cycles through the three
 * types. Any change to `resetSignal` counts as activity - it cancels a
 * vehicle mid-flight and restarts the 10s countdown, so the animation only
 * ever plays while the screen has genuinely gone quiet.
 */
export function useIdleVehicles(resetSignal) {
  const [vehicle, setVehicle] = useState(null); // { id, type, direction } | null
  const idleTimer = useRef(null);
  const flightTimer = useRef(null);
  const cycleIndex = useRef(0);
  const lastDirection = useRef('rtl');

  useEffect(() => {
    function scheduleIdle() {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(spawn, IDLE_MS);
    }

    function spawn() {
      const type = VEHICLE_TYPES[cycleIndex.current % VEHICLE_TYPES.length];
      cycleIndex.current += 1;
      const direction = lastDirection.current === 'ltr' ? 'rtl' : 'ltr';
      lastDirection.current = direction;
      setVehicle({ id: Date.now(), type, direction });
      clearTimeout(flightTimer.current);
      flightTimer.current = setTimeout(() => {
        setVehicle(null);
        scheduleIdle(); // still idle - queue the next one
      }, DURATION_MS[type] + 300);
    }

    // Real activity happened - cancel anything in flight and restart the wait.
    setVehicle(null);
    clearTimeout(flightTimer.current);
    scheduleIdle();

    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(flightTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  return vehicle;
}
