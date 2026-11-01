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
  orderBy,
  limit as fsLimit,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

export const getUserCollection = async (userId) => {
  try {
    const snapshot = await getDocs(collection(db, `users/${userId}/collection`));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo colección:', error);
    return [];
  }
};

export const addRuneToCollection = async (userId, rune) => {
  const docRef = doc(db, `users/${userId}/collection`, rune.id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    await updateDoc(docRef, {
      quantity: docSnap.data().quantity + 1,
      lastObtained: new Date().toISOString()
    });
  } else {
    await setDoc(docRef, {
      ...rune,
      quantity: 1,
      obtainedAt: new Date().toISOString()
    });
  }
};

export const getUserDecks = async (userId) => {
  const snapshot = await getDocs(collection(db, `users/${userId}/decks`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveDeck = async (userId, deck) => {
  await addDoc(collection(db, `users/${userId}/decks`), {
    ...deck,
    createdAt: new Date().toISOString()
  });
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

export const buyRock = async (userId, rockType, price) => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return { success: false, message: 'Perfil no encontrado' };
  
  const currentCoins = docSnap.data().coins || 0;
  if (currentCoins < price) {
    return { success: false, message: 'No tienes suficientes monedas' };
  }
  
  await updateDoc(docRef, {
    coins: currentCoins - price
  });
  
  return { success: true, message: '¡Roca comprada!' };
};

export const claimDailyRock = async (userId) => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return { success: false, message: 'Perfil no encontrado' };
  
  const profile = docSnap.data();
  const lastDaily = profile.lastDailyRock || 0;
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  if (now - lastDaily < twentyFourHours) {
    const remaining = twentyFourHours - (now - lastDaily);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return { 
      success: false, 
      message: `Vuelve en ${hours}h ${minutes}m`,
      remaining
    };
  }
  
  await updateDoc(docRef, {
    lastDailyRock: now
  });
  
  return { success: true, message: '¡Roca diaria reclamada!' };
};

export const getDailyRockStatus = async (userId) => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return { available: true };
  
  const profile = docSnap.data();
  const lastDaily = profile.lastDailyRock || 0;
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  if (now - lastDaily < twentyFourHours) {
    const remaining = twentyFourHours - (now - lastDaily);
    return { available: false, remaining };
  }
  
  return { available: true };
};
// ============================================================
// 🌐 SISTEMA EN LÍNEA: AMIGOS (agregar, eliminar, retar)
// ============================================================

// Búsqueda de jugadores por su ID de invocador (los primeros 8 caracteres)
export const searchUserByCode = async (code) => {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return [];
  try {
    const q = query(
      collection(db, 'users'),
      where('userId', '>=', clean),
      where('userId', '<=', clean + '\uf8ff'),
      fsLimit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
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

// Enviar solicitud de amistad
export const sendFriendRequest = async (fromUid, toUid) => {
  if (fromUid === toUid) return { success: false, message: 'No puedes añadirte a ti mismo' };

  const targetSnap = await getDoc(doc(db, 'users', toUid));
  if (!targetSnap.exists()) return { success: false, message: 'Jugador no encontrado' };

  if ((targetSnap.data().friendIds || []).includes(fromUid)) {
    return { success: false, message: 'Ya son amigos' };
  }

  // Evitar duplicados: si ya existe una pendiente entre ambos, reutilizar/eliminar
  const dupQ = query(
    collection(db, 'friendRequests'),
    where('from', '==', fromUid),
    where('to', '==', toUid),
    where('status', '==', 'pending')
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) return { success: false, message: 'Solicitud ya enviada' };

  // Si el otro ya nos envió una solicitud, se aceptan mutuamente al instante
  const reverseQ = query(
    collection(db, 'friendRequests'),
    where('from', '==', toUid),
    where('to', '==', fromUid),
    where('status', '==', 'pending')
  );
  const reverseSnap = await getDocs(reverseQ);
  if (!reverseSnap.empty) {
    await acceptFriendRequest(reverseSnap.docs[0].id, toUid, fromUid);
    return { success: true, message: '¡Son nuevos amigos! 🤝', autoAccepted: true };
  }

  await addDoc(collection(db, 'friendRequests'), {
    from: fromUid,
    to: toUid,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return { success: true, message: 'Solicitud enviada ✉️' };
};

// Aceptar solicitud (se añade a la lista friendIds de ambos)
export const acceptFriendRequest = async (requestId, myUid, otherUidParam = null) => {
  try {
    const ref = doc(db, 'friendRequests', requestId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, message: 'Solicitud no encontrada' };

    const { from, to } = snap.data();
    const me = myUid;
    const other = otherUidParam || (me === from ? to : from);

    await updateDoc(ref, { status: 'accepted', resolvedAt: serverTimestamp() });

    for (const uid of [me, other]) {
      const uRef = doc(db, 'users', uid);
      const uSnap = await getDoc(uRef);
      if (!uSnap.exists()) continue;
      const ids = uSnap.data().friendIds || [];
      if (!ids.includes(other)) {
        await updateDoc(uRef, { friendIds: [...ids, other] });
      }
    }
    return { success: true, message: 'Invocador añadido a amigos 🎉' };
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
    for (const uid of [myUid, friendUid]) {
      const uRef = doc(db, 'users', uid);
      const uSnap = await getDoc(uRef);
      if (!uSnap.exists()) continue;
      const ids = (uSnap.data().friendIds || []).filter(id => id !== (uid === myUid ? friendUid : myUid));
      await updateDoc(uRef, { friendIds: ids });
    }
    return { success: true, message: 'Amigo eliminado' };
  } catch (error) {
    console.error('Error eliminando amigo:', error);
    return { success: false, message: 'Error al eliminar al amigo' };
  }
};

// ============================================================
// ⚔️ BATALLAS EN LÍNEA (reto → aceptación → sala compartida)
// ============================================================

export const createBattleChallenge = async (challengerUid, opponentUid) => {
  try {
    const challengerSnap = await getDoc(doc(db, 'users', challengerUid));
    const cData = challengerSnap.exists() ? challengerSnap.data() : {};
    const docRef = await addDoc(collection(db, 'challenges'), {
      from: challengerUid,
      to: opponentUid,
      fromName: cData.username || 'Invocador',
      fromAvatarId: cData.avatarId || 'arquero',
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return { success: true, challengeId: docRef.id, message: '⚔️ ¡Reto enviado!' };
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

// Sala compartida en tiempo real estilo Match de Clash Royale.
// El primer jugador en unirse queda registrado como AZUL 🔵 (blueUid),
// el segundo será ROJO 🔴. Solo escribe; la escucha se hace con watchRoom.
export const joinOnlineRoom = async (roomId, myUid, displayName) => {
  const ref = doc(db, 'rooms', roomId);
  try {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const updates = {
      [`players.${myUid}`]: { name: displayName, ready: true, joinedAt: Date.now() }
    };
    if (!data.blueUid) updates.blueUid = myUid;
    await setDoc(ref, updates, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error entrando a la sala:', error);
    return { success: false };
  }
};

// Escucha en tiempo real el estado de una sala de batalla
export const watchRoom = (roomId, callback) => {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
};

export const leaveOnlineRoom = (roomId, myUid) => {
  return updateDoc(doc(db, 'rooms', roomId), {
    [`players.${myUid}`]: null
  }).catch(() => {});
};

// Guardar resultado de una batalla online (estadísticas del perfil)
export const recordOnlineBattleResult = async (userId, won) => {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const wins = data.onlineWins || 0;
    const losses = data.onlineLosses || 0;
    const updates = won
      ? { onlineWins: wins + 1, coins: (data.coins || 0) + 30, xp: (data.xp || 0) + 25 }
      : { onlineLosses: losses + 1, coins: (data.coins || 0) + 5, xp: (data.xp || 0) + 5 };
    await updateDoc(ref, updates);
  } catch (error) {
    console.error('Error guardando resultado online:', error);
  }
};


// Mazo activo de un jugador (último guardado) — usado por las batallas en línea
export const getUserActiveDeck = async (userId) => {
  try {
    const decks = await getUserDecks(userId);
    if (!decks.length) return [];
    decks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return decks[0].runes || [];
  } catch (error) {
    console.error('Error obteniendo mazo activo:', error);
    return [];
  }
};
