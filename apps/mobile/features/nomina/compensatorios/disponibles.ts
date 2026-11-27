import type { DescansoCompensatorio } from '@api-client';
import { toISODate } from '@/lib/formatters';
import { COLORS } from '@/lib/designTokens';

/** Espejo de COMPENSATORIO_PLAZO_DIAS (backend/config/constants.js): días para tomar el descanso. */
export const COMPENSATORIO_PLAZO_DIAS = 28;

/** Último día en que se puede tomar un descanso por el festivo trabajado en `origenFecha`. */
export function vencimientoCompensatorio(origenFecha: string): string {
  const d = new Date(`${origenFecha}T12:00:00`);
  d.setDate(d.getDate() + COMPENSATORIO_PLAZO_DIAS);
  return toISODate(d);
}

/**
 * Compensatorios pendientes de un trabajador que se pueden tomar el día `fecha`: dentro de los 28 días
 * siguientes al festivo trabajado. El más antiguo primero — es el que se preselecciona. Mismo criterio que
 * `elegirPendienteParaDia` del backend, que es quien decide de verdad.
 */
export function compensatoriosDisponibles(
  lista: readonly Pick<DescansoCompensatorio, 'id' | 'trabajador_id' | 'estado' | 'origen_fecha' | 'clasificacion'>[],
  trabajadorId: number,
  fecha: string,
) {
  return lista
    .filter((c) => c.trabajador_id === trabajadorId && c.estado === 'pendiente'
      && fecha > c.origen_fecha && fecha <= vencimientoCompensatorio(c.origen_fecha))
    .sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha) || a.id - b.id);
}

/** Días que le quedan (desde `hoy`) para tomar el descanso del festivo trabajado en `origenFecha` (o hasta la fecha dada si `esVencimiento`); negativo si ya venció. */
export function diasParaVencer(origenFecha: string, hoy: string, esVencimiento = false): number {
  const vence = esVencimiento ? origenFecha : vencimientoCompensatorio(origenFecha);
  const ms = new Date(`${vence}T12:00:00`).getTime() - new Date(`${hoy}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

export function textoVencimiento(dias: number): string {
  if (dias < 0) return 'Vencido';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/** Rojo la última semana (hay que asignarlo ya), ámbar el resto. Ambos pasan AA sobre fondo claro. */
export function colorVencimiento(dias: number): string {
  return dias <= 7 ? COLORS.dangerText : COLORS.warningText;
}
