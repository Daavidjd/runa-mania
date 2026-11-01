import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getUserActiveDeck,
  watchChallenge,
  joinOnlineRoom,
  watchRoom,
  leaveOnlineRoom,
  recordOnlineBattleResult
} from '../services/firestore';
import { doc as fsDoc, updateDoc as fsUpdate, getDoc as fsGetDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RUNES_DB } from '../data/runes';
import { AVATAR_OPTIONS } from '../data/avatars';
import RuneCard from './RuneCard';
import './Battle.css';
import './BattleOnline.css';

// ============================================================
// ⚔️ BATALLA EN LÍNEA (estilo Match de Clash Royale)
// Misma mecánica que la batalla NPC (tablero 3x3 + flechas),
// pero sincronizada entre dos jugadores reales por Firestore.
// 🔵 AZUL = tú   |   🔴 ROJO = rival   (50/50 al elegir quien empieza)
// ============================================================

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

const buildHandFromIds = (runeIds, owner) => {
  const runes = (runeIds || [])
    .map(id => RUNES_DB.find(r => r.id === id))
    .filter(Boolean)
    .map(r => ({ ...r, owner }));
  if (runes.length >= 2) return runes;
  // Fallback si el rival no tiene mazo guardado: runas aleatorias
  const shuffled = [...RUNES_DB].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5).map(r => ({ ...r, owner }));
};

