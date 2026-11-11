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
  const unlockedCount = Object.keys(ownedRunes).length;

  if (loading) return <div className="collection-loading">Cargando mazo y runas...</div>;

  return (
    <div className="collection-screen">
      <section className="deck-hero-section">
        <div className="deck-hero-header">
          <h2 className="deck-hero-title">⚔️ MAZO DE BATALLA</h2>
          <span className={`deck-hero-hint ${deck.length === DECK_SIZE ? 'deck-hero-hint-ok' : ''}`}>
            {deck.length === DECK_SIZE ? '✓ Completo' : `${deck.length}/${DECK_SIZE}`}
          </span>
        </div>
        <p className="shared-deck-description">El mismo mazo se utiliza en batallas NPC y online</p>
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
