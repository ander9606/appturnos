'use strict';

const { pool } = require('../../config/database');

/** Acceso a datos de cuentas de cobro (tabla cuentas_cobro). */
const CuentasCobroModel = {
  /**
   * Crea la cuenta de cobro de un (periodo, trabajador) si aún no existe.
   * Si ya existe y está firmada, no la toca — solo refresca datos (items,
   * totales) mientras siga sin firmar, para poder recalcular con
   * regenerar() sin arriesgar pisar una firma ya hecha.
   */
  async crear(empresaId, datos, ejecutor = pool) {
    const [res] = await ejecutor.query(
      `INSERT INTO cuentas_cobro
         (empresa_id, periodo_id, trabajador_id, numero_cuenta, fecha_inicio, fecha_fin,
          total_turnos, total_horas, valor_total, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         numero_cuenta = IF(firmado_trabajador = 0, VALUES(numero_cuenta), numero_cuenta),
         total_turnos  = IF(firmado_trabajador = 0, VALUES(total_turnos),  total_turnos),
         total_horas   = IF(firmado_trabajador = 0, VALUES(total_horas),   total_horas),
         valor_total   = IF(firmado_trabajador = 0, VALUES(valor_total),   valor_total),
         items         = IF(firmado_trabajador = 0, VALUES(items),        items)`,
      [
        empresaId,
        datos.periodoId,
        datos.trabajadorId,
        datos.numeroCuenta,
        datos.fechaInicio,
        datos.fechaFin,
        datos.totalTurnos,
        datos.totalHoras,
        datos.valorTotal,
        JSON.stringify(datos.items),
      ]
    );
    if (res.insertId === 0) {
      const [filas] = await ejecutor.query(
        `SELECT id FROM cuentas_cobro WHERE periodo_id = ? AND trabajador_id = ? LIMIT 1`,
        [datos.periodoId, datos.trabajadorId]
      );
      return filas[0]?.id;
    }
    return res.insertId;
  },

  /** empresaId null: TRABAJADOR_TURNOS multi-empresa — el id ya es único globalmente. */
  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.empresa_id, cc.periodo_id, cc.trabajador_id, cc.numero_cuenta,
              cc.fecha_inicio, cc.fecha_fin, cc.total_turnos, cc.total_horas, cc.valor_total,
              cc.items, cc.firmado_trabajador, cc.firmado_at, cc.firma_b64, cc.created_at,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cedula AS trabajador_cedula, t.usuario_id AS trabajador_usuario_id,
              t.firma_guardada AS trabajador_firma_guardada,
              e.nombre AS empresa_nombre, e.nit AS empresa_nit
       FROM cuentas_cobro cc
       JOIN trabajadores t ON t.id = cc.trabajador_id
       JOIN empresas e     ON e.id = cc.empresa_id
       WHERE cc.id = ?${empresaId != null ? ' AND cc.empresa_id = ?' : ''} LIMIT 1`,
      empresaId != null ? [id, empresaId] : [id]
    );
    const row = filas[0];
    if (row) row.items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    return row || null;
  },

  /** Todas las cuentas de cobro del usuario, a través de todas sus empresas activas. */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.numero_cuenta, cc.fecha_inicio, cc.fecha_fin,
              cc.total_turnos, cc.total_horas, cc.valor_total,
              cc.firmado_trabajador, cc.firmado_at
       FROM cuentas_cobro cc
       JOIN trabajador_empresa te ON te.trabajador_id = cc.trabajador_id
       WHERE te.usuario_id = ? AND te.estado = 'activo'
       ORDER BY cc.fecha_fin DESC`,
      [usuarioId]
    );
    return filas;
  },

  async listarSinFirmarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.numero_cuenta, cc.fecha_inicio, cc.fecha_fin,
              cc.total_turnos, cc.total_horas, cc.valor_total
       FROM cuentas_cobro cc
       JOIN trabajador_empresa te ON te.trabajador_id = cc.trabajador_id
       WHERE te.usuario_id = ? AND te.estado = 'activo' AND cc.firmado_trabajador = 0
       ORDER BY cc.fecha_fin DESC`,
      [usuarioId]
    );
    return filas;
  },

  async firmar(empresaId, id, firmaB64) {
    const [res] = await pool.query(
      `UPDATE cuentas_cobro
       SET firmado_trabajador = 1, firmado_at = NOW(), firma_b64 = ?
       WHERE id = ? AND empresa_id = ? AND firmado_trabajador = 0`,
      [firmaB64, id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = CuentasCobroModel;
