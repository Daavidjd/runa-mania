import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Componentes y Páginas
import Auth from './pages/Auth';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Battle from './components/Battle';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';

// Assets Pesados (Avatares y Rocas)
import Arquero from './assets/avatar/Arquero.png';
import Bruja from './assets/avatar/Bruja.png';
import Caballero from './assets/avatar/Caballero.png';
import Elfo from './assets/avatar/Elfo.png';
import Lobo from './assets/avatar/Lobo.png';
import Mago from './assets/avatar/Mago.png';

import Roca1 from './assets/rocks/Roca1.png';
import Roca2 from './assets/rocks/Roca2.png';
import Roca3 from './assets/rocks/Roca3.png';

// Base de datos de runas (para extraer sus imágenes automáticamente)
import { RUNES_DB } from './data/runes';

// 🚀 LISTA MAESTRA DE ASSETS PARA PRECARGA
// Esto evita que las imágenes se descarguen de golpe durante la batalla, eliminando el lag.
const HEAVY_ASSETS = [
  // Avatares
  Arquero, Bruja, Caballero, Elfo, Lobo, Mago,
  // Rocas de la tienda
  Roca1, Roca2, Roca3,
  // Todas las imágenes de las runas (el truco para que Battle vuele)
  ...RUNES_DB.map(rune => rune.image)
];

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);

  return (
    <Router>
      <AuthProvider>
        {/* 1. PANTALLA DE CARGA: Bloquea la vista hasta que todo esté en caché */}
        {!isAppReady ? (
          <LoadingScreen 
            assets={HEAVY_ASSETS} 
            onComplete={() => setIsAppReady(true)}
            minDisplayTime={1500} // Mínimo 1.5s para que se aprecie la animación
          />
        ) : (
          /* 2. APLICACIÓN PRINCIPAL: Se renderiza solo cuando las imágenes están listas */
          <>
            <Routes>
              <Route path="/" element={<Auth />} />

              <Route path="/home" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />

              <Route path="/collection" element={
                <ProtectedRoute>
                  <Collection />
                </ProtectedRoute>
              } />

              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />

              <Route path="/shop" element={
                <ProtectedRoute>
                  <Shop />
                </ProtectedRoute>
              } />

              <Route path="/battle" element={
                <ProtectedRoute>
                  <Battle />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* El Navbar gestiona él mismo en qué pantallas se oculta */}
            <Navbar />
          </>
        )}
      </AuthProvider>
    </Router>
  );
}