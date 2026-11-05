import type { FaseGrupo, GrupoTurno, TurnoDeGrupo } from '@api-client';
import { formatShortDate } from '@/lib/formatters';
import type { GrupoElegido, WizardData } from '@/features/turnos/crear/types';

/** Lo que el asistente guarda del grupo elegido. */
export function aElegido(g: Pick<GrupoTurno, 'id' | 'nombre' | 'lugar' | 'latitud' | 'longitud'>): GrupoElegido {
  return { id: g.id, nombre: g.nombre, lugar: g.lugar, latitud: g.latitud, longitud: g.longitud };
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

/** Texto y color de la fase del grupo (la fase la calcula el backend con las fechas de sus turnos). */
export const FASE_INFO: Record<FaseGrupo, { label: string; clase: string; texto: string }> = {
  sin_turnos: { label: 'Sin turnos',  clase: 'bg-muted',          texto: 'text-muted-foreground' },
  proximo:    { label: 'Próximo',     clase: 'bg-primary/10',    texto: 'text-primary-700' },
  en_curso:   { label: 'En curso',    clase: 'bg-success-light',  texto: 'text-success' },
  terminado:  { label: 'Terminado',   clase: 'bg-muted',          texto: 'text-muted-foreground' },
  cerrado:    { label: 'Cerrado',     clase: 'bg-muted',          texto: 'text-muted-foreground' },
};

/** Último turno del grupo que se puede copiar: el de fecha más reciente que no esté cancelado. */
export function ultimoTurnoCopiable(turnos: TurnoDeGrupo[]): TurnoDeGrupo | null {
  const vivos = turnos.filter((t) => t.estado !== 'cancelada');
  if (!vivos.length) return null;
  return vivos.reduce((a, b) => (b.fecha > a.fecha || (b.fecha === a.fecha && b.hora_inicio > a.hora_inicio) ? b : a));
}
