import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, createUserProfile } from '../services/firestore';
import FriendsPanel from '../components/FriendsPanel';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AVATAR_OPTIONS } from '../data/avatars'; // ✅ IMPORTACIÓN CENTRALIZADA
import './Profile.css';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('arquero');
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const userProfile = await getUserProfile(user.uid);
      if (userProfile) {
        setProfile(userProfile);
        setUsername(userProfile.username || '');
        setSelectedAvatarId(userProfile.avatarId || 'arquero');
      } else {
        const initialProfile = {
          uid: user.uid,
          email: user.email,
          username: user.email ? user.email.split('@')[0] : 'Invitado',
          avatarId: 'arquero',
          userId: user.uid.substring(0, 8).toUpperCase(),
          coins: 100,
          level: 1,
          xp: 0,
          isGuest: user.isAnonymous,
          createdAt: new Date().toISOString()
        };
        await createUserProfile(user.uid, initialProfile);
        setProfile(initialProfile);
        setUsername(initialProfile.username);
        setSelectedAvatarId('arquero');
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }
    try {
      const updatedProfile = {
        ...profile,
        uid: user.uid,
        username: username.trim(),
        avatarId: selectedAvatarId
      };
      await createUserProfile(user.uid, updatedProfile);
      setProfile(updatedProfile);
      setEditing(false);
    } catch (error) {
      console.error('Error guardando perfil:', error);
    }
  };

  const handleLinkAccount = async (e) => {
    e.preventDefault();
    setLinkError('');
    setLinkSuccess('');

    if (linkPassword.length < 6) {
      return setLinkError('La contraseña debe tener al menos 6 caracteres');
    }

    setLinkLoading(true);

    try {
      const credential = EmailAuthProvider.credential(linkEmail, linkPassword);
      await linkWithCredential(user, credential);

      const updatedProfile = {
        ...profile,
        uid: user.uid,
        email: linkEmail,
        isGuest: false
      };
      await createUserProfile(user.uid, updatedProfile);
      setProfile(updatedProfile);

      setLinkSuccess('¡Cuenta vinculada con éxito!');
      setTimeout(() => {
        setShowLinkModal(false);
        setLinkEmail('');
        setLinkPassword('');
        setLinkSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Error vinculando cuenta:', err);
      if (err.code === 'auth/email-already-in-use') {
        setLinkError('Este email ya está en uso');
      } else if (err.code === 'auth/invalid-email') {
        setLinkError('Email inválido');
      } else if (err.code === 'auth/weak-password') {
        setLinkError('Contraseña muy débil');
      } else {
        setLinkError('Error al vincular cuenta');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (logout) await logout();
      navigate('/');
    } catch (err) {
      console.error('Error cerrando sesión:', err);
    }
  };

  const getSelectedAvatarSrc = () => {
    const avatar = AVATAR_OPTIONS.find(a => a.id === (editing ? selectedAvatarId : profile?.avatarId));
    return avatar ? avatar.src : AVATAR_OPTIONS[0].src;
  };

  if (loading) {
    return (
      <div className="profile-screen">
        <div className="profile-loading-box">
          <span className="profile-spin-glyph">ᛟ</span>
          <p>Consultando anales del invocador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-screen">
      {/* 1. HUD SUPERIOR COHERENTE CON HOME */}
      <header className="profile-hud-header">
        <div className="profile-title-block">
          <span className="profile-title-rune"></span>
          <div>
            <h1 className="profile-title-txt">PERFIL DE INVOCADOR</h1>
            <span className="profile-id-txt">ID: {profile?.userId || '----'}</span>
          </div>
        </div>

        <div className="profile-hud-coins" onClick={() => navigate('/shop')}>
          <span className="coins-glyph">🪙</span>
          <span className="coins-val">{profile?.coins ?? 0}</span>
        </div>
      </header>

      <main className="profile-scroll-area">
        {/* 2. TARJETA CREDENCIAL ESTILO CLASH ROYALE */}
        <section className="profile-badge-slab">
          <div className="profile-avatar-anchor">
            <img
              src={getSelectedAvatarSrc()}
              alt="Avatar"
              className="profile-avatar-frame"
            />
            <div className="profile-level-gem">
              <span>{profile?.level || 1}</span>
            </div>
          </div>

          <div className="profile-badge-details">
            <div className="profile-name-line">
              <h2 className="profile-display-name">{profile?.username}</h2>
              {profile?.isGuest && <span className="guest-pill">Invitado</span>}
            </div>
            <span className="profile-rank-subtitle">Invocador de Runa Mania</span>
          </div>

          {/* Estadísticas de combate y recursos */}
          <div className="profile-stats-row">
            <div className="profile-stat-slot">
              <span className="stat-slot-label">Nivel</span>
              <span className="stat-slot-value lv-val">{profile?.level || 1}</span>
            </div>
            <div className="profile-stat-slot">
              <span className="stat-slot-label">XP</span>
              <span className="stat-slot-value xp-val">{profile?.xp || 0}</span>
            </div>
            <div className="profile-stat-slot">
              <span className="stat-slot-label">Monedas</span>
              <span className="stat-slot-value coin-val"> {profile?.coins || 0}</span>
            </div>
          </div>

          {/* Actualizar cuenta si es invitado */}
          {profile?.isGuest && (
            <button
              className="guest-upgrade-btn"
              onClick={() => setShowLinkModal(true)}
            >
              <span>🔒</span> Vincular correo y contraseña
            </button>
          )}
        </section>

        {/* 3. MODO EDICIÓN O BOTÓN DE EDITAR */}
        {editing ? (
          <section className="profile-edit-slab">
            <h3 className="edit-slab-title">Editar Invocador</h3>

            <div className="edit-field-group">
              <label className="edit-field-label">Nombre de Invocador</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="edit-field-input"
                placeholder="Nombre de invocador"
              />
            </div>

            <div className="edit-field-group">
              <label className="edit-field-label">Selecciona tu Avatar</label>
              <div className="avatar-options-grid">
                {AVATAR_OPTIONS.map((avatar) => {
                  const isChosen = selectedAvatarId === avatar.id;
                  return (
                    <div
                      key={avatar.id}
                      className={`avatar-choice-card ${isChosen ? 'chosen' : ''}`}
                      onClick={() => setSelectedAvatarId(avatar.id)}
                    >
                      <img src={avatar.src} alt={avatar.name} className="choice-img" />
                      <span className="choice-txt">{avatar.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="edit-buttons-row">
              <button className="edit-save-btn" onClick={handleSave}>
                💾 Guardar
              </button>
              <button className="edit-cancel-btn" onClick={() => setEditing(false)}>
                ✕ Cancelar
              </button>
            </div>
          </section>
        ) : (
          <div className="profile-actions-column">
            <button className="profile-edit-trigger-btn" onClick={() => setEditing(true)}>
              ✏️ Modificar Avatar y Nombre
            </button>

            <button className="profile-logout-trigger-btn" onClick={handleLogout}>
               Cerrar Sesión
            </button>
          </div>
        )}

        {/* 4. 🌐 SISTEMA DE AMIGOS: agregar, eliminar y retar (batalla online) */}
        <FriendsPanel profile={profile} />
      </main>

      {/* 5. MODAL VINCULACIÓN DE CUENTA */}
      {showLinkModal && (
        <div className="profile-modal-backdrop" onClick={() => setShowLinkModal(false)}>
          <div className="profile-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-icon" onClick={() => setShowLinkModal(false)}>
              ✕
            </button>

            <h3 className="modal-heading">Vincular Cuenta</h3>
            <p className="modal-sub">
              Asegura tu colección y mazo para no perder tu progreso.
            </p>

            {linkError && <div className="modal-alert error">⚠️ {linkError}</div>}
            {linkSuccess && <div className="modal-alert success">✅ {linkSuccess}</div>}

            <form onSubmit={handleLinkAccount} className="modal-inputs-form">
              <div className="modal-input-wrap">
                <label>Correo Electrónico</label>
                <input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="invocador@ejemplo.com"
                  required
                />
              </div>

              <div className="modal-input-wrap">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength="6"
                  required
                />
              </div>

              <button type="submit" className="modal-action-btn" disabled={linkLoading}>
                {linkLoading ? 'Vinculando...' : 'Guardar y Vincular'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;