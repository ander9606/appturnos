/**
 * Design token bridge — valores JS que espeja tailwind.config.js.
 * Usar aquí en lugar de hex literales cuando NativeWind no alcanza
 * (ActivityIndicator color, RefreshControl tintColor, headerTintColor,
 *  placeholderTextColor, style={{ backgroundColor }}, etc.).
 */

export const COLORS = {
  primary:         '#FF5A3C',
  info:            '#3B82F6',
  success:         '#059669',
  warning:         '#F59E0B',
  danger:          '#EF4444',
  foreground:      '#0F172A',
  mutedForeground: '#64748B',
  placeholder:     '#94A3B8', // slate-400 — para placeholderTextColor
  border:          '#E2E8F0',
  card:            '#FFFFFF',
  background:      '#F8FAFC',
  starFilled:      '#F59E0B', // warning — estrella rellena
  starEmpty:       '#CBD5E1', // slate-300 — estrella vacía
  shadow:          '#000000',
} as const;

// Paleta de avatares (iniciales de trabajadores). Orden fijo → mismo id = mismo color.
export const AVATAR_COLORS = [
  COLORS.primary,  // #FF5A3C
  COLORS.info,     // #3B82F6
  COLORS.success,  // #059669
  COLORS.warning,  // #F59E0B
  '#8B5CF6',       // purple-500 (no es token semántico, se define aquí)
  '#EC4899',       // pink-500
] as const;

export function avatarColorForId(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// Paleta por tipo de trabajador: naranja para turnos, verde para nómina.
export const THEME_COLORS = {
  turnos: { primary: '#FF5A3C', primaryLight: '#FFF1EE' },
  nomina: { primary: '#059669', primaryLight: '#ECFDF5' },
} as const;

export type ThemeKey = keyof typeof THEME_COLORS;
