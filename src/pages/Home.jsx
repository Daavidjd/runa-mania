import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getDailyRockStatus } from '../services/firestore';
import './Home.css';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [dailyReady, setDailyReady] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadHomeData = async () => {
      try {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) setProfile(userProfile);

        const dailyStatus = await getDailyRockStatus(user.uid);
        if (dailyStatus?.available) setDailyReady(true);
      } catch (err) {
        console.error('Error cargando datos del home:', err);
      }
    };

    loadHomeData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="home-screen">
      {/* 1. HUD SUPERIOR: Perfil, Nivel, Monedas y Salir */}
      <header className="home-hud">
        <button 
          className="hud-profile-pill" 
          onClick={() => navigate('/profile')}
          title="Ver perfil"
        >
          <div className="hud-level-circle">
            <span>{profile?.level || 1}</span>
          </div>
          <div className="hud-player-meta">
            <span className="hud-name">
              {profile?.username || user?.displayName || user?.email?.split('@')[0] || 'Invocador'}
            </span>
            <span className="hud-id">ID: {profile?.userId || '----'}</span>
          </div>
        </button>

        <div className="hud-right-actions">
          <div className="hud-coins-pill" onClick={() => navigate('/shop')}>
            <span className="coin-icon">🪙</span>
            <span className="coin-amount">{profile?.coins ?? 100}</span>
            <span className="coin-add-badge">+</span>
          </div>

          <button 
            className="hud-logout-btn" 
            onClick={handleLogout} 
            title="Cerrar sesión"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. BANNER DE LA MINA / ROCA DIARIA */}
      <section className="home-banner-section">
        <button 
          className={`daily-portal-strip ${dailyReady ? 'active-ready' : ''}`}
          onClick={() => navigate('/shop')}
        >
          <div className="portal-icon-box">
            <span className="portal-emoji">🪨</span>
            {dailyReady && <span className="portal-ping"></span>}
          </div>
          <div className="portal-text">
            <span className="portal-title">Yacimiento Diario</span>
            <span className="portal-desc">
              {dailyReady ? '¡Roca lista para picar!' : 'Visita la tienda para extraer runas'}
            </span>
          </div>
          <span className="portal-arrow">IR →</span>
        </button>
      </section>

      {/* 3. ARENA CENTRAL: ALTAR DE COMBATE Y LANZADOR PRINCIPAL */}
      <main className="home-arena-stage">
        <div className="runic-arena-altar">
          {/* Runa y rango de la arena */}
          <div className="arena-rank-badge">
            <span className="rank-rune">ᛏ</span>
            <span className="rank-title">ARENA RUNA 1</span>
          </div>

          {/* Diorama del Monolito Mágico */}
          <div className="arena-monolith-view">
            <div className="monolith-pillar">
              <span className="monolith-glyph">ᚱ</span>
              <div className="monolith-aura"></div>
            </div>
            <p className="arena-mantra">«Despliega tus 5 runas en el tablero cósmico»</p>
          </div>

          {/* BOTÓN PROTAGONISTA DE BATALLA */}
          <button 
            className="huge-battle-cta" 
            onClick={() => navigate('/battle')}
          >
            <div className="cta-glare"></div>
            <div className="cta-main-content">
              <span className="cta-swords">⚔️</span>
              <span className="cta-txt">¡A LUCHAR!</span>
            </div>
            <span className="cta-sub">DUELO TÁCTICO CONTRA IA</span>
          </button>
        </div>

        {/* 4. ACCESOS RÁPIDOS SECUNDARIOS */}
        <div className="home-quick-actions">
          <button 
            className="quick-card deck-quick-card" 
            onClick={() => navigate('/collection')}
          >
            <div className="quick-icon-wrap">🎴</div>
            <div className="quick-info">
              <span className="quick-title">Mi Mazo</span>
              <span className="quick-sub">Organizar 5 runas</span>
            </div>
          </button>

          <button 
            className="quick-card pvp-quick-card disabled" 
            disabled 
            title="Próximamente"
          >
            <div className="quick-icon-wrap">ᛟ</div>
            <div className="quick-info">
              <span className="quick-title">PvP Online</span>
              <span className="quick-sub">Próximamente</span>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
