import { useAuthStore } from '@/features/auth/useAuthStore';
import { THEME_COLORS, type ThemeKey } from '@/lib/designTokens';

/** Devuelve la paleta de color según el rol del usuario autenticado. */
export function useTheme() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  const key: ThemeKey = rol === 'trabajador_nomina' ? 'nomina' : 'turnos';
  return THEME_COLORS[key];
}
