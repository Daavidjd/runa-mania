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

const RockMiner = ({ onClose, rockType = 'normal', rockLabel = 'Roca Normal' }) => {
  const { user } = useAuth();
  const [hits, setHits] = useState(0);
  const [revealedRune, setRevealedRune] = useState(null);
  const [mining, setMining] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bloquear el botón "Atrás" del navegador y el gesto de volver en móvil
  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);

    // Prevenir cierre por tecla Escape
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

    setTimeout(() => setMining(false), 400);

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
    <div className="rock-miner-overlay">
      <div className="rock-miner-content">
        
        {!revealedRune ? (
          <>
            <h2 className="miner-title">PICA</h2>
            <p className="miner-hits">{3 - hits} golpes restantes</p>

            <div className={`rock-container ${mining ? 'shaking' : ''}`} onClick={handleHit}>
              <img 
                src={rockImage} 
                alt="Roca"
                className="rock-image"
              />
            </div>
          </>
        ) : (
          <div className="reveal-container">
            <h2 className="reveal-title">¡Runa Obtenida!</h2>
            <div className="revealed-rune">
              <RuneCard 
                rune={revealedRune} 
                owned={true} 
                quantity={1}
                onClick={() => {}}
              />
            </div>
            <button className="collect-btn" onClick={onClose} disabled={saving}>
              {saving ? 'Guardando...' : 'Continuar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RockMiner;