'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de liquidación: agrega registros_diarios por trabajador. */
const LiquidacionModel = {
  /** @param {number} [trabajadorId] Si se pasa, filtra a un solo trabajador (vista propia). */
  async resumenPorPeriodo(empresaId, periodoId, trabajadorId) {
    const params = [empresaId, periodoId];
    let filtroTrabajador = '';
    if (trabajadorId != null) {
      filtroTrabajador = 'AND r.trabajador_id = ?';
      params.push(trabajadorId);
    }
    const [filas] = await pool.query(
      `SELECT r.trabajador_id,
              t.nombre, t.apellido, t.cedula,
              t.salario_base, t.tarifa_hora,
              t.banco, t.tipo_cuenta, t.numero_cuenta,
              -- Snapshot congelado al cerrar el período (NULL si sigue abierto).
              -- MAX() es seguro: todos los registros del mismo trabajador
              -- en el mismo período tienen el mismo snapshot.
              MAX(r.valor_hora_snapshot) AS valor_hora_snapshot,
              COUNT(*)                   AS dias_registrados,
              SUM(r.horas_ordinarias)      AS horas_ordinarias,
              SUM(r.horas_extra_diurnas)   AS horas_extra_diurnas,
              SUM(r.horas_extra_nocturnas) AS horas_extra_nocturnas,
              SUM(r.horas_nocturnas)       AS horas_nocturnas,
              SUM(r.horas_festivo)         AS horas_festivo
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE r.empresa_id = ? AND r.periodo_id = ? ${filtroTrabajador}
       GROUP BY r.trabajador_id, t.nombre, t.apellido, t.cedula,
                t.salario_base, t.tarifa_hora, t.banco, t.tipo_cuenta, t.numero_cuenta
       ORDER BY t.apellido, t.nombre`,
      params
    );
    return filas;
  },
};

module.exports = LiquidacionModel;
