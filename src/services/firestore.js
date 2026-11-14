import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc,
  deleteDoc,
  query,
  where,
  limit as fsLimit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { ROCK_TYPES } from '../data/runes';

const MATCH_QUEUE = 'matchmakingQueue';
const MATCH_QUEUE_STALE_MS = 45000;

const matchedResult = (uid, entry) => ({
  success: true,
  matched: true,
  roomId: entry.roomId,
  opponentUid: entry.opponentUid,
  opponentName: entry.opponentName || 'Rival',
  opponentAvatarId: entry.opponentAvatarId || 'mago',
  matchOrder: entry.matchOrder || [entry.opponentUid, uid]
});

// Cola aleatoria en Firestore. La transacción reserva simultáneamente a ambos
// jugadores; el orden por searchedAt + UID evita que dos clientes se reclamen.
export const findRandomMatch = async (uid, name, avatarId) => {
  const ownRef = doc(db, MATCH_QUEUE, uid);
  const now = Date.now();
  try {
    const registration = await runTransaction(db, async transaction => {
      const ownSnap = await transaction.get(ownRef);
      const own = ownSnap.exists() ? ownSnap.data() : null;
      if (own?.status === 'matched' && own.roomId && own.opponentUid) {
        return { matched: true, entry: own };
      }
      const isFresh = own?.status === 'waiting'
        && Number.isFinite(Number(own.lastSeenAt))
        && now - Number(own.lastSeenAt) <= MATCH_QUEUE_STALE_MS;
      const searchedAt = isFresh ? Number(own.searchedAt) : now;
      transaction.set(ownRef, {
        uid, name: name || 'Invocador', avatarId: avatarId || 'mago',
        status: 'waiting', searchedAt, lastSeenAt: now
      });
      return { matched: false, searchedAt };
    });
    if (registration.matched) return matchedResult(uid, registration.entry);
    const searchedAt = registration.searchedAt;

    const queueSnap = await getDocs(query(
      collection(db, MATCH_QUEUE),
      where('status', '==', 'waiting'),
      fsLimit(50)
    ));
    const candidates = queueSnap.docs
      .filter(item => item.id !== uid)
      .map(item => ({ uid: item.id, ...item.data() }))
      .filter(item => {
        const candidateSeen = Number(item.lastSeenAt ?? item.searchedAt);
        const candidateSearch = Number(item.searchedAt);
        if (!Number.isFinite(candidateSeen) || !Number.isFinite(candidateSearch)
          || now - candidateSeen > MATCH_QUEUE_STALE_MS) return false;
        return candidateSearch < searchedAt
          || (candidateSearch === searchedAt && item.uid.localeCompare(uid) < 0);
      })
      .sort((a, b) => Number(a.searchedAt) - Number(b.searchedAt)
        || a.uid.localeCompare(b.uid));

    for (const opponent of candidates) {
      const opponentRef = doc(db, MATCH_QUEUE, opponent.uid);
      const roomId = `online-${now}-${[uid, opponent.uid].sort().join('-').slice(0, 24)}`;
      const matchOrder = [opponent.uid, uid];
      const result = await runTransaction(db, async transaction => {
        const [myLatestSnap, opponentLatestSnap] = await Promise.all([
          transaction.get(ownRef),
          transaction.get(opponentRef)
        ]);
        if (!myLatestSnap.exists() || !opponentLatestSnap.exists()) return null;
        const mine = myLatestSnap.data();
        const rival = opponentLatestSnap.data();
        const txNow = Date.now();
        const mineFresh = mine.status === 'waiting'
          && txNow - Number(mine.lastSeenAt ?? mine.searchedAt) <= MATCH_QUEUE_STALE_MS;
        const rivalFresh = rival.status === 'waiting'
          && txNow - Number(rival.lastSeenAt ?? rival.searchedAt) <= MATCH_QUEUE_STALE_MS;
        const rivalHasPriority = Number(rival.searchedAt) < Number(mine.searchedAt)
          || (Number(rival.searchedAt) === Number(mine.searchedAt) && opponent.uid.localeCompare(uid) < 0);
        if (!mineFresh || !rivalFresh || !rivalHasPriority) return null;

        transaction.update(ownRef, {
          status: 'matched', opponentUid: opponent.uid,
          opponentName: rival.name || 'Rival',
          opponentAvatarId: rival.avatarId || 'mago',
          roomId, matchOrder, matchedAt: txNow
        });
        transaction.update(opponentRef, {
          status: 'matched', opponentUid: uid,
          opponentName: mine.name || 'Invocador',
          opponentAvatarId: mine.avatarId || 'mago',
          roomId, matchOrder, matchedAt: txNow
        });
        return {
          success: true, matched: true, roomId,
          opponentUid: opponent.uid,
          opponentName: rival.name || 'Rival',
          opponentAvatarId: rival.avatarId || 'mago',
          matchOrder
        };
      });
      if (result?.matched) return result;
    }

    const latestSnap = await getDoc(ownRef);
    const latest = latestSnap.data();
    if (latest?.status === 'matched' && latest.roomId && latest.opponentUid) {
      return matchedResult(uid, latest);
    }
    return { success: true, matched: false };
  } catch (error) {
    console.error('Error buscando partida en Firestore:', error);
    return { success: false, matched: false, message: error?.message || 'Error al buscar rival' };
  }
};

