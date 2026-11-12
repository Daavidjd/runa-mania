import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RUNES_DB } from '../data/runes';
import { getUserCollection, getPlayerDecks, saveDeck } from '../services/firestore';
import RuneCard from '../components/RuneCard';
import RuneDetail from '../components/RuneDetail';
import './Collection.css';

const DECK_SIZE = 8;

const Collection = () => {
  const { user } = useAuth();
  const [ownedRunes, setOwnedRunes] = useState({});
  const [selectedRune, setSelectedRune] = useState(null);
  const [deck, setDeck] = useState([]);
  const [selectedDeckRune, setSelectedDeckRune] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingDeckAction, setPendingDeckAction] = useState(null);

  const loadData = async () => {
    if (!user) return;
    try {
      const collectionData = await getUserCollection(user.uid);
      const ownedMap = {};
      collectionData.forEach(rune => {
        const runeData = RUNES_DB.find(r => r.id === (rune.runeId || rune.id));
        if (runeData) ownedMap[runeData.id] = { ...runeData, quantity: rune.quantity || 1 };
      });
      setOwnedRunes(ownedMap);

      const rawDecks = await getPlayerDecks(user.uid);
      setDeck((rawDecks.shared || rawDecks.online || rawDecks.npc || [])
        .map(id => ownedMap[id] || RUNES_DB.find(r => r.id === id))
        .filter(Boolean)
        .slice(0, DECK_SIZE));
    } catch (error) {
      console.error('Error cargando colección:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const persistDeck = async (runes) => {
    const next = runes.slice(0, DECK_SIZE);
    setDeck(next);
    try {
      await saveDeck(user.uid, { name: 'Mazo de batalla', type: 'shared', runes: next.map(r => r.id) });
    } catch (error) {
      console.error('Error guardando mazo:', error);
      await loadData();
    }
  };

  const handleAddToDeck = async (rune) => {
    if (deck.some(r => r.id === rune.id)) return;
    if (deck.length >= DECK_SIZE) {
      alert('El mazo ya está completo (8 runas máximo)');
      return;
    }
    await persistDeck([...deck, rune]);
    setSelectedRune(null);
  };

  const handleRemoveFromDeck = async (rune, e) => {
    e?.stopPropagation();
    await persistDeck(deck.filter(r => r.id !== rune.id));
    setSelectedDeckRune(null);
  };

  const isInDeck = rune => deck.some(r => r.id === rune.id);

  const confirmDeckAction = async () => {
    if (pendingDeckAction === 'random') {
      const availableRunes = Object.values(ownedRunes);
      const shuffled = [...availableRunes];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      await persistDeck(shuffled.slice(0, DECK_SIZE));
    } else if (pendingDeckAction === 'clear') {
      await persistDeck([]);
    }
    setSelectedDeckRune(null);
    setPendingDeckAction(null);
  };
  const unlockedCount = Object.keys(ownedRunes).length;

  if (loading) return <div className="collection-loading">Cargando mazo y runas...</div>;

  return (
    <div className="collection-screen">
      <section className="deck-hero-section">
        <div className="deck-hero-header">
          <button
            type="button"
            className="deck-tool-button deck-clear-button"
            onClick={() => setPendingDeckAction('clear')}
            disabled={deck.length === 0}
            title="Vaciar mazo"
            aria-label="Vaciar todo el mazo"
          >🗑️</button>
          <h2 className="deck-hero-title">⚔️ MAZO DE BATALLA</h2>
          <button
            type="button"
            className="deck-tool-button deck-random-button"
            onClick={() => setPendingDeckAction('random')}
            disabled={unlockedCount === 0}
            title="Crear mazo aleatorio"
            aria-label="Crear mazo aleatorio con mis runas"
          >🎲</button>
        </div>
        <div className="deck-hero-grid deck-grid-online">
          {Array.from({ length: DECK_SIZE }).map((_, index) => {
            const rune = deck[index];
            const isSelected = selectedDeckRune?.id === rune?.id;
            return (
              <div key={index} className="deck-hero-slot">
                {rune ? (
                  <div className={`deck-card-wrapper ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDeckRune(isSelected ? null : rune)}>
                    <RuneCard rune={rune} owned={true} />
                    {isSelected && <button className="deck-remove-pill" onClick={(e) => handleRemoveFromDeck(rune, e)}>✕ Quitar</button>}
                  </div>
                ) : (
                  <div className="deck-hero-empty">
                    <span className="empty-plus">+</span>
                    <span className="empty-txt">Ranura {index + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="collection-divider-clean">
        <h3 className="divider-label">COLECCIÓN</h3>
        <span className="divider-stats-pill">{unlockedCount} / {RUNES_DB.length}</span>
      </div>

      <main className="collection-compact-area">
        <div className="runes-compact-grid">
          {RUNES_DB.map(rune => {
            const owned = !!ownedRunes[rune.id];
            const inDeck = isInDeck(rune);
            return (
              <div key={rune.id} className="compact-item-wrapper">
                <RuneCard rune={rune} owned={owned} onClick={() => setSelectedRune(rune)} />
                {inDeck && <div className="compact-deck-badge" style={{ background: '#a855f7' }}>✓ EN MAZO</div>}
              </div>
            );
          })}
        </div>
      </main>

      {pendingDeckAction && (
        <div className="deck-confirm-overlay" role="presentation" onClick={() => setPendingDeckAction(null)}>
          <section
            className="deck-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-confirm-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="deck-confirm-icon">{pendingDeckAction === 'random' ? '🎲' : '🗑️'}</div>
            <h3 id="deck-confirm-title">{pendingDeckAction === 'random' ? '¿MAZO ALEATORIO?' : '¿VACIAR EL MAZO?'}</h3>
            <p>
              {pendingDeckAction === 'random'
                ? `Se elegirán hasta 8 runas al azar de las ${unlockedCount} que tienes. ¿Quieres continuar?`
                : 'Se quitarán todas las runas de tu mazo. ¿Seguro que quieres continuar?'}
            </p>
            <div className="deck-confirm-actions">
              <button type="button" className="deck-confirm-cancel" onClick={() => setPendingDeckAction(null)}>Cancelar</button>
              <button type="button" className="deck-confirm-accept" onClick={confirmDeckAction}>
                {pendingDeckAction === 'random' ? '¡Alea, crear!' : 'Sí, vaciar'}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedRune && (
        <RuneDetail
          rune={selectedRune}
          owned={!!ownedRunes[selectedRune.id]}
          quantity={ownedRunes[selectedRune.id]?.quantity || 0}
          onClose={() => setSelectedRune(null)}
          onAddToDeck={handleAddToDeck}
          isInDeck={isInDeck(selectedRune)}
        />
      )}
    </div>
  );
};

export default Collection;
