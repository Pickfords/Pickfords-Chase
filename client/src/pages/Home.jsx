import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="pf-shell">
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span>CHASER</span>
        </div>
      </div>
      <div className="pf-center-stage">
        <div className="pf-eyebrow">EXPAT ACADEMY EVENT</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, margin: 0, letterSpacing: '0.02em' }}>
          Which device is this?
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 280, marginTop: 8 }}>
          <Link to="/play/contestant" className="pf-btn pf-btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
            I'm the Contestant
          </Link>
          <Link to="/play/chaser" className="pf-btn pf-btn-danger" style={{ textAlign: 'center', textDecoration: 'none' }}>
            I'm the Chaser (Phil)
          </Link>
          <Link to="/admin" className="pf-btn pf-btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Admin / data capture (Chris)
          </Link>
        </div>
      </div>
    </div>
  );
}
