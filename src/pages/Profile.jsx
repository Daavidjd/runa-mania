import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, createUserProfile } from '../services/firestore';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import Arquero from '../assets/avatar/Arquero.jpg';
import Bruja from '../assets/avatar/Bruja.jpg';
import Caballero from '../assets/avatar/Caballero.jpg';
import Elfo from '../assets/avatar/Elfo.jpg';
import Lobo from '../assets/avatar/Lobo.jpg';
import Mago from '../assets/avatar/Mago.jpg';
import './Profile.css';

const AVATAR_OPTIONS = [
  { id: 'arquero', src: Arquero, name: 'Arquero' },
  { id: 'bruja', src: Bruja, name: 'Bruja' },
  { id: 'caballero', src: Caballero, name: 'Caballero' },
  { id: 'elfo', src: Elfo, name: 'Elfo' },
  { id: 'lobo', src: Lobo, name: 'Lobo' },
  { id: 'mago', src: Mago, name: 'Mago' }
];

const Profile = () => {
  const { user } = useAuth();
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
      // Crear credencial con email y contraseña
      const credential = EmailAuthProvider.credential(linkEmail, linkPassword);
      
      // Vincular credencial al usuario anónimo actual
      await linkWithCredential(user, credential);

      // Actualizar perfil en Firestore
      const updatedProfile = {
        ...profile,
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
        setLinkError('Este email ya está en uso por otra cuenta');
      } else if (err.code === 'auth/invalid-email') {
        setLinkError('El email no es válido');
      } else if (err.code === 'auth/weak-password') {
        setLinkError('La contraseña es demasiado débil');
      } else if (err.code === 'auth/provider-already-linked') {
        setLinkError('Esta cuenta ya está vinculada');
      } else {
        setLinkError('Error al vincular la cuenta. Intenta de nuevo.');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const getSelectedAvatarSrc = () => {
    const avatar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId);
    return avatar ? avatar.src : Arquero;
  };

  if (loading) {
    return <div className="profile-loading">Cargando perfil...</div>;
  }

  return (
    <div className="profile-container">
      <button className="back-btn" onClick={() => navigate('/home')}>
        ← Volver
      </button>

      <div className="profile-card">
        <div className="profile-header">
          <img 
            src={getSelectedAvatarSrc()} 
            alt="Avatar" 
            className="profile-avatar"
          />
          <div className="profile-info">
            <div className="profile-name-row">
              <h1 className="profile-username">{profile.username}</h1>
              {profile.isGuest && (
                <span className="guest-badge">Invitado</span>
              )}
            </div>
            <p className="profile-id">ID: {profile.userId}</p>
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-label">Nivel</span>
                <span className="stat-value">{profile.level}</span>
              </div>
              <div className="stat">
                <span className="stat-label">XP</span>
                <span className="stat-value">{profile.xp}</span>
              </div>
              <div className="stat coins">
                <span className="stat-label">🪙 Monedas</span>
                <span className="stat-value">{profile.coins}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botón para vincular cuenta (solo invitados) */}
        {profile.isGuest && (
          <button className="link-account-btn" onClick={() => setShowLinkModal(true)}>
             Actualizar Cuenta
          </button>
        )}

        {editing ? (
          <div className="profile-edit">
            <div className="edit-section">
              <label>Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="username-input"
                placeholder="Tu nombre de invocador"
              />
            </div>

            <div className="edit-section">
              <label>Elige tu avatar</label>
              <div className="avatar-selector">
                {AVATAR_OPTIONS.map(avatar => (
                  <div
                    key={avatar.id}
                    className={`avatar-option-wrapper ${selectedAvatarId === avatar.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatarId(avatar.id)}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.name}
                      className="avatar-option"
                    />
                    <span className="avatar-name">{avatar.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="edit-actions">
              <button className="save-btn" onClick={handleSave}>
                💾 Guardar
              </button>
              <button className="cancel-btn" onClick={() => setEditing(false)}>
                ✕ Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="edit-profile-btn" onClick={() => setEditing(true)}>
            ✏️ Editar Perfil
          </button>
        )}
      </div>

      {/* Modal de vinculación de cuenta */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLinkModal(false)}>✕</button>
            
            <h2 className="modal-title">Vincular Cuenta</h2>
            <p className="modal-subtitle">
              Convierte tu cuenta de invitado en una cuenta permanente. Tu progreso se conservará.
            </p>

            {linkError && (
              <div className="modal-error">
                <span>⚠️</span>
                <span>{linkError}</span>
              </div>
            )}

            {linkSuccess && (
              <div className="modal-success">
                <span>✅</span>
                <span>{linkSuccess}</span>
              </div>
            )}

            <form onSubmit={handleLinkAccount} className="modal-form">
              <div className="modal-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="modal-input"
                />
              </div>

              <div className="modal-form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength="6"
                  className="modal-input"
                />
              </div>

              <button type="submit" className="modal-submit-btn" disabled={linkLoading}>
                {linkLoading ? (
                  <>
                    <span className="spinner"></span>
                    Vinculando...
                  </>
                ) : (
                  'Vincular Cuenta'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;