export const watchMatchmakingEntry = (uid, callback, onError) =>
  onSnapshot(doc(db, MATCH_QUEUE, uid),
    snapshot => callback(snapshot.exists() ? { uid, ...snapshot.data() } : null),
    error => {
      console.error('Error escuchando la cola de matchmaking:', error);
      onError?.(error);
    });

export const completeMatchmaking = async (uid, roomId) => {
  const queueRef = doc(db, MATCH_QUEUE, uid);
  // Ya no hay heartbeat al aceptar el match: una lectura simple seguida de
  // borrado evita una transacción de verificación innecesaria sobre la cola.
  const snapshot = await getDoc(queueRef);
  if (snapshot.exists() && snapshot.data().status === 'matched'
    && snapshot.data().roomId === roomId) {
    await deleteDoc(queueRef);
  }
};

export const leaveMatchmakingQueue = async uid => {
  const queueRef = doc(db, MATCH_QUEUE, uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(queueRef);
    if (snapshot.exists() && snapshot.data().status === 'waiting') transaction.delete(queueRef);
  });
};



export const getUserCollection = async (userId) => {
  try {
    const snapshot = await getDocs(collection(db, `users/${userId}/collection`));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo colección:', error);
    return [];
  }
};

export const addRuneToCollection = async (userId, rune, awardId = null) => {
  if (!userId || !rune?.id) throw new Error('Usuario o runa no válidos');

  const collectionRef = doc(db, `users/${userId}/collection`, rune.id);
  const receiptRef = awardId
    ? doc(db, `users/${userId}/miningAwards`, awardId)
    : null;
  const obtainedAt = new Date().toISOString();

  await runTransaction(db, async transaction => {
    // Las lecturas ocurren antes de cualquier escritura.
    if (receiptRef) {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists()) return;
    }

    const snapshot = await transaction.get(collectionRef);
    if (snapshot.exists()) {
      const currentQuantity = Number(snapshot.data().quantity) || 0;
      transaction.update(collectionRef, {
        quantity: currentQuantity + 1,
        lastObtained: obtainedAt
      });
    } else {
      transaction.set(collectionRef, {
        ...rune,
        quantity: 1,
        obtainedAt
      });
    }

    if (receiptRef) {
      transaction.set(receiptRef, { runeId: rune.id, createdAt: obtainedAt });
    }
  });
};

