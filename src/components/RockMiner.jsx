import { useState, useEffect, useRef } from 'react';
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

const SAVE_TIMEOUT_MS = 5000;

const RockMiner = ({ onClose, rockType = 'normal' }) => {
  const { user } = useAuth();
  const [hits, setHits] = useState(0);
  const [revealedRune, setRevealedRune] = useState(null);
  const [mining, setMining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const isProcessingRef = useRef(false);

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
    if (mining || hits >= 3 || revealedRune || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const newHits = hits + 1;
      setHits(newHits);
      setMining(true);

      setTimeout(() => setMining(false), 300);

      if (newHits === 3) {
        const rune = getRandomRune(rockType);
        setRevealedRune(rune);

        if (user) {
          setSaving(true);
          setSaveError(false);

          const savePromise = addRuneToCollection(user.uid, rune);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), SAVE_TIMEOUT_MS)
          );

          try {
            await Promise.race([savePromise, timeoutPromise]);
          } catch (err) {
            console.error('Error guardando runa (no bloqueante):', err);
            setSaveError(true);
          } finally {
            setSaving(false);
          }
        }
      }
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);
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
            <img src={rockImage} alt="Roca" className="rock-standalone-img" />
          </div>
          
          {/* ✅ Eliminados los puntos de progreso (miner-hits-indicator) */}
        </div>
      ) : (
        <div className="reveal-minimal-view" onClick={(e) => e.stopPropagation()}>
          <h2 className="reveal-minimal-title">¡RUNA OBTENIDA!</h2>

          {saveError && (
            <div className="save-error-banner">
              ️ Error al guardar. La runa se mostrará pero puede no quedar en tu colección.
            </div>
          )}

          <div className="reveal-rune-box">
            <RuneCard rune={revealedRune} owned={true} battleMode={true} />
          </div>

          <button
            className={`collect-minimal-btn ${saveError ? 'btn-warning' : ''}`}
            onClick={onClose}
            disabled={saving}
          >
            {saving ? '⏳ Guardando...' : saveError ? '⚠️ Continuar (sin guardar)' : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RockMiner;