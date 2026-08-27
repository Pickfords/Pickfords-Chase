import { Link } from 'react-router-dom';
import mascotImg from '../assets/mascot.png';

export default function Home() {
  return (
    <div className="pf-shell">
      <div className="pf-topbar">
        <div className="pf-wordmark">
          PICKFORDS <span className="pf-word-relo">RELO</span> <span className="pf-word-chaser">CHASER</span>
        </div>
      </div>
      <div className="pf-center-stage">
        <div className="pf-eyebrow">EXPAT ACADEMY EVENT</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, margin: 0, letterSpacing: '0.02em' }}>
          Which device is this?
        </h1>
        <div style={{ position: 'relative', width: 280, marginTop: 8 }}>
          <img
            src={mascotImg}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', right: '100%', top: -52, width: 130, marginRight: 4, pointerEvents: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Link to="/play/contestant" className="pf-btn pf-btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              I'm the Contestant
            </Link>
            <Link to="/play/chaser" className="pf-btn pf-btn-danger" style={{ textAlign: 'center', textDecoration: 'none' }}>
              I'm the Chaser
            </Link>
            <Link to="/admin" className="pf-btn pf-btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Admin / data capture
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280, marginTop: 22 }}>
          <div className="pf-eyebrow">PUBLIC DISPLAYS</div>
          <Link to="/display/chaser" className="pf-btn pf-btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Chaser screen (big screen)
          </Link>
          <Link to="/display/leaderboard" className="pf-btn pf-btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Leaderboard (big screen)
          </Link>
        </div>
      </div>
    </div>
  );
}
