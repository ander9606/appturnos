'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de trabajadores.
 * Todas las consultas se filtran por empresa_id (aislamiento multi-tenant).
 */

const COLUMNAS = `t.id, t.empresa_id, t.usuario_id, t.nombre, t.apellido, t.cedula,
  t.tipo_documento, t.fecha_nacimiento, t.sexo,
  t.contacto_emergencia_nombre, t.contacto_emergencia_tel,
  t.telefono, t.email, t.tipo, t.cargo, t.tarifa_hora, t.salario_base, t.acepta_extras,
  t.eps, t.afp, t.banco, t.tipo_cuenta, t.numero_cuenta,
  t.ant_judiciales_fecha, t.ant_disciplinarios_fecha,
  t.tipo_marcacion, t.punto_marcaje_id,
  t.activo, t.external_ref, t.ranking, t.total_calificaciones, t.created_at,
  u.foto_perfil`;

// Alias para queries sin JOIN (uso interno donde ya no hay alias)
const COLUMNAS_BARE = `id, empresa_id, usuario_id, nombre, apellido, cedula,
  tipo_documento, fecha_nacimiento, sexo,
  contacto_emergencia_nombre, contacto_emergencia_tel,
  telefono, email, tipo, cargo, tarifa_hora, salario_base, acepta_extras,
  eps, afp, banco, tipo_cuenta, numero_cuenta,
  ant_judiciales_fecha, ant_disciplinarios_fecha,
  tipo_marcacion, punto_marcaje_id,
  activo, external_ref, ranking, total_calificaciones, created_at`;

// Allowlist de columnas modificables vía PUT. Lista fija de código,
// nunca construida a partir de input del cliente.
const CAMPOS_EDITABLES = [
  'nombre', 'apellido', 'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo',
  'telefono', 'email', 'tipo', 'cargo', 'tarifa_hora', 'salario_base',
  'contacto_emergencia_nombre', 'contacto_emergencia_tel',
  'eps', 'afp', 'banco', 'tipo_cuenta', 'numero_cuenta',
  'ant_judiciales_fecha', 'ant_disciplinarios_fecha',
  'external_ref',
];

