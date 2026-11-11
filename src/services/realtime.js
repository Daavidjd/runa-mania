import {
  ref, get, set, update, remove, onValue, onDisconnect, runTransaction
} from 'firebase/database';
import { rtdb } from './firebase';

const QUEUE_PATH = 'matchmaking/queue';
const ROOM_PATH = 'onlineRooms';

export const findRandomMatch = async (uid, name, avatarId) => {
  const myRef = ref(rtdb, `${QUEUE_PATH}/${uid}`);
  const entry = { uid, name, avatarId: avatarId || 'mago', status: 'searching', searchedAt: Date.now() };
  try {
    await set(myRef, entry);
    await onDisconnect(myRef).remove();
    const roomId = `online-${Date.now()}-${uid.slice(0, 6)}`;
    let match = null;
    const result = await runTransaction(ref(rtdb, QUEUE_PATH), (queue) => {
      queue = queue || {};
      const candidates = Object.values(queue)
        .filter(p => p && p.uid !== uid && ['searching', 'waiting'].includes(p.status)
          && Date.now() - (p.searchedAt || 0) < 60000)
        .sort((a, b) => (a.searchedAt || 0) - (b.searchedAt || 0));
      if (candidates.length) {
        const opponent = candidates[0];
        match = { opponent, roomId };
        queue[opponent.uid] = { ...opponent, status: 'matched', opponentUid: uid,
          opponentName: name, opponentAvatarId: avatarId || 'mago', roomId };
        queue[uid] = { ...entry, status: 'matched', opponentUid: opponent.uid,
          opponentName: opponent.name || 'Rival', opponentAvatarId: opponent.avatarId || 'mago', roomId };
      } else {
        queue[uid] = { ...entry, status: 'waiting' };
      }
      return queue;
    }, { applyLocally: false });
    if (!result.committed) return { success: false, matched: false, message: 'No se pudo entrar en la cola' };
    const mine = result.snapshot.child(uid).val();
    if (mine?.status === 'matched') return {
      success: true, matched: true, roomId: mine.roomId, opponentUid: mine.opponentUid,
      opponentName: mine.opponentName, opponentAvatarId: mine.opponentAvatarId
    };
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
