import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createUserProfile, getUserProfile, findFreePlayerCode } from '../services/firestore';
import './Auth.css';

const Auth = () => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, register, registerGuest } = useAuth();
  const navigate = useNavigate();

  // Redirigir si ya está logueado (usando useEffect)
  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (username.trim().length < 3) return setError('El nombre debe tener al menos 3 caracteres');
      if (password !== confirmPassword) return setError('Las contraseñas no coinciden');
      if (!acceptTerms) return setError('Debes aceptar los términos y condiciones');
    }

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');

    setLoading(true);

    try {
      if (mode === 'register') {
        const userCredential = await register(email, password);
        const userId = userCredential.user.uid;
        const playerCode = await findFreePlayerCode();

        await createUserProfile(userId, {
          email: email,
          username: username.trim(),
          avatarId: 'arquero',
          playerCode: playerCode,
          userId: playerCode,
          coins: 1000,
          level: 1,
          xp: 0,
          isGuest: false,
          createdAt: new Date().toISOString()
        });
      } else {
        const userCredential = await login(email, password);
        const userId = userCredential.user.uid;

        const profile = await getUserProfile(userId);
        if (!profile) {
          const playerCode = await findFreePlayerCode();
          await createUserProfile(userId, {
            email: email,
            username: email.split('@')[0],
            avatarId: 'arquero',
            playerCode: playerCode,
            userId: playerCode,
            coins: 10000,
            level: 1,
            xp: 0,
            isGuest: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      navigate('/home');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este email ya está registrado');
      else if (err.code === 'auth/user-not-found') setError('No existe una cuenta con este email');
      else if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta');
      else if (err.code === 'auth/invalid-email') setError('Email no válido');
      else if (err.code === 'auth/weak-password') setError('La contraseña es demasiado débil');
      else setError(mode === 'login' ? 'Error al iniciar sesión' : 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const userCredential = await registerGuest();
      const userId = userCredential.user.uid;
      const playerCode = await findFreePlayerCode();

      await createUserProfile(userId, {
        email: 'guest@runamania.com',
        username: `Invitado_${playerCode}`,
        avatarId: 'arquero',
        playerCode: playerCode,
        userId: playerCode,
        coins: 1000,
        level: 1,
        xp: 0,
        isGuest: true,
        createdAt: new Date().toISOString()
      });

      navigate('/home');
    } catch (err) {
      console.error('Error completo:', err);
      
      if (err.code === 'auth/operation-not-allowed') {
        setError('La autenticación anónima no está habilitada. Usa email/contraseña.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu internet.');
      } else {
        setError('Error al crear cuenta de invitado. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return { strength: 0, text: '', color: '' };
    if (pwd.length < 6) return { strength: 1, text: 'Débil', color: '#e74c3c' };
    if (pwd.length < 10) return { strength: 2, text: 'Media', color: '#f39c12' };
    return { strength: 3, text: 'Fuerte', color: '#2ecc71' };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="auth-page">
      <div className="stars-layer stars-small"></div>
      <div className="stars-layer stars-large"></div>
      <div className="nebula"></div>

      <div className="auth-layout">
        <div className="auth-branding">
          <div className="branding-content">
            <div className="brand-logo-large">
              <div className="logo-rune">
                <span className="rune-symbol">ᚱ</span>
              </div>
              <h1 className="brand-name">Runa Mania</h1>
            </div>
            <p className="brand-tagline">
              Colecciona runas legendarias, crea tu mazo perfecto y domina el cielo
            </p>
            <div className="brand-features">
              <div className="feature"><span className="feature-icon">️</span><span>Batallas épicas</span></div>
              <div className="feature"><span className="feature-icon">💎</span><span>10 runas únicas</span></div>
              <div className="feature"><span className="feature-icon">🎁</span><span>Recompensa diaria</span></div>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="form-container">
            <div className="mobile-brand">
              <div className="logo-rune small"><span className="rune-symbol"></span></div>
              <h1 className="brand-name small">Runa Mania</h1>
            </div>

            <div className="auth-toggle">
              <button type="button" className={`toggle-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Iniciar Sesión</button>
              <button type="button" className={`toggle-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Registrarse</button>
              <div className="toggle-slider" style={{ transform: mode === 'login' ? 'translateX(0)' : 'translateX(100%)' }}></div>
            </div>

            <h2 className="form-title">{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
            <p className="form-subtitle">{mode === 'login' ? 'Inicia sesión para continuar tu aventura' : 'Únete a la batalla épica'}</p>

            {error && <div className="error-alert"><span className="error-icon">⚠️</span><span>{error}</span></div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Nombre de Invocador</label>
                  <input type="text" placeholder="Elige tu nombre" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" minLength="3" maxLength="20" autoComplete="username" />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" autoComplete="email" />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                {mode === 'register' && password.length > 0 && (
                  <div className="password-strength">
                    <div className="strength-bar"><div className="strength-fill" style={{ width: `${(passwordStrength.strength / 3) * 100}%`, backgroundColor: passwordStrength.color }}></div></div>
                    <span className="strength-text" style={{ color: passwordStrength.color }}>{passwordStrength.text}</span>
                  </div>
                )}
              </div>

              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Confirmar Contraseña</label>
                    <input type="password" placeholder="Repite tu contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" autoComplete="new-password" />
                    {confirmPassword && password !== confirmPassword && <span className="validation-error">Las contraseñas no coinciden</span>}
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                      <span className="checkmark"></span>
                      <span className="checkbox-text">Acepto los <a href="#" className="terms-link">términos</a> y la <a href="#" className="terms-link">privacidad</a></span>
                    </label>
                  </div>
                </>
              )}

              {mode === 'login' && (
                <div className="form-options">
                  <label className="checkbox-label remember">
                    <input type="checkbox" />
                    <span className="checkmark"></span>
                    <span className="checkbox-text">Recordarme</span>
                  </label>
                  <a href="#" className="forgot-link">¿Olvidaste tu contraseña?</a>
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (<><span className="spinner"></span>{mode === 'login' ? 'Entrando...' : 'Creando cuenta...'}</>) : (mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
              </button>
            </form>

            <div className="auth-divider">
              <span>o</span>
            </div>

            <button type="button" className="guest-btn" onClick={handleGuestLogin} disabled={loading}>
              <span className="guest-icon">👤</span>
              Jugar como Invitado
            </button>
            
            <p className="guest-warning">
              ⚠️ Tu progreso se guarda en este dispositivo. Si borras los datos o cambias de dispositivo, perderás tu progreso. Podrás vincular un correo más tarde desde tu perfil.
            </p>

            <p className="switch-mode-text">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              <button type="button" className="switch-link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;