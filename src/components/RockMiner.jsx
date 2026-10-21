import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRandomRune } from '../data/runes';
import { addRuneToCollection } from '../services/firestore';
import RuneCard from './RuneCard';
import Roca1 from '../assets/rocks/Roca1.png';
import Roca2 from '../assets/rocks/Roca2.png';
import Roca3 from '../assets/rocks/Roca3.png';
import './RockMiner.css';

const ROCK_IMAGES = [Roca1, Roca2, Roca3];

const RockMiner = ({ onClose, rockType = 'normal' }) => {
  const { user } = useAuth();
  const [hits, setHits] = useState(0);
  const [revealedRune, setRevealedRune] = useState(null);
  const [mining, setMining] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prevenir navegación accidental mientras se pica
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
    if (mining || hits >= 3 || revealedRune) return;

    const newHits = hits + 1;
    setHits(newHits);
    setMining(true);

    setTimeout(() => setMining(false), 300);

    if (newHits === 3) {
      const rune = getRandomRune(rockType);
      setRevealedRune(rune);

      if (user) {
        setSaving(true);
        try {
          await addRuneToCollection(user.uid, rune);
        } catch (error) {
          console.error('Error guardando runa:', error);
        } finally {
          setSaving(false);
        }
      }
    }
  };

  const rockImage = ROCK_IMAGES[Math.min(hits, 2)];

  return (
    <div className="rock-miner-overlay" onClick={handleHit}>
      {!revealedRune ? (
        <div className="miner-minimal-view">
          <h1 className="miner-huge-title">PICA</h1>

          <div className={`rock-center ${mining ? 'shaking' : ''}`}>
            <img src={rockImage} alt="Roca" className="rock-standalone-img" />
          </div>
        </div>
      ) : (
        <div className="reveal-minimal-view" onClick={(e) => e.stopPropagation()}>
          <h2 className="reveal-minimal-title">¡RUNA OBTENIDA!</h2>
          
          <div className="reveal-rune-box">
            <RuneCard rune={revealedRune} owned={true} battleMode={true} />
          </div>

          <button className="collect-minimal-btn" onClick={onClose} disabled={saving}>
            {saving ? 'Guardando...' : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RockMiner;