const TrabajadoresModel = {
  async listar(empresaId, { tipo, activo, limit, offset }) {
    const where = ['t.empresa_id = ?'];
    const params = [empresaId];
    if (tipo) { where.push('t.tipo = ?'); params.push(tipo); }
    if (activo !== undefined) { where.push('t.activo = ?'); params.push(activo ? 1 : 0); }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE ${whereSql}
       ORDER BY t.apellido, t.nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    // count uses bare table (no JOIN needed)
    const bareWhere = whereSql.replace(/t\./g, '');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trabajadores WHERE ${bareWhere}`,
      params
    );
    return { data: filas, total };
  },

  async buscarPorCedula(cedula) {
    const [filas] = await pool.query(
      `SELECT t.id, t.nombre, t.apellido, t.cedula, t.tipo_documento, t.cargo, t.ranking
       FROM trabajadores t
       INNER JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.cedula = ?
         AND u.rol = 'trabajador_turnos'
         AND u.activo = 1
         AND t.empresa_id IS NULL
       LIMIT 1`,
      [cedula]
    );
    return filas[0] || null;
  },

  async actualizarMarcacion(empresaId, id, { tipo_marcacion, punto_marcaje_id }) {
    const [result] = await pool.query(
      'UPDATE trabajadores SET tipo_marcacion = ?, punto_marcaje_id = ? WHERE id = ? AND empresa_id = ?',
      [tipo_marcacion, punto_marcaje_id ?? null, id, empresaId]
    );
    if (!result.affectedRows) throw new (require('../../utils/AppError'))('Trabajador no encontrado', 404);
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.id = ? AND t.empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0];
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.id = ? AND t.empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async obtenerPorUsuarioId(empresaId, usuarioId) {
    const [filas] = empresaId != null
      ? await pool.query(
          `SELECT ${COLUMNAS}
           FROM trabajadores t
           LEFT JOIN usuarios u ON u.id = t.usuario_id
           WHERE t.usuario_id = ? AND t.empresa_id = ? AND t.activo = 1 LIMIT 1`,
          [usuarioId, empresaId]
        )
      : await pool.query(
          `SELECT ${COLUMNAS}
           FROM trabajadores t
           LEFT JOIN usuarios u ON u.id = t.usuario_id
           WHERE t.usuario_id = ? AND t.activo = 1 LIMIT 1`,
          [usuarioId]
        );
    return filas[0] || null;
  },

  async obtenerPorExternalRef(empresaId, externalRef) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.external_ref = ? AND t.empresa_id = ? LIMIT 1`,
      [externalRef, empresaId]
    );
    return filas[0] || null;
  },

  /** Trabajadores activos aún no vinculados a un empleado de logiq360. */
  async listarSinVincularLogiq360(empresaId) {
    const [filas] = await pool.query(
      `SELECT id, nombre, apellido, cedula, external_ref
       FROM trabajadores
       WHERE empresa_id = ? AND activo = 1
         AND (external_ref IS NULL OR external_ref NOT LIKE 'logiq360:empleado:%')
       ORDER BY nombre, apellido`,
      [empresaId]
    );
    return filas;
  },

  /**
   * Trabajadores activos que hacen turnos, para que logiq360 los sincronice
   * a su tabla de empleados (pull). Incluye 'turnos' y 'ambos'.
   */
  async listarParaSyncLogiq360(empresaId) {
    const [filas] = await pool.query(
      `SELECT nombre, apellido, email, telefono, cedula, cargo, tipo, external_ref
       FROM trabajadores
       WHERE empresa_id = ? AND activo = 1 AND tipo IN ('turnos', 'ambos')
       ORDER BY nombre, apellido`,
      [empresaId]
    );
    return filas;
  },

  /** Fija el external_ref de un trabajador (vínculo de conciliación). */
  async vincularExternalRef(empresaId, trabajadorId, externalRef) {
    const [res] = await pool.query(
      `UPDATE trabajadores SET external_ref = ?
       WHERE id = ? AND empresa_id = ?`,
      [externalRef, trabajadorId, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Inserta un trabajador con todos sus datos de perfil en una transacción.
   * @returns {Promise<number>} id del nuevo trabajador.
   */
  async crear(empresaId, datos) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const [res] = await conn.query(
        `INSERT INTO trabajadores
           (empresa_id, nombre, apellido, cedula, tipo_documento, fecha_nacimiento, sexo,
            telefono, email, tipo, cargo, tarifa_hora, salario_base,
            contacto_emergencia_nombre, contacto_emergencia_tel,
            eps, afp, banco, tipo_cuenta, numero_cuenta,
            ant_judiciales_fecha, ant_disciplinarios_fecha,
            empresas_postulacion, external_ref)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          empresaId,
          datos.nombre,
          datos.apellido,
          datos.cedula ?? null,
          datos.tipo_documento ?? 'CC',
          datos.fecha_nacimiento ?? null,
          datos.sexo ?? null,
          datos.telefono ?? null,
          datos.email ?? null,
          datos.tipo || 'turnos',
          datos.cargo ?? null,
          datos.tarifa_hora ?? null,
          datos.salario_base ?? null,
          datos.contacto_emergencia_nombre ?? null,
          datos.contacto_emergencia_tel ?? null,
          datos.eps ?? null,
          datos.afp ?? null,
          datos.banco ?? null,
          datos.tipo_cuenta ?? null,
          datos.numero_cuenta ?? null,
          datos.ant_judiciales_fecha ?? null,
          datos.ant_disciplinarios_fecha ?? null,
          datos.empresa_ids?.length ? JSON.stringify(datos.empresa_ids) : null,
          datos.external_ref ?? null,
        ]
      );
      const trabajadorId = res.insertId;

      if (datos.experiencias?.length) {
        const vals = datos.experiencias.map((e) => [
          trabajadorId, e.empresa_nombre, e.cargo, e.fecha_inicio, e.fecha_fin ?? null,
        ]);
        await conn.query(
          'INSERT INTO trabajador_experiencias (trabajador_id, empresa_nombre, cargo, fecha_inicio, fecha_fin) VALUES ?',
          [vals]
        );
      }

      if (datos.diplomas?.length) {
        const vals = datos.diplomas.map((d) => [
          trabajadorId, d.titulo, d.institucion, d.anio ?? null,
        ]);
        await conn.query(
          'INSERT INTO trabajador_diplomas (trabajador_id, titulo, institucion, anio) VALUES ?',
          [vals]
        );
      }

      await conn.commit();
      return trabajadorId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async actualizar(empresaId, id, datos) {
    const sets = [];
    const params = [];
    for (const campo of CAMPOS_EDITABLES) {
      if (datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        params.push(datos[campo]);
      }
    }
    if (sets.length === 0) return 0;

    params.push(id, empresaId);
    const [res] = await pool.query(
      `UPDATE trabajadores SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );
    return res.affectedRows;
  },

  async desactivar(empresaId, id) {
    const [res] = await pool.query(
      'UPDATE trabajadores SET activo = 0 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },

  // ── Experiencias ──────────────────────────────────────────────────────────

  async listarExperiencias(trabajadorId) {
    const [filas] = await pool.query(
      'SELECT * FROM trabajador_experiencias WHERE trabajador_id = ? ORDER BY fecha_inicio DESC',
      [trabajadorId]
    );
    return filas;
  },

  async crearExperiencia(trabajadorId, { empresa_nombre, cargo, fecha_inicio, fecha_fin }) {
    const [res] = await pool.query(
      `INSERT INTO trabajador_experiencias (trabajador_id, empresa_nombre, cargo, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?)`,
      [trabajadorId, empresa_nombre, cargo, fecha_inicio, fecha_fin ?? null]
    );
    const [[fila]] = await pool.query(
      'SELECT * FROM trabajador_experiencias WHERE id = ?', [res.insertId]
    );
    return fila;
  },

  async eliminarExperiencia(trabajadorId, id) {
    const [res] = await pool.query(
      'DELETE FROM trabajador_experiencias WHERE id = ? AND trabajador_id = ?',
      [id, trabajadorId]
    );
    return res.affectedRows;
  },

  // ── Diplomas ──────────────────────────────────────────────────────────────

  async listarDiplomas(trabajadorId) {
    const [filas] = await pool.query(
      'SELECT * FROM trabajador_diplomas WHERE trabajador_id = ? ORDER BY anio DESC, id DESC',
      [trabajadorId]
    );
    return filas;
  },

  async crearDiploma(trabajadorId, { titulo, institucion, anio }) {
    const [res] = await pool.query(
      `INSERT INTO trabajador_diplomas (trabajador_id, titulo, institucion, anio) VALUES (?, ?, ?, ?)`,
      [trabajadorId, titulo, institucion, anio ?? null]
    );
    const [[fila]] = await pool.query(
      'SELECT * FROM trabajador_diplomas WHERE id = ?', [res.insertId]
    );
    return fila;
  },

  async eliminarDiploma(trabajadorId, id) {
    const [res] = await pool.query(
      'DELETE FROM trabajador_diplomas WHERE id = ? AND trabajador_id = ?',
      [id, trabajadorId]
    );
    return res.affectedRows;
  },

  // ── Cargos certificados ────────────────────────────────────────────────────

  async listarCargos(trabajadorId) {
    const [filas] = await pool.query(
      `SELECT DISTINCT tc.cargo_id AS id, c.nombre, c.codigo
       FROM trabajador_cargos tc
       JOIN cargos c ON c.id = tc.cargo_id
       JOIN trabajador_empresa te ON te.id = tc.trabajador_empresa_id
       WHERE te.trabajador_id = ?
       ORDER BY c.nombre`,
      [trabajadorId]
    );
    return filas;
  },

  // Campos que el propio trabajador puede editar sobre sí mismo.
  async actualizarPorUsuarioId(usuarioId, datos) {
    const CAMPOS_ME = [
      'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo', 'telefono',
      'contacto_emergencia_nombre', 'contacto_emergencia_tel',
      'eps', 'afp', 'banco', 'tipo_cuenta', 'numero_cuenta',
      'ant_judiciales_fecha', 'ant_disciplinarios_fecha', 'acepta_extras',
    ];
    const sets = [];
    const params = [];
    for (const campo of CAMPOS_ME) {
      if (datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        params.push(datos[campo] === '' ? null : datos[campo]);
      }
    }
    if (sets.length === 0) return 0;
    params.push(usuarioId);
    const [res] = await pool.query(
      `UPDATE trabajadores SET ${sets.join(', ')} WHERE usuario_id = ? AND activo = 1`,
      params
    );
    return res.affectedRows;
  },

  async actualizarExtras(usuarioId, acepta) {
    const [res] = await pool.query(
      'UPDATE trabajadores SET acepta_extras = ? WHERE usuario_id = ? AND activo = 1',
      [acepta ? 1 : 0, usuarioId]
    );
    return res.affectedRows;
  },

  // ── Disponibilidad ────────────────────────────────────────────────────────

  async obtenerDisponibilidad(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      'SELECT id, dia_semana, hora_inicio, hora_fin, activo FROM disponibilidad_trabajador WHERE empresa_id = ? AND trabajador_id = ? ORDER BY dia_semana',
      [empresaId, trabajadorId]
    );
    return filas;
  },

  /**
   * Upsert masivo: recibe array de { dia_semana, hora_inicio, hora_fin, activo }.
   * Reemplaza todos los slots del trabajador en la empresa de una sola vez.
   */
  async guardarDisponibilidad(empresaId, trabajadorId, slots) {
    if (!slots.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'DELETE FROM disponibilidad_trabajador WHERE empresa_id = ? AND trabajador_id = ?',
        [empresaId, trabajadorId]
      );
      for (const s of slots) {
        await conn.query(
          'INSERT INTO disponibilidad_trabajador (empresa_id, trabajador_id, dia_semana, hora_inicio, hora_fin, activo) VALUES (?, ?, ?, ?, ?, ?)',
          [empresaId, trabajadorId, s.dia_semana, s.hora_inicio, s.hora_fin, s.activo ? 1 : 0]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = TrabajadoresModel;
