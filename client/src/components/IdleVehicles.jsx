import { PlaneIcon, TruckIcon, ShipIcon } from './VehicleIcons';
import './idlevehicles.css';

const ICONS = { truck: TruckIcon, plane: PlaneIcon, ship: ShipIcon };

// Renders whichever vehicle useIdleVehicles() currently has in flight (or
// nothing). A fresh `key` per vehicle (its id) forces the CSS animation to
// restart cleanly for each crossing. All three vehicles are real branded
// artwork with a separate source image per direction (see VehicleIcons.jsx)
// rather than a CSS scaleX mirror, which would flip their painted text
// backward - `direction` is passed through to each Icon to pick between them.
export default function IdleVehicles({ vehicle }) {
  if (!vehicle) return null;
  const Icon = ICONS[vehicle.type];
  return (
    <div key={vehicle.id} className={`pf-idle-vehicle pf-idle-${vehicle.type} pf-idle-${vehicle.direction}`} aria-hidden="true">
      <Icon className="pf-idle-icon" direction={vehicle.direction} />
    </div>
  );
}
