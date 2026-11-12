import {
  ref, get, set, update, remove, onValue, onDisconnect, runTransaction
} from 'firebase/database';
import { rtdb } from './firebase';

const QUEUE_PATH = 'matchmaking/queue';
const MAX_QUEUE_SILENCE_MS = 45000;
const ROOM_PATH = 'onlineRooms';

export const findRandomMatch = async (uid, name, avatarId) => {
  const myRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const now = Date.now();
  const entry = {
    uid, name, avatarId: avatarId || 'mago',
    status: 'waiting',
    searchedAt: now,
    lastSeenAt: now
  };

  try {
    // La regla de seguridad autoriza escrituras por usuario en queue/{uid},
    // no una transacción sobre /queue completo. Reservamos cada rival con una
    // transacción individual y FIFO estricto para evitar reclamaciones cruzadas.
    const existingSnap = await get(myRef);
    const existing = existingSnap.val();
    if (existing?.status === 'matched' && existing.roomId && existing.opponentUid) {
      return {
        success: true, matched: true, roomId: existing.roomId,
        opponentUid: existing.opponentUid,
        opponentName: existing.opponentName || 'Rival',
        opponentAvatarId: existing.opponentAvatarId || 'mago',
        matchOrder: existing.matchOrder || [existing.opponentUid, uid]
      };
    }

    if (existing?.status === 'waiting' && Number.isFinite(Number(existing.searchedAt))) {
      entry.searchedAt = Number(existing.searchedAt);
    }
    await onDisconnect(myRef).remove();
    await set(myRef, entry);

    const queueSnap = await get(ref(rtdb, QUEUE_PATH));
    const candidates = Object.values(queueSnap.val() || {})
      .filter(p => {
        if (!p || p.uid === uid || p.status !== 'waiting') return false;
        const searchedAt = Number(p.searchedAt);
        const lastSeenAt = Number(p.lastSeenAt ?? searchedAt);
        if (!Number.isFinite(lastSeenAt) || now - lastSeenAt > MAX_QUEUE_SILENCE_MS) return false;
        // Solo el jugador que llegó DESPUÉS puede reclamar al anterior.
        // El desempate por UID define un orden total incluso en el mismo ms.
        return searchedAt < now || (searchedAt === now && String(p.uid) < String(uid));
      })
      .sort((a, b) => Number(a.searchedAt) - Number(b.searchedAt)
        || String(a.uid).localeCompare(String(b.uid)));

    for (const opponent of candidates) {
      const roomId = `online-${now}-${opponent.uid.slice(0, 6)}-${uid.slice(0, 6)}`;
      const matchOrder = [opponent.uid, uid];
      const opponentRef = ref(rtdb, `${QUEUE_PATH}/${opponent.uid}`);
      const claim = await runTransaction(opponentRef, current => {
        if (!current || current.uid !== opponent.uid || current.status !== 'waiting') return;
        const searchedAt = Number(current.searchedAt);
        const lastSeenAt = Number(current.lastSeenAt ?? searchedAt);
        if (!Number.isFinite(lastSeenAt) || now - lastSeenAt > MAX_QUEUE_SILENCE_MS) return;
        if (!(searchedAt < now || (searchedAt === now && String(current.uid) < String(uid)))) return;
        return {
          ...current,
          status: 'matched',
          opponentUid: uid,
          opponentName: name,
          opponentAvatarId: avatarId || 'mago',
          roomId,
          matchOrder
        };
      }, { applyLocally: false });

      if (!claim.committed) continue;

      const ownClaim = await runTransaction(myRef, current => {
        if (!current || current.uid !== uid || current.status !== 'waiting') return;
        return { ...current, status: 'matched', opponentUid: opponent.uid,
          opponentName: opponent.name || 'Rival', opponentAvatarId: opponent.avatarId || 'mago',
          roomId, matchOrder };
      }, { applyLocally: false });

      if (!ownClaim.committed) {
        await runTransaction(opponentRef, current => {
          if (!current || current.status !== 'matched' || current.opponentUid !== uid || current.roomId !== roomId) return;
          const { status, opponentUid, opponentName, opponentAvatarId, roomId: _roomId, matchOrder: _matchOrder, ...waiting } = current;
          return { ...waiting, status: 'waiting' };
        }, { applyLocally: false });
        continue;
      }

      return {
        success: true, matched: true, roomId,
        opponentUid: opponent.uid,
        opponentName: opponent.name || 'Rival',
        opponentAvatarId: opponent.avatarId || 'mago',
        matchOrder
      };
    }

    return { success: true, matched: false };
  } catch (error) {
    console.error('Error buscando partida en Realtime Database:', error);
    return { success: false, matched: false, message: 'Error al buscar rival' };
  }
};

export const watchMyQueueEntry = (uid, callback, onError) =>
  onValue(ref(rtdb, `${QUEUE_PATH}/${uid}`),
    snap => callback(snap.val() ? { uid, ...snap.val() } : null),
    error => {
      console.error('Error escuchando la cola de matchmaking:', error);
      onError?.(error);
    });

export const refreshQueueEntry = async uid => {
  const queueRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  await runTransaction(queueRef, current => {
    if (!current || current.status !== 'waiting') return;
    return { ...current, lastSeenAt: Date.now() };
  }, { applyLocally: false });
};

export const completeQueueMatch = async (uid, roomId) => {
  const queueRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const snap = await get(queueRef);
  const entry = snap.val();
  if (entry?.status === 'matched' && entry.roomId === roomId) await remove(queueRef);
};

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
