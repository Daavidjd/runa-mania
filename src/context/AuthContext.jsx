import { createContext, useState, useEffect, useContext } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password) => {
    return await createUserWithEmailAndPassword(auth, email, password);
  };

  const registerGuest = async () => {
    return await signInAnonymously(auth);
  };

  const logout = async () => {
    return await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;