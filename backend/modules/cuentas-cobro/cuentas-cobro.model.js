'use strict';

const { pool } = require('../../config/database');

/** Acceso a datos de cuentas de cobro (tabla cuentas_cobro). */
const CuentasCobroModel = {
  /**
   * Crea la cuenta de cobro de un (periodo, trabajador, secuencia) si aún no existe.
   * Si ya existe y está firmada, no la toca — solo refresca datos (items,
   * totales) mientras siga sin firmar, para poder recalcular con
   * regenerar() sin arriesgar pisar una firma ya hecha. `secuencia` 1 es la
   * cuenta original; las complementarias (2+) las crea el servicio por diferencia.
   */
  async crear(empresaId, datos, ejecutor = pool) {
    const [res] = await ejecutor.query(
      `INSERT INTO cuentas_cobro
         (empresa_id, periodo_id, trabajador_id, secuencia, numero_cuenta, fecha_inicio, fecha_fin,
          total_turnos, total_horas, valor_total, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        datos.secuencia ?? 1,
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
        `SELECT id FROM cuentas_cobro WHERE periodo_id = ? AND trabajador_id = ? AND secuencia = ? LIMIT 1`,
        [datos.periodoId, datos.trabajadorId, datos.secuencia ?? 1]
      );
      return filas[0]?.id;
    }
    return res.insertId;
  },

  /** empresaId null: TRABAJADOR_TURNOS multi-empresa — el id ya es único globalmente. */
  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.empresa_id, cc.periodo_id, cc.trabajador_id, cc.secuencia, cc.numero_cuenta,
              cc.fecha_inicio, cc.fecha_fin, cc.total_turnos, cc.total_horas, cc.valor_total,
              cc.items, cc.firmado_trabajador, cc.firmado_at, cc.firma_b64, cc.created_at,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cedula AS trabajador_cedula, t.usuario_id AS trabajador_usuario_id,
              t.firma_guardada AS trabajador_firma_guardada,
              t.banco AS trabajador_banco, t.tipo_cuenta AS trabajador_tipo_cuenta,
              t.numero_cuenta AS trabajador_numero_cuenta,
              e.nombre AS empresa_nombre, e.nit AS empresa_nit, e.logo_url AS empresa_logo_url
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

  /** Cuentas (original + complementarias) de un trabajador en un período, en orden de secuencia. */
  async listarPorPeriodoYTrabajador(empresaId, periodoId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT id, secuencia, firmado_trabajador, items
       FROM cuentas_cobro
       WHERE empresa_id = ? AND periodo_id = ? AND trabajador_id = ?
       ORDER BY secuencia`,
      [empresaId, periodoId, trabajadorId]
    );
    return filas.map((f) => ({
      ...f,
      items: typeof f.items === 'string' ? JSON.parse(f.items) : f.items,
    }));
  },

  /** Borra una cuenta que ya no tiene nada que cobrar. Nunca toca una firmada. */
  async eliminarSinFirmar(empresaId, id) {
    const [res] = await pool.query(
      'DELETE FROM cuentas_cobro WHERE id = ? AND empresa_id = ? AND firmado_trabajador = 0',
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /** usuario_id de quienes administran cuentas de cobro (para avisarles de bloqueos al generarlas). */
  async listarGestoresUsuarioIds(empresaId) {
    const [filas] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND activo = 1 AND rol IN ('admin_empresa', 'jefe_nomina')`,
      [empresaId]
    );
    return filas.map((f) => f.id);
  },

  /** Período ya cerrado (o liquidado) que cubre la fecha del turno; null si sigue abierto o no existe. */
  async periodoCerradoDeAsignacion(empresaId, asignacionId) {
    const [filas] = await pool.query(
      `SELECT p.id
       FROM asignaciones_turno a
       JOIN ofertas_turno o   ON o.id = a.oferta_id
       JOIN periodos_nomina p ON p.empresa_id = a.empresa_id
                             AND o.fecha BETWEEN p.fecha_inicio AND p.fecha_fin
                             AND p.estado IN ('cerrado', 'liquidado')
       WHERE a.id = ? AND a.empresa_id = ?
       LIMIT 1`,
      [asignacionId, empresaId]
    );
    return filas[0]?.id ?? null;
  },

  /** Cuenta del trabajador cuyo período cubre la fecha de la oferta (si ya existe). */
  async obtenerPorOfertaYTrabajador(empresaId, ofertaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.periodo_id, cc.firmado_trabajador
       FROM cuentas_cobro cc
       JOIN ofertas_turno o ON o.id = ?
       WHERE cc.empresa_id = ? AND cc.trabajador_id = ?
         AND o.fecha BETWEEN cc.fecha_inicio AND cc.fecha_fin
       ORDER BY cc.secuencia DESC
       LIMIT 1`,
      [ofertaId, empresaId, trabajadorId]
    );
    return filas[0] || null;
  },

  /**
   * Todas las cuentas de cobro del usuario, de todas sus empresas — incluso las de una
   * empresa donde ya no está activo: es un documento de cobro histórico y debe poder
   * descargarse siempre (el acceso al detalle/PDF ya se valida por dueño, no por estado).
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT DISTINCT cc.id, cc.secuencia, cc.numero_cuenta, cc.fecha_inicio, cc.fecha_fin,
              cc.total_turnos, cc.total_horas, cc.valor_total,
              cc.firmado_trabajador, cc.firmado_at
       FROM cuentas_cobro cc
       JOIN trabajador_empresa te ON te.trabajador_id = cc.trabajador_id
       WHERE te.usuario_id = ?
       ORDER BY cc.fecha_fin DESC, cc.secuencia DESC`,
      [usuarioId]
    );
    return filas;
  },

  async listarSinFirmarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT cc.id, cc.secuencia, cc.numero_cuenta, cc.fecha_inicio, cc.fecha_fin,
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
