import { fmtPeriodo } from '@/shared/lib/format';
import type { GrupoElegido, GrupoTurno } from './types';

/** Lo que el formulario guarda del grupo elegido. */
export function aElegido(g: GrupoTurno): GrupoElegido {
  return { id: g.id, nombre: g.nombre, lugar: g.lugar, lugar_alias: g.lugar_alias ?? null, latitud: g.latitud, longitud: g.longitud };
}

/** Línea de apoyo para elegir bien entre varios grupos: fechas y cuántos turnos tiene. */
export function subtituloGrupo(g: Pick<GrupoTurno, 'fecha_inicio' | 'fecha_fin' | 'total_turnos'>): string {
  if (!g.fecha_inicio || !g.fecha_fin) return 'Sin turnos todavía';
  return `${fmtPeriodo(g.fecha_inicio, g.fecha_fin)} · ${g.total_turnos} turno${g.total_turnos !== 1 ? 's' : ''}`;
}

/**
 * Lugar que debe quedar en el turno al elegir (o quitar) un grupo, o null si no cambia nada. El lugar del
 * grupo es solo un valor por defecto: se copia al turno únicamente si este aún no tiene lugar propio (vacío,
 * o el que le puso el grupo anterior). Nunca pisa lo que el usuario escribió y quitar el grupo no borra nada.
 */
export function lugarAlElegirGrupo(
  turno: { lugar: string },
  anterior: GrupoElegido | null,
  nuevo: GrupoElegido | null,
): { lugar: string; lugar_alias: string; latitud: number; longitud: number } | null {
  if (!nuevo?.lugar || nuevo.latitud == null || nuevo.longitud == null) return null;
  const sinDueno = !turno.lugar.trim() || (!!anterior?.lugar && turno.lugar === anterior.lugar);
  return sinDueno ? { lugar: nuevo.lugar, lugar_alias: nuevo.lugar_alias ?? '', latitud: nuevo.latitud, longitud: nuevo.longitud } : null;
}

/** ¿El lugar que muestra el turno es el que viene del grupo? (para avisarlo bajo el campo) */
export function lugarEsDelGrupo(
  turno: { lugar: string; latitud: number | null; longitud: number | null },
  grupo: GrupoElegido | null,
): boolean {
  return !!grupo?.lugar && turno.lugar === grupo.lugar && turno.latitud === grupo.latitud && turno.longitud === grupo.longitud;
}
