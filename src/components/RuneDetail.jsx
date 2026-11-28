import { useState } from 'react';
import RuneCard from './RuneCard';
import './RuneDetail.css';

const DIRECTIONS = ['top', 'right', 'bottom', 'left'];

const getArrowsForLevel = (rune, level) => {
  const arrows = { top: 0, right: 0, bottom: 0, left: 0 };
  DIRECTIONS.forEach(direction => {
    arrows[direction] = Math.max(0, Number(rune.startingArrows?.[direction]) || 0);
  });
  (rune.evolutionPath || []).slice(0, Math.max(0, level - 1)).forEach(direction => {
    if (DIRECTIONS.includes(direction)) arrows[direction] += 1;
  });
  return arrows;
};

const RuneDetail = ({
  rune, owned, quantity, level = 1, repes = 0,
  onClose, onAddToDeck, onUpgradeRune, isInDeck
}) => {
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const frase = rune?.description || 'Una runa ancestral imbuida con el poder de los cielos y el cosmos.';
  const maxLevel = rune?.evolutionPath?.length || 1;
  const currentLevel = Math.min(maxLevel, Math.max(1, Number(level) || 1));
  const upgradeCost = 3 * currentLevel;
  const isMaxLevel = currentLevel >= maxLevel;
  const progress = isMaxLevel ? 100 : Math.min(100, (Math.max(0, repes) / upgradeCost) * 100);
  const previewRune = owned
    ? { ...rune, arrows: getArrowsForLevel(rune, currentLevel) }
    : rune;

  const handleAddToDeck = () => {
    onAddToDeck(rune);
    onClose();
  };

  const handleUpgrade = async () => {
    if (upgrading || isMaxLevel || repes < upgradeCost) return;
    setUpgrading(true);
    setUpgradeMessage('');
    try {
      const result = await onUpgradeRune(rune);
      if (result?.success) setUpgradeMessage(`¡Runa mejorada al nivel ${result.level}!`);
      else setUpgradeMessage(result?.message || 'No se ha podido mejorar la runa.');
    } catch (error) {
      setUpgradeMessage('No se ha podido mejorar la runa. Inténtalo de nuevo.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rd-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="rd-frame">
          {owned ? (
            <div className="rd-artwork-box">
              <RuneCard rune={previewRune} owned={true} battleMode={true} />
            </div>
          ) : (
            <div className="rd-locked-box">
              <span className="rd-locked-icon">🔒</span>
              <span className="rd-locked-txt">Bloqueada</span>
            </div>
          )}
        </div>

        <div className="rd-content">
          <div className="rd-header-row">
            <h2 className="rd-name">{owned ? rune.name : 'Runa Desconocida'}</h2>
            {owned && quantity > 1 && <span className="rd-quantity-badge">x{quantity}</span>}
          </div>

          <p className="rd-desc">
            {owned ? frase : 'Consigue esta runa en la mina o en batallas para desbloquear sus secretos.'}
          </p>

          {owned && (
            <section className="rd-evolution">
              <div
                className="rd-progress-track"
                role="progressbar"
                aria-label="Progreso de copias para la siguiente mejora"
                aria-valuemin={0}
                aria-valuemax={upgradeCost}
                aria-valuenow={isMaxLevel ? upgradeCost : Math.min(repes, upgradeCost)}
              >
                <div className="rd-progress-fill" style={{ width: `${progress}%` }} />
                <span className="rd-progress-label">
                  {isMaxLevel ? 'NIVEL MÁXIMO' : `COPIAS ${Math.min(repes, upgradeCost)}/${upgradeCost}`}
                </span>
              </div>
              {!isMaxLevel && repes >= upgradeCost && (
                <button
                  type="button"
                  className="rd-upgrade-btn"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  {upgrading ? 'MEJORANDO...' : `⬆ MEJORAR · ${upgradeCost} REPES`}
                </button>
              )}
              {upgradeMessage && <p className="rd-upgrade-message" role="status">{upgradeMessage}</p>}
            </section>
          )}

          {owned && (
            <button
              className={`rd-action-btn ${isInDeck ? 'is-in-deck' : 'is-add'}`}
              onClick={handleAddToDeck}
              disabled={isInDeck}
            >
              {isInDeck ? '✓ Ya en el Mazo' : 'EQUIPAR EN MAZO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuneDetail;