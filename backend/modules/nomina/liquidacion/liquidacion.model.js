'use strict';

const { pool } = require('../../../config/database');

/** Acceso a datos de liquidación: agrega registros_diarios por trabajador. */
const LiquidacionModel = {
  async resumenPorPeriodo(empresaId, periodoId) {
    const [filas] = await pool.query(
      `SELECT r.trabajador_id,
              t.nombre, t.apellido, t.cedula, t.salario_base, t.tarifa_hora,
              COUNT(*) AS dias_registrados,
              SUM(r.horas_ordinarias) AS horas_ordinarias,
              SUM(r.horas_extra_diurnas) AS horas_extra_diurnas,
              SUM(r.horas_extra_nocturnas) AS horas_extra_nocturnas,
              SUM(r.horas_nocturnas) AS horas_nocturnas,
              SUM(r.horas_festivo) AS horas_festivo
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE r.empresa_id = ? AND r.periodo_id = ?
       GROUP BY r.trabajador_id, t.nombre, t.apellido, t.cedula,
                t.salario_base, t.tarifa_hora
       ORDER BY t.apellido, t.nombre`,
      [empresaId, periodoId]
    );
    return filas;
  },
};

module.exports = LiquidacionModel;
