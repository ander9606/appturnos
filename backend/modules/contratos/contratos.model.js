'use strict';

const { pool } = require('../../config/database');

/** Acceso a datos de contratos diarios (tabla contratos_diarios). */
const ContratosModel = {
  /**
   * Crea el contrato diario de una asignación.
   * Acepta un `ejecutor` opcional (conexión de transacción) para poder
   * generarlo de forma atómica al confirmar la asignación.
   */
  async crear(empresaId, datos, ejecutor = pool) {
    const numeroContrato = `CT-${datos.anio}-${datos.asignacionId}`;
    const [res] = await ejecutor.query(
      `INSERT INTO contratos_diarios
         (empresa_id, asignacion_id, numero_contrato, fecha, descripcion_labor, valor_dia)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        datos.asignacionId,
        numeroContrato,
        datos.fecha,
        datos.descripcionLabor,
        datos.valorDia,
      ]
    );
    return res.insertId;
  },

  /** Contrato con datos de trabajador, oferta y empresa (para detalle y PDF). */
  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT c.id, c.empresa_id, c.asignacion_id, c.numero_contrato, c.fecha,
              c.descripcion_labor, c.valor_dia, c.firmado_trabajador, c.firmado_at,
              c.firma_b64, c.pdf_url, c.created_at,
              a.trabajador_id, a.estado AS asignacion_estado,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cedula AS trabajador_cedula, t.usuario_id AS trabajador_usuario_id,
              o.titulo AS oferta_titulo, o.hora_inicio, o.hora_fin_estimada, o.lugar,
              e.nombre AS empresa_nombre, e.nit AS empresa_nit
       FROM contratos_diarios c
       JOIN asignaciones_turno a ON a.id = c.asignacion_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN empresas e ON e.id = c.empresa_id
       WHERE c.id = ? AND c.empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async listarPorTrabajador(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT c.id, c.numero_contrato, c.fecha, c.valor_dia,
              c.firmado_trabajador, c.firmado_at,
              o.titulo AS oferta_titulo, o.hora_inicio, o.hora_fin_estimada
       FROM contratos_diarios c
       JOIN asignaciones_turno a ON a.id = c.asignacion_id
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE c.empresa_id = ? AND a.trabajador_id = ?
       ORDER BY c.fecha DESC`,
      [empresaId, trabajadorId]
    );
    return filas;
  },

  async obtenerPorAsignacion(empresaId, asignacionId) {
    const [filas] = await pool.query(
      `SELECT c.id, c.empresa_id, c.asignacion_id, c.numero_contrato, c.fecha,
              c.descripcion_labor, c.valor_dia, c.firmado_trabajador, c.firmado_at,
              c.firma_b64, c.pdf_url, c.created_at,
              a.trabajador_id, a.estado AS asignacion_estado,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cedula AS trabajador_cedula, t.usuario_id AS trabajador_usuario_id,
              o.titulo AS oferta_titulo, o.hora_inicio, o.hora_fin_estimada, o.lugar,
              e.nombre AS empresa_nombre, e.nit AS empresa_nit
       FROM contratos_diarios c
       JOIN asignaciones_turno a ON a.id = c.asignacion_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN empresas e ON e.id = c.empresa_id
       WHERE c.asignacion_id = ? AND c.empresa_id = ? LIMIT 1`,
      [asignacionId, empresaId]
    );
    return filas[0] || null;
  },

  async firmar(empresaId, id, firmaB64) {
    const [res] = await pool.query(
      `UPDATE contratos_diarios
       SET firmado_trabajador = 1, firmado_at = NOW(), firma_b64 = ?
       WHERE id = ? AND empresa_id = ?`,
      [firmaB64, id, empresaId]
    );
    return res.affectedRows;
  },
};

module.exports = ContratosModel;
