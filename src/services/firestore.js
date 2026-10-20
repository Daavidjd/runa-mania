import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc,
  deleteDoc
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
  return docSnap.exists() ? docSnap.data() : null;
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