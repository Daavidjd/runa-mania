import './RuneDetail.css';

const RuneDetail = ({ rune, owned, quantity, onClose, onAddToDeck, isInDeck }) => {
  const frase = rune?.description || "Una runa ancestral imbuida con el poder de los cielos y el cosmos.";

  const handleAddToDeck = () => {
    onAddToDeck(rune);
    onClose();
  };

  const arrows = rune?.arrows || {};

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
        {/* Botón de cierre */}
        <button className="rd-close-btn" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        {/* Marco de la Ilustración / Altar */}
        <div className="rd-frame">
          {owned ? (
            <div className="rd-artwork-box">
              <img src={rune.image} alt={rune.name} className="rd-image" />
              
              {/* Valores de combate direccionales (Skystones) */}
              {arrows.top !== undefined && (
                <div className="rd-stat-arrow rd-stat-top">▲ {arrows.top}</div>
              )}
              {arrows.bottom !== undefined && (
                <div className="rd-stat-arrow rd-stat-bottom">▼ {arrows.bottom}</div>
              )}
              {arrows.left !== undefined && (
                <div className="rd-stat-arrow rd-stat-left">◀ {arrows.left}</div>
              )}
              {arrows.right !== undefined && (
                <div className="rd-stat-arrow rd-stat-right">▶ {arrows.right}</div>
              )}
            </div>
          ) : (
            <div className="rd-locked-box">
              <span className="rd-locked-icon">🔒</span>
              <span className="rd-locked-txt">Bloqueada</span>
            </div>
          )}
        </div>

        {/* Información y Estadísticas */}
        <div className="rd-content">
          <div className="rd-header-row">
            <h2 className="rd-name">{owned ? rune.name : 'Runa Desconocida'}</h2>
            {owned && quantity > 1 && (
              <span className="rd-quantity-badge">x{quantity}</span>
            )}
          </div>

          <p className="rd-desc">
            {owned ? frase : 'Consigue esta runa en la mina o en batallas para desbloquear sus secretos.'}
          </p>

          {/* Botón de Acción */}
          {owned && (
            <button
              className={`rd-action-btn ${isInDeck ? 'is-in-deck' : 'is-add'}`}
              onClick={handleAddToDeck}
              disabled={isInDeck}
            >
              {isInDeck ? '✓ Ya en el Mazo' : '⚡ Equipar en Mazo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuneDetail;
