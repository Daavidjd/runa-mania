import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AVATAR_OPTIONS } from '../data/avatars';
import {
  searchUserByCode,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  createBattleChallenge,
  getPendingChallengesFor,
  acceptChallenge,
  declineChallenge
} from '../services/firestore';
import './FriendsPanel.css';

const avatarSrc = (avatarId) => {
  const found = AVATAR_OPTIONS.find(a => a.id === avatarId);
  return found ? found.src : AVATAR_OPTIONS[0].src;
};

const TABS = [
  { id: 'friends', label: '👥 Amigos' },
  { id: 'requests', label: '✉️ Solicitudes' },
  { id: 'add', label: '➕ Añadir' },
  { id: 'challenges', label: '⚔️ Retos' }
];

const FriendsPanel = ({ profile }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Buscador
  const [searchCode, setSearchCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState({});

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [f, inc, out, ch] = await Promise.all([
        getFriends(user.uid),
        getIncomingRequests(user.uid),
        getOutgoingRequests(user.uid),
        getPendingChallengesFor(user.uid)
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setChallenges(ch);
    } catch (err) {
      console.error('Error cargando datos sociales:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // ---------- AGREGAR AMIGOS ----------
  const handleSearch = async (e) => {
    e?.preventDefault();
    const code = searchCode.trim();
    if (code.length < 3) {
      showToast('El ID debe tener al menos 3 caracteres', false);
      return;
    }
    setSearching(true);
    const results = await searchUserByCode(code);
    setSearchResults(results.filter(r => r.uid !== user.uid));
    setSearching(false);
    if (results.filter(r => r.uid !== user.uid).length === 0) {
      showToast('No se encontró ningún invocador con ese ID', false);
    }
  };

  const handleSendRequest = async (targetUid) => {
    const res = await sendFriendRequest(user.uid, targetUid);
    showToast(res.message, res.success);
    if (res.success) {
      setSentRequests(prev => ({ ...prev, [targetUid]: true }));
      refreshAll();
    }
  };

  const handleAcceptRequest = async (req) => {
    const res = await acceptFriendRequest(req.id, user.uid);
    showToast(res.message, res.success);
    refreshAll();
  };

  const handleDeclineRequest = async (req) => {
    const res = await declineFriendRequest(req.id);
    showToast(res.message, res.success);
    refreshAll();
  };

  // ---------- ELIMINAR AMIGO ----------
  const handleRemoveFriend = async (friend) => {
    if (!window.confirm(`¿Eliminar a ${friend.username || 'este invocador'} de tu lista de amigos?`)) return;
    const res = await removeFriend(user.uid, friend.uid);
    showToast(res.message, res.success);
    refreshAll();
  };

  // ---------- RETAR (BATALLA ONLINE) ----------
  const handleChallenge = async (friend) => {
    const res = await createBattleChallenge(user.uid, friend.uid);
    showToast(`${res.message}${res.success ? ` Esperando a ${friend.username}...` : ''}`, res.success);
    if (res.success) {
      localStorage.setItem('pendingOutgoingChallenge', JSON.stringify({
        challengeId: res.challengeId,
        opponentUid: friend.uid,
        opponentName: friend.username || 'Rival',
        opponentAvatarId: friend.avatarId || 'mago'
      }));
    }
  };

  const handleAcceptChallenge = async (ch) => {
    const res = await acceptChallenge(ch.id, user.uid);
    showToast(res.message, res.success);
    if (res.success) {
      localStorage.setItem('onlineBattle', JSON.stringify({
        challengeId: ch.id,
        opponentUid: ch.from,
        opponentName: ch.fromName || 'Rival',
        opponentAvatarId: ch.fromAvatarId || 'mago',
        role: 'defender'
      }));
      navigate('/battle-online');
    } else {
      refreshAll();
    }
  };

  const handleDeclineChallenge = async (ch) => {
    const res = await declineChallenge(ch.id);
    showToast(res.message, res.success);
    refreshAll();
  };

  const isFriend = useCallback((uid) => friends.some(f => f.uid === uid), [friends]);
  const isRequested = useCallback((uid) => outgoing.some(o => o.to === uid) || sentRequests[uid], [outgoing, sentRequests]);

  const totalBadges = incoming.length + challenges.length;

  return (
    <section className="fp-panel">
      <header className="fp-header">
        <h3 className="fp-title">🌐 Zona Social</h3>
        <button className="fp-refresh" onClick={refreshAll} title="Actualizar">⟳</button>
      </header>

      {/* Mi código de amigo */}
      <div className="fp-my-code" title="Copia este ID para que te agreguen">
        <span className="fp-my-code-label">MI ID DE INVOCADOR</span>
        <span
          className="fp-my-code-value"
          onClick={() => {
            navigator.clipboard?.writeText(profile?.userId || '');
            showToast('¡ID copiado al portapapeles! 📋');
          }}
        >
          #{profile?.userId || '----'} 📋
        </span>
      </div>

      {/* Pestañas */}
      <nav className="fp-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`fp-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'requests' && incoming.length > 0 && <span className="fp-badge">{incoming.length}</span>}
            {t.id === 'challenges' && challenges.length > 0 && <span className="fp-badge fp-badge-red">{challenges.length}</span>}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="fp-loading">Conectando con la red de invocadores...</div>
      ) : (
        <>
          {/* ===== LISTA DE AMIGOS ===== */}
          {tab === 'friends' && (
            <div className="fp-list">
              {friends.length === 0 ? (
                <p className="fp-empty">Aún no tienes amigos. Ve a la pestaña <b>➕ Añadir</b> e invita a otros invocadores con su ID.</p>
              ) : friends.map(f => (
                <div key={f.uid} className="fp-row">
                  <img src={avatarSrc(f.avatarId)} alt={f.username} className="fp-avatar" />
                  <div className="fp-row-info">
                    <span className="fp-row-name">{f.username || 'Invocador'}</span>
                    <span className="fp-row-sub">Nv. {f.level || 1} · #{f.userId} · 🏆 {f.onlineWins || 0}V / {f.onlineLosses || 0}D</span>
                  </div>
                  <div className="fp-row-actions">
                    <button className="fp-btn fp-btn-challenge" onClick={() => handleChallenge(f)}>⚔️ Retar</button>
                    <button className="fp-btn fp-btn-remove" onClick={() => handleRemoveFriend(f)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== SOLICITUDES ===== */}
          {tab === 'requests' && (
            <div className="fp-list">
              <h4 className="fp-section-label">Recibidas</h4>
              {incoming.length === 0 && <p className="fp-empty">No tienes solicitudes pendientes.</p>}
              {incoming.map(r => r.sender && (
                <div key={r.id} className="fp-row">
                  <img src={avatarSrc(r.sender.avatarId)} alt={r.sender.username} className="fp-avatar" />
                  <div className="fp-row-info">
                    <span className="fp-row-name">{r.sender.username || 'Invocador'}</span>
                    <span className="fp-row-sub">Nv. {r.sender.level || 1} · #{r.sender.userId}</span>
                  </div>
                  <div className="fp-row-actions">
                    <button className="fp-btn fp-btn-accept" onClick={() => handleAcceptRequest(r)}>✔️ Aceptar</button>
                    <button className="fp-btn fp-btn-decline" onClick={() => handleDeclineRequest(r)}>✖️</button>
                  </div>
                </div>
              ))}

              <h4 className="fp-section-label">Enviadas</h4>
              {outgoing.length === 0 && <p className="fp-empty">No has enviado solicitudes.</p>}
              {outgoing.map(r => r.target && (
                <div key={r.id} className="fp-row fp-row-muted">
                  <img src={avatarSrc(r.target.avatarId)} alt={r.target.username} className="fp-avatar" />
                  <div className="fp-row-info">
                    <span className="fp-row-name">{r.target.username || 'Invocador'}</span>
                    <span className="fp-row-sub">Esperando respuesta...</span>
                  </div>
                  <div className="fp-row-actions">
                    <button className="fp-btn fp-btn-decline" onClick={() => handleDeclineRequest(r)}>Cancelar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== AÑADIR AMIGOS ===== */}
          {tab === 'add' && (
            <div className="fp-add-area">
              <form className="fp-search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  className="fp-search-input"
                  placeholder="ID del invocador (ej: A1B2C3D4)"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                <button type="submit" className="fp-btn fp-btn-search" disabled={searching}>
                  {searching ? '...' : '🔍 Buscar'}
                </button>
              </form>

              <div className="fp-list">
                {searchResults.map(r => (
                  <div key={r.uid} className="fp-row">
                    <img src={avatarSrc(r.avatarId)} alt={r.username} className="fp-avatar" />
                    <div className="fp-row-info">
                      <span className="fp-row-name">{r.username || 'Invocador'}</span>
                      <span className="fp-row-sub">Nv. {r.level || 1} · #{r.userId}</span>
                    </div>
                    <div className="fp-row-actions">
                      {isFriend(r.uid) ? (
                        <span className="fp-tag-friend">Ya es amigo ✔️</span>
                      ) : isRequested(r.uid) ? (
                        <span className="fp-tag-pending">Pendiente ✉️</span>
                      ) : (
                        <button className="fp-btn fp-btn-add" onClick={() => handleSendRequest(r.uid)}>➕ Agregar</button>
                      )}
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <p className="fp-empty">
                    Comparte tu <b>#{profile?.userId}</b> con otros invocadores. Ellos deben buscarte por ese ID y viceversa. 💡 Si ambos se envían solicitud, se aceptan automáticamente.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ===== RETOS RECIBIDOS ===== */}
          {tab === 'challenges' && (
            <div className="fp-list">
              {totalBadges === 0 && challenges.length === 0 && (
                <p className="fp-empty">No tienes retos pendientes. ¡Reta a un amigo desde la pestaña <b>👥 Amigos</b>!</p>
              )}
              {challenges.map(ch => (
                <div key={ch.id} className="fp-row fp-row-challenge">
                  <img src={avatarSrc(ch.fromAvatarId)} alt={ch.fromName} className="fp-avatar fp-avatar-red" />
                  <div className="fp-row-info">
                    <span className="fp-row-name">⚔️ {ch.fromName || 'Rival'} te reta</span>
                    <span className="fp-row-sub">Batalla en línea · Recompensa: 🪙 30 monedas</span>
                  </div>
                  <div className="fp-row-actions">
                    <button className="fp-btn fp-btn-accept" onClick={() => handleAcceptChallenge(ch)}>🛡️ Aceptar</button>
                    <button className="fp-btn fp-btn-decline" onClick={() => handleDeclineChallenge(ch)}>🏳️ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Toast de notificaciones */}
      {toast && (
        <div className={`fp-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>
      )}
    </section>
  );
};

export default FriendsPanel;
