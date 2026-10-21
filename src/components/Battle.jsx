import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserDecks, getUserProfile, updateUserProfile } from '../services/firestore';
import { RUNES_DB } from '../data/runes';
import RuneCard from './RuneCard';
import Arquero from '../assets/avatar/Arquero.jpg';
import Bruja from '../assets/avatar/Bruja.jpg';
import Caballero from '../assets/avatar/Caballero.jpg';
import Elfo from '../assets/avatar/Elfo.jpg';
import Lobo from '../assets/avatar/Lobo.jpg';
import Mago from '../assets/avatar/Mago.jpg';
import './Battle.css';

const AVATAR_OPTIONS = [
  { id: 'arquero', src: Arquero },
  { id: 'bruja', src: Bruja },
  { id: 'caballero', src: Caballero },
  { id: 'elfo', src: Elfo },
  { id: 'lobo', src: Lobo },
  { id: 'mago', src: Mago }
];

const Battle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [lastPlaced, setLastPlaced] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);

  // Cargar Perfil y Mazo
  const loadDeck = async () => {
    setLoading(true);
    setShowEndModal(false);
    try {
      if (user) {
        const profile = await getUserProfile(user.uid);
        if (profile) setPlayerProfile(profile);
      }

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
      console.error('Error cargando partida:', err);
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
          const atk = placed.arrows?.[s] || 0;
          const def = adj.arrows?.[o] || 0;
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
    b.forEach(c => {
      if (c?.owner === 'player') p++;
      else if (c?.owner === 'ai') a++;
    });
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
      setTimeout(() => setShowEndModal(true), 900);
    } else {
      setTurn('ai');
    }
  };

  useEffect(() => {
    if (turn !== 'ai' || gameOver) return;
    const timer = setTimeout(() => {
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
        setTimeout(() => setShowEndModal(true), 900);
      } else {
        setTurn('player');
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [turn, gameOver, aiHand, board]);

  useEffect(() => {
    if (showEndModal && winner === 'player' && user) {
      const claimReward = async () => {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            await updateUserProfile(user.uid, { coins: (profile.coins || 0) + 20 });
          }
        } catch (err) {
          console.error('Error reclamando recompensa:', err);
        }
      };
      claimReward();
    }
  }, [showEndModal, winner, user]);

  const getPlayerAvatar = () => {
    const found = AVATAR_OPTIONS.find(a => a.id === playerProfile?.avatarId);
    return found ? found.src : Arquero;
  };

  if (loading) {
    return (
      <div className="bp bp-loading-screen">
        <div className="bp-loading-box">
          <span className="bp-loading-rune">ᛟ</span>
          <p>Preparando el combate cósmico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bp">
      <div className="bp-stars"></div>
      <div className="bp-stars bp-stars-2"></div>

      {/* 1. HUD ENEMIGO (Encima de su mazo) */}
      <div className="bp-player-strip bp-enemy-strip">
        <div className="bp-user-meta">
          <div className="bp-avatar-frame bp-enemy-frame">
            <span className="bp-bot-icon">🤖</span>
          </div>
          <div className="bp-user-names">
            <span className="bp-user-title">IA Guardián</span>
            <span className="bp-user-tag">Nivel 1</span>
          </div>
        </div>
        <div className="bp-score-badge-box bp-score-ai-box">
          <span className="bp-score-badge-label">PUNTOS</span>
          <span className="bp-score-badge-value">{scores.ai}</span>
        </div>
      </div>

      {/* 2. MAZO ENEMIGO (Cartas más grandes) */}
      <section className="bp-hand-area bp-hand-ai-area">
        <div className="bp-hand-track">
          {aiHand.map((r) => (
            <div key={r.id} className="bp-slot bp-slot-ai">
              <RuneCard rune={r} owned={true} battleMode={true} />
            </div>
          ))}
        </div>
      </section>

      {/* 3. ZONA CENTRAL: TURNO + TABLERO 3x3 EXPANSIVO */}
      <main className="bp-arena-center">
        <div className={`bp-turn-indicator ${turn === 'ai' ? 'is-turn-ai' : 'is-turn-player'}`}>
          <span className="bp-turn-icon">{turn === 'player' ? '⚔️' : '⏳'}</span>
          <span className="bp-turn-txt">
            {turn === 'player' 
              ? (selectedCard !== null ? '¡Toca una casilla del tablero!' : 'Elige una de tus runas') 
              : 'La IA está calculando jugada...'}
          </span>
        </div>

        <div className="bp-board-container">
          <div className="bp-grid-3x3">
            {board.map((cell, i) => (
              <div
                key={i}
                className={`bp-cell ${cell ? `bp-cell-${cell.owner}` : 'bp-cell-empty'} ${flippingCells.includes(i) ? 'bp-cell-flip' : ''} ${lastPlaced === i ? 'bp-cell-placed' : ''}`}
                onClick={() => handleCellClick(i)}
              >
                {cell ? (
                  <RuneCard
                    rune={cell}
                    owned={true}
                    battleMode={true}
                    isFlipping={flippingCells.includes(i)}
                    isPlaced={lastPlaced === i}
                  />
                ) : (
                  <div className="bp-cell-slot-dot">᛭</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 4. MAZO JUGADOR (Cartas grandes, cómodas y reactivas) */}
      <section className="bp-hand-area bp-hand-player-area">
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

      {/* 5. HUD JUGADOR (Debajo de tu mazo: Avatar, Nombre y Puntuación) */}
      <div className="bp-player-strip bp-self-strip">
        <div className="bp-user-meta">
          <img
            src={getPlayerAvatar()}
            alt="Tu Avatar"
            className="bp-avatar-frame bp-self-frame"
          />
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
                <span className="bp-modal-label">IA Rival</span>
                <span className="bp-modal-points">{scores.ai}</span>
              </div>
            </div>

            {winner === 'player' && (
              <div className="bp-modal-reward">
                <span className="bp-reward-coin">🪙</span>
                <span className="bp-reward-val">+20 Monedas</span>
              </div>
            )}

            <div className="bp-modal-actions">
              <button
                className="bp-btn bp-btn-repeat"
                onClick={() => { setShowEndModal(false); loadDeck(); }}
              >
                🔄 Revancha
              </button>
              <button
                className="bp-btn bp-btn-exit"
                onClick={() => navigate('/home')}
              >
                🚪 Salir a Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Battle;
