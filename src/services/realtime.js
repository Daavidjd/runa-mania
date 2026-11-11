import {
  ref, get, set, update, remove, onValue, onDisconnect, runTransaction
} from 'firebase/database';
import { rtdb } from './firebase';

const QUEUE_PATH = 'matchmaking/queue';
const ROOM_PATH = 'onlineRooms';

export const findRandomMatch = async (uid, name, avatarId) => {
  const myRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const entry = { uid, name, avatarId: avatarId || 'mago', status: 'waiting', searchedAt: Date.now() };
  try {
    await set(myRef, entry);
    await onDisconnect(myRef).remove();

    const queueSnap = await get(ref(rtdb, QUEUE_PATH));
    const candidates = Object.values(queueSnap.val() || {})
      .filter(p => p && p.uid !== uid && p.status === 'waiting'
        && Date.now() - (p.searchedAt || 0) < 60000)
      .sort((a, b) => (a.searchedAt || 0) - (b.searchedAt || 0));

    for (const opponent of candidates) {
      const roomId = `online-${Date.now()}-${uid.slice(0, 6)}`;
      const opponentRef = ref(rtdb, `${QUEUE_PATH}/${opponent.uid}`);
      const claim = await runTransaction(opponentRef, current => {
        if (!current || current.status !== 'waiting'
          || Date.now() - (current.searchedAt || 0) >= 60000) return;
        return { ...current, status: 'matched', opponentUid: uid,
          opponentName: name, opponentAvatarId: avatarId || 'mago', roomId };
      }, { applyLocally: false });
      if (!claim.committed) continue;

      await set(myRef, { ...entry, status: 'matched', opponentUid: opponent.uid,
        opponentName: opponent.name || 'Rival', opponentAvatarId: opponent.avatarId || 'mago', roomId });
      return { success: true, matched: true, roomId, opponentUid: opponent.uid,
        opponentName: opponent.name || 'Rival', opponentAvatarId: opponent.avatarId || 'mago' };
    }
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

export const joinOnlineRoom = async (roomId, uid, displayName) => {
  const roomRef = ref(rtdb, `${ROOM_PATH}/${roomId}`);
  const now = Date.now();
  const result = await runTransaction(roomRef, room => {
    room = room || { roomId, createdAt: now, players: {}, board: Array(16).fill(null), deckSizes: {}, finished: false };
    room.players = room.players || {};
    if (!room.players[uid] && Object.keys(room.players).filter(k => room.players[k]).length >= 2) return;
    if (!room.players[uid]) room.players[uid] = { name: displayName, ready: true, joinedAt: now };
    if (!room.blueUid) room.blueUid = uid;
    return room;
  }, { applyLocally: false });
  if (!result.committed) throw new Error('La sala está completa o no se pudo reservar plaza');
  await onDisconnect(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).remove();
  return { success: true };
};

export const watchRoom = (roomId, callback) =>
  onValue(ref(rtdb, `${ROOM_PATH}/${roomId}`), snap => callback(snap.val() || {}));

export const updateOnlineRoom = (roomId, updates) =>
  update(ref(rtdb, `${ROOM_PATH}/${roomId}`), updates);

export const leaveOnlineRoom = (roomId, uid) =>
  remove(ref(rtdb, `${ROOM_PATH}/${roomId}/players/${uid}`)).catch(() => {});
