import React from 'react';
import './RuneCard.css';

const RuneCard = React.memo(({ 
  rune, 
  owned, 
  onClick, 
  quantity, 
  battleMode = false, 
  isFlipping = false, 
  isPlaced = false,
  attackDirs = {} // ✅ Nueva prop para animación de ataque
}) => {
  if (!rune) return null;

  const handleClick = () => {
    if (onClick) onClick(rune);
  };

  // MODO BATALLA
  if (battleMode) {
    const ownerClass = rune.owner === 'ai' ? 'battle-ai' : 'battle-player';
    const animClass = isFlipping ? 'br-flip' : isPlaced ? 'br-placed' : '';
    
    return (
      <div className={`rune-battle ${ownerClass} ${animClass}`} onClick={handleClick}>
        {/* Flechas agrupadas por lado con clases de ataque condicionales */}
        <div className={`battle-arrows battle-arrows-top ${attackDirs.top ? 'arrow-attack-top' : ''}`}>
          {Array.from({ length: rune.arrows.top || 0 }).map((_, i) => (
            <span key={`t-${i}`} className="battle-arrow">▲</span>
          ))}
        </div>
        <div className={`battle-arrows battle-arrows-bottom ${attackDirs.bottom ? 'arrow-attack-bottom' : ''}`}>
          {Array.from({ length: rune.arrows.bottom || 0 }).map((_, i) => (
            <span key={`b-${i}`} className="battle-arrow">▼</span>
          ))}
        </div>
        <div className={`battle-arrows battle-arrows-left ${attackDirs.left ? 'arrow-attack-left' : ''}`}>
          {Array.from({ length: rune.arrows.left || 0 }).map((_, i) => (
            <span key={`l-${i}`} className="battle-arrow">◀</span>
          ))}
        </div>
        <div className={`battle-arrows battle-arrows-right ${attackDirs.right ? 'arrow-attack-right' : ''}`}>
          {Array.from({ length: rune.arrows.right || 0 }).map((_, i) => (
            <span key={`r-${i}`} className="battle-arrow">▶</span>
          ))}
        </div>
        
        {/* Área interior (sin nombre en batalla) */}
        <div className="battle-inner">
          <img src={rune.image} alt={rune.name} className="battle-image" loading="lazy" />
        </div>
      </div>
    );
  }

  // MODO NORMAL (Colección)
  return (
    <div className={`rune-card ${!owned ? 'locked' : ''}`} onClick={handleClick}>
      <div className="rune-inner">
        {owned ? (
          <>
            <img src={rune.image} alt={rune.name} className="rune-image" loading="lazy" />
            <h3 className="rune-name">{rune.name}</h3>
          </>
        ) : (
          <div className="rune-locked">?</div>
        )}
      </div>

      {owned && (
        <>
          <div className="rune-arrows-top">
            {Array.from({ length: rune.arrows.top || 0 }).map((_, i) => (
              <span key={i} className="arrow">▲</span>
            ))}
          </div>
          <div className="rune-arrows-bottom">
            {Array.from({ length: rune.arrows.bottom || 0 }).map((_, i) => (
              <span key={i} className="arrow">▼</span>
            ))}
          </div>
          <div className="rune-arrows-left">
            {Array.from({ length: rune.arrows.left || 0 }).map((_, i) => (
              <span key={i} className="arrow">◀</span>
            ))}
          </div>
          <div className="rune-arrows-right">
            {Array.from({ length: rune.arrows.right || 0 }).map((_, i) => (
              <span key={i} className="arrow">▶</span>
            ))}
          </div>
        </>
      )}
      
      {quantity > 1 && (
        <div className="rune-quantity-badge">x{quantity}</div>
      )}
    </div>
  );
});

export default RuneCard;