export const getUserDecks = async (userId) => {
  const snapshot = await getDocs(collection(db, `users/${userId}/decks`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Un único mazo compartido de 8 runas para batallas NPC y online.
export const saveDeck = async (userId, deck) => {
  await setDoc(doc(db, `users/${userId}/decks`, 'shared'), {
    ...deck,
    name: 'Mazo de batalla',
    type: 'shared',
    runes: (deck.runes || []).slice(0, 8),
    createdAt: new Date().toISOString()
  }, { merge: true });
};

// Lee el mazo compartido; si aún no existe, migra en memoria el mazo legado
// online o NPC más reciente para que el usuario pueda completarlo hasta 8.
export const getPlayerDecks = async (userId) => {
  try {
    const decks = await getUserDecks(userId);
    const shared = decks.find(d => d.type === 'shared' || d.id === 'shared');
    const legacyOnline = decks.find(d => d.type === 'online' || d.id === 'online');
    const legacyNpc = decks.find(d => d.type === 'npc' || d.id === 'npc');
    const legacy = [legacyOnline, legacyNpc].filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    const selected = shared || (legacyOnline?.runes?.length >= 8 ? legacyOnline : legacy) || decks
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    const runes = (selected?.runes || []).slice(0, 8);
    return { npc: runes, online: runes, shared: runes };
  } catch (error) {
    console.error('Error obteniendo mazo:', error);
    return { npc: [], online: [], shared: [] };
  }
};

export const deleteDeck = async (userId, deckId) => {
  await deleteDoc(doc(db, `users/${userId}/decks`, deckId));
};

export const getUserProfile = async (userId) => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
};

export const createUserProfile = async (userId, profileData) => {
  await setDoc(doc(db, 'users', userId), {
    ...profileData,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

// FUNCIÓN AÑADIDA - Actualizar perfil de usuario
export const updateUserProfile = async (userId, profileData) => {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    ...profileData,
    updatedAt: new Date().toISOString()
  });
};

export const buyRock = async (userId, rockType) => {
  const rock = ROCK_TYPES[rockType];
  if (!userId || !rock) return { success: false, message: 'Tipo de roca no válido' };

  const profileRef = doc(db, 'users', userId);
  try {
    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists()) return { success: false, message: 'Perfil no encontrado' };

      const currentCoins = Number(snapshot.data().coins) || 0;
      if (currentCoins < rock.price) {
        return { success: false, message: 'No tienes suficientes monedas' };
      }

      transaction.update(profileRef, { coins: currentCoins - rock.price });
      return { success: true, message: '¡Roca comprada!' };
    });
  } catch (error) {
    console.error('Error en la compra de roca:', error);
    throw error;
  }
};

export const claimDailyRock = async (userId) => {
  if (!userId) return { success: false, message: 'Usuario no válido' };

  const profileRef = doc(db, 'users', userId);
  try {
    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists()) return { success: false, message: 'Perfil no encontrado' };

      const lastDaily = Number(snapshot.data().lastDailyRock) || 0;
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;
      const elapsed = now - lastDaily;

      if (lastDaily > 0 && elapsed < cooldown) {
        const remaining = cooldown - Math.max(0, elapsed);
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return {
          success: false,
          message: `Vuelve en ${hours}h ${minutes}m`,
          remaining
        };
      }

      transaction.update(profileRef, { lastDailyRock: now });
      return { success: true, message: '¡Roca diaria reclamada!' };
    });
  } catch (error) {
    console.error('Error reclamando roca diaria:', error);
    throw error;
  }
};

export const getDailyRockStatus = async (userId) => {
  if (!userId) return { available: false, error: 'Usuario no válido' };

  const profileRef = doc(db, 'users', userId);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) return { available: false, error: 'Perfil no encontrado' };

  const lastDaily = Number(snapshot.data().lastDailyRock) || 0;
  const cooldown = 24 * 60 * 60 * 1000;
  const remaining = cooldown - (Date.now() - lastDaily);

  return remaining > 0
    ? { available: false, remaining }
    : { available: true };
};
// ============================================================
// 🌐 SISTEMA EN LÍNEA: AMIGOS (agregar, eliminar, retar)
// ============================================================

// Búsqueda de jugadores por su código de invocador (6 caracteres: 3 letras + 3 números)
export const searchUserByCode = async (code) => {
  const clean = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return [];
  try {
    // 1) Búsqueda exacta por playerCode nuevo (K7RM2Q) o legacy (8 chars uid)
    let q = query(collection(db, 'users'), where('playerCode', '==', clean), fsLimit(10));
    let snap = await getDocs(q);
    let results = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

    // 2) Compatibilidad: también coincide con los primeros caracteres del ID antiguo
    if (results.length === 0 && clean.length >= 4) {
      q = query(
        collection(db, 'users'),
        where('userId', '>=', clean),
        where('userId', '<=', clean + '\uf8ff'),
        fsLimit(10)
      );
      snap = await getDocs(q);
      results = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }
    return results;
  } catch (error) {
    console.error('Error buscando jugadores:', error);
    return [];
  }
};

