import type { Rol } from './authStore';

/** super_admin no tiene datos en "/dashboard" (DashboardPage no le muestra nada) — su home real es el listado de empresas. */
export function homeForRol(rol: Rol): string {
  return rol === 'super_admin' ? '/admin/empresas' : '/dashboard';
}
