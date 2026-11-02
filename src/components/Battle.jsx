import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserNpcDeck, getUserProfile, updateUserProfile } from '../services/firestore';
import { RUNES_DB } from '../data/runes';
import RuneCard from './RuneCard';

import Arquero from '../assets/avatar/Arquero.png';
import Bruja from '../assets/avatar/Bruja.png';
import Caballero from '../assets/avatar/Caballero.png';
import Elfo from '../assets/avatar/Elfo.png';
import Lobo from '../assets/avatar/Lobo.png';
import Mago from '../assets/avatar/Mago.png';

import './Battle.css';

const AVATAR_OPTIONS = [
  { id: 'arquero', src: Arquero },
  { id: 'bruja', src: Bruja },
  { id: 'caballero', src: Caballero },
  { id: 'elfo', src: Elfo },
  { id: 'lobo', src: Lobo },
  { id: 'mago', src: Mago }
];

// ✅ Función para generar mazos equilibrados según dificultad
const generateAIDeck = (difficulty) => {
  const comunRunes = RUNES_DB.filter(r => r.tier === 'comun');
  const raraRunes = RUNES_DB.filter(r => r.tier === 'rara');
  const epicaRunes = RUNES_DB.filter(r => r.tier === 'epica');

  let deck = [];

  if (difficulty === 'Fácil') {
    // Sky: 100% comunes (runas débiles, 2-4 flechas) — mazo NPC de 5
    const shuffled = [...comunRunes].sort(() => 0.5 - Math.random());
    deck = shuffled.slice(0, 5).map(r => r.id);
  } else if (difficulty === 'Medio') {
    // elJonny: 60% comunes, 40% raras — mazo NPC de 5
    const shuffledComun = [...comunRunes].sort(() => 0.5 - Math.random());
    const shuffledRara = [...raraRunes].sort(() => 0.5 - Math.random());
    deck = [
      ...shuffledComun.slice(0, 3).map(r => r.id),
      ...shuffledRara.slice(0, 2).map(r => r.id)
    ];
  } else if (difficulty === 'Difícil') {
    // Eustakio: 20% comunes, 40% raras, 40% épicas — mazo NPC de 5
    const shuffledComun = [...comunRunes].sort(() => 0.5 - Math.random());
    const shuffledRara = [...raraRunes].sort(() => 0.5 - Math.random());
    const shuffledEpica = [...epicaRunes].sort(() => 0.5 - Math.random());
    deck = [
      ...shuffledComun.slice(0, 1).map(r => r.id),
      ...shuffledRara.slice(0, 2).map(r => r.id),
      ...shuffledEpica.slice(0, 2).map(r => r.id)
    ];
  }
  return deck.slice(0, 5);

  return deck;
};

// Perfiles de rivales (IDs consistentes con Home)
const AI_OPPONENTS = [
  {
    id: 'sky',
    name: 'Sky',
    avatar: Bruja,
    difficulty: 'Fácil',
    difficultyColor: '#10b981',
    reward: 20,
    deck: generateAIDeck('Fácil') // ✅ Mazo dinámico
  },
  {
    id: 'eljonny',
    name: 'elJonny',
    avatar: Elfo,
    difficulty: 'Medio',
    difficultyColor: '#f59e0b',
    reward: 50,
    deck: generateAIDeck('Medio') // ✅ Mazo dinámico
  },
  {
    id: 'eustakio',
    name: 'Eustakio',
    avatar: Caballero,
    difficulty: 'Difícil',
    difficultyColor: '#ef4444',
    reward: 150,
    deck: generateAIDeck('Difícil') // ✅ Mazo dinámico
  }
];

const getOpponent = () => {
  const saved = localStorage.getItem('selectedOpponent');
  return AI_OPPONENTS.find(o => o.id === saved) || AI_OPPONENTS[0];
};

