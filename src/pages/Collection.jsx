import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RUNES_DB } from '../data/runes';
import { getUserCollection, getPlayerDecks, saveDeck } from '../services/firestore';
import RuneCard from '../components/RuneCard';
import RuneDetail from '../components/RuneDetail';
import './Collection.css';

// Dos mazos: NPC (5 runas) y ONLINE (8 runas)
const DECK_CONFIG = {
  npc:    { label: '🤖 MAZO NPC',    size: 5, slots: 5, color: '#f39c12' },
  online: { label: '🌐 MAZO ONLINE', size: 8, slots: 8, color: '#a855f7' }
};

const Collection = () => {
  const { user } = useAuth();

  const [ownedRunes, setOwnedRunes] = useState({});
  const [selectedRune, setSelectedRune] = useState(null);
  const [activeTab, setActiveTab] = useState('npc'); // 'npc' | 'online'
  const [decks, setDecks] = useState({ npc: [], online: [] }); // listas de runas por mazo
  const [selectedDeckRune, setSelectedDeckRune] = useState(null);
  const [loading, setLoading] = useState(true);

  const cfg = DECK_CONFIG[activeTab];
  const currentDeck = decks[activeTab];

  const loadData = async () => {
    if (!user) return;
    try {
      const collectionData = await getUserCollection(user.uid);
      const ownedMap = {};

      collectionData.forEach(rune => {
        const runeData = RUNES_DB.find(r => r.id === (rune.runeId || rune.id));
        if (runeData) {
          ownedMap[runeData.id] = {
            ...runeData,
            quantity: rune.quantity || 1
          };
        }
      });

      setOwnedRunes(ownedMap);

      const rawDecks = await getPlayerDecks(user.uid);
      setDecks({
        npc: (rawDecks.npc || []).map(id => ownedMap[id]).filter(Boolean),
        online: (rawDecks.online || []).map(id => ownedMap[id]).filter(Boolean)
      });
    } catch (error) {
      console.error('Error cargando colección:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Guarda el mazo completo en su doc determinista ('npc' o 'online')
  const persistDeck = async (type, runes) => {
    const next = { ...decks, [type]: runes };
    setDecks(next);
    try {
      await saveDeck(user.uid, {
        name: type === 'npc' ? 'Mazo NPC' : 'Mazo Online',
        type,
        runes: runes.map(r => r.id)
      });
    } catch (error) {
      console.error('Error guardando mazo:', error);
    }
  };

  const handleAddToDeck = async (rune) => {
    if (currentDeck.find(r => r.id === rune.id)) return;
    if (currentDeck.length >= cfg.size) {
      alert(`El mazo ${activeTab === 'npc' ? 'NPC' : 'Online'} ya está lleno (${cfg.size} runas máximo)`);
      return;
    }
    await persistDeck(activeTab, [...currentDeck, rune]);
    setSelectedRune(null);
  };

  const handleRemoveFromDeck = async (rune, e) => {
    if (e) e.stopPropagation();
    await persistDeck(activeTab, currentDeck.filter(r => r.id !== rune.id));
    setSelectedDeckRune(null);
  };

  const isInDeck = (rune) => currentDeck.some(r => r.id === rune.id);
  const unlockedCount = Object.keys(ownedRunes).length;

  if (loading) {
    return <div className="collection-loading">Cargando mazos y runas...</div>;
  }

  return (
    <div className="collection-screen">
      {/* 1. EL MAZO PROTAGONISTA (Anclado arriba) */}
      <section className="deck-hero-section">
        {/* Selector de mazo: NPC (5) u Online (8) */}
        <div className="deck-tabs">
          {Object.entries(DECK_CONFIG).map(([key, c]) => (
            <button
              key={key}
              className={`deck-tab ${activeTab === key ? 'deck-tab-active' : ''}`}
              style={activeTab === key ? { '--tab-color': c.color } : undefined}
              onClick={() => { setActiveTab(key); setSelectedDeckRune(null); }}
            >
              <span className="deck-tab-label">{c.label}</span>
              <span className="deck-tab-count">{decks[key].length}/{c.size}</span>
            </button>
          ))}
        </div>

        <div className="deck-hero-header">
          <h2 className="deck-hero-title" style={{ color: cfg.color }}>{cfg.label}</h2>
          <span className={`deck-hero-hint ${currentDeck.length === cfg.size ? 'deck-hero-hint-ok' : ''}`}>
            {currentDeck.length === cfg.size ? '✓ Completo' : `${currentDeck.length}/${cfg.size}`}
          </span>
        </div>

        <div className={`deck-hero-grid ${activeTab === 'npc' ? 'deck-grid-npc' : 'deck-grid-online'}`}>
          {Array.from({ length: cfg.slots }).map((_, index) => {
            const rune = currentDeck[index];
            const isSelected = selectedDeckRune?.id === rune?.id;

            return (
              <div
                key={index}
                className={`deck-hero-slot ${index >= 4 ? 'bottom-row' : ''}`}
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
        <h3 className="divider-label">COLECCIÓN</h3>
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
                {inDeck && (
                  <div className="compact-deck-badge" style={{ background: cfg.color }}>
                    ✓ EN MAZO
                  </div>
                )}
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
