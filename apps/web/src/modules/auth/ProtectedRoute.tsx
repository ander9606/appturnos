import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from './authStore';

export function ProtectedRoute() {
  const usuario = useAuthStore(s => s.usuario);
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}
