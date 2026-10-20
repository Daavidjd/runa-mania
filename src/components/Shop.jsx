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
        // Crear perfil inicial si no existe
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
      showMessage('Error al cargar el perfil', 'error');
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
      <div className="shop-container">
        <div className="shop-loading">
          <div className="loading-spinner"></div>
          <p>Cargando tienda...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="shop-container">
        <div className="shop-error">
          <p>No se pudo cargar el perfil</p>
          <button onClick={() => navigate('/home')} className="back-btn">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-container">
      <button className="back-btn" onClick={() => navigate('/home')}>
        ← Volver
      </button>

      <div className="shop-header">
        <h1>Tienda de Runas</h1>
        <div className="coins-display">
          <span className="coin-icon">🪙</span>
          <span className="coin-amount">{profile.coins || 0}</span>
        </div>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      {/* Roca Diaria */}
      <div className="daily-section">
        <h2> Roca Diaria Gratis</h2>
        <div className={`daily-card ${dailyStatus.available ? 'available' : 'locked'}`}>
          <div className="daily-icon">🪨</div>
          <div className="daily-info">
            <h3>Roca Normal Gratis</h3>
            <p>
              {dailyStatus.available 
                ? '¡Disponible ahora!' 
                : `Disponible en ${countdown}`}
            </p>
          </div>
          <button 
            className={`daily-btn ${dailyStatus.available ? 'claimable' : 'disabled'}`}
            onClick={handleClaimDaily}
            disabled={!dailyStatus.available}
          >
            {dailyStatus.available ? 'Reclamar' : 'Esperar'}
          </button>
        </div>
      </div>

      {/* Tienda de Rocas */}
      <div className="shop-section">
        <h2>🛒 Comprar Rocas</h2>
        <div className="rocks-grid">
          {Object.values(ROCK_TYPES).map(rock => (
            <div 
              key={rock.id} 
              className={`rock-card rock-${rock.id}`}
              style={{ borderColor: rock.color }}
            >
              <div className="rock-rarity-badge" style={{ background: rock.color }}>
                {rock.rarity}
              </div>
              <div className="rock-icon" style={{ color: rock.color }}>
                {rock.icon}
              </div>
              <h3 className="rock-name">{rock.name}</h3>
              <p className="rock-description">{rock.description}</p>
              <div className="rock-price">
                <span className="coin-icon">🪙</span>
                <span>{rock.price}</span>
              </div>
              <button 
                className="buy-btn"
                onClick={() => handleBuyRock(rock.id)}
                disabled={profile.coins < rock.price}
                style={{ 
                  background: profile.coins >= rock.price ? rock.color : '#555'
                }}
              >
                {profile.coins >= rock.price ? 'Comprar' : 'Sin monedas'}
              </button>
            </div>
          ))}
        </div>
      </div>

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