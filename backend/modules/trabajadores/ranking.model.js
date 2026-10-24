'use strict';

const { pool } = require('../../config/database');

/**
 * SQL del ranking de un trabajador. Las funciones puras de los tiers (delayPorRanking,
 * nivelRanking, DELAY_RANKING_SQL_CASE) están en utils/rankingUtils.js.
 */
const RankingModel = {
  /**
   * Recalcula y persiste el ranking de un trabajador en una empresa concreta.
   * Debe llamarse dentro de una transacción activa (conn).
   * El AVG incluye las calificaciones 0-estrella (no_presentado).
   */
  async recalcular(conn, empresaId, trabajadorId) {
    const [[stats]] = await conn.query(
      `SELECT ROUND(AVG(calificacion), 2) AS promedio, COUNT(*) AS total
       FROM calificaciones_turno
       WHERE empresa_id = ? AND trabajador_id = ?`,
      [empresaId, trabajadorId]
    );
    const promedio = stats.promedio != null ? Number(stats.promedio) : null;
    await conn.query(
      `UPDATE trabajadores SET ranking = ?, total_calificaciones = ?
       WHERE id = ? AND empresa_id = ?`,
      [promedio, stats.total, trabajadorId, empresaId]
    );
    return { ranking: promedio, total: stats.total };
  },

  /** Versión standalone (abre su propia conexión, sin transacción) para uso fuera de ellas. */
  async recalcularStandalone(empresaId, trabajadorId) {
    const conn = await pool.getConnection();
    try {
      return await RankingModel.recalcular(conn, empresaId, trabajadorId);
    } finally {
      conn.release();
    }
  },
};

module.exports = RankingModel;
