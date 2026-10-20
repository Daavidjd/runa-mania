import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { RUNES_DB } from '../data/runes';
import { getUserCollection, getUserDecks, saveDeck, deleteDeck } from '../services/firestore';
import RuneCard from './RuneCard';
import RuneDetail from './RuneDetail';
import './Collection.css';

const Collection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
        const runeData = RUNES_DB.find(r => r.id === rune.id);
        if (runeData) {
          ownedMap[rune.id] = {
            ...runeData,
            quantity: rune.quantity
          };
        }
      });
      
      setOwnedRunes(ownedMap);

      const userDecks = await getUserDecks(user.uid);
      if (userDecks.length > 0) {
        const deck = userDecks[0];
        setDeckId(deck.id);
        const deckRunes = deck.runes.map(id => ownedMap[id]).filter(Boolean);
        setMyDeck(deckRunes);
      } else {
        setMyDeck([]);
        setDeckId(null);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
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
      alert('El mazo ya está lleno (5 runas máx)');
      return;
    }

    try {
      const newRunes = [...myDeck, rune];
      
      if (deckId) {
        await deleteDeck(user.uid, deckId);
      }
      
      await saveDeck(user.uid, {
        name: 'Mi Mazo',
        runes: newRunes.map(r => r.id)
      });
      
      setMyDeck(newRunes);
      const decks = await getUserDecks(user.uid);
      setDeckId(decks[0].id);
    } catch (error) {
      console.error('Error añadiendo al mazo:', error);
    }
  };

  const handleDeckRuneClick = async (rune) => {
    if (selectedDeckRune?.id === rune.id) {
      try {
        const newRunes = myDeck.filter(r => r.id !== rune.id);
        
        if (deckId) {
          await deleteDeck(user.uid, deckId);
        }
        
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
          setDeckId(decks[0].id);
        }
      } catch (error) {
        console.error('Error eliminando del mazo:', error);
      }
    } else {
      setSelectedDeckRune(rune);
    }
  };

  const isInDeck = (rune) => myDeck.find(r => r.id === rune.id);

  if (loading) {
    return <div className="collection-loading">Cargando colección...</div>;
  }

  return (
    <div className="collection-container">
      <button className="home-btn" onClick={() => navigate('/home')}>
        🏠 Home
      </button>

      <div className="deck-panel-visual">
        <h2 className="deck-title">MI MAZO</h2>
        <div className="deck-slots-visual">
          {Array.from({ length: 5 }).map((_, index) => {
            const rune = myDeck[index];
            return (
              <div key={index} className="deck-slot-visual">
                {rune ? (
                  <div 
                    className={`rune-in-deck ${selectedDeckRune?.id === rune.id ? 'selected' : ''}`}
                    onClick={() => handleDeckRuneClick(rune)}
                  >
                    <img src={rune.image} alt={rune.name} className="deck-rune-image" />
                    <span className="deck-rune-name">{rune.name}</span>
                    <div className="remove-rune-hint">
                      {selectedDeckRune?.id === rune.id ? 'Clic otra vez para quitar' : 'Clic para seleccionar'}
                    </div>
                  </div>
                ) : (
                  <div className="empty-deck-slot">
                    <span className="plus-icon">+</span>
                    <span className="empty-text">Vacío</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="runes-grid">
        {RUNES_DB.map(rune => (
          <div key={rune.id} className="rune-card-wrapper">
            <RuneCard
              rune={rune}
              owned={!!ownedRunes[rune.id]}
              onClick={() => setSelectedRune(rune)}
            />
            {isInDeck(rune) && (
              <div className="in-deck-badge">✓ En mazo</div>
            )}
          </div>
        ))}
      </div>

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