// Lista de usuarios que ya son amigos
export const getFriends = async (userId) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('friendIds', 'array-contains', userId),
      fsLimit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error obteniendo amigos:', error);
    return [];
  }
};

// Solicitudes de amistad recibidas (pendientes)
export const getIncomingRequests = async (userId) => {
  try {
    const q = query(
      collection(db, 'friendRequests'),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Adjuntamos datos básicos del emisor para mostrarlos
    for (const r of reqs) {
      const senderSnap = await getDoc(doc(db, 'users', r.from));
      r.sender = senderSnap.exists() ? { uid: r.from, ...senderSnap.data() } : null;
    }
    return reqs;
  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    return [];
  }
};

// Solicitudes de amistad enviadas (pendientes)
export const getOutgoingRequests = async (userId) => {
  try {
    const q = query(
      collection(db, 'friendRequests'),
      where('from', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const r of reqs) {
      const targetSnap = await getDoc(doc(db, 'users', r.to));
      r.target = targetSnap.exists() ? { uid: r.to, ...targetSnap.data() } : null;
    }
    return reqs;
  } catch (error) {
    console.error('Error obteniendo solicitudes enviadas:', error);
    return [];
  }
};

// Enviar solicitud de amistad. Basta con que una persona envíe la invitación;
// si ya existe una invitación inversa, se acepta automáticamente para ambos.
export const sendFriendRequest = async (fromUid, toUid) => {
  try {
    if (!fromUid || !toUid || fromUid === toUid) return { success: false, message: 'No puedes añadirte a ti mismo' };
    const [targetSnap, mySnap] = await Promise.all([
      getDoc(doc(db, 'users', toUid)),
      getDoc(doc(db, 'users', fromUid))
    ]);
    if (!targetSnap.exists() || !mySnap.exists()) return { success: false, message: 'Jugador no encontrado' };
    if ((mySnap.data().friendIds || []).includes(toUid) || (targetSnap.data().friendIds || []).includes(fromUid)) {
      return { success: true, message: 'Ya son amigos' };
    }

    // Comprobar primero la solicitud inversa: no exigimos que ambos se inviten.
    const reverseQ = query(
      collection(db, 'friendRequests'),
      where('from', '==', toUid),
      where('to', '==', fromUid),
      where('status', '==', 'pending')
    );
    const reverseSnap = await getDocs(reverseQ);
    if (!reverseSnap.empty) {
      const accepted = await acceptFriendRequest(reverseSnap.docs[0].id, fromUid, toUid);
      if (accepted.success) return { success: true, message: '¡Solicitud aceptada automáticamente! Ya son amigos 🤝', autoAccepted: true };
      return accepted;
    }

    const outgoingQ = query(
      collection(db, 'friendRequests'),
      where('from', '==', fromUid),
      where('to', '==', toUid),
      where('status', '==', 'pending')
    );
    const outgoingSnap = await getDocs(outgoingQ);
    if (!outgoingSnap.empty) return { success: true, message: 'Solicitud pendiente; el otro jugador puede aceptarla' };

    await addDoc(collection(db, 'friendRequests'), {
      from: fromUid,
      to: toUid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return { success: true, message: 'Solicitud enviada. Cuando la reciba, quedarán conectados como amigos ✉️' };
  } catch (error) {
    console.error('Error enviando solicitud de amistad:', error);
    return { success: false, message: 'No se pudo enviar la solicitud' };
  }
};

// Aceptar solicitud (se añade a la lista friendIds de ambos)
export const acceptFriendRequest = async (requestId, myUid, otherUidParam = null) => {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) return { success: false, message: 'Solicitud no encontrada' };

    const { from, to, status } = requestSnap.data();
    if (status !== 'pending' || ![from, to].includes(myUid)) {
      return { success: false, message: 'La solicitud ya no está disponible' };
    }
    const otherUid = otherUidParam || (myUid === from ? to : from);
    const [mySnap, otherSnap] = await Promise.all([
      getDoc(doc(db, 'users', myUid)),
      getDoc(doc(db, 'users', otherUid))
    ]);
    if (!mySnap.exists() || !otherSnap.exists()) {
      return { success: false, message: 'No se ha encontrado uno de los perfiles' };
    }

    const batch = writeBatch(db);
    batch.update(requestRef, { status: 'accepted', resolvedAt: serverTimestamp() });
    const myFriends = mySnap.data().friendIds || [];
    const otherFriends = otherSnap.data().friendIds || [];
    if (!myFriends.includes(otherUid)) {
      batch.update(doc(db, 'users', myUid), { friendIds: [...myFriends, otherUid] });
    }
    if (!otherFriends.includes(myUid)) {
      batch.update(doc(db, 'users', otherUid), { friendIds: [...otherFriends, myUid] });
    }
    await batch.commit();
    return { success: true, message: '¡Invocador añadido a amigos! 🎉' };
  } catch (error) {
    console.error('Error aceptando solicitud:', error);
    return { success: false, message: 'Error al aceptar la solicitud' };
  }
};

// Rechazar / cancelar solicitud
export const declineFriendRequest = async (requestId) => {
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));
    return { success: true, message: 'Solicitud eliminada' };
  } catch (error) {
    console.error('Error rechazando solicitud:', error);
    return { success: false, message: 'Error al eliminar la solicitud' };
  }
};

