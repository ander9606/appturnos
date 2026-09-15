'use strict';

const { pool } = require('../../../config/database');

/**
 * Construye geofence_info según tipo_geofence del cargo — misma regla para
 * cualquier fila que traiga las columnas de la selección de abajo (tipo_geofence,
 * punto_*, lugar/latitud/longitud de la oferta). Antes solo vivía inline en
 * obtenerConDetalles (vista gestor); listarPorTrabajador/listarPorUsuario (la
 * vista "mis-turnos" que usa el trabajador para marcar ingreso) nunca la
 * calculaban, así que el cliente creía que esos turnos no tenían geofence
 * — el fix de useGeofence.ts en el celular nunca corría, y el ingreso se
 * mandaba con lat/lng en 0,0.
 */
function construirGeofenceInfo(row) {
  const tipo = row.tipo_geofence ?? 'oferta';
  if (tipo === 'fijo' && row.punto_latitud != null) {
    return {
      tipo: 'fijo',
      nombre: row.punto_nombre,
      latitud: Number(row.punto_latitud),
      longitud: Number(row.punto_longitud),
      radio_metros: row.punto_radio ?? 100,
    };
  }
  if (tipo === 'libre') return { tipo: 'libre' };
  if (tipo === 'zonal') return { tipo: 'zonal' };
  return {
    tipo: 'oferta',
    nombre: row.lugar,
    latitud: row.latitud != null ? Number(row.latitud) : null,
    longitud: row.longitud != null ? Number(row.longitud) : null,
    radio_metros: 1000,
  };
}

const SELECT_GEOFENCE_COLS = `carg.tipo_geofence,
              pm.id   AS punto_id,      pm.nombre AS punto_nombre,
              pm.latitud AS punto_latitud, pm.longitud AS punto_longitud,
              pm.radio_metros AS punto_radio,`;
const JOIN_PUNTO_MARCAJE = 'LEFT JOIN puntos_marcaje pm ON pm.id = carg.punto_marcaje_id';

// Mismo patrón que geofence_info y trabajador_tipo: obtenerConDetalles (vista
// gestor) ya traía estos campos, listarPorTrabajador/listarPorUsuario ("mis-
// turnos") no — el trabajador nunca veía a quién llamar al llegar (encargado),
// la cadencia de pago de la empresa, ni las notas externas de la oferta,
// porque turno/[id].tsx los renderiza sin gate de rol (silencioso, sin crash).
const SELECT_DETALLE_OFERTA_COLS = `o.externo_notas AS oferta_externo_notas,
              o.encargado_nombre, o.encargado_telefono,`;

/**
 * Lecturas y listados de asignaciones (sin mutar estado ni pago).
 * Ver asignaciones.model.js para el resto de AsignacionesModel.
 */
