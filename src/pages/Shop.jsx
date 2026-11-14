import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, buyRock, claimDailyRock, getDailyRockStatus, buyPickaxe } from '../services/firestore';
import { ROCK_TYPES } from '../data/runes';
import RockMiner from '../components/RockMiner';
import PicoHierro from '../assets/pico/PicoHierro.png';
import PicoOro from '../assets/pico/PicoOro.png';
import PicoDiamante from '../assets/pico/PicoDiamante.png';
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

const PICKAXES = [
 { id:'iron',name:'Pico de hierro',price:500,rockType:'normal',image:PicoHierro,rarity:'Normal',color:'#90a4ae' },
 { id:'gold',name:'Pico de oro',price:800,rockType:'rare',image:PicoOro,rarity:'Rara',color:'#eab308' },
 { id:'diamond',name:'Pico de diamante',price:1000,rockType:'epic',image:PicoDiamante,rarity:'Épica',color:'#38bdf8' }
];

const Shop = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activeRock, setActiveRock] = useState(null);
  const [dailyStatus, setDailyStatus] = useState({ available: false, loading: true });
  const [countdown, setCountdown] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);

  useEffect(() => {
    if (user) {
      const initializeShop = async () => {
        await loadProfile();
        await checkDailyStatus();
      };
      initializeShop();
    }
  }, [user]);

  useEffect(() => {
    if (dailyStatus.available === false && dailyStatus.remaining > 0) {
      const deadline = Date.now() + dailyStatus.remaining;

      const updateCountdown = () => {
        const remaining = Math.max(0, deadline - Date.now());
        if (remaining === 0) {
          setCountdown('');
          setDailyStatus({ available: true });
          return;
        }
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') updateCountdown();
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
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
          coins: 1000,
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
      if (status.error) showMessage(status.error, 'error');
    } catch (error) {
      console.error('Error verificando roca diaria:', error);
      setDailyStatus({ available: false, error: 'No se pudo comprobar la recompensa diaria' });
      showMessage('No se pudo comprobar la recompensa diaria', 'error');
    }
  };

  const handleBuyRock = async (rockType) => {
    if (purchaseBusy) return;
    const rock = ROCK_TYPES[rockType];
    if (!profile || profile.coins < rock.price) {
      showMessage('No tienes suficientes monedas', 'error');
      return;
    }

    try {
      setPurchaseBusy(true);
      const result = await buyRock(user.uid, rockType);
      if (result.success) {
        await loadProfile();
        setActiveRock({ type: rockType, label: rock.name });
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      console.error('Error comprando roca:', error);
      showMessage('Error al comprar la roca', 'error');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleBuyPickaxe = async (pickaxe) => {
    if (purchaseBusy) return;
    if (!profile || profile.coins < pickaxe.price) { showMessage('No tienes suficientes monedas', 'error'); return; }
    try { setPurchaseBusy(true); const result = await buyPickaxe(user.uid, pickaxe.id);
      if (result.success) { await loadProfile(); setActiveRock({ type:pickaxe.rockType,label:pickaxe.name,pickaxeType:pickaxe.id }); }
      else showMessage(result.message,'error');
    } catch(error) { console.error('Error comprando pico:',error); showMessage('Error al comprar el pico','error'); }
    finally { setPurchaseBusy(false); }
  };

  const handleClaimDaily = async () => {
    if (!dailyStatus.available || dailyBusy) return;

    try {
      setDailyBusy(true);
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
      showMessage('No se pudo reclamar la roca diaria', 'error');
    } finally {
      setDailyBusy(false);
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
                {dailyStatus.loading
                  ? 'Comprobando recompensa...'
                  : dailyStatus.available
                    ? '¡Lista para extraer! Golpea 3 veces.'
                    : `Disponible en ${countdown || 'espera...'}`}
              </p>
            </div>

            <button
              className={`daily-claim-btn ${dailyStatus.available ? 'claimable' : 'disabled'}`}
              onClick={handleClaimDaily}
              disabled={!dailyStatus.available || dailyBusy}
            >
              {dailyBusy ? 'Cargando...' : dailyStatus.available ? '¡Picar!' : 'Espera'}
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
                    disabled={!canAfford || purchaseBusy}
                  >
                    <span className="buy-coin-icon">🪙</span>
                    <span className="buy-price">{purchaseBusy ? '...' : rock.price}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section className="shop-section">
          <div className="section-title-bar"><span className="section-title-txt">PICOS ESPECIALES</span><span className="section-tag">3 ROCAS</span></div>
          <div className="rocks-row-container">
            {PICKAXES.map((pickaxe) => { const canAfford=(profile?.coins||0)>=pickaxe.price; return <div key={pickaxe.id} className="rock-item-card">
              <div className="rock-rarity-ribbon" style={{background:pickaxe.color}}>{pickaxe.rarity}</div>
              <div className="rock-visual-box"><img src={pickaxe.image} alt={pickaxe.name} className="rock-item-img" /></div>
              <h3 className="rock-item-name">{pickaxe.name}</h3><p className="pickaxe-description">Abre 3 rocas del mismo nivel</p>
              <button className={`rock-buy-btn ${canAfford?'affordable':'unaffordable'}`} onClick={()=>handleBuyPickaxe(pickaxe)} disabled={!canAfford||purchaseBusy}><span className="buy-coin-icon">🪙</span><span className="buy-price">{purchaseBusy?'...':pickaxe.price}</span></button>
            </div>; })}
          </div>
        </section>
      </main>

      {activeRock && (
        <RockMiner
          onClose={handleRockMinerClose}
          rockType={activeRock.type}
          rockLabel={activeRock.label}
          pickaxeType={activeRock.pickaxeType}
        />
      )}
    </div>
  );
};

export default Shop;