import {
  ref, get, set, update, remove, onValue, onDisconnect, runTransaction
} from 'firebase/database';
import { rtdb } from './firebase';

const QUEUE_PATH = 'queue';
const ROOM_PATH = 'onlineRooms';

export const findRandomMatch = async (uid, name, avatarId) => {
  const myRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const now = Date.now();
  const entry = {
    uid, name, avatarId: avatarId || 'mago',
    status: 'waiting',
    searchedAt: now
  };

  try {
    // La transacción sobre TODA la cola hace indivisible la selección y reserva
    // de los dos jugadores: dos búsquedas simultáneas no pueden reclamar rivales
    // diferentes ni generar dos salas para el mismo emparejamiento.
    const queueResult = await runTransaction(ref(rtdb, QUEUE_PATH), current => {
      const queue = current || {};
      const existing = queue[uid];

      // Si este usuario ya fue emparejado por otra búsqueda, conservar ese match.
      if (existing?.status === 'matched' && existing.roomId && existing.opponentUid) {
        return queue;
      }

      const candidates = Object.values(queue)
        .filter(p => p && p.uid !== uid && p.status === 'waiting'
          && Number.isFinite(Number(p.searchedAt))
          && now - Number(p.searchedAt) < 60000)
        // FIFO estricto: primero el más antiguo; UID desempata timestamps iguales.
        .sort((a, b) => Number(a.searchedAt) - Number(b.searchedAt)
          || String(a.uid).localeCompare(String(b.uid)));

      const opponent = candidates[0];
      if (!opponent) {
        queue[uid] = existing?.status === 'waiting'
          ? { ...existing, name, avatarId: avatarId || 'mago' }
          : entry;
        return queue;
      }

      const matchOrder = [opponent.uid, uid];
      const roomId = `online-${now}-${opponent.uid.slice(0, 6)}-${uid.slice(0, 6)}`;
      queue[opponent.uid] = {
        ...opponent,
        status: 'matched',
        opponentUid: uid,
        opponentName: name,
        opponentAvatarId: avatarId || 'mago',
        roomId,
        matchOrder
      };
      queue[uid] = {
        ...entry,
        status: 'matched',
        opponentUid: opponent.uid,
        opponentName: opponent.name || 'Rival',
        opponentAvatarId: opponent.avatarId || 'mago',
        roomId,
        matchOrder
      };
      return queue;
    }, { applyLocally: false });

    if (!queueResult.committed) {
      throw new Error('No se pudo reservar el emparejamiento');
    }

    const myEntry = queueResult.snapshot.val()?.[uid];
    if (myEntry?.status === 'matched' && myEntry.roomId && myEntry.opponentUid) {
      // El emparejamiento ya está cerrado; el disconnect solo limpia la entrada
      // de cola, nunca asigna ni cambia colores de la sala.
      await onDisconnect(myRef).remove();
      return {
        success: true,
        matched: true,
        roomId: myEntry.roomId,
        opponentUid: myEntry.opponentUid,
        opponentName: myEntry.opponentName || 'Rival',
        opponentAvatarId: myEntry.opponentAvatarId || 'mago',
        matchOrder: myEntry.matchOrder || [myEntry.opponentUid, uid]
      };
    }

    await onDisconnect(myRef).remove();
    return { success: true, matched: false };
  } catch (error) {
    console.error('Error buscando partida en Realtime Database:', error);
    return { success: false, matched: false, message: 'Error al buscar rival' };
  }
};

export const watchMyQueueEntry = (uid, callback) =>
  onValue(ref(rtdb, `${QUEUE_PATH}/${uid}`), snap => callback(snap.val() ? { uid, ...snap.val() } : null));

export const leaveQueue = async uid => {
  const queueRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const snap = await get(queueRef);
  if (snap.exists() && ['searching', 'waiting'].includes(snap.val().status)) await remove(queueRef);
};

export const joinOnlineRoom = async (roomId, uid, displayName, matchOrder = []) => {
  const roomRef = ref(rtdb, `${ROOM_PATH}/${roomId}`);
  const now = Date.now();
  const result = await runTransaction(roomRef, room => {
    room = room || {
      roomId, createdAt: now, players: {},
      board: Array(16).fill(null), deckSizes: {}, finished: false
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
        room.starterUid = Math.random() < 0.5 ? room.blueUid : room.redUid;
      }
      room.colorsAssignedAt = now;
    }
    return room;
  }, { applyLocally: false });

  if (!result.committed) throw new Error('La sala está completa o no se pudo reservar plaza');
  await onDisconnect(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).remove();
  return { success: true, room: result.snapshot.val() };
};

export const watchRoom = (roomId, callback) =>
  onValue(ref(rtdb, `${ROOM_PATH}/${roomId}`), snap => callback(snap.val() || {}));

export const updateOnlineRoom = (roomId, updates) =>
  update(ref(rtdb, `${ROOM_PATH}/${roomId}`), updates);

export const leaveOnlineRoom = (roomId, uid) =>
  remove(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).catch(() => {});
