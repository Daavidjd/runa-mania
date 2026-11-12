import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getUserActiveDeck,
  watchChallenge,
  recordOnlineBattleResult,
  findRandomMatch,
  watchMatchmakingEntry,
  completeMatchmaking,
  leaveMatchmakingQueue
} from '../services/firestore';
import { joinOnlineRoom, watchRoom, leaveOnlineRoom, updateOnlineRoom, playOnlineMove } from '../services/realtime';

import { RUNES_DB } from '../data/runes';
import { AVATAR_OPTIONS } from '../data/avatars';
import RuneCard from './RuneCard';
import './Battle.css';
import './BattleOnline.css';

// ============================================================
// ⚔️ BATALLA EN LÍNEA (estilo Match de Clash Royale)
// Misma mecánica que la batalla NPC (tablero 4x4 + flechas),
// pero sincronizada entre dos jugadores reales por Firestore.
// 🔵 AZUL = primer jugador y siempre empieza | 🔴 ROJO = segundo jugador
// ============================================================

const getAttackDirections = (placedIdx, capturedIdxs) => {
  const dirs = { top: false, bottom: false, left: false, right: false };
  if (!capturedIdxs.length) return dirs;
  const pr = Math.floor(placedIdx / 4), pc = placedIdx % 4;
  capturedIdxs.forEach(ci => {
    const cr = Math.floor(ci / 4), cc = ci % 4;
    if (cr === pr - 1 && cc === pc) dirs.top = true;
    if (cr === pr + 1 && cc === pc) dirs.bottom = true;
    if (cr === pr && cc === pc - 1) dirs.left = true;
    if (cr === pr && cc === pc + 1) dirs.right = true;
  });
  return dirs;
};

const normalizeOnlineBoard = (value) => {
  const board = Array(16).fill(null);
  if (Array.isArray(value)) {
    value.forEach((cell, index) => {
      if (index >= 0 && index < 16 && cell) board[index] = cell;
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, cell]) => {
      const index = Number(key);
      if (/^(0|[1-9]|1[0-5])$/.test(key) && Number.isInteger(index) && cell) {
        board[index] = cell;
      }
    });
  }
  return board;
};

const buildHandFromIds = (runeIds, owner) => {
  const runes = (runeIds || [])
    .map(id => RUNES_DB.find(r => r.id === id))
    .filter(Boolean)
    .map(r => ({ ...r, owner }));
  // Completar mazos antiguos o incompletos hasta ocho runas sin duplicados.
  const existingIds = new Set(runes.map(r => r.id));
  const missingRunes = [...RUNES_DB]
    .filter(r => !existingIds.has(r.id))
    .sort(() => 0.5 - Math.random())
    .slice(0, 8 - runes.length)
    .map(r => ({ ...r, owner }));
  return [...runes, ...missingRunes].slice(0, 8);
};

