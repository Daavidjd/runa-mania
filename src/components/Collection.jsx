import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RUNES_DB } from '../data/runes';
import { getUserCollection, getUserDecks, saveDeck, deleteDeck } from '../services/firestore';
import RuneCard from './RuneCard';
import RuneDetail from './RuneDetail';
import './Collection.css';

const Collection = () => {
  const { user } = useAuth();

  const [ownedRunes, setOwnedRunes] = useState({});
  const [selectedRune, setSelectedRune] = useState(null);
  const [myDeck, setMyDeck] = useState([]);
  const [deckId, setDeckId] = useState(null);
  const [selectedDeckRune, setSelectedDeckRune] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    try {
      const collection = await getUserCollection(user.uid);
      const ownedMap = {};

      collection.forEach(rune => {
        const runeData = RUNES_DB.find(r => r.id === (rune.runeId || rune.id));
        if (runeData) {
          ownedMap[runeData.id] = {
            ...runeData,
            quantity: rune.quantity || 1
          };
        }
      });

      setOwnedRunes(ownedMap);

      const userDecks = await getUserDecks(user.uid);
      if (userDecks.length > 0) {
        const deck = userDecks[0];
        setDeckId(deck.id);
        const deckRunes = (deck.runes || []).map(id => ownedMap[id]).filter(Boolean);
        setMyDeck(deckRunes);
      } else {
        setMyDeck([]);
        setDeckId(null);
      }
    } catch (error) {
      console.error('Error cargando colección:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleAddToDeck = async (rune) => {
    if (myDeck.find(r => r.id === rune.id)) return;
    if (myDeck.length >= 5) {
      alert('El mazo ya está lleno (5 runas máximo)');
      return;
    }

    try {
      const newRunes = [...myDeck, rune];
      if (deckId) await deleteDeck(user.uid, deckId);

      await saveDeck(user.uid, {
        name: 'Mi Mazo',
        runes: newRunes.map(r => r.id)
      });

      setMyDeck(newRunes);
      const decks = await getUserDecks(user.uid);
      if (decks.length > 0) setDeckId(decks[0].id);
    } catch (error) {
      console.error('Error añadiendo al mazo:', error);
    }
  };

  const handleRemoveFromDeck = async (rune, e) => {
    if (e) e.stopPropagation();
    try {
      const newRunes = myDeck.filter(r => r.id !== rune.id);
      if (deckId) await deleteDeck(user.uid, deckId);

      if (newRunes.length > 0) {
        await saveDeck(user.uid, {
          name: 'Mi Mazo',
          runes: newRunes.map(r => r.id)
        });
      }

      setMyDeck(newRunes);
      setSelectedDeckRune(null);

      if (newRunes.length === 0) {
        setDeckId(null);
      } else {
        const decks = await getUserDecks(user.uid);
        if (decks.length > 0) setDeckId(decks[0].id);
      }
    } catch (error) {
      console.error('Error quitando del mazo:', error);
    }
  };

  const isInDeck = (rune) => myDeck.some(r => r.id === rune.id);
  const unlockedCount = Object.keys(ownedRunes).length;

  if (loading) {
    return <div className="collection-loading">Cargando mazo y runas...</div>;
  }

  return (
    <div className="collection-screen">
      {/* 1. EL MAZO PROTAGONISTA (3 arriba + 2 abajo) */}
      <section className="deck-hero-section">
        <div className="deck-hero-header">
          <div className="deck-title-group">
            <span className="deck-icon">⚡</span>
            <h2 className="deck-hero-title">MAZO DE BATALLA</h2>
          </div>
          <div className="deck-pill-badge">
            <span className="badge-count">{myDeck.length}/5</span>
          </div>
        </div>

        <div className="deck-hero-grid">
          {Array.from({ length: 5 }).map((_, index) => {
            const rune = myDeck[index];
            const isSelected = selectedDeckRune?.id === rune?.id;

            return (
              <div
                key={index}
                className={`deck-hero-slot ${index >= 3 ? 'bottom-row' : ''}`}
              >
                {rune ? (
                  <div
                    className={`deck-card-wrapper ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDeckRune(isSelected ? null : rune)}
                  >
                    <RuneCard rune={rune} owned={true} />
                    {isSelected && (
                      <button
                        className="deck-remove-pill"
                        onClick={(e) => handleRemoveFromDeck(rune, e)}
                      >
                        ✕ Quitar
                      </button>
                    )}
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

      {/* 2. BARRA DIVISORIA LIMPIA */}
      <div className="collection-divider-clean">
        <h3 className="divider-label">COLECCIÓN Y RESERVA</h3>
        <span className="divider-stats-pill">
          {unlockedCount} / {RUNES_DB.length}
        </span>
      </div>

      {/* 3. GRILLA COMPACTA DE 4 COLUMNAS */}
      <main className="collection-compact-area">
        <div className="runes-compact-grid">
          {RUNES_DB.map(rune => {
            const owned = !!ownedRunes[rune.id];
            const inDeck = isInDeck(rune);

            return (
              <div key={rune.id} className="compact-item-wrapper">
                <RuneCard
                  rune={rune}
                  owned={owned}
                  onClick={() => setSelectedRune(rune)}
                />
                {inDeck && <div className="compact-deck-badge">✓ EN MAZO</div>}
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL DETALLE DE RUNA */}
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
