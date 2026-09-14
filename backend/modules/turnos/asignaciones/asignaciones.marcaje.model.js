'use strict';

const { pool } = require('../../../config/database');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');

/**
 * Ingreso/egreso, geofence, marcaje sospechoso, cierre masivo de jornada y
 * ajustes de pago. Ver asignaciones.model.js para el resto de AsignacionesModel.
 */
module.exports = {
  /** Marca la llegada del trabajador con coordenadas GPS. */
  async registrarIngreso(empresaId, id, horaIngreso, latitud, longitud, deviceId) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET hora_ingreso_real = ?, latitud_ingreso = ?, longitud_ingreso = ?, device_ingreso = ?,
           estado = 'en_progreso'
       WHERE id = ? AND empresa_id = ? AND estado = 'confirmado'`,
      [horaIngreso, latitud, longitud, deviceId ?? null, id, empresaId]
    );
    // affectedRows = 0 means another concurrent request already marked ingreso
    if (res.affectedRows === 0) {
      const AppError = require('../../../utils/AppError');
      throw new AppError('El ingreso ya fue registrado o el turno no está confirmado', 409);
    }
    return res.affectedRows;
  },

  /**
   * Otros trabajadores de la empresa que marcaron ingreso cerca en el tiempo —
   * candidatos a comparar por device_id + proximidad GPS (marcaje sospechoso).
   */
  async listarIngresosCercanos(empresaId, trabajadorId, horaIngreso, ventanaSeg) {
    const [filas] = await pool.query(
      `SELECT id AS registro_id, trabajador_id,
              latitud_ingreso AS lat, longitud_ingreso AS lng, device_ingreso AS device
       FROM asignaciones_turno
       WHERE empresa_id = ? AND trabajador_id != ?
         AND latitud_ingreso IS NOT NULL AND device_ingreso IS NOT NULL
         AND ABS(TIMESTAMPDIFF(SECOND, hora_ingreso_real, ?)) <= ?`,
      [empresaId, trabajadorId, horaIngreso, ventanaSeg]
    );
    return filas;
  },

  /** Marca una o más asignaciones como sospechosas (no bloquea, solo audita). */
  async marcarSospechoso(empresaId, ids) {
    if (ids.length === 0) return;
    await pool.query(
      `UPDATE asignaciones_turno SET sospechoso = 1 WHERE empresa_id = ? AND id IN (?)`,
      [empresaId, ids]
    );
  },

  /** Descarta el flag de sospechoso tras revisión del gestor. */
  async descartarSospechoso(empresaId, id) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno SET sospechoso = 0 WHERE id = ? AND empresa_id = ?`,
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Marca la salida, guarda la firma y calcula horas y pago.
   * `pago_total` toma la tarifa del PUESTO al que postuló el trabajador
   * (no la oferta — desde la migración 013 la tarifa vive por puesto).
   */
  async registrarEgreso(empresaId, id, firmaB64) {
    const ahora = ahoraColombiaSQL();
    const [res] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN ofertas_turno o  ON o.id = a.oferta_id
       SET a.hora_egreso_real = ?,
           a.firma_digital = ?,
           a.estado = 'completado',
           a.horas_trabajadas = TIMESTAMPDIFF(MINUTE, a.hora_ingreso_real,
               LEAST(?, TIMESTAMP(o.fecha, COALESCE(o.hora_fin_estimada, '23:59:59')))
           ) / 60,
           a.pago_total = p.tarifa_dia + a.bono_monto
       WHERE a.id = ? AND a.empresa_id = ?
         AND a.estado = 'en_progreso'
         AND a.hora_ingreso_real IS NOT NULL`,
      [ahora, firmaB64, ahora, id, empresaId]
    );
    // affectedRows = 0 means concurrent egreso, missing ingreso, or invalid state
    if (res.affectedRows === 0) {
      const AppError = require('../../../utils/AppError');
      throw new AppError('El egreso ya fue registrado o el ingreso no está marcado', 409);
    }
    return res.affectedRows;
  },

  async actualizarPagoTotal(empresaId, id, pagoTotal) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno SET pago_total = ? WHERE id = ? AND empresa_id = ?`,
      [pagoTotal, id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Agrega o edita el bono manual (ej. propina) de un turno. El delta se
   * refleja de inmediato en `pago_total` (permanece NULL si el turno aún no
   * se completó — mismo criterio que registrarEgreso/cerrarMasivo, que ya
   * suman `bono_monto` al fijar `pago_total = tarifa_dia` al cerrar).
   */
  async asignarBono(empresaId, id, { monto, motivo, creadoPor }) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET pago_total      = pago_total - bono_monto + ?,
           bono_monto      = ?,
           bono_motivo     = ?,
           bono_creado_por = ?,
           bono_creado_at  = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [monto, monto, motivo, creadoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Cierre masivo de jornada para una oferta.
   * - en_progreso (sin excepción) → completado (horas capeadas por hora_fin_estimada)
   * - confirmado  (sin excepción) → no_presentado + devuelve plaza al puesto
   * - excepciones                 → intactos en cualquier estado
   * @returns {{ cerradas: number, noPresentados: number }}
   */
  async cerrarMasivo(empresaId, ofertaId, excepcionesIds = []) {
    const excClause = excepcionesIds.length
      ? `AND a.trabajador_id NOT IN (${excepcionesIds.map(() => '?').join(',')})`
      : '';

    // 1. en_progreso → completado
    const ahora = ahoraColombiaSQL();
    const [resComp] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       SET a.hora_egreso_real = ?,
           a.estado = 'completado',
           a.horas_trabajadas = TIMESTAMPDIFF(MINUTE, a.hora_ingreso_real,
               LEAST(?, TIMESTAMP(o.fecha, COALESCE(o.hora_fin_estimada, '23:59:59')))
           ) / 60,
           a.pago_total = p.tarifa_dia + a.bono_monto
       WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'en_progreso'
         AND a.hora_ingreso_real IS NOT NULL
         ${excClause}`,
      [ahora, ahora, ofertaId, empresaId, ...excepcionesIds]
    );

    // 2. confirmado → no_presentado (obtener IDs antes de mutar para devolver plazas)
    const [ausentes] = await pool.query(
      `SELECT a.id, a.puesto_id FROM asignaciones_turno a
       WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'confirmado'
         ${excClause}`,
      [ofertaId, empresaId, ...excepcionesIds]
    );

    let noPresentados = 0;
    if (ausentes.length > 0) {
      const ids = ausentes.map((r) => r.id);
      await pool.query(
        `UPDATE asignaciones_turno SET estado = 'no_presentado'
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );

      // Devolver plazas: decrementar por la cantidad de ausentes por puesto.
      const porPuesto = ausentes.reduce((acc, r) => {
        acc[r.puesto_id] = (acc[r.puesto_id] || 0) + 1;
        return acc;
      }, {});
      for (const [puestoId, cant] of Object.entries(porPuesto)) {
        await pool.query(
          'UPDATE oferta_puestos SET plazas_cubiertas = GREATEST(0, plazas_cubiertas - ?) WHERE id = ?',
          [cant, puestoId]
        );
      }

      noPresentados = ausentes.length;
    }

    return { cerradas: resComp.affectedRows, noPresentados };
  },

  /** Corrección manual de ingreso/egreso por un gestor (sin GPS ni firma). */
  async corregir(empresaId, id, { horaIngreso, horaEgreso, horasTrabajadas, estado }) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET hora_ingreso_real = ?, hora_egreso_real = ?,
           horas_trabajadas  = ?, estado = ?
       WHERE id = ? AND empresa_id = ?`,
      [horaIngreso ?? null, horaEgreso ?? null, horasTrabajadas ?? null, estado, id, empresaId]
    );
    return res.affectedRows;
  },
};
