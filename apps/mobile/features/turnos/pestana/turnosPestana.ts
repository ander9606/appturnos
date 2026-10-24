import { COLORS } from '@/lib/designTokens';
import type { Asignacion, Oferta } from '@api-client';

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

export function fmtRangeSimple(start: string, end: string | null, finDiaSiguiente?: number | boolean | null): string {
  const s = start.slice(0, 5).replace(/^0/, '');
  if (!end) return s;
  return `${s} – ${end.slice(0, 5).replace(/^0/, '')}${finDiaSiguiente ? ' (día sig.)' : ''}`;
}

/** 'YYYY-MM-DD HH:MM:SS' sumando un día a `fecha` si el turno termina al día siguiente (comparable como texto). */
function momento(fecha: string, hora: string, diaSiguiente?: number | null): string {
  let dia = fecha.slice(0, 10);
  if (diaSiguiente) {
    const d = new Date(`${dia}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    dia = d.toISOString().slice(0, 10);
  }
  return `${dia} ${hora}`;
}

/** Detecta si una oferta se solapa en horario con algún turno confirmado del trabajador (también si cruza la medianoche). */
export function turnosSolapan(oferta: Oferta, confirmados: Asignacion[]): boolean {
  const ofIni = momento(oferta.fecha, oferta.hora_inicio);
  const ofFin = momento(oferta.fecha, oferta.hora_fin_estimada ?? '23:59:59', oferta.fin_dia_siguiente);
  return confirmados.some((a) => {
    const aIni = momento(a.oferta_fecha, a.hora_inicio);
    const aFin = momento(a.oferta_fecha, a.hora_fin_estimada ?? '23:59:59', a.fin_dia_siguiente);
    return aIni < ofFin && aFin > ofIni;
  });
}

export const CAL_COLOR = {
  borrador:   COLORS.placeholder, // gris — no publicada, no requiere acción
  urgente:    COLORS.warning, // ámbar — puestos sin cubrir cerca de la fecha, o postulantes sin revisar
  completada: COLORS.success, // verde
  cancelada:  COLORS.danger, // rojo
  // Naranja (activa, sin urgencia) usa `primary` del theme — es el acento del módulo Turnos.
};

/**
 * Color del punto de calendario del gestor para una oferta.
 * "Completada con incidencia" (no_presentado/sospechoso) queda fuera a propósito:
 * requeriría traer las asignaciones de cada oferta del mes (N+1), no solo el listado —
 * upgrade path: que el backend agregue un flag `tiene_incidencias` a GET /ofertas.
 */
export function colorOferta(o: Oferta, pendientesPorOferta: Map<number, number>, today: string, primary: string): string {
  if (o.estado === 'cancelada')  return CAL_COLOR.cancelada;
  if (o.estado === 'completada') return CAL_COLOR.completada;
  if (o.estado === 'borrador')   return CAL_COLOR.borrador;

  const totalPlazas = o.puestos?.reduce((s, p) => s + p.plazas, 0) ?? 0;
  const cubiertas   = o.puestos?.reduce((s, p) => s + p.plazas_cubiertas, 0) ?? 0;
  const incompleta  = cubiertas < totalPlazas;
  const pendientes  = pendientesPorOferta.get(o.id) ?? 0;
  const diasHasta   = (new Date(`${o.fecha}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000;
  const urgente = pendientes > 0 || (incompleta && diasHasta <= 3);

  return urgente ? CAL_COLOR.urgente : primary;
}
