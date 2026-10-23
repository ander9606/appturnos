/**
 * Design token bridge — valores JS que espeja tailwind.config.js.
 * Usar aquí en lugar de hex literales cuando NativeWind no alcanza
 * (ActivityIndicator color, RefreshControl tintColor, headerTintColor,
 *  placeholderTextColor, style={{ backgroundColor }}, etc.).
 */

export const COLORS = {
  // Marca y semánticos (los mismos de tailwind.config.js)
  primary:         '#FF5A3C',
  info:            '#3B82F6',
  success:         '#059669',
  warning:         '#F59E0B',
  danger:          '#EF4444',
  integracion:     '#6366F1', // indigo-500 — acento del módulo logiq360 (app/integracion/*)
  eventual:        '#7C3AED', // violet-600 — acento de los turnos eventuales
  // Neutros y superficies
  foreground:      '#0F172A',
  mutedForeground: '#64748B',
  placeholder:     '#94A3B8', // slate-400 — para placeholderTextColor
  border:          '#E2E8F0',
  borderStrong:    '#CBD5E1', // slate-300 — bordes marcados, controles deshabilitados
  card:            '#FFFFFF',
  background:      '#F8FAFC',
  muted:           '#F1F5F9', // slate-100 — zonas atenuadas, chips inactivos
  white:           '#FFFFFF', // texto/íconos sobre fondos de color
  shadow:          '#000000',
  slate600:        '#475569', // texto entre foreground y mutedForeground
  slate700:        '#334155',
  // Variantes de la marca (escala de tailwind.config.js)
  primaryLight:    '#FFF1EE', // primary-50
  primary400:      '#FF7150',
  primary600:      '#E83E1F',
  // Verde y azul del perfil con texto blanco encima (5,48:1 y 5,17:1); success/info quedan para íconos y fondos suaves (3,77 y 3,68).
  success700:      '#047857',
  info600:         '#2563EB',
  // Fondos suaves de cada semántico (badges, banners)
  successLight:    '#D1FAE5',
  warningLight:    '#FEF3C7',
  dangerLight:     '#FEE2E2',
  infoLight:       '#DBEAFE',
  // Texto/íconos fuertes SOBRE esos fondos suaves (pasan AA; ver docs/DISENO.md §6)
  successText:     '#166534', // green-800 (6.3:1 sobre successLight)
  warningText:     '#92400E', // amber-800
  dangerText:      '#991B1B', // red-800
  infoText:        '#1E3A8A', // blue-900
  // Bordes suaves
  infoBorder:      '#BFDBFE', // blue-200
  warningSoft:     '#FCD34D', // amber-300 — borde de aviso, estrella sobre fondo de color
  // Variantes de énfasis
  warningDark:     '#D97706', // amber-600 — íconos/texto grande de alerta sobre fondo claro (3.2:1, no sirve para texto pequeño)
  dangerDark:      '#DC2626', // red-600 — texto de error sobre fondo claro (4.8:1, pasa AA)
  starFilled:      '#F59E0B', // warning — estrella rellena
  starEmpty:       '#CBD5E1', // slate-300 — estrella vacía
} as const;

/**
 * Acentos categóricos: distinguen categorías (rol, tipo de día, nivel de ranking), no significan nada
 * por sí mismos. Para estados (éxito/alerta/error) usar COLORS.
 */
export const ACCENT = {
  violeta:   '#8B5CF6', // compensatorio, rol de nómina, plan empresarial, ranking elite
  rosa:      '#EC4899',
  esmeralda: '#10B981',
  naranja:   '#F97316',
  amarillo:  '#EAB308',
  indigo:    '#818CF8',
} as const;

/** Look de "papel" de las pantallas de documento (contrato, cuenta de cobro), que comparten valores. */
export const DOCUMENT_COLORS = {
  canvas:     '#E8EEF4', // fondo de la pantalla detrás de la hoja
  paper:      '#FFFEFB', // la hoja
  infoBg:     '#EFF6FF', // blue-50
  infoIcon:   '#2563EB', // blue-600
  warningBg:  '#FFFBEB', // amber-50
} as const;

/** Colores de marcas de terceros: se usan tal cual los define cada marca. */
export const THIRD_PARTY = {
  google: '#4285F4',
} as const;

/**
 * Color con transparencia: `alpha(COLORS.danger, 0.1)` → fondo rojo al 10 %.
 * Solo acepta `#RRGGBB` (los tokens de COLORS/ACCENT); `opacity` entre 0 y 1.
 */
export function alpha(color: string, opacity: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color; // otro formato (rgb(), nombre): sin transparencia antes que un color inválido
  const canal = Math.round(Math.min(1, Math.max(0, opacity)) * 255).toString(16).padStart(2, '0');
  return `${color}${canal}`;
}

// Paleta de avatares (iniciales de trabajadores). Orden fijo → mismo id = mismo color.
export const AVATAR_COLORS = [
  COLORS.primary,  // #FF5A3C
  COLORS.info,     // #3B82F6
  COLORS.success,  // #059669
  COLORS.warning,  // #F59E0B
  ACCENT.violeta,
  ACCENT.rosa,
] as const;

export function avatarColorForId(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// Composición de horas por tipo (barra de nómina). Orden fijo, validado contra
// daltonismo con el validador del skill de dataviz sobre superficie #FFFFFF
// (adjacent, ΔE normal-vision 27.6, CVD deutan 6.1 — banda límite, mitigado con
// la leyenda fija + detalle exacto siempre disponible al expandir la fila).
export const HOUR_TYPE_COLORS = {
  ordinarias:    COLORS.placeholder, // baseline neutro, no es una "serie"
  extraNocturna: '#4A3AA7', // violeta
  extraDiurna:   '#E87BA4', // magenta
  nocturna:      '#1BAF7A', // aqua
  festivo:       '#EB6834', // naranja
} as const;

// Paleta por tipo de usuario: naranja (turnos), verde (nomina), azul (gestores).
export const THEME_COLORS = {
  turnos:   { primary: COLORS.primary, primaryLight: COLORS.primaryLight },
  nomina:   { primary: COLORS.success700, primaryLight: '#ECFDF5' },
  gestores: { primary: COLORS.info600,    primaryLight: COLORS.infoLight },
} as const;

export type ThemeKey = keyof typeof THEME_COLORS;