const getAttackDirections = (placedIdx, capturedIdxs) => {
  const dirs = { top: false, bottom: false, left: false, right: false };
  if (!capturedIdxs.length) return dirs;
  const pr = Math.floor(placedIdx / 3), pc = placedIdx % 3;
  capturedIdxs.forEach(ci => {
    const cr = Math.floor(ci / 3), cc = ci % 3;
    if (cr === pr - 1 && cc === pc) dirs.top = true;
    if (cr === pr + 1 && cc === pc) dirs.bottom = true;
    if (cr === pr && cc === pc - 1) dirs.left = true;
    if (cr === pr && cc === pc + 1) dirs.right = true;
  });
  return dirs;
};

const Battle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ Rival fijo desde localStorage (no cambia durante la partida)
  const [selectedOpponent] = useState(getOpponent);

  const [playerProfile, setPlayerProfile] = useState(null);
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
  const [pendingCaptures, setPendingCaptures] = useState([]);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);

  const [attackDirs, setAttackDirs] = useState({});
  const [shakeHand, setShakeHand] = useState(false);

  const aiIsPlayingRef = useRef(false);

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setShowEndModal(false);
    try {
      if (user) {
        const profile = await getUserProfile(user.uid);
        if (profile) setPlayerProfile(profile);
      }

      let playerRunes = [];
      if (user) {
        const npcDeckIds = await getUserNpcDeck(user.uid); // mazo de 5 runas para NPC
        playerRunes = npcDeckIds
          .map(id => RUNES_DB.find(r => r.id === id))
          .filter(Boolean)
          .slice(0, 5)
          .map(r => ({ ...r, owner: 'player' }));
      }
      if (playerRunes.length < 2) {
        const shuffled = [...RUNES_DB].sort(() => 0.5 - Math.random());
        playerRunes = shuffled.slice(0, 5).map(r => ({ ...r, owner: 'player' }));
      }

      // ✅ Usamos el mazo generado dinámicamente según la dificultad
      const aiRunes = selectedOpponent.deck
        .map(id => RUNES_DB.find(r => r.id === id))
        .filter(Boolean)
        .map(r => ({ ...r, owner: 'ai' }));

      setPlayerHand(playerRunes);
      setAiHand(aiRunes);
      setBoard(Array(9).fill(null));
      setTurn('player');
      setSelectedCard(null);
      setScores({ player: 0, ai: 0 });
      setGameOver(false);
      setWinner(null);
      setFlippingCells([]);
      setPendingCaptures([]);
      setLastPlaced(null);
      setAttackDirs({});
      setShakeHand(false);
      aiIsPlayingRef.current = false;
    } catch (err) {
      console.error('Error cargando partida:', err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedOpponent]);

  useEffect(() => { loadDeck(); }, [loadDeck]);

  const resolveCaptures = useCallback((currentBoard, index, owner) => {
    const placed = currentBoard[index];
    if (!placed) return { board: currentBoard, captured: [] };
    const row = Math.floor(index / 3);
    const col = index % 3;
    const dirs = [
      { dr: -1, dc: 0, s: 'top', o: 'bottom' },
      { dr: 0, dc: 1, s: 'right', o: 'left' },
      { dr: 1, dc: 0, s: 'bottom', o: 'top' },
      { dr: 0, dc: -1, s: 'left', o: 'right' }
    ];
    const final = [...currentBoard];
    const captured = [];
    for (const { dr, dc, s, o } of dirs) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        const idx = nr * 3 + nc;
        const adj = final[idx];
        if (adj && adj.owner !== owner) {
          const atk = placed.arrows?.[s] || 0;
          const def = adj.arrows?.[o] || 0;
          if (atk > def) captured.push(idx);
        }
      }
    }
    return { board: final, captured };
  }, []);

  const applyCaptures = useCallback((board, capturedIndices, newOwner) => {
    const newBoard = [...board];
    capturedIndices.forEach(idx => {
      if (newBoard[idx]) newBoard[idx] = { ...newBoard[idx], owner: newOwner };
    });
    return newBoard;
  }, []);

  const calcScores = useCallback((b) => {
    let p = 0, a = 0;
    for (let i = 0; i < b.length; i++) {
      if (b[i]?.owner === 'player') p++;
      else if (b[i]?.owner === 'ai') a++;
    }
    return { player: p, ai: a };
  }, []);

  const handleCellClick = useCallback((index) => {
    if (gameOver || turn !== 'player' || board[index]) return;
    if (selectedCard === null) {
      setShakeHand(true);
      setTimeout(() => setShakeHand(false), 500);
      return;
    }
    const card = playerHand[selectedCard];
    const newBoard = [...board];
    newBoard[index] = { ...card, owner: 'player' };
    const { board: resolved, captured } = resolveCaptures(newBoard, index, 'player');
    const newScores = calcScores(resolved);
    setBoard(resolved);
    setPlayerHand(prev => prev.filter((_, i) => i !== selectedCard));
    setScores(newScores);
    setSelectedCard(null);
    setLastPlaced(index);
    if (captured.length > 0) {
      const dirs = getAttackDirections(index, captured);
      setAttackDirs({ [index]: dirs });
      setTimeout(() => {
        const boardWithNewOwners = applyCaptures(resolved, captured, 'player');
        setBoard(boardWithNewOwners);
        setPendingCaptures(captured);
        setAttackDirs({});
        setTimeout(() => {
          setFlippingCells([]);
          setPendingCaptures([]);
        }, 600);
      }, 1500);
    } else {
      setTimeout(() => setLastPlaced(null), 600);
    }
    const isPlayerEmpty = playerHand.length - 1 === 0;
    const isAiEmpty = aiHand.length === 0;
    if (isPlayerEmpty && isAiEmpty) {
      const result = newScores.player > newScores.ai ? 'player' : newScores.ai > newScores.player ? 'ai' : 'draw';
      setGameOver(true);
      setWinner(result);
      setTimeout(() => setShowEndModal(true), 900);
    } else {
      setTimeout(() => {
        setTurn('ai');
        setLastPlaced(null);
      }, captured.length > 0 ? 2100 : 600);
    }
  }, [gameOver, turn, board, selectedCard, playerHand, aiHand, resolveCaptures, calcScores, applyCaptures]);

  useEffect(() => {
    if (turn !== 'ai' || gameOver || aiIsPlayingRef.current) return;
    aiIsPlayingRef.current = true;
    const timer = setTimeout(() => {
      let bestMove = null;
      let maxCap = -1;
      const emptyCells = [];
      for (let i = 0; i < board.length; i++) {
        if (board[i] === null) emptyCells.push(i);
      }
      for (const card of aiHand) {
        for (const bi of emptyCells) {
          const testBoard = [...board];
          testBoard[bi] = { ...card, owner: 'ai' };
          const { captured } = resolveCaptures(testBoard, bi, 'ai');
          if (captured.length > maxCap) {
            maxCap = captured.length;
            bestMove = { card, bi };
          }
        }
      }
      if (!bestMove) {
        const randomCard = aiHand[Math.floor(Math.random() * aiHand.length)];
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        bestMove = { card: randomCard, bi: randomCell };
      }
      const newBoard = [...board];
      newBoard[bestMove.bi] = { ...bestMove.card, owner: 'ai' };
      const { board: resolved, captured } = resolveCaptures(newBoard, bestMove.bi, 'ai');
      const newScores = calcScores(resolved);
      setBoard(resolved);
      setAiHand(prev => prev.filter(r => r.id !== bestMove.card.id));
      setScores(newScores);
      setLastPlaced(bestMove.bi);
      if (captured.length > 0) {
        const dirs = getAttackDirections(bestMove.bi, captured);
        setAttackDirs({ [bestMove.bi]: dirs });
        setTimeout(() => {
          const boardWithNewOwners = applyCaptures(resolved, captured, 'ai');
          setBoard(boardWithNewOwners);
          setPendingCaptures(captured);
          setAttackDirs({});
          setTimeout(() => {
            setFlippingCells([]);
            setPendingCaptures([]);
          }, 600);
        }, 1500);
      } else {
        setTimeout(() => setLastPlaced(null), 600);
      }
      const isAiEmpty = aiHand.length - 1 === 0;
      const isPlayerEmpty = playerHand.length === 0;
      if (isAiEmpty && isPlayerEmpty) {
        const result = newScores.player > newScores.ai ? 'player' : newScores.ai > newScores.player ? 'ai' : 'draw';
        setGameOver(true);
        setWinner(result);
        setTimeout(() => setShowEndModal(true), 900);
        setTimeout(() => { aiIsPlayingRef.current = false; }, 1000);
      } else {
        setTimeout(() => {
          setTurn('player');
          setLastPlaced(null);
          aiIsPlayingRef.current = false;
        }, captured.length > 0 ? 2100 : 600);
      }
    }, 1100);
    return () => { clearTimeout(timer); };
  }, [turn, gameOver]);

  useEffect(() => {
    if (showEndModal && winner === 'player' && user) {
      const claimReward = async () => {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            await updateUserProfile(user.uid, { coins: (profile.coins || 0) + selectedOpponent.reward });
          }
        } catch (err) {
          console.error('Error reclamando recompensa:', err);
        }
      };
      claimReward();
    }
  }, [showEndModal, winner, user, selectedOpponent.reward]);

  const getPlayerAvatar = useCallback(() => {
    const found = AVATAR_OPTIONS.find(a => a.id === playerProfile?.avatarId);
    return found ? found.src : Arquero;
  }, [playerProfile?.avatarId]);

  if (loading) {
    return (
      <div className="bp">
        <div className="bp-stars"></div>
        <div className="bp-stars bp-stars-2"></div>
        <div style={{ textAlign: 'center', color: '#00d4ff', fontWeight: 900 }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}></span>
          <p>Preparando el combate cósmico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bp">
      <div className="bp-stars"></div>
      <div className="bp-stars bp-stars-2"></div>

      {/* HUD ENEMIGO */}
      <div className="bp-player-strip bp-enemy-strip">
        <div className="bp-user-meta">
          <img
            src={selectedOpponent.avatar}
            alt={selectedOpponent.name}
            className="bp-avatar-frame bp-enemy-frame"
            style={{ borderColor: selectedOpponent.difficultyColor }}
          />
          <div className="bp-user-names">
            <span className="bp-user-title">{selectedOpponent.name}</span>
            <span className="bp-user-tag" style={{ color: selectedOpponent.difficultyColor }}>
              {selectedOpponent.difficulty}
            </span>
          </div>
        </div>
        <div className="bp-score-badge-box bp-score-ai-box">
          <span className="bp-score-badge-label">PUNTOS</span>
          <span className="bp-score-badge-value">{scores.ai}</span>
        </div>
      </div>

      {/* MAZO ENEMIGO */}
      <section className="bp-hand-area bp-hand-ai-area">
        <div className="bp-hand-track">
          {aiHand.map((r) => (
            <div key={r.id} className="bp-slot bp-slot-ai">
              <RuneCard rune={r} owned={true} battleMode={true} />
            </div>
          ))}
        </div>
      </section>

      {/* ZONA CENTRAL */}
      <main className="bp-arena-center">
        <div className={`bp-turn-indicator ${turn === 'ai' ? 'is-turn-ai' : 'is-turn-player'}`}>
          <span className="bp-turn-icon">{turn === 'player' ? '⚔️' : '⏳'}</span>
          <span className="bp-turn-txt">
            {turn === 'player'
              ? (selectedCard !== null ? '¡Toca una casilla del tablero!' : 'Elige una de tus runas')
              : `${selectedOpponent.name} está calculando...`}
          </span>
        </div>

        <div className="bp-board-container">
          <div className="bp-grid-3x3">
            {board.map((cell, i) => (
              <div
                key={i}
                className={`bp-cell ${cell ? `bp-cell-${cell.owner}` : 'bp-cell-empty'} ${flippingCells.includes(i) || pendingCaptures.includes(i) ? 'bp-cell-flip' : ''} ${lastPlaced === i ? 'bp-cell-placed' : ''}`}
                onClick={() => handleCellClick(i)}
              >
                {cell ? (
                  <RuneCard
                    rune={cell}
                    owned={true}
                    battleMode={true}
                    isFlipping={flippingCells.includes(i) || pendingCaptures.includes(i)}
                    isPlaced={lastPlaced === i}
                    attackDirs={attackDirs[i] || {}}
                  />
                ) : (
                  <div className="bp-cell-slot-dot">᛭</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* MAZO JUGADOR */}
      <section className={`bp-hand-area bp-hand-player-area ${shakeHand ? 'bp-shake' : ''}`}>
        <div className="bp-hand-track">
          {playerHand.map((r, i) => (
            <div
              key={r.id}
              className={`bp-slot bp-slot-player ${selectedCard === i ? 'bp-selected' : ''} ${turn !== 'player' ? 'bp-disabled' : ''}`}
              onClick={() => turn === 'player' && setSelectedCard(i)}
            >
              <RuneCard rune={r} owned={true} battleMode={true} />
            </div>
          ))}
        </div>
      </section>

      {/* HUD JUGADOR */}
      <div className="bp-player-strip bp-self-strip">
        <div className="bp-user-meta">
          <img src={getPlayerAvatar()} alt="Tu Avatar" className="bp-avatar-frame bp-self-frame" />
          <div className="bp-user-names">
            <span className="bp-user-title">{playerProfile?.username || 'Invocador'}</span>
            <span className="bp-user-tag">Nv. {playerProfile?.level || 1}</span>
          </div>
        </div>
        <div className="bp-score-badge-box bp-score-self-box">
          <span className="bp-score-badge-label">TUS PUNTOS</span>
          <span className="bp-score-badge-value">{scores.player}</span>
        </div>
      </div>

      {/* MODAL FIN DE PARTIDA */}
      {showEndModal && (
        <div className="bp-modal-overlay">
          <div className={`bp-modal ${winner === 'player' ? 'win-modal' : winner === 'ai' ? 'lose-modal' : 'draw-modal'}`}>
            <div className="bp-modal-banner">
              <span className="bp-modal-icon">{winner === 'player' ? '🏆' : winner === 'ai' ? '💀' : '⚔️'}</span>
              <h2 className="bp-modal-title">
                {winner === 'player' ? '¡VICTORIA!' : winner === 'ai' ? 'DERROTA' : 'EMPATE'}
              </h2>
            </div>

            <div className="bp-modal-scoreboard">
              <div className="bp-modal-score-col">
                <span className="bp-modal-label">{playerProfile?.username || 'Tú'}</span>
                <span className="bp-modal-points">{scores.player}</span>
              </div>
              <span className="bp-modal-vs">VS</span>
              <div className="bp-modal-score-col">
                <span className="bp-modal-label">{selectedOpponent.name}</span>
                <span className="bp-modal-points">{scores.ai}</span>
              </div>
            </div>

            {winner === 'player' && (
              <div className="bp-modal-reward">
                <span className="bp-reward-coin">🪙</span>
                <span className="bp-reward-val">+{selectedOpponent.reward} Monedas</span>
              </div>
            )}

            <div className="bp-modal-actions">
              <button className="bp-btn bp-btn-repeat" onClick={() => { setShowEndModal(false); loadDeck(); }}>
                🔄 Revancha
              </button>
              <button className="bp-btn bp-btn-exit" onClick={() => navigate('/home')}>
                 Salir a Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Battle;