import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const MODES = [
  { rune: 'ᚱ', title: 'Colección de Runas', desc: 'Colecciona runas legendarias y crea tu mazo perfecto.', cta: 'Ver colección', path: '/collection', featured: true },
  { rune: 'ᚠ', title: 'Tienda', desc: 'Compra rocas con monedas o reclama tu roca diaria gratis.', cta: 'Ir a la tienda', path: '/shop' },
  { rune: 'ᛏ', title: 'Batalla vs IA', desc: 'Enfrenta tus runas contra la IA en combates por turnos.', cta: '¡A luchar!', path: '/battle' },
  { rune: 'ᛟ', title: 'Matchmaking', desc: 'Desafía a otros invocadores en batallas épicas.', cta: 'Próximamente', disabled: true },
];

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="home-wrapper">
      <nav className="game-navbar">
        <div className="nav-brand">
          <span className="brand-icon" aria-hidden="true">ᚱ</span>
          <span className="brand-text">Runa Mania</span>
        </div>
        <div className="nav-user">
          <button onClick={() => navigate('/profile')} className="nav-btn ghost">
            <span className="nav-avatar" aria-hidden="true">
              {(user?.displayName || user?.email || 'I').charAt(0).toUpperCase()}
            </span>
            <span className="nav-label">Perfil</span>
          </button>
          <button onClick={handleLogout} className="nav-btn outline">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="home-container">
        <header className="home-header">
          <p className="eyebrow">Runas del cielo</p>
          <h1 className="welcome-title">Bienvenido, Invocador</h1>
          <p className="subtitle">Domina las runas del cielo. Elige tu camino.</p>
        </header>

        <div className="game-grid">
          {MODES.map((m) => (
            <button
              key={m.title}
              type="button"
              className={`game-card${m.featured ? ' featured' : ''}`}
              onClick={() => !m.disabled && navigate(m.path)}
              disabled={m.disabled}
            >
              <span className="card-rune" aria-hidden="true">{m.rune}</span>
              <div className="card-body">
                <h2 className="card-title">{m.title}</h2>
                <p className="card-description">{m.desc}</p>
              </div>
              <span className={`card-cta${m.disabled ? ' muted' : ''}`}>
                {m.cta}
                {!m.disabled && <span className="arrow" aria-hidden="true">→</span>}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;