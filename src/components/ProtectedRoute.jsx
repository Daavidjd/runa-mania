import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import LoadingScreen from './LoadingScreen';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? children : <Navigate to="/" replace />;
}

export default ProtectedRoute;