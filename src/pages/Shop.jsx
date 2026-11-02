import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, buyRock, claimDailyRock, getDailyRockStatus } from '../services/firestore';
import { ROCK_TYPES } from '../data/runes';
import RockMiner from '../components/RockMiner';
import './Shop.css';

// Importar las 12 imágenes de rocas
import Roca1 from '../assets/rocks/Roca1.png';
import Roca2 from '../assets/rocks/Roca2.png';
import Roca3 from '../assets/rocks/Roca3.png';
import RocaAzul1 from '../assets/rocks/RocaAzul1.png';
import RocaAzul2 from '../assets/rocks/RocaAzul2.png';
import RocaAzul3 from '../assets/rocks/RocaAzul3.png';
import RocaLila1 from '../assets/rocks/RocaLila1.png';
import RocaLila2 from '../assets/rocks/RocaLila2.png';
import RocaLila3 from '../assets/rocks/RocaLila3.png';
import RocaBlanca1 from '../assets/rocks/RocaBlanca1.png';
import RocaBlanca2 from '../assets/rocks/RocaBlanca2.png';
import RocaBlanca3 from '../assets/rocks/RocaBlanca3.png';

// ✅ Mapeo actualizado: 'daily' usa las marrones, 'normal' usa las blancas
const ROCK_IMAGES = {
  daily: [Roca1, Roca2, Roca3], 
  normal: [RocaBlanca1, RocaBlanca2, RocaBlanca3], 
  rare: [RocaAzul1, RocaAzul2, RocaAzul3],
  epic: [RocaLila1, RocaLila2, RocaLila3]
};

const Shop = () => {
  const { user } = useAuth();
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
        const { findFreePlayerCode } = await import('../services/firestore');
        const playerCode = await findFreePlayerCode();
        const initialProfile = {
          email: user.email,
          username: user.email ? user.email.split('@')[0] : 'Invocador',
          avatarId: 'arquero',
          playerCode: playerCode,
          userId: playerCode,
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
        // ✅ Usamos el tipo 'daily' para que el minero use las rocas marrones
        setActiveRock({ type: 'daily', label: 'Roca Diaria' });
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
          <span className="shop-spinner">️</span>
          <p>Abriendo la mina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-screen">
      <header className="shop-header">
        <div className="shop-header-title">
          <span className="shop-header-icon">⛏️</span>
          <div>
            <h1 className="shop-title">LA MINA</h1>
            <span className="shop-subtitle">Extrae runas de las rocas</span>
          </div>
        </div>

        <div className="shop-coins-pill">
          <span className="coins-icon">🪙</span>
          <span className="coins-value">{profile?.coins ?? 0}</span>
        </div>
      </header>

      {message && (
        <div className={`shop-banner ${messageType}`}>
          {message}
        </div>
      )}

      <main className="shop-content-scroll">
        <section className="shop-section">
          <div className="section-title-bar">
            <span className="section-title-txt">RECOMPENSA GRATIS</span>
            <span className="section-tag">DIARIA</span>
          </div>

          <div className={`daily-reward-card ${dailyStatus.available ? 'ready' : 'waiting'}`}>
            <div className="daily-reward-icon-box">
              <img src={Roca1} alt="Roca Diaria" className="daily-rock-img" />
              {dailyStatus.available && <div className="daily-glow-ring"></div>}
            </div>

            <div className="daily-reward-details">
              <h3 className="daily-reward-name">Roca Normal Diaria</h3>
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

        <section className="shop-section">
          <div className="section-title-bar">
            <span className="section-title-txt">YACIMIENTO DE ROCAS</span>
            <span className="section-tag">COMPRA</span>
          </div>

          <div className="rocks-row-container">
            {Object.values(ROCK_TYPES).map((rock) => {
              const canAfford = (profile?.coins || 0) >= rock.price;
              const rockImg = ROCK_IMAGES[rock.id]?.[0] || RocaBlanca1;

              return (
                <div key={rock.id} className="rock-item-card">
                  <div
                    className="rock-rarity-ribbon"
                    style={{ background: rock.color || '#00d4ff' }}
                  >
                    {rock.rarity}
                  </div>

                  <div className="rock-visual-box">
                    <img src={rockImg} alt={rock.name} className="rock-item-img" />
                  </div>

                  <h3 className="rock-item-name">{rock.name}</h3>

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