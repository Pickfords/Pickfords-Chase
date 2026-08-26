import './idlevehicles.css';

const EMOJI = { truck: '🚚', plane: '✈️', car: '🚗' };

// Renders whichever vehicle useIdleVehicles() currently has in flight (or
// nothing). A fresh `key` per vehicle (its id) forces the CSS animation to
// restart cleanly for each crossing.
export default function IdleVehicles({ vehicle }) {
  if (!vehicle) return null;
  return (
    <div key={vehicle.id} className={`pf-idle-vehicle pf-idle-${vehicle.type} pf-idle-${vehicle.direction}`} aria-hidden="true">
      {EMOJI[vehicle.type]}
    </div>
  );
}
