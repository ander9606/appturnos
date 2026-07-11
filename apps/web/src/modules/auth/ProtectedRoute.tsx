import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from './authStore';
import type { Rol } from './authStore';
import { homeForRol } from './roleHome';

export function ProtectedRoute() {
  const usuario = useAuthStore(s => s.usuario);
  if (!usuario) return <Navigate to="/bienvenida" replace />;
  return <Outlet />;
}

/** Además de exigir sesión, exige que el rol esté en `roles` — si no, redirige al home real de ese rol. */
export function RoleRoute({ roles }: { roles: Rol[] }) {
  const usuario = useAuthStore(s => s.usuario);
  if (!usuario) return <Navigate to="/bienvenida" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={homeForRol(usuario.rol)} replace />;
  return <Outlet />;
}
