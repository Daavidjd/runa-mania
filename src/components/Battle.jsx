import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserDecks, getUserProfile, updateUserProfile } from '../services/firestore';
import { RUNES_DB } from '../data/runes';
import RuneCard from './RuneCard';
import './Battle.css';

const Battle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [board, setBoard] = useState(Array(9).fill(null));
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [turn, setTurn] = useState('player');
  const [selectedCard, setSelectedCard] = useState(null);
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [flippingCells, setFlippingCells] = useState([]);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);

  const loadDeck = async () => {
    setLoading(true);
    setShowEndModal(false);
    try {
      let playerRunes = [];
      if (user) {
        const decks = await getUserDecks(user.uid);
        if (decks.length > 0 && decks[0].runes?.length > 0) {
          playerRunes = decks[0].runes
            .map(id => RUNES_DB.find(r => r.id === id))
            .filter(Boolean)
            .map(r => ({ ...r, owner: 'player' }));
        }
      }
      if (playerRunes.length === 0) {
        const shuffled = [...RUNES_DB].sort(() => 0.5 - Math.random());
        playerRunes = shuffled.slice(0, 5).map(r => ({ ...r, owner: 'player' }));
      }
      
      const shuffled = [...RUNES_DB].sort(() => 0.5 - Math.random());
      const aiRunes = shuffled.slice(0, 5).map(r => ({ ...r, owner: 'ai' }));

      setPlayerHand(playerRunes);
      setAiHand(aiRunes);
      setBoard(Array(9).fill(null));
      setTurn('player');
      setSelectedCard(null);
      setScores({ player: 0, ai: 0 });
      setGameOver(false);
      setWinner(null);
      setFlippingCells([]);
      setLastPlaced(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeck(); }, [user]);

  const resolveCaptures = (newBoard, index, owner) => {
    const placed = newBoard[index];
    if (!placed) return { board: newBoard, captured: [] };
    
    const row = Math.floor(index / 3);
    const col = index % 3;
    const dirs = [
      { dr: -1, dc: 0, s: 'top', o: 'bottom' },
      { dr: 0, dc: 1, s: 'right', o: 'left' },
      { dr: 1, dc: 0, s: 'bottom', o: 'top' },
      { dr: 0, dc: -1, s: 'left', o: 'right' }
    ];
    
    const final = newBoard.map(c => c ? { ...c } : null);
    const captured = [];
    
    dirs.forEach(({ dr, dc, s, o }) => {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        const idx = nr * 3 + nc;
        const adj = final[idx];
        if (adj && adj.owner !== owner) {
          const atk = placed.arrows[s] || 0;
          const def = adj.arrows[o] || 0;
          if (atk > def) {
            final[idx] = { ...adj, owner };
            captured.push(idx);
          }
        }
      }
    });
    return { board: final, captured };
  };

  const calcScores = (b) => {
    let p = 0, a = 0;
    b.forEach(c => { if (c?.owner === 'player') p++; else if (c?.owner === 'ai') a++; });
    return { player: p, ai: a };
  };

  const handleCellClick = (index) => {
    if (gameOver || turn !== 'player' || board[index] || selectedCard === null) return;
    
    const card = playerHand[selectedCard];
    const newBoard = [...board];
    newBoard[index] = { ...card, owner: 'player' };
    
    const { board: resolved, captured } = resolveCaptures(newBoard, index, 'player');
    const newScores = calcScores(resolved);
    
    setBoard(resolved);
    setPlayerHand(playerHand.filter((_, i) => i !== selectedCard));
    setScores(newScores);
    setSelectedCard(null);
    setLastPlaced(index);

    if (captured.length > 0) {
      setFlippingCells(captured);
      setTimeout(() => setFlippingCells([]), 800);
    }
    setTimeout(() => setLastPlaced(null), 600);

    if (playerHand.length - 1 === 0 && aiHand.length === 0) {
      const result = newScores.player > newScores.ai ? 'player' : newScores.ai > newScores.player ? 'ai' : 'draw';
      setGameOver(true);
      setWinner(result);
      setTimeout(() => setShowEndModal(true), 1000);
    } else {
      setTurn('ai');
    }
  };

  useEffect(() => {
    if (turn !== 'ai' || gameOver) return;
    const timer = setTimeout(async () => {
      let best = null, maxCap = -1;
      aiHand.forEach((card, ci) => {
        board.forEach((cell, bi) => {
          if (!cell) {
            const test = board.map(c => c ? { ...c } : null);
            test[bi] = { ...card, owner: 'ai' };
            const { captured } = resolveCaptures(test, bi, 'ai');
            if (captured.length > maxCap) {
              maxCap = captured.length;
              best = { ci, bi };
            }
          }
        });
      });
      
      if (!best) {
        const empty = board.map((c, i) => c === null ? i : -1).filter(i => i !== -1);
        best = { ci: Math.floor(Math.random() * aiHand.length), bi: empty[Math.floor(Math.random() * empty.length)] };
      }
      
      const card = aiHand[best.ci];
      const newBoard = board.map(c => c ? { ...c } : null);
      newBoard[best.bi] = { ...card, owner: 'ai' };
      
      const { board: resolved, captured } = resolveCaptures(newBoard, best.bi, 'ai');
      const newScores = calcScores(resolved);
      
      setBoard(resolved);
      setAiHand(aiHand.filter((_, i) => i !== best.ci));
      setScores(newScores);
      setLastPlaced(best.bi);

      if (captured.length > 0) {
        setFlippingCells(captured);
        setTimeout(() => setFlippingCells([]), 800);
      }
      setTimeout(() => setLastPlaced(null), 600);

      if (aiHand.length - 1 === 0 && playerHand.length === 0) {
        const result = newScores.player > newScores.ai ? 'player' : newScores.ai > newScores.player ? 'ai' : 'draw';
        setGameOver(true);
        setWinner(result);
        setTimeout(() => setShowEndModal(true), 1000);
      } else {
        setTurn('player');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [turn, gameOver]);

  useEffect(() => {
    if (showEndModal && winner === 'player' && user) {
      const claimReward = async () => {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            await updateUserProfile(user.uid, { coins: (profile.coins || 0) + 20 });
          }
        } catch (err) {
          console.error('Error reclamando monedas:', err);
        }
      };
      claimReward();
    }
  }, [showEndModal, winner, user]);

  if (loading) return <div className="bp bp-loading-screen"><div className="bp-loading">Cargando mazo...</div></div>;

  return (
    <div className="bp">
      <div className="bp-stars"></div>
      <div className="bp-stars bp-stars-2"></div>
      
      <div className="bp-scores">
        <div className="bp-score-box bp-score-player">
          <span className="bp-score-label">👤 JUGADOR</span>
          <span className="bp-score-num">{scores.player}</span>
        </div>
        <div className="bp-score-box bp-score-ai">
          <span className="bp-score-label">🤖 IA</span>
          <span className="bp-score-num">{scores.ai}</span>
        </div>
      </div>

      <div className={`bp-turn ${turn === 'ai' ? 'bp-turn-ai' : ''}`}>
        {turn === 'player' ? '🎯 Selecciona una ficha de tu mano' : '🤖 La IA está pensando...'}
      </div>

      {/* Mano IA */}
      <div className="bp-hand-label bp-hand-ai-label">Mano IA ({aiHand.length})</div>
      <div className="bp-hand">
        {aiHand.map((r) => (
          <div key={r.id} className="bp-slot bp-ai-slot">
            <RuneCard rune={r} owned={true} battleMode={true} />
          </div>
        ))}
      </div>

      {/* Tablero */}
      <div className="bp-board">
        <div className="bp-grid">
          {board.map((cell, i) => (
            <div 
              key={i} 
              className={`bp-cell ${cell ? 'bp-cell-' + cell.owner : 'bp-cell-empty'} ${flippingCells.includes(i) ? 'bp-cell-flip' : ''} ${lastPlaced === i ? 'bp-cell-placed' : ''}`}
              onClick={() => handleCellClick(i)}
            >
              {cell && <RuneCard rune={cell} owned={true} battleMode={true} isFlipping={flippingCells.includes(i)} isPlaced={lastPlaced === i} />}
            </div>
          ))}
        </div>
      </div>

      {/* Mano Jugador */}
      <div className="bp-hand-label bp-hand-player-label">Tu Mano ({playerHand.length})</div>
      <div className="bp-hand">
        {playerHand.map((r, i) => (
          <div 
            key={r.id} 
            className={`bp-slot ${selectedCard === i ? 'bp-selected' : ''} ${turn !== 'player' ? 'bp-disabled' : ''}`}
            onClick={() => turn === 'player' && setSelectedCard(i)}
          >
            <RuneCard rune={r} owned={true} battleMode={true} />
          </div>
        ))}
      </div>

      {/* MODAL FIN DE PARTIDA */}
      {showEndModal && (
        <div className="bp-modal-overlay">
          <div className={`bp-modal ${winner === 'player' ? 'win-modal' : winner === 'ai' ? 'lose-modal' : 'draw-modal'}`}>
            <div className="bp-modal-icon">{winner === 'player' ? '🏆' : winner === 'ai' ? '💀' : '🤝'}</div>
            <h2 className="bp-modal-title">
              {winner === 'player' ? '¡VICTORIA!' : winner === 'ai' ? 'DERROTA' : 'EMPATE'}
            </h2>
            <p className="bp-modal-score">{scores.player} - {scores.ai}</p>
            
            {winner === 'player' && (
              <div className="bp-modal-reward">
                <span>💰</span>
                <span>+20 monedas</span>
              </div>
            )}
            
            <div className="bp-modal-buttons">
              <button className="bp-modal-btn bp-modal-btn-repeat" onClick={() => { setShowEndModal(false); loadDeck(); }}>
                🔄 Repetir
              </button>
              <button className="bp-modal-btn bp-modal-btn-exit" onClick={() => navigate('/home')}>
                🚪 Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Battle;