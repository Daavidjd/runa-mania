import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getPlayerDecks,
  leaveMatchmakingQueue
} from '../services/firestore';

import { RUNES_DB } from '../data/runes';
import { AVATAR_OPTIONS } from '../data/avatars'; // ✅ IMPORTACIÓN CENTRALIZADA

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
  const [battleDeck, setBattleDeck] = useState([]); // mazo compartido de 8 runas para NPC y online
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [battleMode, setBattleMode] = useState('cpu');

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
        const rawDecks = await getPlayerDecks(user.uid);
        setBattleDeck((rawDecks.shared || rawDecks.online || rawDecks.npc || []).map(id => RUNES_DB.find(r => r.id === id)).filter(Boolean));
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
    if (user) await leaveMatchmakingQueue(user.uid);
  };

  const handleRandomBattle = async () => {
    if (!user || searching) return;
    if (battleDeck.length < 8) {
      setMatchError('Necesitas completar tu mazo de batalla con 8 runas para luchar 🔵🔴');
      setTimeout(() => setMatchError(''), 3500);
      return;
    }
    setMatchError('');
    localStorage.setItem('onlineBattle', JSON.stringify({ role: 'random', searching: true }));
    navigate('/battle-online');
  };

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
            <span className="hud-id">NIVEL {profile?.level || 1}</span>
          </div>
        </button>

        <div className="hud-coins-pill">
          <span className="coin-icon">🪙</span>
          <span className="coin-amount">{profile?.coins ?? 0}</span>
        </div>
      </header>

      {/* ARENA CENTRAL: panel único CPU / ONLINE */}
      <main className="home-arena-stage">
        <section className={`unified-battle-card ${battleMode === 'online' ? 'is-online' : 'is-cpu'}`} aria-label="Panel de batalla">
          <div className="battle-mode-switch" role="group" aria-label="Modo de batalla">
            <button
              type="button"
              className={`battle-mode-option ${battleMode === 'cpu' ? 'active' : ''}`}
              onClick={() => setBattleMode('cpu')}
              disabled={searching}
              aria-pressed={battleMode === 'cpu'}
            >
              CPU
            </button>
            <button
              type="button"
              className={`battle-mode-option ${battleMode === 'online' ? 'active' : ''}`}
              onClick={() => setBattleMode('online')}
              disabled={searching}
              aria-pressed={battleMode === 'online'}
            >
              ONLINE
            </button>
          </div>

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
          ) : battleMode === 'cpu' ? (
            <>
              <button
                type="button"
                className="selected-opponent-card"
                onClick={() => setShowOpponentModal(true)}
                aria-label={`Cambiar oponente. Actual: ${selectedOpponent.name}`}
              >
                <div className="opponent-avatar-box">
                  <img
                    src={selectedOpponent.avatar}
                    alt={selectedOpponent.name}
                    className="opponent-avatar"
                  />
                </div>
                <div className="opponent-info-box">
                  <span className="opponent-name">{selectedOpponent.name}</span>
                  <span className="opponent-selected-difficulty" style={{ color: selectedOpponent.difficultyColor }}>
                    {selectedOpponent.difficulty}
                  </span>
                </div>
              </button>
            </>
          ) : (
            <>
              <span className="battle-mode-label online-label">BATALLA ONLINE</span>
              <div className="online-mode-icon" aria-hidden="true">?</div>
            </>
          )}

          {!searching && (
            <button
              className={`huge-battle-cta ${battleDeck.length < 8 ? 'cta-disabled' : ''}`}
              onClick={() => {
                if (battleDeck.length < 8) return;
                if (battleMode === 'online') handleRandomBattle();
                else navigate('/battle');
              }}
              disabled={battleDeck.length < 8}
              title={battleDeck.length < 8 ? `Necesitas 8 runas en el mazo de batalla (${battleDeck.length}/8)` : 'Iniciar batalla'}
            >
              <div className="cta-glare"></div>
              <div className="cta-main-content">
                <span className="cta-swords">{battleDeck.length < 8 ? '' : '⚔️'}</span>
                <span className="cta-txt">
                  {battleDeck.length < 8 ? 'MAZO INCOMPLETO' : '¡LUCHAR!'}
                </span>
              </div>
              {battleDeck.length < 8 && (
                <span className="cta-sub">Equipas {battleDeck.length}/8 runas en el mazo compartido</span>
              )}
            </button>
          )}
        </section>

        {matchError && <div className="online-match-error">{matchError}</div>}

        <section className="home-shortcuts" aria-label="Accesos rápidos">
          <button type="button" className="home-shortcut-btn mining-shortcut" onClick={() => navigate('/shop')}>
            <span className="shortcut-icon" aria-hidden="true">⛏</span>
            <span className="shortcut-copy">
              <strong>MINERÍA</strong>
              <small>Consigue nuevas runas</small>
            </span>
            <span className="shortcut-arrow" aria-hidden="true">›</span>
          </button>
          <button type="button" className="home-shortcut-btn collection-shortcut" onClick={() => navigate('/collection')}>
            <span className="shortcut-icon collection-icon" aria-hidden="true">ᛟ</span>
            <span className="shortcut-copy">
              <strong>COLECCIÓN</strong>
              <small>Gestiona tus runas y mazos</small>
            </span>
            <span className="shortcut-arrow" aria-hidden="true">›</span>
          </button>
        </section>

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