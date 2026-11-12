import { useState, useEffect, useCallback } from 'react';
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
  removeFriend
} from '../services/firestore';
import './FriendsPanel.css';

const avatarSrc = (avatarId) => {
  const found = AVATAR_OPTIONS.find(a => a.id === avatarId);
  return found ? found.src : AVATAR_OPTIONS[0].src;
};

const TABS = [
  { id: 'friends', label: '👥 Amigos' },
  { id: 'requests', label: '✉️ Solicitudes' },
  { id: 'add', label: '➕ Añadir' }
];

const FriendsPanel = ({ profile, open = true, onClose }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchCode, setSearchCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyUid, setBusyUid] = useState('');

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const refreshAll = useCallback(async (quiet = false) => {
    if (!user) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [friendList, received, sent] = await Promise.all([
        getFriends(user.uid),
        getIncomingRequests(user.uid),
        getOutgoingRequests(user.uid)
      ]);
      setFriends(friendList.sort((a, b) => (a.username || '').localeCompare(b.username || '', 'es')));
      setIncoming(received);
      setOutgoing(sent);
    } catch (error) {
      console.error('Error cargando amigos:', error);
      showToast('No se pudo actualizar tu lista social', false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (open) refreshAll();
  }, [open, refreshAll]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isFriend = useCallback((uid) => friends.some(friend => friend.uid === uid), [friends]);
  const isRequested = useCallback((uid) => outgoing.some(request => request.to === uid), [outgoing]);

  if (!open) return null;

  const handleSearch = async (event) => {
    event?.preventDefault();
    const code = searchCode.trim().toUpperCase().replace(/^#/, '');
    if (code.length < 3) {
      showToast('Introduce al menos 3 caracteres del código', false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUserByCode(code);
      setSearchResults(results.filter(result => result.uid !== user.uid));
      if (!results.some(result => result.uid !== user.uid)) {
        showToast('No encontramos ningún invocador con ese código', false);
      }
    } catch (error) {
      console.error('Error buscando invocadores:', error);
      showToast('No se pudo realizar la búsqueda', false);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUid) => {
    setBusyUid(targetUid);
    try {
      const result = await sendFriendRequest(user.uid, targetUid);
      showToast(result.message, result.success);
      if (result.success) await refreshAll(true);
    } finally {
      setBusyUid('');
    }
  };

  const handleAcceptRequest = async (request) => {
    setBusyUid(request.id);
    try {
      const result = await acceptFriendRequest(request.id, user.uid);
      showToast(result.message, result.success);
      if (result.success) await refreshAll(true);
    } finally {
      setBusyUid('');
    }
  };

  const handleDeleteRequest = async (request) => {
    setBusyUid(request.id);
    try {
      const result = await declineFriendRequest(request.id);
      showToast(result.success ? 'Solicitud eliminada' : result.message, result.success);
      if (result.success) await refreshAll(true);
    } finally {
      setBusyUid('');
    }
  };

  const handleRemoveFriend = async (friend) => {
    if (!window.confirm(`¿Eliminar a ${friend.username || 'este invocador'} de tu lista de amigos?`)) return;
    setBusyUid(friend.uid);
    try {
      const result = await removeFriend(user.uid, friend.uid);
      showToast(result.message, result.success);
      if (result.success) await refreshAll(true);
    } finally {
      setBusyUid('');
    }
  };

  return (
    <div className="fp-backdrop" onClick={onClose}>
      <section className="fp-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Gestión de amigos">
        <header className="fp-header fp-header-compact">
          <div className="fp-header-actions">
            <button className="fp-refresh" onClick={() => refreshAll(true)} title="Actualizar" disabled={refreshing}>{refreshing ? '…' : '⟳'}</button>
            <button className="fp-close" onClick={onClose} title="Cerrar" aria-label="Cerrar">✕</button>
          </div>
        </header>
        <button
          className="fp-my-code"
          onClick={async () => {
            const code = profile?.playerCode || profile?.userId || user?.uid || '';
            try {
              await navigator.clipboard.writeText(String(code));
              showToast('Código de invocador copiado');
            } catch {
              showToast('No se pudo copiar el código', false);
            }
          }}
          disabled={!profile?.playerCode && !profile?.userId && !user?.uid}
          title="Copiar código de invocador"
        >
          <span className="fp-my-code-label">TU CÓDIGO DE INVOCADOR</span>
          <span className="fp-my-code-value">#{profile?.playerCode || profile?.userId || user?.uid || '—'} 📋</span>
        </button>

        <nav className="fp-tabs" aria-label="Secciones de amigos">
          {TABS.map(item => (
            <button key={item.id} className={`fp-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
              {item.label}
              {item.id === 'requests' && incoming.length > 0 && <span className="fp-badge">{incoming.length}</span>}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="fp-loading">Cargando tu lista de amigos…</div>
        ) : (
          <>
            {tab === 'friends' && (
              <div className="fp-list">
                <div className="fp-list-heading"><span>{friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}</span><span>Invocadores</span></div>
                {friends.length === 0 ? (
                  <div className="fp-empty-state">
                    <span className="fp-empty-icon">🫂</span>
                    <p className="fp-empty">Todavía no tienes amigos.</p>
                    <p className="fp-hint">Busca a otros jugadores por su código para empezar a crear tu comunidad.</p>
                    <button className="fp-btn fp-btn-add" onClick={() => setTab('add')}>➕ Buscar amigos</button>
                  </div>
                ) : friends.map(friend => (
                  <div key={friend.uid} className="fp-row">
                    <img src={avatarSrc(friend.avatarId)} alt="" className="fp-avatar" />
                    <div className="fp-row-info">
                      <span className="fp-row-name">{friend.username || 'Invocador'}</span>
                      <span className="fp-row-sub">Nv. {friend.level || 1} · #{friend.playerCode || friend.userId || '—'}</span>
                    </div>
                    <div className="fp-row-actions">
                      <button className="fp-btn fp-btn-remove" onClick={() => handleRemoveFriend(friend)} disabled={busyUid === friend.uid} title="Eliminar amigo">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'requests' && (
              <div className="fp-list">
                <h4 className="fp-section-label">Recibidas · {incoming.length}</h4>
                {incoming.length === 0 && <p className="fp-empty">No tienes solicitudes pendientes.</p>}
                {incoming.map(request => request.sender && (
                  <div key={request.id} className="fp-row">
                    <img src={avatarSrc(request.sender.avatarId)} alt="" className="fp-avatar" />
                    <div className="fp-row-info">
                      <span className="fp-row-name">{request.sender.username || 'Invocador'}</span>
                      <span className="fp-row-sub">Nv. {request.sender.level || 1} · #{request.sender.playerCode || request.sender.userId || '—'}</span>
                    </div>
                    <div className="fp-row-actions">
                      <button className="fp-btn fp-btn-accept" onClick={() => handleAcceptRequest(request)} disabled={busyUid === request.id}>Aceptar</button>
                      <button className="fp-btn fp-btn-decline" onClick={() => handleDeleteRequest(request)} disabled={busyUid === request.id}>✕</button>
                    </div>
                  </div>
                ))}

                <h4 className="fp-section-label">Enviadas · {outgoing.length}</h4>
                {outgoing.length === 0 && <p className="fp-empty">No has enviado solicitudes pendientes.</p>}
                {outgoing.map(request => request.target && (
                  <div key={request.id} className="fp-row fp-row-muted">
                    <img src={avatarSrc(request.target.avatarId)} alt="" className="fp-avatar" />
                    <div className="fp-row-info">
                      <span className="fp-row-name">{request.target.username || 'Invocador'}</span>
                      <span className="fp-row-sub">Solicitud pendiente</span>
                    </div>
                    <div className="fp-row-actions">
                      <button className="fp-btn fp-btn-decline" onClick={() => handleDeleteRequest(request)} disabled={busyUid === request.id}>Cancelar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'add' && (
              <div className="fp-add-area">
                <p className="fp-hint">Introduce el código de otro invocador para encontrarlo y enviarle una solicitud.</p>
                <form className="fp-search-form" onSubmit={handleSearch}>
                  <input type="text" className="fp-search-input" placeholder="Código de invocador (ej. K7RM2Q)" value={searchCode} onChange={event => setSearchCode(event.target.value.toUpperCase())} maxLength={13} autoComplete="off" />
                  <button type="submit" className="fp-btn fp-btn-search" disabled={searching || searchCode.trim().length < 3}>{searching ? 'Buscando…' : '🔍 Buscar'}</button>
                </form>
                <div className="fp-list">
                  {searchResults.map(result => (
                    <div key={result.uid} className="fp-row">
                      <img src={avatarSrc(result.avatarId)} alt="" className="fp-avatar" />
                      <div className="fp-row-info">
                        <span className="fp-row-name">{result.username || 'Invocador'}</span>
                        <span className="fp-row-sub">Nv. {result.level || 1} · #{result.playerCode || result.userId || '—'}</span>
                      </div>
                      <div className="fp-row-actions">
                        {isFriend(result.uid) ? <span className="fp-tag-friend">Amigo ✓</span> :
                          isRequested(result.uid) ? <span className="fp-tag-pending">Pendiente ✉️</span> :
                          <button className="fp-btn fp-btn-add" onClick={() => handleSendRequest(result.uid)} disabled={busyUid === result.uid}>{busyUid === result.uid ? '…' : '➕ Añadir'}</button>}
                      </div>
                    </div>
                  ))}
                  {searchResults.length === 0 && <p className="fp-empty">Los resultados aparecerán aquí. Tu código está arriba: compártelo para que también puedan encontrarte.</p>}
                </div>
              </div>
            )}
          </>
        )}
        {toast && <div className={`fp-toast ${toast.ok ? 'ok' : 'err'}`} role="status">{toast.msg}</div>}
      </section>
    </div>
  );
};

export default FriendsPanel;
