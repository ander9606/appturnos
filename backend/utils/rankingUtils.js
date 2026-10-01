'use strict';

const { pool } = require('../config/database');

/**
 * Minutos de retraso en visibilidad de ofertas según ranking.
 * Un ranking más alto → el trabajador ve las ofertas antes que otros.
 */
function delayPorRanking(ranking) {
  if (ranking == null) return 15;   // nuevo sin historial
  const r = Number(ranking);
  if (r >= 4.5) return 0;           // elite   — ve las ofertas de inmediato
  if (r >= 3.5) return 15;          // alto    — 15 min de retraso
  if (r >= 2.5) return 30;          // medio   — 30 min de retraso
  return 60;                        // bajo/crítico — 60 min de retraso
}

/**
 * Mismos tiers que delayPorRanking() pero como fragmento SQL — para queries
 * que filtran por ranking directo en la base (listarMultiEmpresa,
 * notificarPoolPorPuestos) en vez de traer filas y filtrar en JS. Fuente
 * única: si cambian los tiers, solo hay que tocar un lugar en vez de que las
 * dos implementaciones (JS y SQL) se desincronicen en silencio. Asume que la
 * tabla trabajadores está aliaseada como `t` en el query que lo use.
 */
const DELAY_RANKING_SQL_CASE = `CASE
             WHEN t.ranking IS NULL THEN 15
             WHEN t.ranking >= 4.5  THEN 0
             WHEN t.ranking >= 3.5  THEN 15
             WHEN t.ranking >= 2.5  THEN 30
             ELSE                        60
           END`;

/**
 * Nivel cualitativo del ranking para mostrar al trabajador.
 * @returns {'nuevo'|'critico'|'bajo'|'medio'|'alto'|'elite'}
 */
function nivelRanking(ranking, totalCalificaciones = 0) {
  if (ranking == null || totalCalificaciones === 0) return 'nuevo';
  const r = Number(ranking);
  if (r >= 4.5) return 'elite';
  if (r >= 3.5) return 'alto';
  if (r >= 2.5) return 'medio';
  if (r >= 1.0) return 'bajo';
  return 'critico';
}

/**
 * Recalcula y persiste el ranking de un trabajador en una empresa concreta.
 * Debe llamarse dentro de una transacción activa (conn).
 * El AVG incluye las calificaciones 0-estrella (no_presentado).
 */
async function recalcularRanking(conn, empresaId, trabajadorId) {
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
}

/**
 * Versión standalone (abre su propia conexión) para uso fuera de transacciones.
 */
async function recalcularRankingStandalone(empresaId, trabajadorId) {
  const conn = await pool.getConnection();
  try {
    return await recalcularRanking(conn, empresaId, trabajadorId);
  } finally {
    conn.release();
  }
}

module.exports = { delayPorRanking, DELAY_RANKING_SQL_CASE, nivelRanking, recalcularRanking, recalcularRankingStandalone };
