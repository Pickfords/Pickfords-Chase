import truckLtrImg from '../assets/truck-pickfords-ltr.png';
import truckRtlImg from '../assets/truck-pickfords-rtl.png';
import planeLtrImg from '../assets/plane-pickfords-ltr.png';
import planeRtlImg from '../assets/plane-pickfords-rtl.png';

// Flat-icon vehicles for the idle-screen animation (see IdleVehicles.jsx).
// The ship is a plain drawn icon pointing RIGHT (positive x) by default -
// IdleVehicles flips it with scaleX(-1) for right-to-left travel, so the
// front always leads the direction of motion instead of an ambiguous emoji
// glyph that can end up looking like it's flying/sailing sideways.
//
// The truck and plane are real branded Pickfords artwork with "Pickfords"
// text painted on them - mirroring either in CSS would flip that text
// backward and make it unreadable, so both instead have two separate
// source images, one already drawn facing each way, and their Icon
// components pick between them by direction rather than ever applying a
// scaleX flip.

export function PlaneIcon({ className, direction }) {
  return <img src={direction === 'ltr' ? planeLtrImg : planeRtlImg} className={className} alt="" />;
}

export function TruckIcon({ className, direction }) {
  return <img src={direction === 'ltr' ? truckLtrImg : truckRtlImg} className={className} alt="" />;
}

export function ShipIcon({ className }) {
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 40 L88 40 Q97 40 92 48 L84 54 L16 54 Q8 54 8 47 Z" fill="#7fc9d9" />
      <rect x="16" y="24" width="18" height="16" fill="#f0a94b" />
      <rect x="36" y="24" width="18" height="16" fill="#f6c98a" />
      <rect x="58" y="15" width="22" height="25" rx="2" fill="#3a6ea5" />
      <rect x="62" y="20" width="6" height="6" fill="#d8ecff" />
      <rect x="72" y="20" width="6" height="6" fill="#d8ecff" />
      <rect x="68" y="6" width="7" height="11" fill="#3a6ea5" />
      <path d="M68 5 q2 -5 4 0" stroke="#bcdff0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M73 3 q2 -5 4 0" stroke="#bcdff0" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
