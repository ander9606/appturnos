import type { ActualizarGrupoPayload, FaseGrupo, GrupoTurno, TurnoDeGrupo } from '@api-client';
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

export interface FormularioGrupo {
  nombre: string;
  descripcion: string;
  lugar: string;
  lugarAlias: string;
  latitud: number | null;
  longitud: number | null;
}

/**
 * Lo que se envía al guardar los cambios de un grupo, o el campo que falla y por qué. El servidor pide el nombre, y el
 * lugar con dirección y coordenadas juntas: escribir la dirección a mano borra las coordenadas, así que hay que elegirla
 * de la lista. Vaciar un texto lo quita (null): sin lugar se mandan en null el lugar, el nombre corto y las coordenadas.
 * Cambiar el lugar del grupo no mueve los turnos que ya lo copiaron: es solo el valor por defecto de los nuevos.
 */
export function cambiosDeGrupo(f: FormularioGrupo):
  | { ok: true; payload: ActualizarGrupoPayload }
  | { ok: false; campo: 'nombre' | 'lugar'; mensaje: string } {
  const nombre = f.nombre.trim();
  if (!nombre) return { ok: false, campo: 'nombre', mensaje: 'Escribe un nombre.' };
  const descripcion = f.descripcion.trim() || null;
  const lugar = f.lugar.trim();
  if (!lugar) {
    return { ok: true, payload: { nombre, descripcion, lugar: null, lugar_alias: null, latitud: null, longitud: null } };
  }
  if (f.latitud == null || f.longitud == null) {
    return { ok: false, campo: 'lugar', mensaje: 'Elige una dirección de la lista, o deja el lugar vacío.' };
  }
  return {
    ok: true,
    payload: { nombre, descripcion, lugar, lugar_alias: f.lugarAlias.trim() || null, latitud: f.latitud, longitud: f.longitud },
  };
}

/** Datos de un grupo ya existente como formulario de edición (la latitud y la longitud pueden llegar como texto de MySQL). */
export function formularioDeGrupo(g: Pick<GrupoTurno, 'nombre' | 'descripcion' | 'lugar' | 'lugar_alias' | 'latitud' | 'longitud'>): FormularioGrupo {
  return {
    nombre: g.nombre,
    descripcion: g.descripcion ?? '',
    lugar: g.lugar ?? '',
    lugarAlias: g.lugar_alias ?? '',
    latitud: g.latitud == null ? null : Number(g.latitud),
    longitud: g.longitud == null ? null : Number(g.longitud),
  };
}

/**
 * Aproximación del período de facturación para una fecha (YYYY-MM-DD): quincena 1–15 o 16–fin de mes.
 * Solo se usa cuando el servidor no devuelve el período real (ver periodoQueContiene).
 */
export function periodoDeFecha(iso: string): { desde: string; hasta: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return d <= 15
    ? { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-15` }
    : { desde: `${y}-${mm}-16`, hasta: `${y}-${mm}-${ultimo}` };
}

/**
 * Período de facturación real de la empresa que contiene la fecha, entre los que devuelve el servidor; null si
 * ninguno la cubre (p. ej. un período futuro que aún no se creó) y entonces se usa la quincena como aproximación.
 */
export function periodoQueContiene(periodos: { fecha_inicio: string; fecha_fin: string }[] | undefined, iso: string): { desde: string; hasta: string } | null {
  for (const p of periodos ?? []) {
    const desde = p.fecha_inicio.slice(0, 10);
    const hasta = p.fecha_fin.slice(0, 10);
    if (desde <= iso && iso <= hasta) return { desde, hasta };
  }
  return null;
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

/** Cuántos turnos activos tiene el grupo y cuántas de sus plazas ya están cubiertas (los cancelados no cuentan). */
export function resumenPlazas(turnos: Pick<TurnoDeGrupo, 'estado' | 'plazas' | 'plazas_cubiertas'>[]): { turnos: number; plazas: number; cubiertas: number } {
  const vivos = turnos.filter((t) => t.estado !== 'cancelada');
  return {
    turnos: vivos.length,
    plazas: vivos.reduce((s, t) => s + (Number(t.plazas) || 0), 0),
    cubiertas: vivos.reduce((s, t) => s + (Number(t.plazas_cubiertas) || 0), 0),
  };
}
