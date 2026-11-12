import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from './authStore';
import type { Rol } from './authStore';
import { homeForRol } from './roleHome';

export function ProtectedRoute() {
  const usuario = useAuthStore(s => s.usuario);
  if (!usuario) return <Navigate to="/bienvenida" replace />;
  // Igual que en mobile (app/_layout.tsx): super_admin no opera sobre datos de
  // trabajadores/empresa, así que no se le exige aceptar términos para entrar.
  if (usuario.rol !== 'super_admin' && !usuario.terminos_aceptados_at) return <Navigate to="/terminos" replace />;
  return <Outlet />;
}

/** Además de exigir sesión, exige que el rol esté en `roles` — si no, redirige al home real de ese rol. */
export function RoleRoute({ roles }: { roles: Rol[] }) {
  const usuario = useAuthStore(s => s.usuario);
  if (!usuario) return <Navigate to="/bienvenida" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={homeForRol(usuario.rol)} replace />;
  return <Outlet />;
}
