import { PlaneIcon, TruckIcon, ShipIcon } from './VehicleIcons';
import './idlevehicles.css';

const ICONS = { truck: TruckIcon, plane: PlaneIcon, ship: ShipIcon };

// Renders whichever vehicle useIdleVehicles() currently has in flight (or
// nothing). A fresh `key` per vehicle (its id) forces the CSS animation to
// restart cleanly for each crossing. The plane/ship are drawn nose-first
// pointing right (see VehicleIcons.jsx) - .pf-idle-rtl mirrors them via CSS
// so the front always leads the direction of travel. The truck instead has
// a separate source image per direction (mirroring would flip its text),
// so its `direction` is passed through to TruckIcon to pick between them.
export default function IdleVehicles({ vehicle }) {
  if (!vehicle) return null;
  const Icon = ICONS[vehicle.type];
  return (
    <div key={vehicle.id} className={`pf-idle-vehicle pf-idle-${vehicle.type} pf-idle-${vehicle.direction}`} aria-hidden="true">
      <Icon className="pf-idle-icon" direction={vehicle.direction} />
    </div>
  );
}
