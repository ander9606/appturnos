'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos de trabajadores.
 * Todas las consultas se filtran por empresa_id (aislamiento multi-tenant).
 */

const COLUMNAS = `id, empresa_id, usuario_id, nombre, apellido, cedula,
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
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (tipo) {
      where.push('tipo = ?');
      params.push(tipo);
    }
    if (activo !== undefined) {
      where.push('activo = ?');
      params.push(activo ? 1 : 0);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE ${whereSql}
       ORDER BY apellido, nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trabajadores WHERE ${whereSql}`,
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
      `SELECT ${COLUMNAS} FROM trabajadores WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0];
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [id, empresaId]
    );
    return filas[0] || null;
  },

  async obtenerPorUsuarioId(empresaId, usuarioId) {
    const [filas] = empresaId != null
      ? await pool.query(
          `SELECT ${COLUMNAS} FROM trabajadores
           WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1`,
          [usuarioId, empresaId]
        )
      : await pool.query(
          `SELECT ${COLUMNAS} FROM trabajadores
           WHERE usuario_id = ? AND activo = 1 LIMIT 1`,
          [usuarioId]
        );
    return filas[0] || null;
  },

  async obtenerPorExternalRef(empresaId, externalRef) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM trabajadores
       WHERE external_ref = ? AND empresa_id = ? LIMIT 1`,
      [externalRef, empresaId]
    );
    return filas[0] || null;
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

      if (datos.cargo_ids?.length) {
        const vals = datos.cargo_ids.map((cid) => [trabajadorId, cid]);
        await conn.query(
          'INSERT IGNORE INTO trabajador_cargos (trabajador_id, cargo_id) VALUES ?',
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
      `SELECT tc.cargo_id AS id, c.nombre, c.codigo
       FROM trabajador_cargos tc
       JOIN cargos c ON c.id = tc.cargo_id
       WHERE tc.trabajador_id = ?
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
};

module.exports = TrabajadoresModel;
