'use strict';

const { pool } = require('../../../config/database');
const ContratosModel = require('../../contratos/contratos.model');

/**
 * Acceso a datos de asignaciones de turno (tabla asignaciones_turno).
 * `confirmar` abarca también ofertas_turno porque debe ajustar
 * plazas_cubiertas de forma atómica.
 */
const AsignacionesModel = {
  /** Crea una postulación en estado 'pendiente'. */
  async crear(empresaId, ofertaId, trabajadorId) {
    const [res] = await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, trabajador_id, estado)
       VALUES (?, ?, ?, 'pendiente')`,
      [empresaId, ofertaId, trabajadorId]
    );
    return res.insertId;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async obtenerPorOfertaYTrabajador(ofertaId, trabajadorId) {
    const [filas] = await pool.query(
      'SELECT * FROM asignaciones_turno WHERE oferta_id = ? AND trabajador_id = ? LIMIT 1',
      [ofertaId, trabajadorId]
    );
    return filas[0] || null;
  },

  /** Asignaciones de una oferta, con nombre del trabajador (para el detalle). */
  async listarPorOferta(empresaId, ofertaId) {
    const [filas] = await pool.query(
      `SELECT a.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.empresa_id = ? AND a.oferta_id = ?
       ORDER BY a.created_at`,
      [empresaId, ofertaId]
    );
    return filas;
  },

  /**
   * Asignaciones de una oferta con el external_ref del trabajador.
   * Usado por costo-labor.service para construir el payload del evento
   * `costo_labor.calculado` que se emite a logiq360.
   */
  async listarConTrabajadorRef(empresaId, ofertaId) {
    const [filas] = await pool.query(
      `SELECT a.id, a.estado, a.horas_trabajadas, a.pago_total,
              a.hora_ingreso_real, a.hora_egreso_real,
              t.external_ref AS trabajador_external_ref,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.empresa_id = ? AND a.oferta_id = ?
       ORDER BY a.created_at`,
      [empresaId, ofertaId]
    );
    return filas;
  },

  async eliminar(empresaId, id) {
    const [res] = await pool.query(
      'DELETE FROM asignaciones_turno WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * usuario_id de los trabajadores asignados a una oferta (no cancelados)
   * que tienen cuenta de usuario. Sirve para notificarlos.
   */
  async listarUsuariosAsignados(empresaId, ofertaId) {
    const [filas] = await pool.query(
      `SELECT DISTINCT t.usuario_id
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.empresa_id = ? AND a.oferta_id = ?
         AND a.estado <> 'cancelado' AND t.usuario_id IS NOT NULL`,
      [empresaId, ofertaId]
    );
    return filas.map((f) => f.usuario_id);
  },

  /**
   * Confirma una asignación pendiente y suma una plaza cubierta a la oferta,
   * todo dentro de una transacción con bloqueo de fila.
   * @returns {Promise<{ok:boolean, motivo?:string}>}
   */
  async confirmar(empresaId, id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[asig]] = await conn.query(
        'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [id, empresaId]
      );
      if (!asig) {
        await conn.rollback();
        return { ok: false, motivo: 'no_existe' };
      }
      if (asig.estado !== 'pendiente') {
        await conn.rollback();
        return { ok: false, motivo: 'estado' };
      }

      const [[oferta]] = await conn.query(
        'SELECT * FROM ofertas_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [asig.oferta_id, empresaId]
      );
      if (!oferta || oferta.estado !== 'abierta') {
        await conn.rollback();
        return { ok: false, motivo: 'oferta' };
      }
      if (oferta.plazas_cubiertas >= oferta.plazas_disponibles) {
        await conn.rollback();
        return { ok: false, motivo: 'lleno' };
      }

      await conn.query(
        "UPDATE asignaciones_turno SET estado = 'confirmado' WHERE id = ?",
        [id]
      );
      await conn.query(
        'UPDATE ofertas_turno SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id = ?',
        [asig.oferta_id]
      );

      // El contrato diario se genera de forma atómica al confirmar:
      // si falla, toda la confirmación se revierte.
      await ContratosModel.crear(
        empresaId,
        {
          asignacionId: id,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: oferta.tarifa_dia,
        },
        conn
      );

      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Marca la llegada del trabajador con coordenadas GPS. */
  async registrarIngreso(empresaId, id, latitud, longitud) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET hora_ingreso_real = NOW(), latitud_ingreso = ?, longitud_ingreso = ?,
           estado = 'en_progreso'
       WHERE id = ? AND empresa_id = ?`,
      [latitud, longitud, id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Marca la salida, guarda la firma y calcula horas y pago.
   * pago_total toma la tarifa diaria de la oferta vinculada.
   */
  async registrarEgreso(empresaId, id, firmaB64) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       SET a.hora_egreso_real = NOW(),
           a.firma_digital = ?,
           a.estado = 'completado',
           a.horas_trabajadas = TIMESTAMPDIFF(MINUTE, a.hora_ingreso_real, NOW()) / 60,
           a.pago_total = o.tarifa_dia
       WHERE a.id = ? AND a.empresa_id = ?`,
      [firmaB64, id, empresaId]
    );
    return res.affectedRows;
  },

  /** Listado para jefes/admin, con datos de oferta y trabajador. */
  async listar(empresaId, { fecha, ofertaId, trabajadorId, limit, offset }) {
    const where = ['a.empresa_id = ?'];
    const params = [empresaId];
    if (ofertaId) {
      where.push('a.oferta_id = ?');
      params.push(ofertaId);
    }
    if (trabajadorId) {
      where.push('a.trabajador_id = ?');
      params.push(trabajadorId);
    }
    if (fecha) {
      where.push('o.fecha = ?');
      params.push(fecha);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT a.*, o.titulo AS oferta_titulo, o.fecha AS oferta_fecha, o.hora_inicio,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE ${whereSql}
       ORDER BY o.fecha DESC, o.hora_inicio
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  /**
   * Registra una calificación de la asignación y recomputa el ranking del
   * trabajador (promedio + conteo), todo dentro de una transacción.
   * Lanza ER_DUP_ENTRY si la asignación ya tenía calificación.
   */
  async calificar(empresaId, asignacionId, { trabajadorId, calificacion, comentario, calificadoPor }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO calificaciones_turno
           (empresa_id, asignacion_id, trabajador_id, calificacion, comentario, calificado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, asignacionId, trabajadorId, calificacion, comentario, calificadoPor]
      );
      const [[stats]] = await conn.query(
        `SELECT AVG(calificacion) AS promedio, COUNT(*) AS total
         FROM calificaciones_turno
         WHERE empresa_id = ? AND trabajador_id = ?`,
        [empresaId, trabajadorId]
      );
      await conn.query(
        `UPDATE trabajadores SET ranking = ?, total_calificaciones = ?
         WHERE id = ? AND empresa_id = ?`,
        [Number(stats.promedio).toFixed(2), stats.total, trabajadorId, empresaId]
      );
      await conn.commit();
      return { ranking: Number(Number(stats.promedio).toFixed(2)), total: stats.total };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Turnos y postulaciones de un trabajador (vista "mis-turnos"). */
  async listarPorTrabajador(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT a.*, o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud, o.tarifa_dia
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE a.empresa_id = ? AND a.trabajador_id = ?
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [empresaId, trabajadorId]
    );
    return filas;
  },
};

module.exports = AsignacionesModel;
