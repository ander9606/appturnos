'use strict';

const { pool } = require('../../../config/database');
const { esDiaFestivo } = require('../../../utils/laboralUtils');
const { COMPENSATORIO_PLAZO_DIAS } = require('../../../config/constants');

function sumarDiasISO(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const CompensatoriosModel = {
  /** Crea un descanso compensatorio pendiente. Ignora duplicados (misma empresa + registro). */
  async crear(empresaId, { trabajadorId, periodoId, origenFecha, origenRegistroId, clasificacion }) {
    const [res] = await pool.query(
      `INSERT IGNORE INTO descansos_compensatorios
         (empresa_id, trabajador_id, periodo_id, origen_fecha, origen_registro_id, clasificacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, trabajadorId, periodoId, origenFecha, origenRegistroId, clasificacion || 'habitual']
    );
    return res.insertId || null;
  },

  /** Lista compensatorios con datos del trabajador. Filtrable por trabajador y estado. */
  async listar(empresaId, { trabajadorId, estado } = {}) {
    const where = ['dc.empresa_id = ?'];
    const params = [empresaId];
    if (trabajadorId) { where.push('dc.trabajador_id = ?'); params.push(trabajadorId); }
    if (estado)       { where.push('dc.estado = ?');        params.push(estado); }

    const [filas] = await pool.query(
      `SELECT dc.*,
              t.nombre   AS trabajador_nombre,
              t.apellido AS trabajador_apellido
       FROM descansos_compensatorios dc
       JOIN trabajadores t ON t.id = dc.trabajador_id
       WHERE ${where.join(' AND ')}
       ORDER BY dc.origen_fecha DESC`,
      params
    );
    return filas;
  },

  /** true si el trabajador ya tiene un descanso asignado/tomado en esa fecha. */
  async existeFechaAsignada(empresaId, trabajadorId, fecha) {
    const [filas] = await pool.query(
      `SELECT 1 FROM descansos_compensatorios
       WHERE empresa_id = ? AND trabajador_id = ? AND fecha_asignada = ?
         AND estado IN ('asignado', 'tomado') LIMIT 1`,
      [empresaId, trabajadorId, fecha]
    );
    return filas.length > 0;
  },

  /**
   * Los COMPENSATORIO_PLAZO_DIAS días candidatos para asignar el descanso,
   * con su zona de color (verde = cercano al día trabajado, ámbar =
   * intermedio, rojo = cerca del límite legal) y si están libres (ni
   * domingo/festivo, ni ya ocupados por otro registro o compensatorio).
   */
  async rangoDisponible(empresaId, trabajadorId, origenFecha) {
    const fechaInicio = sumarDiasISO(origenFecha, 1);
    const fechaFin = sumarDiasISO(origenFecha, COMPENSATORIO_PLAZO_DIAS);

    const [[registros], [asignados]] = await Promise.all([
      pool.query(
        `SELECT fecha FROM registros_diarios
         WHERE empresa_id = ? AND trabajador_id = ? AND fecha BETWEEN ? AND ?`,
        [empresaId, trabajadorId, fechaInicio, fechaFin]
      ),
      pool.query(
        `SELECT fecha_asignada AS fecha FROM descansos_compensatorios
         WHERE empresa_id = ? AND trabajador_id = ? AND estado IN ('asignado', 'tomado')
           AND fecha_asignada BETWEEN ? AND ?`,
        [empresaId, trabajadorId, fechaInicio, fechaFin]
      ),
    ]);
    const ocupadas = new Set([...registros, ...asignados].map((r) => r.fecha));

    const dias = [];
    for (let i = 1; i <= COMPENSATORIO_PLAZO_DIAS; i++) {
      const fecha = sumarDiasISO(origenFecha, i);
      dias.push({
        fecha,
        disponible: !esDiaFestivo(fecha) && !ocupadas.has(fecha),
        zona: i <= 9 ? 'verde' : i <= 19 ? 'ambar' : 'rojo',
      });
    }
    return dias;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM descansos_compensatorios WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return filas[0] || null;
  },

  /** Asigna una fecha al descanso compensatorio. */
  async asignar(empresaId, id, { fechaAsignada, asignadoPor }) {
    const [res] = await pool.query(
      `UPDATE descansos_compensatorios
       SET estado = 'asignado', fecha_asignada = ?, asignado_por = ?, asignado_en = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`,
      [fechaAsignada, asignadoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  /** Cambia la fecha_asignada de un descanso ya asignado/tomado (reasignación). */
  async reasignar(empresaId, id, { fechaAsignada, asignadoPor }) {
    const [res] = await pool.query(
      `UPDATE descansos_compensatorios
       SET estado = 'tomado', fecha_asignada = ?, asignado_por = ?, asignado_en = NOW()
       WHERE id = ? AND empresa_id = ? AND estado IN ('asignado', 'tomado')`,
      [fechaAsignada, asignadoPor, id, empresaId]
    );
    return res.affectedRows;
  },

  /** Marca como tomado (cuando se registra ese día como compensatorio en registros_diarios). */
  async marcarTomado(empresaId, id) {
    await pool.query(
      `UPDATE descansos_compensatorios SET estado = 'tomado'
       WHERE id = ? AND empresa_id = ? AND estado = 'asignado'`,
      [id, empresaId]
    );
  },

  /**
   * Compensatorios cuya fecha_asignada es hoy y aún no se le avisó al
   * gestor. Cruza todas las empresas — lo usa compensatorios.worker.js.
   */
  async listarHoyPendientesNotificar(hoy) {
    const [filas] = await pool.query(
      `SELECT dc.id, dc.empresa_id, t.nombre, t.apellido
       FROM descansos_compensatorios dc
       JOIN trabajadores t ON t.id = dc.trabajador_id
       WHERE dc.fecha_asignada = ? AND dc.estado IN ('asignado', 'tomado')
         AND dc.notificado_gestor = 0`,
      [hoy]
    );
    return filas;
  },

  /** Marca un lote de compensatorios como ya notificados al gestor. */
  async marcarNotificadosGestor(ids) {
    if (ids.length === 0) return;
    await pool.query(
      `UPDATE descansos_compensatorios SET notificado_gestor = 1 WHERE id IN (?)`,
      [ids]
    );
  },
};

module.exports = CompensatoriosModel;
