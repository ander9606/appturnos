'use strict';

const { pool } = require('../../../config/database');
const ContratosModel = require('../../contratos/contratos.model');

/**
 * Acceso a datos de asignaciones de turno (tabla asignaciones_turno).
 * `confirmar` abarca también ofertas_turno porque debe ajustar
 * plazas_cubiertas de forma atómica.
 */
const AsignacionesModel = {
  /** Crea una postulación en estado 'pendiente' apuntada a un puesto concreto. */
  async crear(empresaId, ofertaId, puestoId, trabajadorId) {
    const [res] = await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado)
       VALUES (?, ?, ?, ?, 'pendiente')`,
      [empresaId, ofertaId, puestoId, trabajadorId]
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

  /**
   * Una postulación es única por (puesto, trabajador): el trabajador puede
   * postularse a varios puestos distintos de la misma oferta.
   */
  async obtenerPorPuestoYTrabajador(puestoId, trabajadorId) {
    const [filas] = await pool.query(
      'SELECT * FROM asignaciones_turno WHERE puesto_id = ? AND trabajador_id = ? LIMIT 1',
      [puestoId, trabajadorId]
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
   * Confirma una asignación pendiente y suma una plaza cubierta al PUESTO
   * (no a la oferta — la oferta ya no lleva ese contador desde mig 013).
   * Todo en una transacción con bloqueo de fila.
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

      const [[puesto]] = await conn.query(
        'SELECT * FROM oferta_puestos WHERE id = ? FOR UPDATE',
        [asig.puesto_id]
      );
      if (!puesto) {
        await conn.rollback();
        return { ok: false, motivo: 'puesto' };
      }
      if (puesto.plazas_cubiertas >= puesto.plazas) {
        await conn.rollback();
        return { ok: false, motivo: 'lleno' };
      }

      await conn.query(
        "UPDATE asignaciones_turno SET estado = 'confirmado' WHERE id = ?",
        [id]
      );
      await conn.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id = ?',
        [asig.puesto_id]
      );

      // Contrato diario atómico al confirmar. Tarifa la fija el PUESTO.
      await ContratosModel.crear(
        empresaId,
        {
          asignacionId: id,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: puesto.tarifa_dia,
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
   * `pago_total` toma la tarifa del PUESTO al que postuló el trabajador
   * (no la oferta — desde la migración 013 la tarifa vive por puesto).
   */
  async registrarEgreso(empresaId, id, firmaB64) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN oferta_puestos p ON p.id = a.puesto_id
       SET a.hora_egreso_real = NOW(),
           a.firma_digital = ?,
           a.estado = 'completado',
           a.horas_trabajadas = TIMESTAMPDIFF(MINUTE, a.hora_ingreso_real, NOW()) / 60,
           a.pago_total = p.tarifa_dia
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

  /** Turnos y postulaciones de un trabajador (vista "mis-turnos"). Incluye calificación. */
  async listarPorTrabajador(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE a.empresa_id = ? AND a.trabajador_id = ?
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [empresaId, trabajadorId]
    );
    return filas;
  },

  /**
   * Mis-turnos para trabajador_turnos (empresa_id = null en JWT).
   * Localiza todos los trabajador_id del usuario vía trabajador_empresa
   * y devuelve sus asignaciones de todas las empresas vinculadas.
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              emp.nombre AS empresa_nombre,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN trabajador_empresa te ON te.trabajador_id = a.trabajador_id
       JOIN ofertas_turno o       ON o.id = a.oferta_id
       JOIN empresas emp          ON emp.id = a.empresa_id
       JOIN oferta_puestos p      ON p.id = a.puesto_id
       JOIN cargos carg           ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE te.usuario_id = ? AND te.estado = 'activo'
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [usuarioId]
    );
    return filas;
  },

  /**
   * Asignación completa con datos de oferta, trabajador y calificación.
   * Usada por gestores al acceder al detalle de una asignación concreta.
   */
  async obtenerConDetalles(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              carg.tipo_geofence,
              pm.id   AS punto_id,      pm.nombre AS punto_nombre,
              pm.latitud AS punto_latitud, pm.longitud AS punto_longitud,
              pm.radio_metros AS punto_radio,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cargo AS trabajador_cargo,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN ofertas_turno o    ON o.id   = a.oferta_id
       JOIN oferta_puestos p   ON p.id   = a.puesto_id
       JOIN cargos carg        ON carg.id = p.cargo_id
       JOIN trabajadores t     ON t.id   = a.trabajador_id
       LEFT JOIN puntos_marcaje pm ON pm.id = carg.punto_marcaje_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE a.id = ? AND a.empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    const row = filas[0];
    if (!row) return null;

    // Construye geofence_info según tipo_geofence del cargo
    const tipo = row.tipo_geofence ?? 'oferta';
    if (tipo === 'fijo' && row.punto_latitud != null) {
      row.geofence_info = {
        tipo: 'fijo',
        nombre: row.punto_nombre,
        latitud: Number(row.punto_latitud),
        longitud: Number(row.punto_longitud),
        radio_metros: row.punto_radio ?? 100,
      };
    } else if (tipo === 'libre') {
      row.geofence_info = { tipo: 'libre' };
    } else if (tipo === 'zonal') {
      row.geofence_info = { tipo: 'zonal' };
    } else {
      row.geofence_info = {
        tipo: 'oferta',
        nombre: row.lugar,
        latitud: row.latitud != null ? Number(row.latitud) : null,
        longitud: row.longitud != null ? Number(row.longitud) : null,
        radio_metros: 100,
      };
    }

    return row;
  },
};

module.exports = AsignacionesModel;
