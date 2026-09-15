'use strict';

const { pool } = require('../../../config/database');

/**
 * Liquidación de turnos: agrupa asignaciones completadas por trabajador.
 * Ver asignaciones.model.js para el resto de AsignacionesModel.
 */
module.exports = {
  /**
   * Liquidación de turnos: agrupa asignaciones completadas por trabajador.
   * Devuelve un array de trabajadores con sus turnos y totales a pagar.
   */
  async liquidacion(empresaId, { fechaInicio, fechaFin }) {
    // t.tipo != 'nomina': esta es la liquidación de personal de turnos (mensual/
    // quincenal/semanal) — un trabajador_nomina que toma un turno eventual se
    // paga en el segmento 'nomina' de turnos-eventual (trimestral, bono), no acá.
    const where = ['a.empresa_id = ?', "a.estado = 'completado'", "t.tipo != 'nomina'"];
    const params = [empresaId];

    if (fechaInicio) { where.push('o.fecha >= ?'); params.push(fechaInicio); }
    if (fechaFin)    { where.push('o.fecha <= ?'); params.push(fechaFin); }

    const [filas] = await pool.query(
      `SELECT
         a.id          AS asignacion_id,
         a.horas_trabajadas,
         a.pago_total,
         COALESCE(a.pago_extra, 0)   AS pago_extra,
         COALESCE(a.bono_monto, 0)   AS bono_monto,
         a.bono_motivo,
         a.hora_ingreso_real,
         a.hora_egreso_real,
         o.titulo      AS oferta_titulo,
         o.fecha       AS oferta_fecha,
         o.hora_inicio,
         o.hora_fin_estimada,
         o.lugar,
         p.tarifa_dia,
         carg.nombre   AS cargo_nombre,
         cal.calificacion,
         COALESCE(cd.firmado_trabajador, 0) AS firmado_trabajador,
         t.id          AS trabajador_id,
         t.nombre, t.apellido,
         t.cargo       AS cargo_descripcion,
         t.usuario_id, t.cedula,
         t.ranking,
         t.total_calificaciones
       FROM asignaciones_turno a
       JOIN trabajadores t    ON t.id   = a.trabajador_id
       JOIN ofertas_turno o   ON o.id   = a.oferta_id
       JOIN oferta_puestos p  ON p.id   = a.puesto_id
       JOIN cargos carg       ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       LEFT JOIN contratos_diarios cd     ON cd.asignacion_id = a.id
       WHERE ${where.join(' AND ')}
       ORDER BY t.apellido, t.nombre, o.fecha`,
      params
    );

    const workers = new Map();
    for (const row of filas) {
      if (!workers.has(row.trabajador_id)) {
        workers.set(row.trabajador_id, {
          trabajador_id:      row.trabajador_id,
          nombre:             row.nombre,
          apellido:           row.apellido,
          usuario_id:         row.usuario_id,
          cedula:             row.cedula,
          cargo:              row.cargo_descripcion,
          ranking:            row.ranking ? Number(row.ranking) : null,
          total_calificaciones: row.total_calificaciones,
          total_turnos:       0,
          total_horas:        0,
          pago_base:          0,
          pago_extra:         0,
          bono_monto:         0,
          pago_total:         0,
          // Turnos completados cuyo contrato aún no firma el trabajador — su pago
          // no se suma a los totales de arriba hasta que exista la firma.
          turnos_pendientes_firma: 0,
          turnos:             [],
        });
      }
      const w = workers.get(row.trabajador_id);
      const firmado = Boolean(row.firmado_trabajador);
      const extra  = Number(row.pago_extra ?? 0);
      const bono   = Number(row.bono_monto ?? 0);
      const total  = Number(row.pago_total ?? 0);
      const horas  = Number(row.horas_trabajadas ?? 0);
      w.total_turnos++;
      if (firmado) {
        w.total_horas  = parseFloat((w.total_horas + horas).toFixed(4));
        w.pago_extra   += extra;
        w.bono_monto   += bono;
        w.pago_base    += total - extra - bono;
        w.pago_total   += total;
      } else {
        w.turnos_pendientes_firma++;
      }
      w.turnos.push({
        asignacion_id:   row.asignacion_id,
        oferta_titulo:   row.oferta_titulo,
        oferta_fecha:    row.oferta_fecha,
        hora_inicio:     row.hora_inicio,
        hora_fin_estimada: row.hora_fin_estimada,
        lugar:           row.lugar,
        hora_ingreso_real: row.hora_ingreso_real,
        hora_egreso_real:  row.hora_egreso_real,
        horas_trabajadas:  horas,
        tarifa_dia:      Number(row.tarifa_dia),
        cargo_nombre:    row.cargo_nombre,
        pago_extra:      extra,
        bono_monto:      bono,
        bono_motivo:     row.bono_motivo || null,
        pago_total:      total,
        calificacion:    row.calificacion,
        firmado_trabajador: firmado,
      });
    }
    return Array.from(workers.values());
  },
};
