import {
  ref, runTransaction, onValue, onDisconnect, update, remove
} from 'firebase/database';
import { rtdb } from './firebase';

const ROOM_PATH = 'onlineRooms';

export const joinOnlineRoom = async (roomId, uid, displayName, matchOrder = []) => {
  const roomRef = ref(rtdb, `${ROOM_PATH}/${roomId}`);
  const now = Date.now();
  const result = await runTransaction(roomRef, room => {
    room = room || {
      roomId, createdAt: now, players: {},
      board: {}, deckSizes: {}, finished: false
    };
    room.players = room.players || {};
    const playerIds = Object.keys(room.players).filter(k => room.players[k]);
    if (!room.players[uid] && playerIds.length >= 2) return;

    if (!room.players[uid]) {
      room.players[uid] = { name: displayName, ready: true, joinedAt: now };
    }

    // No se fija ningún color hasta que estén los dos jugadores dentro.
    const joinedIds = Object.keys(room.players).filter(k => room.players[k]);
    if (joinedIds.length === 2 && !room.blueUid) {
      const ordered = Array.isArray(matchOrder) && matchOrder.length === 2
        ? matchOrder.filter(id => joinedIds.includes(id))
        : [];
      const byArrival = joinedIds.sort((a, b) =>
        Number(room.players[a].joinedAt || 0) - Number(room.players[b].joinedAt || 0)
        || a.localeCompare(b)
      );
      room.blueUid = ordered.length === 2 ? ordered[0] : byArrival[0];
      room.redUid = joinedIds.find(id => id !== room.blueUid);
      if (!room.starterUid) {
        room.starterUid = room.blueUid;
      }
      room.colorsAssignedAt = now;
    }
    return room;
  }, { applyLocally: false });

  if (!result.committed) throw new Error('La sala está completa o no se pudo reservar plaza');
  await onDisconnect(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).remove();
  return { success: true, room: result.snapshot.val() };
};

// Registra una jugada contra la versión más reciente de la sala.
// Azul siempre juega con número par de casillas ocupadas; rojo con número impar.
// La transacción evita sobrescrituras de movimientos concurrentes.
export const playOnlineMove = async (roomId, uid, card, index, moveId) => {
  const roomRef = ref(rtdb, `${ROOM_PATH}/${roomId}`);
  let capturedResult = [];
  let rejectionReason = 'La jugada ya no es válida';
  const result = await runTransaction(roomRef, room => {
    if (!room || !room.players?.[uid]?.joinedAt || !room.starterUid) {
      rejectionReason = 'La sala todavía no está preparada';
      return;
    }
    // RTDB no conserva arrays dispersos con null: los devuelve como objetos
    // numéricos. Normalizamos SIEMPRE a un array local de 16 casillas.
    const board = Array(16).fill(null);
    if (Array.isArray(room.board)) {
      room.board.forEach((cell, i) => { if (i >= 0 && i < 16 && cell) board[i] = cell; });
    } else if (room.board && typeof room.board === 'object') {
      Object.entries(room.board).forEach(([key, cell]) => {
        const i = Number(key);
        if (/^(0|[1-9]|1[0-5])$/.test(key) && Number.isInteger(i) && cell) board[i] = cell;
      });
    }
    const occupied = board.filter(Boolean).length;
    const isBlue = room.blueUid === uid;
    const isRed = room.redUid === uid;
    if (!isBlue && !isRed) { rejectionReason = 'No tienes un color asignado en esta sala'; return; }
    const isMyTurn = isBlue ? occupied % 2 === 0 : occupied % 2 === 1;
    if (!isMyTurn) {
      rejectionReason = 'No es tu turno';
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= 16 || board[index]) {
      rejectionReason = 'Esa casilla ya está ocupada';
      return;
    }
    const myColor = isBlue ? 'blue' : 'red';
    if (!myColor) {
      rejectionReason = 'No tienes un color asignado en esta sala';
      return;
    }
    const enemyColor = myColor === 'blue' ? 'red' : 'blue';
    const placed = {
      id: card.id, name: card.name, image: card.image, tier: card.tier,
      arrows: card.arrows || {}, owner: myColor, flipped: false
    };
    board[index] = placed;
    const row = Math.floor(index / 4), col = index % 4;
    const directions = [
      { dr: -1, dc: 0, attack: 'top', defend: 'bottom' },
      { dr: 0, dc: 1, attack: 'right', defend: 'left' },
      { dr: 1, dc: 0, attack: 'bottom', defend: 'top' },
      { dr: 0, dc: -1, attack: 'left', defend: 'right' }
    ];
    const captured = [];
    for (const { dr, dc, attack, defend } of directions) {
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr >= 4 || nc < 0 || nc >= 4) continue;
      const neighborIndex = nr * 4 + nc;
      const neighbor = board[neighborIndex];
      if (neighbor?.owner === enemyColor &&
          (placed.arrows[attack] || 0) > (neighbor.arrows?.[defend] || 0)) {
        captured.push(neighborIndex);
      }
    }
    captured.forEach(i => { board[i] = { ...board[i], owner: myColor, flipped: true }; });
    // Guardamos solo las casillas ocupadas como objeto { "0": rune, ... }.
    // Nunca persistimos nulls ni un array disperso en Realtime Database.
    room.board = Object.fromEntries(
      board.map((cell, i) => cell ? [String(i), cell] : null).filter(Boolean)
    );
    room.lastMove = { by: uid, index, captured, moveId };
    room.updatedAt = Date.now();
    capturedResult = captured;
    rejectionReason = '';
    return room;
  }, { applyLocally: false });
  return {
    committed: result.committed,
    captured: result.committed ? capturedResult : [],
    reason: result.committed ? null : rejectionReason,
    room: result.snapshot.val()
  };
};

export const watchRoom = (roomId, callback) =>
  onValue(ref(rtdb, `${ROOM_PATH}/${roomId}`), snap => callback(snap.val() || {}));

export const updateOnlineRoom = (roomId, updates) =>
  update(ref(rtdb, `${ROOM_PATH}/${roomId}`), updates);

export const leaveOnlineRoom = (roomId, uid) =>
  remove(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).catch(() => {});
