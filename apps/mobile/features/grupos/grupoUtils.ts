import type { GrupoTurno } from '@api-client';
import { formatShortDate } from '@/lib/formatters';
import type { GrupoElegido, WizardData } from '@/features/turnos/crear/types';

/** Lo que el asistente guarda del grupo elegido. */
export function aElegido(g: Pick<GrupoTurno, 'id' | 'nombre' | 'lugar' | 'latitud' | 'longitud'> & { lugar_alias?: string | null }): GrupoElegido {
  return { id: g.id, nombre: g.nombre, lugar: g.lugar, lugar_alias: g.lugar_alias ?? null, latitud: g.latitud, longitud: g.longitud };
}

/** "Lun 9 nov" o "Lun 9 nov – Mié 11 nov"; null si el grupo aún no tiene turnos. */
export function rangoDeFechas(g: Pick<GrupoTurno, 'fecha_inicio' | 'fecha_fin'>): string | null {
  if (!g.fecha_inicio || !g.fecha_fin) return null;
  return g.fecha_inicio === g.fecha_fin
    ? formatShortDate(g.fecha_inicio)
    : `${formatShortDate(g.fecha_inicio)} – ${formatShortDate(g.fecha_fin)}`;
}

/** Línea de apoyo para elegir bien entre varios grupos: fechas y cuántos turnos tiene. */
export function subtituloGrupo(g: Pick<GrupoTurno, 'fecha_inicio' | 'fecha_fin' | 'total_turnos'>): string {
  const rango = rangoDeFechas(g);
  if (!rango) return 'Sin turnos todavía';
  return `${rango} · ${g.total_turnos} turno${g.total_turnos !== 1 ? 's' : ''}`;
}

/**
 * Qué cambia en el turno al elegir (o quitar) un grupo. El lugar del grupo es solo un valor por
 * defecto: se copia al turno únicamente si este aún no tiene lugar propio (vacío, o el que le
 * puso el grupo anterior) y no es de ubicación libre. Nunca pisa lo que el usuario escribió y
 * al quitar el grupo no se borra nada.
 */
export function parcheAlElegirGrupo(
  data: Pick<WizardData, 'lugar' | 'ubicacion_libre' | 'grupo'>,
  nuevo: GrupoElegido | null,
): Partial<WizardData> {
  const parche: Partial<WizardData> = { grupo: nuevo };
  const lugarSinDueno = !data.lugar.trim() || (!!data.grupo?.lugar && data.lugar === data.grupo.lugar);
  if (nuevo?.lugar && nuevo.latitud != null && nuevo.longitud != null && lugarSinDueno && !data.ubicacion_libre) {
    parche.lugar = nuevo.lugar;
    parche.lugar_alias = nuevo.lugar_alias ?? '';
    parche.latitud = nuevo.latitud;
    parche.longitud = nuevo.longitud;
  }
  return parche;
}

/** ¿El lugar que muestra el turno es el que viene del grupo? (para avisarlo bajo el campo) */
export function lugarEsDelGrupo(data: Pick<WizardData, 'lugar' | 'latitud' | 'longitud' | 'grupo'>): boolean {
  const g = data.grupo;
  return !!g?.lugar && data.lugar === g.lugar && data.latitud === g.latitud && data.longitud === g.longitud;
}
