import { useLocation, useNavigate } from 'react-router-dom';
import './Navbar.css';

// Importar las imágenes de las runas personalizadas
import PerfilIcon from '../assets/navbar/Perfil.png';
import ShopIcon from '../assets/navbar/Shopminer.png';
import HomeIcon from '../assets/navbar/ArenaHome.png';
import CollectionIcon from '../assets/navbar/CollectioDeck.png';

const NAV_ITEMS = [
  { id: 'shop', path: '/shop', label: 'Tienda', icon: ShopIcon },
  { id: 'collection', path: '/collection', label: 'Mazo', icon: CollectionIcon },
  { id: 'home', path: '/home', label: 'Inicio', icon: HomeIcon },
  { id: 'profile', path: '/profile', label: 'Perfil', icon: PerfilIcon }
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.toLowerCase();
  if (currentPath === '/' || currentPath === '/battle') {
    return null;
  }

  // Calcular el índice del botón activo para mover la gema
  const activeIndex = NAV_ITEMS.findIndex(item => item.path === currentPath);

  return (
    <nav className="rn-navbar">
      <div className="rn-navbar-slab">
        {/* Gema deslizante (se mueve según el índice activo) */}
        <div 
          className="rn-sliding-gem"
          style={{ 
            transform: `translateX(calc(${activeIndex} * 100% + ${activeIndex * 4}px))` 
          }}
        />

        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.id}
              className={`rn-nav-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <img 
                src={item.icon} 
                alt={item.label}
                className="rn-nav-icon"
              />
              <span className="rn-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;