const getRoomSnapshot = async (roomId) => {
  try {
    const snap = await fsGetDoc(fsDoc(db, 'rooms', roomId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
};

const BattleOnline = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [battleData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onlineBattle') || 'null'); }
    catch { return null; }
  });

  // Al entrar a la sala, el reto saliente ya fue aceptado: limpiarlo
  useEffect(() => { localStorage.removeItem('pendingOutgoingChallenge'); }, []);

  const [phase, setPhase] = useState(battleData ? 'connecting' : 'error'); // connecting | playing | error
  const [room, setRoom] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [oppProfile, setOppProfile] = useState(null);

  const [board, setBoard] = useState(Array(9).fill(null));
  const [myHand, setMyHand] = useState([]);
  const [oppHandCount, setOppHandCount] = useState(5);
  const [selectedCard, setSelectedCard] = useState(null);
  const [scores, setScores] = useState({ me: 0, opp: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [iWon, setIWon] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [flippingCells, setFlippingCells] = useState([]);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [attackDirs, setAttackDirs] = useState({});
  const [shakeHand, setShakeHand] = useState(false);

  const roomUnsubRef = useRef(null);
  const challengeUnsubRef = useRef(null);
  const appliedRemoteMovesRef = useRef(new Set());
  const myUidRef = useRef(user?.uid || null);
  const reportedRef = useRef(false);
  const roomIdRef = useRef(null);
  const oppDeckSizeRef = useRef(5);
  const myUid = user?.uid || null;

  // 🎨 El primer jugador en entrar a la sala es AZUL 🔵 y el segundo ROJO 🔴
  // (el orden de llegada queda guardado en Firestore, ambos clientes coinciden)
  const activePlayers = Object.entries(room.players || {}).filter(([, p]) => p && p.joinedAt);
  const blueUid = room.blueUid || (activePlayers.length ? activePlayers.sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0][0] : null);
  const iAmFirst = blueUid ? blueUid === myUid : false;
  const bothJoined = activePlayers.length >= 2;
  const myColor = iAmFirst ? 'blue' : 'red';
  const oppColor = iAmFirst ? 'red' : 'blue';
  // ⚔️ Quién empieza: resultado del volteo de moneda 50/50 guardado en la sala
  const starterIsMe = room.starterUid ? room.starterUid === myUid : iAmFirst;

  // ---------- CONEXIÓN A LA SALA ----------
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!user || !battleData) { setPhase('error'); return; }

      try {
        const [me, opp, myDeckIds, oppDeckIds] = await Promise.all([
          getUserProfile(user.uid),
          getUserProfile(battleData.opponentUid),
          getUserActiveDeck(user.uid),
          getUserActiveDeck(battleData.opponentUid)
        ]);
        if (cancelled) return;
        setMyProfile(me);
        setOppProfile(opp);

        const hand = buildHandFromIds(myDeckIds, 'me');
        setMyHand(hand.map(h => ({ ...h, owner: user.uid })));
        const oppHand = buildHandFromIds(oppDeckIds, 'opp');

        const roomId = battleData.challengeId;
        roomIdRef.current = roomId;

        // Unirse a la sala y escucharla en tiempo real
        await joinOnlineRoom(roomId, user.uid, me?.username || 'Invocador');
        roomUnsubRef.current = watchRoom(roomId, (data) => { if (!cancelled) setRoom(data || {}); });

        // Esperar a que ambos estén dentro de la sala antes de resolver el duelo
        const waitForBoth = async () => {
          for (let i = 0; i < 60; i++) {
            const snap = await getRoomSnapshot(roomId);
            const players = Object.entries(snap?.players || {}).filter(([, p]) => p && p.joinedAt);
            if (players.length >= 2) return snap;
            await new Promise(r => setTimeout(r, 500));
          }
          return null;
        };

        // 🎨 Asignar colores y 🔵🔴 VOLTEO DE MONEDA 50/50 (se guarda en la sala para ambos)
        (async () => {
          try {
            const roomSnap = await waitForBoth();
            if (!roomSnap || cancelled) return;
            const updates = {};
            // Colores: el primero en unirse es AZUL (ya quedó registrado por joinOnlineRoom)
            // Volteo: quien llega primero lo resuelve una sola vez
            if (!roomSnap.starterUid) {
              const order = Object.entries(roomSnap.players || {})
                .filter(([, p]) => p && p.joinedAt)
                .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
              const starter = Math.random() < 0.5 ? order[0][0] : (order[1]?.[0] || order[0][0]);
              updates.starterUid = starter;
            }
            updates[`deckSizes.${user.uid}`] = hand.length;
            updates[`deckSizes.${battleData.opponentUid}`] = oppHand.length;
            await fsUpdate(fsDoc(db, 'rooms', roomId), updates, { merge: true });
          } catch (err) { console.error('Error preparando duelo online:', err); }
        })();

        // Si el reto fue cancelado/rechazado mientras conectábamos
        challengeUnsubRef.current = watchChallenge(roomId, (ch) => {
          if (!cancelled && ch && ch.status === 'declined') setPhase('error');
        });
      } catch (err) {
        console.error('Error conectando a la sala online:', err);
        if (!cancelled) setPhase('error');
      }
    };

    if (battleData) localStorage.removeItem('onlineBattle');
    setup();
    return () => {
      cancelled = true;
      roomUnsubRef.current?.();
      challengeUnsubRef.current?.();
      if (roomIdRef.current && myUidRef.current) leaveOnlineRoom(roomIdRef.current, myUidRef.current);
    };
  }, []);

  // ---------- SINCRONIZACIÓN DEL TABLERO ----------
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'connecting') return;
    const remoteBoard = room.board;
    if (!Array.isArray(remoteBoard) || remoteBoard.length !== 9) return;

    const lastMove = room.lastMove;

    // El tablero compartido ya trae colores reales blue/red
    const colored = remoteBoard.map(cell => (cell ? { ...cell } : null));
    setBoard(colored);

    // Cartas restantes del rival (su mazo inicial menos las jugadas)
    const oppUid = Object.keys(room.players || {}).find(k => k !== myUidRef.current && room.players[k]);
    const oppDeckSize = room.deckSizes?.[oppUid] || 5;
    const playedByOpp = remoteBoard.filter(c => c && c.owner === oppColor).length;
    setOppHandCount(Math.max(0, oppDeckSize - playedByOpp));

    // Animación del último movimiento remoto
    if (lastMove && lastMove.by !== myUidRef.current && !appliedRemoteMovesRef.current.has(lastMove.moveId)) {
      appliedRemoteMovesRef.current.add(lastMove.moveId);
      setLastPlaced(lastMove.index);
      if (lastMove.captured?.length) {
        setAttackDirs({ [lastMove.index]: getAttackDirections(lastMove.index, lastMove.captured) });
        setTimeout(() => {
          setFlippingCells(lastMove.captured);
          setAttackDirs({});
          setTimeout(() => { setFlippingCells([]); }, 600);
        }, 400);
      } else {
        setTimeout(() => setLastPlaced(null), 600);
      }
    }

    // Puntuaciones
    const meCount = colored.filter(c => c?.owner === myColor).length;
    const oppCount = colored.filter(c => c?.owner === oppColor).length; // incluye capturas sufridas
    setScores({ me: meCount, opp: oppCount });

    // Fin de partida: tablero lleno
    if (colored.every(c => c !== null) && !gameOver) {
      setGameOver(true);
      const won = meCount > oppCount;
      const draw = meCount === oppCount;
      setIWon(draw ? null : won);
      setTimeout(() => setShowEndModal(true), 800);
    }
  }, [room, phase, myColor, oppColor, gameOver]);

  // ---------- MI TURNO ----------
  const placedCount = board.filter(c => c !== null).length;
  // El que empieza coloca las jugadas 1ª, 3ª, 5ª... (índices pares ya colocados = su turno)
  const myTurn = phase === 'playing' && !gameOver &&
    (starterIsMe ? placedCount % 2 === 0 : placedCount % 2 === 1);

  // Escritura en la sala (merge directo sobre el doc de la sala).
  // El tablero compartido guarda colores REALES ('blue'/'red') según quien posea la carta.
  const updateRoomState = useCallback(async (rawBoardWithUids, capturedIdxs, lastMove) => {
    try {
      const shared = rawBoardWithUids.map(c => c ? {
        id: c.id, name: c.name, image: c.image, tier: c.tier, arrows: c.arrows,
        owner: c.owner === myUidRef.current ? (iAmFirst ? 'blue' : 'red') : (iAmFirst ? 'red' : 'blue'),
        flipped: capturedIdxs.includes(lastMove.index) ? false : c.flipped
      } : null);
      // Aplicar capturas del movimiento actual
      capturedIdxs.forEach(ci => { shared[ci] = { ...shared[ci], owner: lastMove.by === myUidRef.current ? (iAmFirst ? 'blue' : 'red') : (iAmFirst ? 'red' : 'blue'), flipped: true }; });
      await fsUpdate(fsDoc(db, 'rooms', roomIdRef.current), {
        board: shared,
        lastMove,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sincronizando sala:', err);
    }
  }, [iAmFirst]);

  const handleCellClick = useCallback((index) => {
    if (gameOver || phase !== 'playing' || !myTurn || board[index]) return;
    if (selectedCard === null) {
      setShakeHand(true);
      setTimeout(() => setShakeHand(false), 500);
      return;
    }

    const card = myHand[selectedCard];
    const newBoard = [...board];
    newBoard[index] = { ...card, owner: user.uid };

    // Resolver capturas por flechas (misma lógica que la batalla NPC)
    const row = Math.floor(index / 3), col = index % 3;
    const dirs = [
      { dr: -1, dc: 0, s: 'top', o: 'bottom' },
      { dr: 0, dc: 1, s: 'right', o: 'left' },
      { dr: 1, dc: 0, s: 'bottom', o: 'top' },
      { dr: 0, dc: -1, s: 'left', o: 'right' }
    ];
    const captured = [];
    for (const { dr, dc, s, o } of dirs) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        const idx = nr * 3 + nc;
        const adj = newBoard[idx];
        if (adj && adj.owner !== user.uid) {
          const atk = card.arrows?.[s] || 0;
          const def = adj.arrows?.[o] || 0;
          if (atk > def) captured.push(idx);
        }
      }
    }

    const moveId = `${user.uid}-${Date.now()}`;
    appliedRemoteMovesRef.current.add(moveId); // no re-animar mi propio movimiento

    // Publicar estado en la sala compartida (tablero + jugada para animar en el otro cliente)
    updateRoomState(newBoard, captured, { by: user.uid, index, captured, moveId });

    setMyHand(prev => prev.filter((_, i) => i !== selectedCard));
    setSelectedCard(null);
    setLastPlaced(index);
    if (captured.length > 0) {
      setAttackDirs({ [index]: getAttackDirections(index, captured) });
      setTimeout(() => {
        setFlippingCells(captured);
        setAttackDirs({});
        setTimeout(() => { setFlippingCells([]); }, 600);
      }, 1500);
    } else {
      setTimeout(() => setLastPlaced(null), 600);
    }
  }, [gameOver, phase, myTurn, board, selectedCard, myHand, user]);


  // ---------- REPORTAR RESULTADO UNA SOLA VEZ ----------
  useEffect(() => {
    if (showEndModal && !reportedRef.current && user && iWon !== null) {
      reportedRef.current = true;
      recordOnlineBattleResult(user.uid, iWon);
    }
  }, [showEndModal, iWon, user]);

  // ---------- RENDER ----------
  const avatarSrcOf = (p) => {
    const found = AVATAR_OPTIONS.find(a => a.id === p?.avatarId);
    return found ? found.src : AVATAR_OPTIONS[0].src;
  };

  if (phase === 'error') {
    return (
      <div className="bp bo-screen">
        <div className="bo-error-box">
          <span className="bo-error-icon">📡</span>
          <h2>No hay batalla activa</h2>
          <p>Acepta un reto desde tu perfil (pestaña ⚔️ Retos) para entrar a la arena en línea.</p>
          <button className="bp-btn bp-btn-exit" onClick={() => navigate('/profile')}>Ir a mi Perfil</button>
        </div>
      </div>
    );
  }

  if (phase === 'connecting') {
    const oppJoined = bothJoined;
    return (
      <div className="bp bo-screen">
        <div className="bp-stars"></div>
        <div className="bo-lobby">
          <h2 className="bo-lobby-title">⚔️ Arena en Línea</h2>

          <div className="bo-vs-row">
            <div className="bo-lobby-player bo-me">
              <img src={avatarSrcOf(myProfile)} alt="yo" className="bp-avatar-frame" style={{ borderColor: myColor === 'red' ? '#f44336' : '#2196f3' }} />
              <span className="bo-lobby-name">{myProfile?.username || 'Tú'}</span>
              <span className="bo-lobby-tag" style={{ color: myColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{myColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>
            </div>
            <span className="bo-vs-bolt">VS</span>
            <div className="bo-lobby-player bo-them">
              {oppJoined ? (
                <>
                  <img src={avatarSrcOf(oppProfile)} alt="rival" className="bp-avatar-frame" style={{ borderColor: oppColor === 'red' ? '#f44336' : '#2196f3' }} />
                  <span className="bo-lobby-name">{battleData?.opponentName || 'Rival'}</span>
                  <span className="bo-lobby-tag" style={{ color: oppColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{oppColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>
                </>
              ) : (
                <>
                  <div className="bo-waiting-orb"></div>
                  <span className="bo-lobby-name">Esperando rivales...</span>
                  <span className="bo-lobby-dots"></span>
                </>
              )}
            </div>
          </div>

          {oppJoined && (
            <div className="bo-lobby-info">
              🎲 Volteo de moneda 50/50 resuelto:{' '}
              <b>{room.starterUid ? (starterIsMe ? '¡Tú empiezas!' : 'Empieza el rival') : 'Asignando...'}</b>
            </div>
          )}
          {oppJoined && (
            <button className="bo-start-btn" onClick={() => setPhase('playing')}>
              ⚔️ ¡COMENZAR BATALLA!
            </button>
          )}

          <button className="bp-btn bp-btn-exit bo-leave" onClick={() => navigate('/home')}>🚪 Salir</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bp">
      <div className="bp-stars"></div>
      <div className="bp-stars bp-stars-2"></div>

      {/* HUD RIVAL */}
      <div className="bp-player-strip bp-enemy-strip">
        <div className="bp-user-meta">
          <img
            src={avatarSrcOf(oppProfile)}
            alt="rival"
            className="bp-avatar-frame bp-enemy-frame"
            style={{ borderColor: oppColor === 'red' ? '#f44336' : '#2196f3' }}
          />
          <div className="bp-user-names">
            <span className="bp-user-title">{battleData?.opponentName || oppProfile?.username || 'Rival'}</span>
            <span className="bp-user-tag" style={{ color: oppColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>
              {oppColor === 'red' ? '🔴 ROJO' : '🔵 AZUL'} · En línea
            </span>
          </div>
        </div>
        <div className="bp-score-badge-box bp-score-ai-box">
          <span className="bp-score-badge-label">PUNTOS</span>
          <span className="bp-score-badge-value">{scores.opp}</span>
        </div>
      </div>

      {/* MAZO RIVAL (cartas boca abajo) */}
      <section className="bp-hand-area bp-hand-ai-area">
        <div className="bp-hand-track">
          {Array.from({ length: oppHandCount }).map((_, i) => (
            <div key={i} className="bp-slot bp-slot-ai">
              <div className={`bo-card-back bo-back-${oppColor}`}>ᛞ</div>
            </div>
          ))}
        </div>
      </section>

      {/* ZONA CENTRAL */}
      <main className="bp-arena-center">
        <div className={`bp-turn-indicator ${myTurn ? 'is-turn-player' : 'is-turn-ai'}`}>
          <span className="bp-turn-icon">{myTurn ? '⚔️' : '⏳'}</span>
          <span className="bp-turn-txt">
            {gameOver
              ? 'Partida finalizada'
              : myTurn
                ? (selectedCard !== null ? '¡Toca una casilla del tablero!' : 'Elige una de tus runas')
                : `${battleData?.opponentName || 'El rival'} está jugando...`}
          </span>
        </div>

        <div className="bp-board-container">
          <div className="bp-grid-3x3">
            {board.map((cell, i) => (
              <div
                key={i}
                className={`bp-cell ${cell ? `bp-cell-${cell.owner === 'red' ? 'ai' : 'player'}` : 'bp-cell-empty'} ${flippingCells.includes(i) ? 'bp-cell-flip' : ''} ${lastPlaced === i ? 'bp-cell-placed' : ''}`}
                onClick={() => handleCellClick(i)}
              >
                {cell ? (
                  <RuneCard
                    rune={cell}
                    owned={true}
                    battleMode={true}
                    isFlipping={flippingCells.includes(i)}
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

      {/* MI MAZO */}
      <section className={`bp-hand-area bp-hand-player-area ${shakeHand ? 'bp-shake' : ''}`}>
        <div className="bp-hand-track">
          {myHand.map((r, i) => (
            <div
              key={`${r.id}-${i}`}
              className={`bp-slot bp-slot-player ${selectedCard === i ? 'bp-selected' : ''} ${!myTurn ? 'bp-disabled' : ''}`}
              onClick={() => myTurn && setSelectedCard(i)}
            >
              <RuneCard rune={{ ...r, owner: myColor === 'red' ? 'ai' : 'player' }} owned={true} battleMode={true} />
            </div>
          ))}
        </div>
      </section>

      {/* MI HUD */}
      <div className="bp-player-strip bp-self-strip">
        <div className="bp-user-meta">
          <img
            src={avatarSrcOf(myProfile)}
            alt="Tu Avatar"
            className="bp-avatar-frame bp-self-frame"
            style={{ borderColor: myColor === 'red' ? '#f44336' : '#2196f3' }}
          />
          <div className="bp-user-names">
            <span className="bp-user-title">{myProfile?.username || 'Invocador'}</span>
            <span className="bp-user-tag" style={{ color: myColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>
              {myColor === 'red' ? '🔴 ROJO' : '🔵 AZUL'} · Empieza: {starterIsMe ? 'Tú' : 'Rival'}
            </span>
          </div>
        </div>
        <div className="bp-score-badge-box bp-score-self-box">
          <span className="bp-score-badge-label">TUS PUNTOS</span>
          <span className="bp-score-badge-value">{scores.me}</span>
        </div>
      </div>

      {/* MODAL FIN */}
      {showEndModal && (
        <div className="bp-modal-overlay">
          <div className={`bp-modal ${iWon === null ? 'draw-modal' : iWon ? 'win-modal' : 'lose-modal'}`}>
            <div className="bp-modal-banner">
              <span className="bp-modal-icon">{iWon === null ? '🤝' : iWon ? '🏆' : '💀'}</span>
              <h2 className="bp-modal-title">
                {iWon === null ? 'EMPATE' : iWon ? '¡VICTORIA ONLINE!' : 'DERROTA ONLINE'}
              </h2>
            </div>

            <div className="bp-modal-scoreboard">
              <div className="bp-modal-score-col">
                <span className="bp-modal-label">{myProfile?.username || 'Tú'}</span>
                <span className="bp-modal-points">{scores.me}</span>
              </div>
              <span className="bp-modal-vs">VS</span>
              <div className="bp-modal-score-col">
                <span className="bp-modal-label">{battleData?.opponentName || 'Rival'}</span>
                <span className="bp-modal-points">{scores.opp}</span>
              </div>
            </div>

            <div className="bp-modal-reward">
              <span className="bp-reward-coin">🪙</span>
              <span className="bp-reward-val">{iWon ? '+30 Monedas y +25 XP' : iWon === null ? '+10 Monedas' : '+5 Monedas de consolación'}</span>
            </div>

            <div className="bp-modal-actions">
              <button className="bp-btn bp-btn-repeat" onClick={() => navigate('/profile')}>
                👥 Volver a Amigos
              </button>
              <button className="bp-btn bp-btn-exit" onClick={() => navigate('/home')}>
                🏠 Salir a Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleOnline;
