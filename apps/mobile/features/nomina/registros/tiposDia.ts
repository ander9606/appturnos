import { COLORS, ACCENT } from '@/lib/designTokens';
import type { TipoDia } from '@api-client';

// ── Constantes ────────────────────────────────────────────────────────────

export const TIPOS_DIA: { v: TipoDia; label: string; color: string }[] = [
  { v: 'ordinario',     label: 'Ordinario',     color: COLORS.mutedForeground },
  { v: 'descanso',      label: 'Descanso',      color: COLORS.info },
  { v: 'vacacion',      label: 'Vacación',      color: COLORS.success },
  { v: 'incapacidad',   label: 'Incapacidad',   color: COLORS.warning },
  { v: 'compensatorio', label: 'Compensatorio', color: ACCENT.violeta },
  { v: 'licencia',      label: 'Licencia',      color: ACCENT.rosa },
  { v: 'ausencia',      label: 'Ausencia (no vino)', color: COLORS.danger },
];

// 'ausencia' se maneja aparte (mensaje y color distinto) — estos son los
// demás tipo_dia que tampoco requieren horario de entrada/salida. 'vacacion'
// se incluye para poder marcar un rango de varios días de una sola vez.
// 'incapacidad' sin hora_entrada además descuenta el auxilio de transporte
// de esa quincena (ver liquidacion.model.js, dias_sin_subsidio).
export const TIPOS_DIA_SIN_HORARIO: TipoDia[] = ['compensatorio', 'descanso', 'incapacidad', 'licencia', 'vacacion'];

// 'licencia' y 'vacacion' se marcan por rango — a diferencia de los demás
// tipos, que son un día puntual.
export const TIPOS_RANGO: TipoDia[] = ['licencia', 'vacacion'];
