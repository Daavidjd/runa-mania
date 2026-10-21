import { useLocation, useNavigate } from 'react-router-dom';
import './Navbar.css';

const NAV_ITEMS = [
  { id: 'shop', path: '/shop', label: 'Tienda', icon: '⛏️', rune: 'ᚠ' },
  { id: 'collection', path: '/collection', label: 'Mazo', icon: '🃏', rune: 'ᚨ' },
  { id: 'home', path: '/home', label: 'Inicio', icon: '🏛️', rune: 'ᛟ' },
  { id: 'profile', path: '/profile', label: 'Perfil', icon: '👤', rune: 'ᚱ' }
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Ocultar en login ("/") y en combate ("/battle")
  const currentPath = location.pathname.toLowerCase();
  if (currentPath === '/' || currentPath === '/battle') {
    return null;
  }

  return (
    <nav className="rn-navbar">
      <div className="rn-navbar-slab">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.id}
              className={`rn-nav-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <span className="rn-nav-rune">{item.rune}</span>
              <span className="rn-nav-icon">{item.icon}</span>
              <span className="rn-nav-label">{item.label}</span>
              {isActive && <div className="rn-active-gem" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