module.exports = {
  // empresaId null: trabajador_turnos multi-empresa (JWT sin empresa_id fija) — mismo
  // patrón que obtenerConDetalles más abajo.
  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT * FROM asignaciones_turno WHERE id = ?${empresaId != null ? ' AND empresa_id = ?' : ''} LIMIT 1`,
      empresaId != null ? [id, empresaId] : [id]
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

  /** Asignaciones de una oferta, con nombre del trabajador y cargo del puesto (para el detalle). */
  async listarPorOferta(empresaId, ofertaId) {
    const [filas] = await pool.query(
      `SELECT a.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
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
              p.tarifa_dia, carg.codigo AS cargo_codigo,
              t.external_ref AS trabajador_external_ref,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.tipo AS trabajador_tipo
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
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

  /** Total de asignaciones (cualquier estado) de una oferta — usado para bloquear el borrado definitivo. */
  async contarPorOferta(empresaId, ofertaId) {
    const [[fila]] = await pool.query(
      'SELECT COUNT(*) AS total FROM asignaciones_turno WHERE empresa_id = ? AND oferta_id = ?',
      [empresaId, ofertaId]
    );
    return fila.total;
  },

  /** Listado para jefes/admin, con datos de oferta y trabajador. */
  async listar(empresaId, { fecha, ofertaId, trabajadorId, estado, sospechoso, limit, offset }) {
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
    if (estado) {
      where.push('a.estado = ?');
      params.push(estado);
    }
    if (sospechoso != null) {
      where.push('a.sospechoso = ?');
      params.push(sospechoso ? 1 : 0);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT a.*, o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
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

  /** Turnos y postulaciones de un trabajador (vista "mis-turnos"). Incluye calificación. */
  async listarPorTrabajador(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT a.id, a.empresa_id, a.oferta_id, a.puesto_id, a.trabajador_id, a.estado,
              a.horas_trabajadas, a.pago_total, a.pago_extra,
              a.bono_monto, a.bono_motivo,
              a.hora_ingreso_real, a.hora_egreso_real, a.firma_digital,
              a.latitud_ingreso, a.longitud_ingreso,
              a.device_ingreso, a.sospechoso, a.cancelado_por, a.cancelado_at,
              a.rechazado_por, a.rechazado_at,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              ${SELECT_DETALLE_OFERTA_COLS}
              emp.nombre AS empresa_nombre, emp.tipo_liquidacion AS empresa_tipo_liquidacion,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              t.tipo AS trabajador_tipo,
              ${SELECT_GEOFENCE_COLS}
              cal.calificacion, cal.comentario AS calificacion_comentario,
              COALESCE(cd.firmado_trabajador, 0) AS contrato_firmado
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN empresas emp ON emp.id = a.empresa_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       ${JOIN_PUNTO_MARCAJE}
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       LEFT JOIN contratos_diarios cd     ON cd.asignacion_id = a.id
       WHERE a.empresa_id = ? AND a.trabajador_id = ?
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [empresaId, trabajadorId]
    );
    return filas.map((row) => ({ ...row, geofence_info: construirGeofenceInfo(row) }));
  },

  /**
   * Mis-turnos para trabajador_turnos (empresa_id = null en JWT).
   * Localiza todos los trabajador_id del usuario vía trabajador_empresa
   * y devuelve sus asignaciones de todas las empresas vinculadas.
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT a.id, a.empresa_id, a.oferta_id, a.puesto_id, a.trabajador_id, a.estado,
              a.horas_trabajadas, a.pago_total, a.pago_extra,
              a.bono_monto, a.bono_motivo,
              a.hora_ingreso_real, a.hora_egreso_real, a.firma_digital,
              a.latitud_ingreso, a.longitud_ingreso,
              a.device_ingreso, a.sospechoso, a.cancelado_por, a.cancelado_at,
              a.rechazado_por, a.rechazado_at,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              ${SELECT_DETALLE_OFERTA_COLS}
              emp.nombre AS empresa_nombre, emp.tipo_liquidacion AS empresa_tipo_liquidacion,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              t.tipo AS trabajador_tipo,
              ${SELECT_GEOFENCE_COLS}
              cal.calificacion, cal.comentario AS calificacion_comentario,
              COALESCE(cd.firmado_trabajador, 0) AS contrato_firmado
       FROM asignaciones_turno a
       JOIN trabajador_empresa te ON te.trabajador_id = a.trabajador_id
       JOIN ofertas_turno o       ON o.id = a.oferta_id
       JOIN empresas emp          ON emp.id = a.empresa_id
       JOIN oferta_puestos p      ON p.id = a.puesto_id
       JOIN cargos carg           ON carg.id = p.cargo_id
       JOIN trabajadores t        ON t.id = a.trabajador_id
       ${JOIN_PUNTO_MARCAJE}
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       LEFT JOIN contratos_diarios cd     ON cd.asignacion_id = a.id
       WHERE te.usuario_id = ? AND te.estado = 'activo'
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [usuarioId]
    );
    return filas.map((row) => ({ ...row, geofence_info: construirGeofenceInfo(row) }));
  },

  /**
   * Asignación completa con datos de oferta, trabajador y calificación.
   * Usada por gestores al acceder al detalle de una asignación concreta.
   */
  async obtenerConDetalles(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.externo_notas AS oferta_externo_notas,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              o.encargado_nombre, o.encargado_telefono,
              o.external_ref AS oferta_external_ref,
              emp.nombre AS empresa_nombre, emp.tipo_liquidacion AS empresa_tipo_liquidacion,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              carg.tipo_geofence,
              pm.id   AS punto_id,      pm.nombre AS punto_nombre,
              pm.latitud AS punto_latitud, pm.longitud AS punto_longitud,
              pm.radio_metros AS punto_radio,
              t.id AS trabajador_id_entity, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cargo AS trabajador_cargo, t.external_ref AS trabajador_external_ref, t.usuario_id,
              t.tipo AS trabajador_tipo,
              cal.calificacion, cal.comentario AS calificacion_comentario,
              COALESCE(cd.firmado_trabajador, 0) AS contrato_firmado
       FROM asignaciones_turno a
       JOIN ofertas_turno o    ON o.id   = a.oferta_id
       JOIN empresas emp       ON emp.id = a.empresa_id
       JOIN oferta_puestos p   ON p.id   = a.puesto_id
       JOIN cargos carg        ON carg.id = p.cargo_id
       JOIN trabajadores t     ON t.id   = a.trabajador_id
       LEFT JOIN puntos_marcaje pm ON pm.id = carg.punto_marcaje_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       LEFT JOIN contratos_diarios cd     ON cd.asignacion_id = a.id
       WHERE a.id = ?${empresaId != null ? ' AND a.empresa_id = ?' : ''} LIMIT 1`,
      empresaId != null ? [id, empresaId] : [id]
    );
    const row = filas[0];
    if (!row) return null;

    row.geofence_info = construirGeofenceInfo(row);
    return row;
  },
};
