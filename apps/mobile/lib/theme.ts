import { useAuthStore } from '@/features/auth/useAuthStore';
import { THEME_COLORS, type ThemeKey } from '@/lib/designTokens';

const GESTOR_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

/** Devuelve la paleta de color según el rol del usuario autenticado. */
export function useTheme() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  if (GESTOR_ROLES.includes(rol ?? '')) return THEME_COLORS.gestores;
  if (rol === 'trabajador_nomina')       return THEME_COLORS.nomina;
  return THEME_COLORS.turnos; // default + trabajador_turnos
}
