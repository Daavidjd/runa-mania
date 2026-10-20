import './RuneDetail.css';

const RuneDetail = ({ rune, owned, quantity, onClose, onAddToDeck, isInDeck }) => {
  const frase = "Una runa poderosa que aguarda en las sombras del cielo.";

  const handleAddToDeck = () => {
    onAddToDeck(rune);
    onClose(); // Cierra el popup después de añadir
  };

  return (
    <div className="rune-detail-overlay" onClick={onClose}>
      <div className="rune-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}></button>
        
        <div className="rune-detail-header">
          {owned ? (
            <img src={rune.image} alt={rune.name} className="rune-detail-image" />
          ) : (
            <div className="rune-detail-locked">🔒</div>
          )}
        </div>

        <div className="rune-detail-body">
          <h2 className="rune-detail-name">
            {owned ? rune.name : 'Runa Desconocida'}
          </h2>
          
          {owned && quantity > 1 && (
            <span className="owned-quantity">Tienes x{quantity}</span>
          )}

          <div className="rune-description">
            <p>{owned ? frase : 'Consigue esta runa para desbloquear su descripción.'}</p>
          </div>

          {owned && (
            <div className="rune-actions">
              <button 
                className={`action-btn ${isInDeck ? 'in-deck' : 'primary'}`}
                onClick={handleAddToDeck}
                disabled={isInDeck}
              >
                {isInDeck ? '✓ Ya está en el mazo' : 'Añadir al Mazo'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuneDetail;