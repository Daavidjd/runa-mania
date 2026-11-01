import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getUserDecks,
  findRandomMatch,
  watchMyQueueEntry,
  leaveQueue
} from '../services/firestore';
import { RUNES_DB } from '../data/runes';
import { AVATAR_OPTIONS } from '../data/avatars'; // ✅ IMPORTACIÓN CENTRALIZADA
import RuneCard from '../components/RuneCard';

import './Home.css';

// Helper para obtener la imagen del avatar por su ID
const getAvatarSrc = (id) => AVATAR_OPTIONS.find(a => a.id === id)?.src;

const AI_OPPONENTS = [
  {
    id: 'sky',
    name: 'Sky',
    avatar: getAvatarSrc('bruja'),
    difficulty: 'FÁCIL',
    difficultyColor: '#10b981',
    reward: 20
  },
  {
    id: 'eljonny',
    name: 'elJonny',
    avatar: getAvatarSrc('elfo'),
    difficulty: 'MEDIO',
    difficultyColor: '#f59e0b',
    reward: 50
  },
  {
    id: 'eustakio',
    name: 'Eustakio',
    avatar: getAvatarSrc('caballero'),
    difficulty: 'DIFÍCIL',
    difficultyColor: '#ef4444',
    reward: 150
  }
];

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [userDeck, setUserDeck] = useState([]);
  const [showOpponentModal, setShowOpponentModal] = useState(false);

  // 🎮 Estado del matchmaking aleatorio (batalla online con cualquiera)
  const [searching, setSearching] = useState(() => localStorage.getItem('randomMatchPending') === '1');
  const [matchError, setMatchError] = useState('');

  const [selectedOpponent, setSelectedOpponent] = useState(() => {
    const saved = localStorage.getItem('selectedOpponent');
    return AI_OPPONENTS.find(o => o.id === saved) || AI_OPPONENTS[0];
  });

  useEffect(() => {
    if (!user) return;
    const loadHomeData = async () => {
      try {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) setProfile(userProfile);
        const decks = await getUserDecks(user.uid);
        if (decks.length > 0) {
          decks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (decks[0].runes?.length > 0) {
            const deckRunes = decks[0].runes
              .map(id => RUNES_DB.find(r => r.id === id))
              .filter(Boolean);
            setUserDeck(deckRunes);
          }
        }
      } catch (err) {
        console.error('Error cargando datos del home:', err);
      }
    };
    loadHomeData();
  }, [user]);

  const handleSelectOpponent = (opp) => {
    setSelectedOpponent(opp);
    localStorage.setItem('selectedOpponent', opp.id);
    setShowOpponentModal(false);
  };

  // 🎮 BUSCAR PARTIDA ALEATORIA (cualquier jugador online)
  const stopSearching = async () => {
    setSearching(false);
    localStorage.removeItem('randomMatchPending');
    if (user) await leaveQueue(user.uid);
  };

  const handleRandomBattle = async () => {
    if (!user || searching) return;
    if (userDeck.length < 5) {
      setMatchError('Necesitas un mazo completo de 5 runas para luchar 🔵🔴');
      setTimeout(() => setMatchError(''), 3500);
      return;
    }
    setMatchError('');
    setSearching(true);
    localStorage.setItem('randomMatchPending', '1');

    const displayName = profile?.username || user.displayName || user.email?.split('@')[0] || 'Invocador';
    const res = await findRandomMatch(user.uid, displayName, profile?.avatarId || 'mago');

    if (!res.success) {
      setSearching(false);
      localStorage.removeItem('randomMatchPending');
      setMatchError(res.message || 'No se pudo conectar con la arena online');
      setTimeout(() => setMatchError(''), 3500);
      return;
    }

    if (res.matched) {
      // El segundo en llegar empareja al primero: entramos directo a la sala
      localStorage.setItem('onlineBattle', JSON.stringify({
        roomId: res.roomId,
        opponentUid: res.opponentUid,
        opponentName: res.opponentName,
        opponentAvatarId: res.opponentAvatarId,
        role: 'random'
      }));
      localStorage.removeItem('randomMatchPending');
      navigate('/battle-online');
    }
    // Si no hay rival aún, el useEffect de abajo nos mantiene escuchando la cola
  };

  // ⚔️ Escucha en tiempo real: cuando alguien nos encuentra en la cola, entramos a la sala
  useEffect(() => {
    if (!user || !searching) return undefined;
    let navigated = false;
    const unsub = watchMyQueueEntry(user.uid, (entry) => {
      if (!entry || navigated) return;
      if (entry.status === 'matched' && entry.roomId) {
        navigated = true;
        localStorage.setItem('onlineBattle', JSON.stringify({
          roomId: entry.roomId,
          opponentUid: entry.opponentUid,
          opponentName: entry.opponentName || 'Rival',
          opponentAvatarId: entry.opponentAvatarId || 'mago',
          role: 'random'
        }));
        localStorage.removeItem('randomMatchPending');
        setSearching(false);
        navigate('/battle-online');
      }
    });
    return () => unsub();
  }, [user, searching, navigate]);

  // Al volver a Home sin batalla activa (p. ej. cancelado), limpiar cola pendiente
  useEffect(() => {
    if (localStorage.getItem('randomMatchPending') === '1' && localStorage.getItem('onlineBattle')) {
      localStorage.removeItem('randomMatchPending');
    }
  }, []);

  const getPlayerAvatar = () => {
    const found = AVATAR_OPTIONS.find(a => a.id === profile?.avatarId);
    return found ? found.src : AVATAR_OPTIONS[0].src;
  };

  return (
    <div className="home-screen">
      {/* HUD SUPERIOR */}
      <header className="home-hud">
        <button
          className="hud-profile-pill"
          onClick={() => navigate('/profile')}
          title="Ver perfil"
        >
          <img src={getPlayerAvatar()} alt="Avatar" className="hud-avatar-img" />
          <div className="hud-player-meta">
            <span className="hud-name">
              {profile?.username || user?.displayName || user?.email?.split('@')[0] || 'Invocador'}
            </span>
            <span className="hud-id">Nv. {profile?.level || 1} • ID: {profile?.userId || '----'}</span>
          </div>
        </button>

        <div className="hud-coins-pill">
          <span className="coin-icon">🪙</span>
          <span className="coin-amount">{profile?.coins ?? 0}</span>
        </div>
      </header>

      {/* ARENA CENTRAL */}
      <main className="home-arena-stage">
        <div className="runic-arena-altar">
          {/* Badge NPC clickeable */}
          <button 
            className="arena-npc-badge"
            onClick={() => setShowOpponentModal(true)}
          >
            <span className="npc-badge-title">NPC</span>
          </button>

          {/* Tarjeta del rival seleccionado (solo avatar + nombre) */}
          <div className="selected-opponent-card" onClick={() => setShowOpponentModal(true)}>
            <div className="opponent-avatar-box">
              <img 
                src={selectedOpponent.avatar} 
                alt={selectedOpponent.name}
                className="opponent-avatar"
              />
            </div>
            <div className="opponent-info-box">
              <span className="opponent-name">{selectedOpponent.name}</span>
            </div>
          </div>

          {/* BOTÓN DE BATALLA */}
          <button
            className={`huge-battle-cta ${userDeck.length < 5 ? 'cta-disabled' : ''}`}
            onClick={() => userDeck.length >= 5 && navigate('/battle')}
            disabled={userDeck.length < 5}
            title={userDeck.length < 5 ? `Necesitas 5 runas en el mazo (${userDeck.length}/5)` : 'Iniciar batalla'}
          >
            <div className="cta-glare"></div>
            <div className="cta-main-content">
              <span className="cta-swords">{userDeck.length < 5 ? '' : '⚔️'}</span>
              <span className="cta-txt">
                {userDeck.length < 5 ? 'MAZO INCOMPLETO' : '¡A LUCHAR!'}
              </span>
            </div>
            {userDeck.length < 5 && (
              <span className="cta-sub">Equipas {userDeck.length}/5 runas</span>
            )}
          </button>

          {/* 🎮 BOTÓN DE BATALLA ONLINE ALEATORIA */}
          {searching ? (
            <div className="online-search-box">
              <div className="online-search-row">
                <span className="online-search-orb"></span>
                <div className="online-search-text">
                  <span className="online-search-title">BUSCANDO RIVAL...</span>
                  <span className="online-search-sub">🔵🔴 Cualquier invocador · 50/50</span>
                </div>
              </div>
              <button className="online-cancel-btn" onClick={stopSearching}>✕ Cancelar búsqueda</button>
            </div>
          ) : (
            <button
              className={`online-battle-btn ${userDeck.length < 5 ? 'online-disabled' : ''}`}
              onClick={handleRandomBattle}
              title={userDeck.length < 5 ? 'Necesitas 5 runas en el mazo para el modo online' : 'Batalla online contra un rival aleatorio'}
            >
              <span className="online-btn-icon">🌐</span>
              <span className="online-btn-txt">BATALLA ONLINE</span>
              <span className="online-btn-sub">{userDeck.length < 5 ? 'Mazo incompleto' : 'vs. jugador aleatorio'}</span>
            </button>
          )}

          {matchError && <div className="online-match-error">{matchError}</div>}
        </div>

        {/* VISTA PREVIA DEL MAZO */}
        <div className="home-deck-preview">
          <div className="deck-preview-header">
            <span className="deck-preview-title">TU MAZO ACTUAL</span>
            <span className="deck-preview-count">{userDeck.length}/5</span>
          </div>
          <div className="deck-preview-track">
            {Array.from({ length: 5 }).map((_, i) => {
              const rune = userDeck[i];
              return (
                <div key={i} className="deck-preview-slot">
                  {rune ? (
                    <RuneCard rune={rune} owned={true} battleMode={true} />
                  ) : (
                    <div className="deck-preview-empty">
                      <span className="empty-plus">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="home-coming-soon">
          <span className="coming-soon-rune">ᛟ</span>
          <span className="coming-soon-text">Matchmaking por rango próximamente</span>
        </div>
      </main>

      {/* MODAL DE SELECCIÓN DE RIVALES */}
      {showOpponentModal && (
        <div className="opponent-modal-overlay" onClick={() => setShowOpponentModal(false)}>
          <div className="opponent-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="opponent-modal-close"
              onClick={() => setShowOpponentModal(false)}
            >
              ✕
            </button>
            
            <h3 className="opponent-modal-title">ELIGE TU RIVAL</h3>
            
            <div className="opponent-modal-list">
              {AI_OPPONENTS.map((opp) => (
                <button
                  key={opp.id}
                  className={`opponent-modal-btn ${selectedOpponent.id === opp.id ? 'is-selected' : ''}`}
                  onClick={() => handleSelectOpponent(opp)}
                  style={{
                    borderColor: opp.difficultyColor
                  }}
                >
                  <div className="opp-modal-avatar-box">
                    <img 
                      src={opp.avatar} 
                      alt={opp.name}
                      className="opp-modal-avatar"
                    />
                  </div>
                  <div className="opp-modal-info">
                    <span className="opp-modal-name">{opp.name}</span>
                    <span 
                      className="opp-modal-difficulty"
                      style={{ color: opp.difficultyColor }}
                    >
                      {opp.difficulty}
                    </span>
                  </div>
                  <div className="opp-modal-reward">
                    <span className="reward-coin">🪙</span>
                    <span className="reward-amount">+{opp.reward}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;