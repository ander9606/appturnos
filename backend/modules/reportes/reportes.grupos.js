'use strict';

/**
 * Reporte por grupo (evento, obra…): une lo que pasó en los turnos del rango (asistencia y costo) con la cobertura
 * de sus plazas. Función pura: recibe las filas de dos consultas y no toca la base.
 *
 * `costo` es lo mismo que cuenta el resumen de Turnos (pago_total de los completados, con bono), así que la suma de
 * los grupos más `sin_grupo` es el costo de turnos del período. `pct` es la parte de ese total que se llevó cada grupo.
 */

const redondear = (n) => Math.round(n * 100) / 100;
const num = (v) => Number(v) || 0;

/**
 * @param {Array} filasAsistencia  por grupo_id (null = turnos sin grupo): convocados, completados, no_presentados, costo
 * @param {Array} filasCobertura   por grupo_id (solo con grupo): turnos, plazas, cubiertas
 */
function armarReporteGrupos(filasAsistencia, filasCobertura) {
  const porId = new Map();
  const grupo = (id, nombre, estado) => {
    if (!porId.has(id)) {
      porId.set(id, {
        grupo_id: id, nombre, estado, turnos: 0, convocados: 0, completados: 0, no_presentados: 0,
        costo: 0, plazas: 0, cubiertas: 0,
      });
    }
    return porId.get(id);
  };

  let sinGrupo = { completados: 0, costo: 0 };
  for (const f of filasAsistencia) {
    if (f.grupo_id == null) {
      sinGrupo = { completados: num(f.completados), costo: redondear(num(f.costo)) };
      continue;
    }
    Object.assign(grupo(f.grupo_id, f.nombre, f.estado), {
      convocados: num(f.convocados), completados: num(f.completados),
      no_presentados: num(f.no_presentados), costo: redondear(num(f.costo)),
    });
  }
  // Un grupo con turnos abiertos y aún sin nadie asignado también aparece (costo 0).
  for (const f of filasCobertura) {
    Object.assign(grupo(f.grupo_id, f.nombre, f.estado), {
      turnos: num(f.turnos), plazas: num(f.plazas), cubiertas: num(f.cubiertas),
    });
  }

  const grupos = [...porId.values()];
  const totalGrupos = grupos.reduce((s, g) => s + g.costo, 0);
  const costoTotal = redondear(totalGrupos + sinGrupo.costo);
  for (const g of grupos) g.pct = costoTotal > 0 ? redondear((g.costo / costoTotal) * 100) : null;
  grupos.sort((a, b) => b.costo - a.costo || a.nombre.localeCompare(b.nombre, 'es'));

  return { costo_total: costoTotal, sin_grupo: sinGrupo, grupos };
}

module.exports = { armarReporteGrupos };
