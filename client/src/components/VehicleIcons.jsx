// Flat-icon vehicles for the idle-screen animation (see IdleVehicles.jsx).
// Each is drawn nose/front-first pointing RIGHT (positive x) by default -
// IdleVehicles flips them with scaleX(-1) for right-to-left travel, so the
// front always leads the direction of motion instead of an ambiguous emoji
// glyph that can end up looking like it's flying/driving sideways.

export function PlaneIcon({ className }) {
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M33 41 L70 31 L73 37 L38 47 Z" fill="#4a8bdb" />
      <path d="M14 22 L31 26 L29 32 L13 30 Z" fill="#4a8bdb" />
      <path
        d="M10 32 Q10 25 21 25 L74 28 Q96 29 96 32 Q96 35 74 36 L21 39 Q10 39 10 32 Z"
        fill="#7fc1e8"
      />
      <circle cx="34" cy="32" r="2.2" fill="#e8f3ff" />
      <circle cx="45" cy="32" r="2.2" fill="#e8f3ff" />
      <circle cx="56" cy="32" r="2.2" fill="#e8f3ff" />
      <circle cx="67" cy="32" r="2.2" fill="#e8f3ff" />
    </svg>
  );
}

export function TruckIcon({ className }) {
  return (
    <svg viewBox="0 0 100 60" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="13" width="56" height="29" rx="4" fill="#233055" />
      <rect x="12" y="19" width="16" height="10" rx="1.5" fill="#3a6ea5" />
      <rect x="32" y="19" width="16" height="10" rx="1.5" fill="#4a8bdb" />
      <path d="M63 21 L83 21 Q89 21 91 27 L93 38 L63 38 Z" fill="#f0b84b" />
      <path d="M67 24 L80 24 Q84 24 85 28 L86 33 L67 33 Z" fill="#eaf3ff" />
      <rect x="6" y="40" width="88" height="4" fill="#d9822a" />
      <circle cx="24" cy="49" r="8" fill="#171e33" />
      <circle cx="24" cy="49" r="3.4" fill="#f0b84b" />
      <circle cx="80" cy="49" r="8" fill="#171e33" />
      <circle cx="80" cy="49" r="3.4" fill="#f0b84b" />
    </svg>
  );
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
