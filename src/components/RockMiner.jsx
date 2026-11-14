import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRandomRune } from '../data/runes';
import { addRuneToCollection } from '../services/firestore';
import RuneCard from './RuneCard';

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

import './RockMiner.css';

// ✅ Mapeo actualizado: 'daily' usa las marrones
const ROCK_IMAGES = {
  daily: [Roca1, Roca2, Roca3], 
  normal: [RocaBlanca1, RocaBlanca2, RocaBlanca3],
  rare: [RocaAzul1, RocaAzul2, RocaAzul3],
  epic: [RocaLila1, RocaLila2, RocaLila3]
};

const RockMiner = ({ onClose, rockType = 'normal' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hits, setHits] = useState(0);
  const [revealedRune, setRevealedRune] = useState(null);
  const [mining, setMining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const isProcessingRef = useRef(false);
  const hitCountRef = useRef(0);
  const awardIdRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => {
    Object.values(ROCK_IMAGES).flat().forEach(src => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('popstate', handleBack);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleHit = async () => {
    // Ignora cualquier toque adicional mientras la fase actual está activa.
    // No se encolan golpes: cada animación debe terminar antes del siguiente.
    if (revealedRune || isProcessingRef.current || hitCountRef.current >= 3) return;

    isProcessingRef.current = true;
    try {
      const newHits = hitCountRef.current + 1;
      hitCountRef.current = newHits;
      setHits(newHits);
      setMining(true);

      // La animación de golpe dura 300 ms; dejamos una pequeña pausa extra
      // para que cada estado de la roca se vea antes de aceptar otro toque.
      await new Promise(resolve => setTimeout(resolve, 480));
      setMining(false);

      if (newHits === 3) {
        const rune = getRandomRune(rockType);
        setRevealedRune(rune);
        awardIdRef.current = awardIdRef.current || `mine-${user?.uid || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (user) {
          setSaving(true);
          setSaveError(false);
          try {
            await addRuneToCollection(user.uid, rune, awardIdRef.current);
            savedRef.current = true;
          } catch (err) {
            console.error('Error guardando runa:', err);
            setSaveError(true);
          } finally {
            setSaving(false);
          }
        }
      }
    } finally {
      setMining(false);
      isProcessingRef.current = false;
    }
  };

  const handleRetrySave = async () => {
    if (!user || !revealedRune || savedRef.current || saving || !awardIdRef.current) return;
    isProcessingRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await addRuneToCollection(user.uid, revealedRune, awardIdRef.current);
      savedRef.current = true;
    } catch (err) {
      console.error('Error reintentando guardar runa:', err);
      setSaveError(true);
    } finally {
      setSaving(false);
      isProcessingRef.current = false;
    }
  };

  // Si el tipo es 'daily', usa las marrones. Si no, usa las correspondientes.
  const rockImages = ROCK_IMAGES[rockType] || ROCK_IMAGES.normal;
  const rockImage = rockImages[Math.min(hits, 2)];

  return (
    <div className="rock-miner-overlay" onClick={handleHit}>
      {!revealedRune ? (
        <div className="miner-minimal-view">
          <h1 className="miner-huge-title">PICA</h1>

          <div className={`rock-center ${mining ? 'shaking' : ''}`}>
            <img key={rockImage} src={rockImage} alt="Roca" className="rock-standalone-img" draggable="false" />
          </div>
          
          {/* ✅ Eliminados los puntos de progreso (miner-hits-indicator) */}
        </div>
      ) : (
        <div className="reveal-minimal-view" onClick={(e) => e.stopPropagation()}>
          <h2 className="reveal-minimal-title">¡RUNA OBTENIDA!</h2>

          {saveError && (
            <div className="save-error-banner">
              No se pudo confirmar el guardado. Tu runa sigue aquí; vuelve a intentarlo.
            </div>
          )}

          <button
            type="button"
            className="reveal-rune-box"
            onClick={() => navigate('/collection', { state: { selectedRuneId: revealedRune.id } })}
            aria-label={`Ver detalles de ${revealedRune.name} en la colección`}
          >
            <RuneCard rune={revealedRune} owned={true} battleMode={true} />
          </button>

          <button
            className={`collect-minimal-btn ${saveError ? 'btn-warning' : ''}`}
            onClick={saveError ? handleRetrySave : onClose}
            disabled={saving || saveError || (!savedRef.current && !!user)}
          >
            {saving ? '⏳ Guardando...' : saveError ? 'Reintentar guardado' : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RockMiner;