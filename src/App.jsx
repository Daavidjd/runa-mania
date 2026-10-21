import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Collection from './components/Collection';
import Profile from './pages/Profile';
import Shop from './components/Shop';
import Battle from './components/Battle';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

export default function App() {
  return (
    <Router>
      <AuthProvider>
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
      </AuthProvider>
    </Router>
  );
}
