import type { Asignacion, FaseGrupo } from '@api-client';

/** Los turnos de un trabajador que pertenecen a un mismo grupo (o los que no tienen grupo). Solo cuenta lo suyo. */
export interface GrupoDeMisTurnos {
  /** Empresa + grupo: un trabajador en dos empresas puede tener grupos con el mismo id o nombre. */
  clave: string;
  grupoId: number | null;
  nombre: string | null;
  empresaNombre: string | null;
  fechaInicio: string;
  fechaFin: string;
  /** Turnos suyos en el grupo, sin los cancelados ni los que no se presentó. */
  total: number;
  /** Ya trabajados (completado, o fallido por fuerza mayor: también se paga). */
  terminados: number;
  /** Los que todavía no se hacen: confirmados, en curso, por reconfirmar o en espera. */
  porHacer: number;
  /** Terminados cuyo contrato diario aún no firma: no entran en su cuenta de cobro hasta que lo firme. */
  sinFirmar: number;
  /** Primera fecha de lo que le falta por hacer; null si ya no le queda nada. */
  proximo: string | null;
  turnos: Asignacion[];
}

const NO_CUENTAN = new Set(['cancelado', 'no_presentado']);
const TERMINADOS = new Set(['completado', 'fallido']);

/**
 * Agrupa los turnos del trabajador por grupo. Primero los grupos donde aún le falta algo (el más próximo arriba),
 * luego los ya terminados (el más reciente arriba) y al final los turnos sin grupo. Dentro de cada uno, por fecha.
 */
export function agruparMisTurnos(asignaciones: Asignacion[]): GrupoDeMisTurnos[] {
  const mapa = new Map<string, GrupoDeMisTurnos>();
  const orden = [...asignaciones]
    .filter((a) => !NO_CUENTAN.has(a.estado))
    .sort((a, b) => a.oferta_fecha.localeCompare(b.oferta_fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''));
  for (const a of orden) {
    const grupoId = a.grupo_id ?? null;
    const clave = `${a.empresa_id}:${grupoId ?? 'sin'}`;
    let g = mapa.get(clave);
    if (!g) {
      g = {
        clave, grupoId, nombre: grupoId === null ? null : (a.grupo_nombre ?? 'Grupo'), empresaNombre: a.empresa_nombre ?? null,
        fechaInicio: a.oferta_fecha, fechaFin: a.oferta_fecha, total: 0, terminados: 0, porHacer: 0, sinFirmar: 0, proximo: null, turnos: [],
      };
      mapa.set(clave, g);
    }
    g.turnos.push(a);
    g.total++;
    g.fechaFin = a.oferta_fecha;
    if (TERMINADOS.has(a.estado)) {
      g.terminados++;
      if (a.estado === 'completado' && a.contrato_firmado === 0) g.sinFirmar++;
    } else {
      g.porHacer++;
      g.proximo ??= a.oferta_fecha;
    }
  }
  const lista = [...mapa.values()];
  const rango = (g: GrupoDeMisTurnos) => (g.proximo ? 0 : 1);
  return [
    ...lista.filter((g) => g.grupoId !== null).sort((a, b) =>
      rango(a) - rango(b) || (a.proximo ? a.proximo.localeCompare(b.proximo ?? '') : b.fechaFin.localeCompare(a.fechaFin))),
    ...lista.filter((g) => g.grupoId === null),
  ];
}

/** ¿Alguno de sus turnos tiene grupo? Si no, la vista por grupo no tiene nada que mostrar y no se ofrece. */
export const tieneGrupos = (asignaciones: Asignacion[]): boolean => asignaciones.some((a) => a.grupo_id != null);

/** Aviso cuando hay turnos terminados con el contrato sin firmar; null si no hay ninguno. */
export function avisoSinFirmar(sinFirmar: number): string | null {
  if (sinFirmar <= 0) return null;
  return sinFirmar === 1
    ? 'Tienes 1 turno terminado sin firmar el contrato. No entra en tu cuenta de cobro hasta que lo firmes.'
    : `Tienes ${sinFirmar} turnos terminados sin firmar el contrato. No entran en tu cuenta de cobro hasta que los firmes.`;
}

/** «2 de 4 terminados · 2 por hacer». */
export function resumenAvance(g: Pick<GrupoDeMisTurnos, 'total' | 'terminados' | 'porHacer'>): string {
  const partes = [`${g.terminados} de ${g.total} terminado${g.terminados === 1 ? '' : 's'}`];
  if (g.porHacer > 0) partes.push(`${g.porHacer} por hacer`);
  return partes.join(' · ');
}

/** Solo los eventos (grupos): los turnos sueltos, sin grupo, se ven en la pestaña Turnos. */
export const soloConGrupo = (lista: GrupoDeMisTurnos[]): GrupoDeMisTurnos[] => lista.filter((g) => g.grupoId !== null);

/** Momento en que está el grupo para el trabajador: terminado si no le queda nada, en curso si ya empezó, o próximo. */
export function faseDeMiGrupo(g: Pick<GrupoDeMisTurnos, 'porHacer' | 'fechaInicio'>, hoy: string): Extract<FaseGrupo, 'proximo' | 'en_curso' | 'terminado'> {
  if (g.porHacer === 0) return 'terminado';
  return g.fechaInicio <= hoy ? 'en_curso' : 'proximo';
}

/** Porcentaje (0–100) de turnos ya terminados, para la barra de avance. */
export const porcentajeAvance = (g: Pick<GrupoDeMisTurnos, 'total' | 'terminados'>): number =>
  g.total > 0 ? Math.round((g.terminados / g.total) * 100) : 0;
