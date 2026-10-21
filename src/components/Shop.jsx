import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getUserProfile, buyRock, claimDailyRock, getDailyRockStatus } from '../services/firestore';
import { ROCK_TYPES } from '../data/runes';
import RockMiner from './RockMiner';
import './Shop.css';

const Shop = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeRock, setActiveRock] = useState(null);
  const [dailyStatus, setDailyStatus] = useState({ available: true });
  const [countdown, setCountdown] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProfile();
      checkDailyStatus();
    }
  }, [user]);

  useEffect(() => {
    if (dailyStatus.available === false && dailyStatus.remaining) {
      const startTime = Date.now();
      const initialRemaining = dailyStatus.remaining;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = initialRemaining - elapsed;

        if (remaining <= 0) {
          setDailyStatus({ available: true });
          setCountdown('');
          clearInterval(interval);
        } else {
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [dailyStatus]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const userProfile = await getUserProfile(user.uid);
      if (userProfile) {
        setProfile(userProfile);
      } else {
        const initialProfile = {
          email: user.email,
          username: user.email.split('@')[0],
          avatarId: 'arquero',
          userId: user.uid.substring(0, 8).toUpperCase(),
          coins: 100,
          level: 1,
          xp: 0,
          createdAt: new Date().toISOString()
        };
        const { createUserProfile } = await import('../services/firestore');
        await createUserProfile(user.uid, initialProfile);
        setProfile(initialProfile);
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      showMessage('Error al cargar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkDailyStatus = async () => {
    if (!user) return;
    try {
      const status = await getDailyRockStatus(user.uid);
      setDailyStatus(status);
    } catch (error) {
      console.error('Error verificando roca diaria:', error);
    }
  };

  const handleBuyRock = async (rockType) => {
    const rock = ROCK_TYPES[rockType];
    if (!profile || profile.coins < rock.price) {
      showMessage('No tienes suficientes monedas', 'error');
      return;
    }

    try {
      const result = await buyRock(user.uid, rockType, rock.price);
      if (result.success) {
        await loadProfile();
        setActiveRock({ type: rockType, label: rock.name });
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      console.error('Error comprando roca:', error);
      showMessage('Error al comprar la roca', 'error');
    }
  };

  const handleClaimDaily = async () => {
    if (!dailyStatus.available) return;

    try {
      const result = await claimDailyRock(user.uid);
      if (result.success) {
        await checkDailyStatus();
        setActiveRock({ type: 'normal', label: 'Roca Diaria' });
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      console.error('Error reclamando roca diaria:', error);
    }
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRockMinerClose = () => {
    setActiveRock(null);
    loadProfile();
  };

  if (loading) {
    return (
      <div className="shop-screen">
        <div className="shop-loading-card">
          <span className="shop-spinner">⛏️</span>
          <p>Abriendo la mina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-screen">
      {/* 1. HUD SUPERIOR DE LA TIENDA */}
      <header className="shop-header">
        <div className="shop-header-title">
          <span className="shop-header-icon">⛏️</span>
          <div>
            <h1 className="shop-title">LA MINA</h1>
            <span className="shop-subtitle">Pica rocas y extrae runas</span>
          </div>
        </div>

        <div className="shop-coins-pill">
          <span className="coins-icon">🪙</span>
          <span className="coins-value">{profile?.coins ?? 0}</span>
        </div>
      </header>

      {/* MENSAJE DE ESTADO / ERROR */}
      {message && (
        <div className={`shop-banner ${messageType}`}>
          {message}
        </div>
      )}

      <main className="shop-content-scroll">
        {/* 2. RECOMPENSA DIARIA (ESTILO COFRE DIARIO) */}
        <section className="shop-section">
          <div className="section-title-bar">
            <span className="section-title-txt">RECOMPENSA GRATIS</span>
            <span className="section-tag">DIARIA</span>
          </div>

          <div className={`daily-reward-card ${dailyStatus.available ? 'ready' : 'waiting'}`}>
            <div className="daily-reward-icon-box">
              <span className="daily-rock-emoji">🪨</span>
              {dailyStatus.available && <div className="daily-glow-ring"></div>}
            </div>

            <div className="daily-reward-details">
              <h3 className="daily-reward-name">Roca Normal Gratuita</h3>
              <p className="daily-reward-desc">
                {dailyStatus.available
                  ? '¡Lista para extraer! Golpea 3 veces.'
                  : `Disponible en ${countdown || 'espera...'}`}
              </p>
            </div>

            <button
              className={`daily-claim-btn ${dailyStatus.available ? 'claimable' : 'disabled'}`}
              onClick={handleClaimDaily}
              disabled={!dailyStatus.available}
            >
              {dailyStatus.available ? '¡Picar!' : 'Espera'}
            </button>
          </div>
        </section>

        {/* 3. CATÁLOGO DE ROCAS DE MINERÍA */}
        <section className="shop-section">
          <div className="section-title-bar">
            <span className="section-title-txt">YACIMIENTO DE ROCAS</span>
            <span className="section-tag">MINERALES</span>
          </div>

          <div className="rocks-grid-container">
            {Object.values(ROCK_TYPES).map(rock => {
              const canAfford = (profile?.coins || 0) >= rock.price;

              return (
                <div key={rock.id} className="rock-item-card">
                  <div className="rock-rarity-ribbon" style={{ background: rock.color }}>
                    {rock.rarity}
                  </div>

                  <div className="rock-visual-box">
                    <span className="rock-emoji-art">{rock.icon}</span>
                  </div>

                  <h3 className="rock-item-name">{rock.name}</h3>
                  <p className="rock-item-desc">{rock.description}</p>

                  <button
                    className={`rock-buy-btn ${canAfford ? 'affordable' : 'unaffordable'}`}
                    onClick={() => handleBuyRock(rock.id)}
                    disabled={!canAfford}
                  >
                    <span className="buy-coin-icon">🪙</span>
                    <span className="buy-price">{rock.price}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 4. NAVEGACIÓN INFERIOR COMPARTIDA */}
      <nav className="shop-bottom-bar">
        <button className="bottom-nav-btn active">
          <span className="bottom-nav-icon">⛏️</span>
          <span className="bottom-nav-text">Tienda</span>
        </button>

        <button className="bottom-nav-btn" onClick={() => navigate('/collection')}>
          <span className="bottom-nav-icon">🎴</span>
          <span className="bottom-nav-text">Mazo</span>
        </button>

        <button className="bottom-nav-btn battle-highlight" onClick={() => navigate('/battle')}>
          <span className="bottom-nav-icon">⚔️</span>
          <span className="bottom-nav-text">Batalla</span>
        </button>

        <button className="bottom-nav-btn" onClick={() => navigate('/home')}>
          <span className="bottom-nav-icon">🏠</span>
          <span className="bottom-nav-text">Inicio</span>
        </button>
      </nav>

      {/* MINIJUEGO DE PICAR ROCAS */}
      {activeRock && (
        <RockMiner
          onClose={handleRockMinerClose}
          rockType={activeRock.type}
          rockLabel={activeRock.label}
        />
      )}
    </div>
  );
};

export default Shop;
