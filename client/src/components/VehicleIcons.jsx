import truckLtrImg from '../assets/truck-pickfords-ltr.png';
import truckRtlImg from '../assets/truck-pickfords-rtl.png';
import planeLtrImg from '../assets/plane-pickfords-ltr.png';
import planeRtlImg from '../assets/plane-pickfords-rtl.png';
import shipLtrImg from '../assets/ship-pickfords-ltr.png';
import shipRtlImg from '../assets/ship-pickfords-rtl.png';

// Flat-icon vehicles for the idle-screen animation (see IdleVehicles.jsx).
// All three are real branded Pickfords artwork with "Pickfords" text
// painted on them - mirroring any of them in CSS would flip that text
// backward and make it unreadable, so each instead has two separate source
// images, one already drawn facing each way, and its Icon component picks
// between them by direction rather than ever applying a scaleX flip.

export function PlaneIcon({ className, direction }) {
  return <img src={direction === 'ltr' ? planeLtrImg : planeRtlImg} className={className} alt="" />;
}

export function TruckIcon({ className, direction }) {
  return <img src={direction === 'ltr' ? truckLtrImg : truckRtlImg} className={className} alt="" />;
}

export function ShipIcon({ className, direction }) {
  return <img src={direction === 'ltr' ? shipLtrImg : shipRtlImg} className={className} alt="" />;
}
