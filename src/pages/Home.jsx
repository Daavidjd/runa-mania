import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home_v3.css';

const MODES = [
  { key: 'collection', rune: 'ᚱ', tag: 'Modo principal', title: 'Colección', desc: 'Reúne runas legendarias y forja el mazo definitivo.', cta: 'Abrir colección', path: '/collection', color: 'gold' },
  { key: 'shop', rune: 'ᚠ', tag: 'Recompensa diaria', title: 'Tienda', desc: 'Abre rocas rúnicas y reclama tu recompensa gratis.', cta: 'Entrar', path: '/shop', color: 'emerald' },
  { key: 'battle', rune: 'ᛏ', tag: 'PvE', title: 'Batalla vs IA', desc: 'Combates por turnos contra guardianes ancestrales.', cta: 'Luchar', path: '/battle', color: 'crimson' },
  { key: 'ranked', rune: 'ᛟ', tag: 'PvP', title: 'Clasificatoria', desc: 'Enfréntate a otros invocadores y escala de liga.', cta: 'Próximamente', disabled: true, color: 'violet' },
];

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.displayName || user?.email?.split('@')[0] || 'Invocador';

  const handleLogout = async () => {
    try { await logout(); navigate('/'); }
    catch (e) { console.error('Error al cerrar sesión:', e); }
  };

  return (
    <div className="rm">
      <div className="rm-bg" aria-hidden="true" />

      <nav className="rm-nav">
        <div className="rm-brand">
          <span className="rm-brand-sigil">ᚱ</span>
          <span className="rm-brand-name">RUNA<b>MANIA</b></span>
        </div>

        <div className="rm-resources">
          <span className="rm-res"><i className="coin" />1.250</span>
          <span className="rm-res"><i className="gem" />40</span>
        </div>

        <div className="rm-user">
          <button className="rm-profile" onClick={() => navigate('/profile')}>
            <span className="rm-avatar">{name.charAt(0).toUpperCase()}</span>
            <span className="rm-profile-info">
              <strong>{name}</strong>
              <small>Nivel 12</small>
            </span>
          </button>
          <button className="rm-icon-btn" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">⏻</button>
        </div>
      </nav>

      <main className="rm-main">
        <section className="rm-hero">
          <div className="rm-hero-text">
            <span className="rm-badge">Temporada I · Runas del Cielo</span>
            <h1>Despierta el poder<br /><span>de las runas</span></h1>
            <p>Bienvenido de nuevo, {name}. Tu próxima batalla te espera.</p>
            <div className="rm-hero-actions">
              <button className="rm-btn primary" onClick={() => navigate('/battle')}>▶ Jugar ahora</button>
              <button className="rm-btn secondary" onClick={() => navigate('/collection')}>Ver mazo</button>
            </div>
          </div>
          <div className="rm-hero-art" aria-hidden="true">
            <div className="rm-orb"><span>ᛟ</span></div>
            <div className="rm-ring r1" /><div className="rm-ring r2" />
          </div>
          <div className="rm-season">
            <div className="rm-season-head"><span>Pase de temporada</span><b>Nv. 7 / 30</b></div>
            <div className="rm-bar"><div style={{ width: '23%' }} /></div>
          </div>
        </section>

        <h2 className="rm-section-title">Modos de juego</h2>
        <div className="rm-grid">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`rm-card c-${m.color}${m.disabled ? ' locked' : ''}`}
              onClick={() => !m.disabled && navigate(m.path)}
              disabled={m.disabled}
            >
              <div className="rm-card-art"><span>{m.rune}</span></div>
              <div className="rm-card-body">
                <span className="rm-card-tag">{m.tag}</span>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
                <span className="rm-card-cta">{m.disabled ? '🔒 ' : ''}{m.cta}{!m.disabled && ' →'}</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;