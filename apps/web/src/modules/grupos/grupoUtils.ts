import axios from 'axios';
import { fmtPeriodo } from '@/shared/lib/format';
import type { FaseGrupo, GrupoElegido, GrupoTurno, TurnoDeGrupo } from './types';

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

/** Texto y color de la fase del grupo (la calcula el servidor con las fechas de sus turnos). */
export const FASE_INFO: Record<FaseGrupo, { label: string; clase: string }> = {
  sin_turnos: { label: 'Sin turnos', clase: 'bg-muted text-muted-foreground' },
  proximo:    { label: 'Próximo',    clase: 'bg-primary/10 text-primary-700' },
  en_curso:   { label: 'En curso',   clase: 'bg-success-light text-success' },
  terminado:  { label: 'Terminado',  clase: 'bg-muted text-muted-foreground' },
  cerrado:    { label: 'Cerrado',    clase: 'bg-muted text-muted-foreground' },
};

/** Último turno del grupo que se puede copiar: el de fecha más reciente que no esté cancelado. */
export function ultimoTurnoCopiable(turnos: TurnoDeGrupo[]): TurnoDeGrupo | null {
  const vivos = turnos.filter(t => t.estado !== 'cancelada');
  if (!vivos.length) return null;
  return vivos.reduce((a, b) => (b.fecha > a.fecha || (b.fecha === a.fecha && b.hora_inicio > a.hora_inicio) ? b : a));
}

/**
 * Si el error es el aviso de cerrar un grupo con turnos terminados sin contrato firmado (409 con código
 * `confirmar_cierre`), devuelve el texto para preguntar al usuario; si es cualquier otro error, null.
 */
export function avisoDeCierre(err: unknown): string | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return null;
  const data = err.response.data as { message?: string; detalles?: { codigo?: string }[] } | undefined;
  return data?.detalles?.[0]?.codigo === 'confirmar_cierre' ? (data.message ?? 'Hay contratos sin firmar.') : null;
}

/**
 * Período de facturación que contiene una fecha (YYYY-MM-DD): quincena 1–15 o 16–fin de mes.
 * ponytail: asume ciclo quincenal, el más común — upgrade path: leer el período real de la empresa.
 */
export function periodoDeFecha(iso: string): { desde: string; hasta: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return d <= 15
    ? { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-15` }
    : { desde: `${y}-${mm}-16`, hasta: `${y}-${mm}-${ultimo}` };
}

/** ¿El grupo tiene turnos dentro del período? Uno recién creado (sin turnos) también cuenta: es el que se va a usar. */
export function grupoEnPeriodo(g: Pick<GrupoTurno, 'fecha_inicio' | 'fecha_fin'>, p: { desde: string; hasta: string }): boolean {
  if (!g.fecha_inicio || !g.fecha_fin) return true;
  return g.fecha_inicio <= p.hasta && g.fecha_fin >= p.desde;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda por nombre o lugar, sin distinguir mayúsculas ni tildes. */
export function coincideBusqueda(g: Pick<GrupoTurno, 'nombre' | 'lugar' | 'lugar_alias'>, texto: string): boolean {
  const q = sinTildes(texto.trim());
  if (!q) return true;
  return sinTildes(`${g.nombre} ${g.lugar_alias ?? ''} ${g.lugar ?? ''}`).includes(q);
}