// Eliminar amigo (quita la entrada de ambas listas)
export const removeFriend = async (myUid, friendUid) => {
  try {
    const myRef = doc(db, 'users', myUid);
    const friendRef = doc(db, 'users', friendUid);
    const [mySnap, friendSnap] = await Promise.all([getDoc(myRef), getDoc(friendRef)]);
    if (!mySnap.exists()) return { success: false, message: 'Tu perfil no está disponible' };

    const batch = writeBatch(db);
    batch.update(myRef, { friendIds: (mySnap.data().friendIds || []).filter(id => id !== friendUid) });
    if (friendSnap.exists()) {
      batch.update(friendRef, { friendIds: (friendSnap.data().friendIds || []).filter(id => id !== myUid) });
    }
    await batch.commit();
    return { success: true, message: 'Amigo eliminado de tu lista' };
  } catch (error) {
    console.error('Error eliminando amigo:', error);
    return { success: false, message: 'No se pudo eliminar al amigo' };
  }
};

// ============================================================
// ⚔️ BATALLAS EN LÍNEA (reto → aceptación → sala compartida)
// ============================================================

export const createBattleChallenge = async (challengerUid, opponentUid) => {
  try {
    const challengerSnap = await getDoc(doc(db, 'users', challengerUid));
    const cData = challengerSnap.exists() ? challengerSnap.data() : {};
    // ⚠️ IMPORTANTE: el ID del reto se genera en cliente y es IGUAL a la sala
    // ('challenge-{ts}-{rand}'). Así, al aceptar, el rival puede escribir la
    // sala sin crear documentos (las reglas solo permiten UPDATE sobre salas).
    const challengeId = `challenge-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    await setDoc(doc(db, 'challenges', challengeId), {
      from: challengerUid,
      to: opponentUid,
      fromName: cData.username || 'Invocador',
      fromAvatarId: cData.avatarId || 'arquero',
      roomId: challengeId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return { success: true, challengeId, message: '⚔️ ¡Reto enviado!' };
  } catch (error) {
    console.error('Error creando reto:', error);
    return { success: false, message: 'Error al enviar el reto' };
  }
};

export const getPendingChallengesFor = async (userId) => {
  try {
    const q = query(
      collection(db, 'challenges'),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error obteniendo retos:', error);
    return [];
  }
};

// Retos salientes pendientes (para saber cuando el rival acepta nuestro reto)
export const getOutgoingPendingChallenges = async (userId) => {
  try {
    const q = query(
      collection(db, 'challenges'),
      where('from', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error obteniendo retos salientes:', error);
    return [];
  }
};

export const acceptChallenge = async (challengeId, myUid) => {
  try {
    const ref = doc(db, 'challenges', challengeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, message: 'El reto ya no existe' };
    await updateDoc(ref, { status: 'accepted', acceptedBy: myUid, resolvedAt: serverTimestamp() });
    return { success: true, message: '¡Reto aceptado! Entrando a la arena...' };
  } catch (error) {
    console.error('Error aceptando reto:', error);
    return { success: false, message: 'Error al aceptar el reto' };
  }
};

export const declineChallenge = async (challengeId) => {
  try {
    await updateDoc(doc(db, 'challenges', challengeId), {
      status: 'declined',
      resolvedAt: serverTimestamp()
    });
    return { success: true, message: 'Reto rechazado' };
  } catch (error) {
    console.error('Error rechazando reto:', error);
    return { success: false, message: 'Error al rechazar el reto' };
  }
};

// Escucha en tiempo real el estado de un reto (para saber cuando el rival acepta)
export const watchChallenge = (challengeId, callback) => {
  return onSnapshot(doc(db, 'challenges', challengeId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
};

// Recompensas online equilibradas. El identificador de sala evita pagar dos veces
// si React vuelve a ejecutar el efecto o ambos clientes reportan el mismo resultado.
export const ONLINE_BATTLE_REWARDS = {
  win: { coins: 150, xp: 25 },
  draw: { coins: 20, xp: 12 },
  loss: { coins: 10, xp: 5 }
};

export const recordOnlineBattleResult = async (userId, outcome, matchId) => {
  try {
    if (!userId || !matchId || !['win', 'draw', 'loss'].includes(outcome)) return null;
    const userRef = doc(db, 'users', userId);
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.lastOnlineRewardRoomId === matchId) return { alreadyRecorded: true };
      const reward = ONLINE_BATTLE_REWARDS[outcome];
      transaction.update(userRef, {
        coins: (Number(data.coins) || 0) + reward.coins,
        xp: (Number(data.xp) || 0) + reward.xp,
        onlineWins: (Number(data.onlineWins) || 0) + (outcome === 'win' ? 1 : 0),
        onlineLosses: (Number(data.onlineLosses) || 0) + (outcome === 'loss' ? 1 : 0),
        onlineDraws: (Number(data.onlineDraws) || 0) + (outcome === 'draw' ? 1 : 0),
        lastOnlineRewardRoomId: matchId
      });
      return { ...reward, outcome };
    });
  } catch (error) {
    console.error('Error guardando resultado online:', error);
    return null;
  }
};


// Mazo compartido para batallas NPC y online (8 runas).
// Fallback: último mazo guardado de cualquier tipo.
export const getUserActiveDeck = async (userId) => {
  try {
    const { online, npc } = await getPlayerDecks(userId);
    return (online.length ? online : npc).slice(0, 8);
  } catch (error) {
    console.error('Error obteniendo mazo activo:', error);
    return [];
  }
};

// Alias compatible: el modo NPC utiliza el mismo mazo compartido de 8 runas.
export const getUserNpcDeck = async (userId) => {
  try {
    const { npc, online } = await getPlayerDecks(userId);
    return (online.length ? online : npc).slice(0, 8);
  } catch (error) {
    console.error('Error obteniendo mazo NPC:', error);
    return [];
  }
};

// ============================================================
// 🆔 CÓDIGO DE JUGADOR: 6 caracteres — 3 letras + 3 números
// Ejemplo: K7RM2Q → se muestra como "K7R-M2Q"
// ============================================================
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O para evitar confusiones
const CODE_DIGITS = '0123456789';

export const generatePlayerCode = () => {
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  // 3 letras y 3 números intercalados en posiciones aleatorias
  const slots = [null, null, null, null, null, null];
  const letterPositions = [...Array(6).keys()].sort(() => Math.random() - 0.5).slice(0, 3);
  for (let i = 0; i < 6; i++) {
    slots[i] = letterPositions.includes(i) ? pick(CODE_LETTERS) : pick(CODE_DIGITS);
  }
  return slots.join('');
};

// Busca un perfil disponible cuyo playerCode aún no esté en uso
export const findFreePlayerCode = async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generatePlayerCode();
    const q = query(collection(db, 'users'), where('playerCode', '==', code), fsLimit(1));
    const snap = await getDocs(q);
    if (snap.empty) return code;
  }
  return generatePlayerCode(); // colisión improbable: se acepta
};