const BattleOnline = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [battleData, setBattleData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onlineBattle') || 'null'); }
    catch { return null; }
  });

  // Al entrar a la sala, el reto saliente / cola de matchmaking ya se consumió: limpiar
  useEffect(() => {
    localStorage.removeItem('pendingOutgoingChallenge');
    localStorage.removeItem('randomMatchPending');
  }, []);

  const [phase, setPhase] = useState(battleData ? 'connecting' : 'error'); // connecting | coinflip | playing | error
  const [room, setRoom] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [oppProfile, setOppProfile] = useState(null);

  const [board, setBoard] = useState(Array(16).fill(null));
  const [myHand, setMyHand] = useState([]);
  const [oppHandCount, setOppHandCount] = useState(8);
  const [selectedCard, setSelectedCard] = useState(null);
  const [movePending, setMovePending] = useState(false);
  const [scores, setScores] = useState({ me: 0, opp: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [iWon, setIWon] = useState(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [flippingCells, setFlippingCells] = useState([]);
  const [captureOwnerOverrides, setCaptureOwnerOverrides] = useState({});
  const [lastPlaced, setLastPlaced] = useState(null);
  const [attackDirs, setAttackDirs] = useState({});
  const [shakeHand, setShakeHand] = useState(false);
  const [countdown, setCountdown] = useState(3); // ⏳ cuenta regresiva del volteo de moneda

  const roomUnsubRef = useRef(null);
  const challengeUnsubRef = useRef(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const appliedRemoteMovesRef = useRef(new Set());
  const boardRef = useRef(board);
  boardRef.current = board;
  const myUidRef = useRef(user?.uid || null);
  const reportedRef = useRef(false);
  const roomIdRef = useRef(null);
  const oppDeckSizeRef = useRef(8);
  const myUid = user?.uid || null;

  // Matchmaking desde la propia arena: el jugador ve el lobby mientras se busca rival.
  useEffect(() => {
    if (!user || !battleData?.searching) return undefined;
    let cancelled = false;
    let unsubscribe = null;
    let heartbeat = null;
    let accepted = false;
    const acceptMatch = (entry) => {
      if (cancelled || accepted || !entry?.roomId || !entry?.opponentUid) return;
      accepted = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      const next = {
        role: 'random',
        roomId: entry.roomId,
        opponentUid: entry.opponentUid,
        opponentName: entry.opponentName || 'Rival',
        opponentAvatarId: entry.opponentAvatarId || 'mago',
        matchOrder: entry.matchOrder || [entry.opponentUid, user.uid],
        searching: false
      };
      localStorage.setItem('onlineBattle', JSON.stringify(next));
      completeMatchmaking(user.uid, entry.roomId).catch(error => console.error('Error limpiando la cola tras emparejar:', error));
      setBattleData(next);
    };
    (async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) return;
        setMyProfile(profile);
        const displayName = profile?.username || user.displayName || user.email?.split('@')[0] || 'Invocador';
        const result = await findRandomMatch(user.uid, displayName, profile?.avatarId || 'mago');
        if (cancelled) return;
        if (!result.success) throw new Error(result.message || 'No se pudo buscar rival');
        if (result.matched) {
          acceptMatch(result);
          return;
        }
        unsubscribe = watchMatchmakingEntry(user.uid, acceptMatch, () => { if (!cancelled) setPhase('error'); });
        // Reintentar la búsqueda periódicamente: cubre el caso de dos altas
        // en el mismo milisegundo donde el jugador con prioridad aún no vio al otro.
        heartbeat = setInterval(async () => {
          try {
            const retry = await findRandomMatch(user.uid, displayName, profile?.avatarId || 'mago');
            if (retry.matched) acceptMatch(retry);
            else if (!retry.success) console.error('Reintento de matchmaking fallido:', retry.message);
          } catch (error) {
            console.error('Error reintentando matchmaking:', error);
          }
        }, 5000);
      } catch (error) {
        console.error('Error buscando rival:', error);
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
      // Al aceptar un match, no ejecutar la limpieza de "waiting":
      // el documento ya pertenece a una reserva matched que el otro cliente escucha.
      if (!accepted) {
        leaveMatchmakingQueue(user.uid).catch(error => console.error('Error saliendo de la cola:', error));
      }
    };
  }, [user, battleData?.searching]);

  const cancelMatchmaking = async () => {
    if (user) await leaveMatchmakingQueue(user.uid);
    localStorage.removeItem('onlineBattle');
    setBattleData(null);
    setPhase('error');
    navigate('/home');
  };

  // 🎨 El orden de matchmaking fija los colores: AZUL primero (siempre empieza), ROJO segundo.
  const activePlayers = Object.entries(room.players || {}).filter(([, p]) => p && p.joinedAt);
  const bothJoined = activePlayers.length >= 2;
  const colorsAssigned = bothJoined && !!room.blueUid && !!room.redUid;
  const blueUid = colorsAssigned ? room.blueUid : null;
  const iAmFirst = blueUid ? blueUid === myUid : false;
  const myColor = colorsAssigned ? (iAmFirst ? 'blue' : 'red') : null;
  const oppColor = colorsAssigned ? (iAmFirst ? 'red' : 'blue') : null;
  // Azul siempre abre la partida. starterUid se fija en la sala y ambos clientes usan el mismo dato.
  const starterIsMe = colorsAssigned && room.starterUid === myUid;

  // ---------- CONEXIÓN A LA SALA ----------
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!user || !battleData || battleData.searching || !battleData.opponentUid) return;

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

        const roomId = battleData.roomId || battleData.challengeId;
        roomIdRef.current = roomId;

        // Unirse a la sala y escucharla en tiempo real
        await joinOnlineRoom(roomId, user.uid, me?.username || 'Invocador', battleData.matchOrder || []);
        roomUnsubRef.current = watchRoom(roomId, (data) => { if (!cancelled) setRoom(data || {}); });

        // Esperar a que ambos estén dentro de la sala antes de resolver el duelo
        const waitForBoth = async () => {
          for (let i = 0; i < 60; i++) {
            const snap = await new Promise(resolve => {
              let settled = false;
              let stop = () => {};
              stop = watchRoom(roomId, data => {
                const players = Object.entries(data.players || {}).filter(([, p]) => p && p.joinedAt);
                if (players.length >= 2 && !settled) { settled = true; stop(); resolve(data); }
              });
              setTimeout(() => { if (!settled) { settled = true; stop(); resolve(null); } }, 30000);
            });
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
            // joinOnlineRoom asigna colores y starterUid una única vez mediante transacción.
            // Aquí solo se publican los tamaños de mazo de ambos jugadores.
            // Realtime Database interpreta las claves de update() como rutas: usar /,
            // nunca puntos, porque los puntos no están permitidos en las claves.
            updates[`deckSizes/${user.uid}`] = hand.length;
            updates[`deckSizes/${battleData.opponentUid}`] = oppHand.length;
            await updateOnlineRoom(roomId, updates);
          } catch (err) { console.error('Error preparando duelo online:', err); }
        })();

        // Si el reto fue cancelado/rechazado mientras conectábamos
        // (en partidas aleatorias no hay documento de reto, se omite)
        if (battleData.challengeId) {
          challengeUnsubRef.current = watchChallenge(battleData.challengeId, (ch) => {
            if (!cancelled && ch && ch.status === 'declined') setPhase('error');
          });
        }
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
  }, [battleData?.roomId, battleData?.opponentUid, battleData?.searching, battleData?.challengeId, user?.uid]);

  // ---------- SINCRONIZACIÓN DEL TABLERO ----------
  useEffect(() => {
    if (phase === 'error') return;
    // Firebase RTDB devuelve los tableros indexados como objeto, no siempre
    // como Array. Convertimos ambos formatos a las 16 casillas locales.
    const colored = normalizeOnlineBoard(room.board);
    const lastMove = room.lastMove;

    // El tablero compartido ya trae colores reales blue/red.
    // Conservamos el color anterior localmente mientras dura el giro.
    if (lastMove?.captured?.length && !appliedRemoteMovesRef.current.has(lastMove.moveId)) {
      const previousBoard = boardRef.current;
      const overrides = {};
      lastMove.captured.forEach(index => {
        const previousOwner = previousBoard[index]?.owner;
        if (previousOwner) overrides[index] = previousOwner === 'red' ? 'ai' : 'player';
      });
      if (Object.keys(overrides).length) setCaptureOwnerOverrides(overrides);
    }
    setBoard(colored);

    // Una sala inicializa el tablero vacío, así que la transición no debe
    // depender de que falte el array: solo comienza cuando hay dos jugadores,
    // ambos colores y el sorteo persistidos en la sala.
    if (bothJoined && colorsAssigned && room.starterUid && phaseRef.current === 'connecting') {
      setPhase('coinflip');
    }

    // Cartas restantes del rival (su mazo inicial menos las jugadas)
    const oppUid = Object.keys(room.players || {}).find(k => k !== myUidRef.current && room.players[k]);
    const oppDeckSize = room.deckSizes?.[oppUid] || 8;
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
          // Cambiar el color justo a mitad de la animación de giro (300 de 600 ms).
          setTimeout(() => setCaptureOwnerOverrides({}), 300);
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
    (myColor === 'blue' ? placedCount % 2 === 0 : myColor === 'red' ? placedCount % 2 === 1 : false);

  const handleCellClick = useCallback(async (index) => {
    if (gameOver || phase !== 'playing' || !myTurn || movePending || board[index]) return;
    if (selectedCard === null) {
      setShakeHand(true);
      setTimeout(() => setShakeHand(false), 500);
      return;
    }
    const card = myHand[selectedCard];
    if (!card) return;
    const moveId = `${user.uid}-${Date.now()}`;
    appliedRemoteMovesRef.current.add(moveId);
    setMovePending(true);
    try {
      const result = await playOnlineMove(roomIdRef.current, user.uid, card, index, moveId);
      if (!result.committed) {
        appliedRemoteMovesRef.current.delete(moveId);
        console.warn('Jugada online rechazada:', result.reason || 'El tablero ha cambiado');
        return;
      }
      setMyHand(prev => prev.filter((_, i) => i !== selectedCard));
      setSelectedCard(null);
      setLastPlaced(index);
      const captured = result.captured || [];
      if (captured.length) {
        setCaptureOwnerOverrides(Object.fromEntries(
          captured.map(ci => [ci, board[ci]?.owner === 'red' ? 'ai' : 'player'])
        ));
        setAttackDirs({ [index]: getAttackDirections(index, captured) });
        setTimeout(() => {
          setFlippingCells(captured);
          setAttackDirs({});
          setTimeout(() => setCaptureOwnerOverrides({}), 300);
          setTimeout(() => setFlippingCells([]), 600);
        }, 400);
      } else {
        setTimeout(() => setLastPlaced(null), 600);
      }
    } catch (error) {
      appliedRemoteMovesRef.current.delete(moveId);
      console.error('No se pudo registrar la jugada online:', error);
    } finally {
      setMovePending(false);
    }
  }, [gameOver, phase, myTurn, movePending, board, selectedCard, myHand, user]);


  // ---------- REPORTAR RESULTADO UNA SOLA VEZ ----------
  useEffect(() => {
    if (showEndModal && !reportedRef.current && user && iWon !== null) {
      reportedRef.current = true;
      recordOnlineBattleResult(user.uid, iWon);
    }
  }, [showEndModal, iWon, user]);

  // ---------- ⏳ CUENTA REGRESIVA DEL VOLTEO → INICIO AUTOMÁTICO ----------
  useEffect(() => {
    if (phase !== 'coinflip') return undefined;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); setPhase('playing'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

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
          <h2 className="bo-lobby-title">{battleData?.searching ? '⚔️ Buscando rival' : '⚔️ Arena en Línea'}</h2>

          <div className="bo-vs-row">
            <div className="bo-lobby-player bo-me">
              <img src={avatarSrcOf(myProfile)} alt="yo" className="bp-avatar-frame bo-match-avatar" style={{ borderColor: myColor === 'red' ? '#f44336' : myColor === 'blue' ? '#2196f3' : '#888' }} />
              <span className="bo-lobby-name bo-match-name">{myProfile?.username || 'Tú'}</span>
              {colorsAssigned && <span className="bo-lobby-tag" style={{ color: myColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{myColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>}
            </div>
            <span className="bo-vs-bolt">VS</span>
            <div className="bo-lobby-player bo-them">
              {oppJoined ? (
                <>
                  <img src={avatarSrcOf(oppProfile)} alt="rival" className="bp-avatar-frame bo-match-avatar" style={{ borderColor: oppColor === 'red' ? '#f44336' : oppColor === 'blue' ? '#2196f3' : '#888' }} />
                  <span className="bo-lobby-name bo-match-name">{battleData?.opponentName || 'Rival'}</span>
                  {colorsAssigned && <span className="bo-lobby-tag" style={{ color: oppColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{oppColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>}
                </>
              ) : (
                <>
                  <div className="bo-search-avatar-reel" aria-label="Buscando posibles rivales">{AVATAR_OPTIONS.slice(0, 4).map((avatar) => <img key={avatar.id} src={avatar.src} alt="" />)}</div>
                  <span className="bo-lobby-name bo-match-name">{battleData?.searching ? 'Buscando invocador...' : 'Esperando rival...'}</span>
                </>
              )}
            </div>
          </div>

          {oppJoined && (
            <div className="bo-lobby-info">
              🎲 Volteo de moneda 50/50 en curso...
            </div>
          )}

          <button className="bp-btn bp-btn-exit bo-leave" onClick={battleData?.searching ? cancelMatchmaking : () => navigate('/home')}>{battleData?.searching ? '✕ Cancelar búsqueda' : '🚪 Salir'}</button>
        </div>
      </div>
    );
  }

  // 🎲 PANTALLA DE VOLTEO DE MONEDA 50/50 (rojo vs azul) — Clash Royale style
  if (phase === 'coinflip') {
    return (
      <div className="bp bo-screen">
        <div className="bp-stars"></div>
        <div className="bo-lobby">
          <h2 className="bo-lobby-title">🎲 Volteo de moneda</h2>
          <div className={`bo-coin ${myColor === "blue" ? "bo-coin-show-blue" : "bo-coin-show-red"}`} aria-label={myColor === "blue" ? "Cara azul, elemento agua" : "Cara roja, elemento fuego"}><div className="bo-coin-face bo-coin-blue"><span>≋</span><small>AGUA · AZUL</small></div><div className="bo-coin-face bo-coin-red"><span>♨</span><small>FUEGO · ROJO</small></div></div>
          <div className="bo-vs-row bo-coinflip-names">
            <div className="bo-lobby-player bo-me">
              <img src={avatarSrcOf(myProfile)} alt="yo" className="bp-avatar-frame bo-match-avatar" style={{ borderColor: myColor === 'red' ? '#f44336' : '#2196f3' }} />
              <span className="bo-lobby-name bo-match-name">{myProfile?.username || 'Tú'}</span>
              <span className="bo-lobby-tag" style={{ color: myColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{myColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>
            </div>
            <span className="bo-vs-bolt">VS</span>
            <div className="bo-lobby-player bo-them">
              <img src={avatarSrcOf(oppProfile)} alt="rival" className="bp-avatar-frame bo-match-avatar" style={{ borderColor: oppColor === 'red' ? '#f44336' : '#2196f3' }} />
              <span className="bo-lobby-name bo-match-name">{battleData?.opponentName || oppProfile?.username || 'Rival'}</span>
              <span className="bo-lobby-tag" style={{ color: oppColor === 'red' ? '#ff8a80' : '#4fc3f7' }}>{oppColor === 'red' ? '🔴 Rojo' : '🔵 Azul'}</span>
            </div>
          </div>
          <div className="bo-lobby-info bo-coinflip-result">
            {starterIsMe ? '¡Empiezas tú!' : 'Empieza el rival'}
          </div>
          <p className="bo-coinflip-countdown">La batalla comienza en {countdown}...</p>
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
          <div className="bp-grid-4x4">
            {board.map((cell, i) => {
              const visualOwner = captureOwnerOverrides[i] || (cell?.owner === 'red' ? 'ai' : 'player');
              return (
              <div
                key={i}
                className={`bp-cell ${cell ? `bp-cell-${visualOwner}` : 'bp-cell-empty'} ${flippingCells.includes(i) ? 'bp-cell-flip' : ''} ${lastPlaced === i ? 'bp-cell-placed' : ''}`}
                onClick={() => handleCellClick(i)}
              >
                {cell ? (
                  <RuneCard
                    rune={cell}
                    visualOwner={visualOwner}
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
              );
            })}
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
