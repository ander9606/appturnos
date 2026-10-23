import { createContext, useContext } from 'react';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { THEME_COLORS, type ThemeKey } from '@/lib/designTokens';

const GESTOR_ROLES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina'];

/**
 * Sección con color propio, sea cual sea el rol: la pestaña Nómina de un gestor es verde
 * (no azul), igual que para el trabajador de nómina. Se usa con `<SeccionTema.Provider value="nomina">`.
 */
export const SeccionTema = createContext<'nomina' | null>(null);

/** Devuelve la paleta de color según la sección (si fija una) o el rol del usuario autenticado. */
export function useTheme() {
  const seccion = useContext(SeccionTema);
  const rol = useAuthStore((s) => s.usuario?.rol);
  if (seccion === 'nomina') return THEME_COLORS.nomina;
  if (GESTOR_ROLES.includes(rol ?? '')) return THEME_COLORS.gestores;
  if (rol === 'trabajador_nomina')       return THEME_COLORS.nomina;
  return THEME_COLORS.turnos; // default + trabajador_turnos
}
