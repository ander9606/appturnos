'use strict';

const { pool } = require('../../../config/database');

/**
 * Avance de cada grupo respecto al rango liquidado: cuántos turnos tiene en total (sin los cancelados), cuántos caen
 * dentro del rango, cuántos quedan para después y la fecha del siguiente. Así la cuenta de cobro puede decir
 * «3 de 4 turnos» cuando un grupo se parte entre dos períodos. Sin rango cerrado no hay nada que comparar (null).
 */
async function progresoDeGrupos(empresaId, filas, fechaInicio, fechaFin) {
  const ids = [...new Set(filas.map((f) => f.grupo_id).filter(Boolean))];
  const mapa = new Map();
  if (!ids.length || !fechaInicio || !fechaFin) return mapa;
  const [res] = await pool.query(
    `SELECT grupo_id,
            COUNT(*) AS total,
            SUM(fecha BETWEEN ? AND ?) AS en_periodo,
            SUM(fecha > ?) AS despues,
            DATE_FORMAT(MIN(CASE WHEN fecha > ? THEN fecha END), '%Y-%m-%d') AS proxima
       FROM ofertas_turno
      WHERE empresa_id = ? AND grupo_id IN (?) AND estado <> 'cancelada'
      GROUP BY grupo_id`,
    [fechaInicio, fechaFin, fechaFin, fechaFin, empresaId, ids]
  );
  for (const r of res) {
    mapa.set(r.grupo_id, { total: Number(r.total), en_periodo: Number(r.en_periodo), despues: Number(r.despues), proxima: r.proxima ?? null });
  }
  return mapa;
}

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
    // 'fallido' entra aquí también — es la compensación por fuerza mayor
    // (ver OfertasService.marcarFallida), y debe pagarse igual que un turno
    // completado, no quedar invisible para el gestor que liquida.
    const where = ['a.empresa_id = ?', "a.estado IN ('completado', 'fallido')", "t.tipo != 'nomina'"];
    const params = [empresaId];

    if (fechaInicio) { where.push('o.fecha >= ?'); params.push(fechaInicio); }
    if (fechaFin)    { where.push('o.fecha <= ?'); params.push(fechaFin); }

    // La cuenta de cobro solo existe si fechaInicio/fechaFin coinciden exacto con un
    // ciclo ya generado (cuentas_cobro.fecha_inicio/fecha_fin) — un rango libre que el
    // gestor arme a mano no tiene cuenta y el subquery simplemente no encuentra nada.
    const cuentaCobroParams = [fechaInicio ?? null, fechaFin ?? null];

    const [filas] = await pool.query(
      `SELECT
         a.id          AS asignacion_id,
         a.estado,
         a.compensacion_motivo,
         a.compensacion_decision,
         a.horas_trabajadas,
         a.pago_total,
         COALESCE(a.pago_extra, 0)   AS pago_extra,
         COALESCE(a.bono_monto, 0)   AS bono_monto,
         a.bono_motivo,
         COALESCE((SELECT SUM(d.monto) FROM descuentos_turno d
                   WHERE d.asignacion_id = a.id AND d.estado = 'aceptado'), 0) AS descuento_monto,
         (SELECT GROUP_CONCAT(d.motivo SEPARATOR ' · ') FROM descuentos_turno d
          WHERE d.asignacion_id = a.id AND d.estado = 'aceptado') AS descuento_motivo,
         (SELECT cc.id FROM cuentas_cobro cc
          WHERE cc.empresa_id = a.empresa_id AND cc.trabajador_id = a.trabajador_id
            AND cc.fecha_inicio = ? AND cc.fecha_fin = ?
          ORDER BY cc.secuencia DESC LIMIT 1) AS cuenta_cobro_id,
         a.hora_ingreso_real,
         a.hora_egreso_real,
         o.id          AS oferta_id,
         o.titulo      AS oferta_titulo,
         o.descripcion AS oferta_descripcion,
         o.fecha       AS oferta_fecha,
         o.hora_inicio,
         o.hora_fin_estimada,
         o.fin_dia_siguiente,
         o.lugar,
         o.lugar_alias,
         o.grupo_id,
         (SELECT g.nombre FROM grupos_turno g WHERE g.id = o.grupo_id) AS grupo_nombre,
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
      [...cuentaCobroParams, ...params]
    );

    const progresoGrupos = await progresoDeGrupos(empresaId, filas, fechaInicio, fechaFin);

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
          // Igual para todas las filas de este trabajador (depende solo del rango pedido, no del turno).
          cuenta_cobro_id:    row.cuenta_cobro_id ?? null,
          total_turnos:       0,
          total_horas:        0,
          pago_base:          0,
          pago_extra:         0,
          bono_monto:         0,
          descuento_monto:    0,
          pago_total:         0,
          // Turnos completados cuyo contrato aún no firma el trabajador — su pago
          // no se suma a los totales de arriba hasta que exista la firma.
          turnos_pendientes_firma: 0,
          // Turnos completados con una propuesta de compensación que el trabajador aún no responde: quedan en
          // espera, no suman ni restan en los totales hasta que decida (autoriza → fallido con la compensación;
          // no autoriza → se paga según contrato y vuelve a contar).
          turnos_pendientes_autorizacion: 0,
          turnos:             [],
        });
      }
      const w = workers.get(row.trabajador_id);
      // 'fallido' nunca tiene contrato que firmar (es una compensación por
      // fuerza mayor, no un turno trabajado) — sin este OR, el COALESCE de
      // firmado_trabajador caía en 0 (sin fila en contratos_diarios) y la
      // compensación quedaba atascada para siempre en turnos_pendientes_firma,
      // sin sumarse nunca a lo que realmente hay que pagarle.
      const firmado = row.estado === 'fallido' || Boolean(row.firmado_trabajador);
      const extra  = Number(row.pago_extra ?? 0);
      const bono   = Number(row.bono_monto ?? 0);
      const total  = Number(row.pago_total ?? 0);
      // pago_total es bruto (tarifa + bono); lo que se paga descuenta los aceptados.
      const descuento = Number(row.descuento_monto ?? 0);
      const neto   = total - descuento;
      const horas  = Number(row.horas_trabajadas ?? 0);
      w.total_turnos++;
      const enEspera = row.estado === 'completado' && row.compensacion_decision === 'pendiente';
      if (enEspera) {
        w.turnos_pendientes_autorizacion++;
      } else if (firmado) {
        w.total_horas  = parseFloat((w.total_horas + horas).toFixed(4));
        w.pago_extra   += extra;
        w.bono_monto   += bono;
        w.descuento_monto += descuento;
        w.pago_base    += total - extra - bono;
        w.pago_total   += neto;
      } else {
        w.turnos_pendientes_firma++;
      }
      w.turnos.push({
        asignacion_id:   row.asignacion_id,
        estado:          row.estado,
        compensacion_motivo: row.estado === 'fallido' ? row.compensacion_motivo : null,
        oferta_id:       row.oferta_id,
        oferta_titulo:   row.oferta_titulo,
        oferta_descripcion: row.oferta_descripcion,
        oferta_fecha:    row.oferta_fecha,
        hora_inicio:     row.hora_inicio,
        hora_fin_estimada: row.hora_fin_estimada,
        fin_dia_siguiente: row.fin_dia_siguiente,
        lugar:           row.lugar,
        lugar_alias:     row.lugar_alias ?? null,
        grupo_id:        row.grupo_id ?? null,
        grupo_nombre:    row.grupo_nombre ?? null,
        grupo_progreso:  progresoGrupos.get(row.grupo_id) ?? null,
        hora_ingreso_real: row.hora_ingreso_real,
        hora_egreso_real:  row.hora_egreso_real,
        horas_trabajadas:  horas,
        tarifa_dia:      Number(row.tarifa_dia),
        cargo_nombre:    row.cargo_nombre,
        pago_extra:      extra,
        bono_monto:      bono,
        bono_motivo:     row.bono_motivo || null,
        descuento_monto: descuento,
        descuento_motivo: row.descuento_motivo || null,
        pago_total:      neto,
        calificacion:    row.calificacion,
        firmado_trabajador: firmado,
        // En espera de que el trabajador autorice una propuesta de compensación: no suma ni resta todavía.
        pendiente_autorizacion: enEspera,
      });
    }
    return Array.from(workers.values());
  },

  /**
   * Total a pagar del rango (suma de pago_total de liquidacion()), calculado en SQL.
   * Los tableros solo necesitan esta cifra; traer la liquidación completa para
   * sumarla en el cliente era lo que hacía lenta la pestaña Turnos.
   * Mismas reglas que liquidacion(): mismos filtros, solo cuenta turnos firmados
   * (o 'fallido'), excluye los en espera de autorización de compensación y
   * resta los descuentos aceptados. Si cambias una, cambia la otra.
   */
  async totalLiquidacion(empresaId, { fechaInicio, fechaFin }) {
    const where = ['a.empresa_id = ?', "a.estado IN ('completado', 'fallido')", "t.tipo != 'nomina'"];
    const params = [empresaId];
    if (fechaInicio) { where.push('o.fecha >= ?'); params.push(fechaInicio); }
    if (fechaFin)    { where.push('o.fecha <= ?'); params.push(fechaFin); }

    const [[fila]] = await pool.query(
      `SELECT COALESCE(SUM(
                COALESCE(a.pago_total, 0) - COALESCE(
                  (SELECT SUM(d.monto) FROM descuentos_turno d
                   WHERE d.asignacion_id = a.id AND d.estado = 'aceptado'), 0)
              ), 0) AS total
       FROM asignaciones_turno a
       JOIN trabajadores t   ON t.id = a.trabajador_id
       JOIN ofertas_turno o  ON o.id = a.oferta_id
       LEFT JOIN contratos_diarios cd ON cd.asignacion_id = a.id
       WHERE ${where.join(' AND ')}
         AND (a.estado = 'fallido' OR COALESCE(cd.firmado_trabajador, 0) = 1)
         AND NOT (a.estado = 'completado' AND a.compensacion_decision = 'pendiente')`,
      params
    );
    return Number(fila.total);
  },
};
