'use strict';

const { pool } = require('../../config/database');

/**
 * Acceso a datos del módulo de autenticación.
 * Toca las tablas: usuarios, refresh_tokens, intentos_login y trabajadores.
 */
const AuthModel = {
  // ─── Usuarios ───────────────────────────────────────────────

  /** Usuario por email, con password_hash (uso interno de login). */
  async buscarUsuarioPorEmail(email) {
    const [filas] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );
    return filas[0] || null;
  },

  /** Perfil público del usuario por id (sin password_hash). */
  async buscarUsuarioPorId(id) {
    const [filas] = await pool.query(
      `SELECT id, empresa_id, nombre, apellido, foto_perfil, email, rol, activo, created_at
       FROM usuarios WHERE id = ? LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  // ─── Refresh tokens ─────────────────────────────────────────

  async guardarRefreshToken({ usuario_id, token, expira_at }) {
    await pool.query(
      'INSERT INTO refresh_tokens (usuario_id, token, expira_at) VALUES (?, ?, ?)',
      [usuario_id, token, expira_at]
    );
  },

  /**
   * Busca un refresh token y trae datos del usuario asociado.
   * Devuelve flags `revocado` y `expirado` calculados en SQL para evitar
   * comparaciones de fecha en JS.
   */
  async buscarRefreshToken(token) {
    const [filas] = await pool.query(
      `SELECT rt.id, rt.usuario_id, rt.revocado,
              (rt.expira_at <= NOW()) AS expirado,
              u.empresa_id, u.rol, u.nombre, u.activo AS usuario_activo
       FROM refresh_tokens rt
       INNER JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token = ? LIMIT 1`,
      [token]
    );
    return filas[0] || null;
  },

  async revocarRefreshToken(token) {
    await pool.query(
      'UPDATE refresh_tokens SET revocado = 1 WHERE token = ?',
      [token]
    );
  },

  /** Revoca todos los refresh tokens vigentes de un usuario. */
  async revocarRefreshTokensDeUsuario(usuarioId) {
    await pool.query(
      'UPDATE refresh_tokens SET revocado = 1 WHERE usuario_id = ? AND revocado = 0',
      [usuarioId]
    );
  },

  // ─── Lockout (intentos_login) ───────────────────────────────

  async obtenerIntentos(usuarioId) {
    const [filas] = await pool.query(
      `SELECT usuario_id, intentos, bloqueado_hasta,
              (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
       FROM intentos_login WHERE usuario_id = ? LIMIT 1`,
      [usuarioId]
    );
    return filas[0] || null;
  },

  /** Suma un intento fallido (crea la fila si no existe). */
  async registrarIntentoFallido(usuarioId) {
    await pool.query(
      `INSERT INTO intentos_login (usuario_id, intentos, ultimo_intento)
       VALUES (?, 1, NOW())
       ON DUPLICATE KEY UPDATE intentos = intentos + 1, ultimo_intento = NOW()`,
      [usuarioId]
    );
  },

  /** Bloquea la cuenta durante `minutos` a partir de ahora. */
  async establecerBloqueo(usuarioId, minutos) {
    await pool.query(
      `UPDATE intentos_login
       SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE usuario_id = ?`,
      [minutos, usuarioId]
    );
  },

  /** Reinicia el contador de intentos y levanta cualquier bloqueo. */
  async limpiarIntentos(usuarioId) {
    await pool.query(
      'UPDATE intentos_login SET intentos = 0, bloqueado_hasta = NULL WHERE usuario_id = ?',
      [usuarioId]
    );
  },

  // ─── Actualización de perfil ────────────────────────────────

  async actualizarPerfil(id, { nombre, apellido, email }) {
    const updates = [];
    const params = [];
    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
    if (apellido !== undefined) { updates.push('apellido = ?'); params.push(apellido); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (updates.length === 0) return;
    params.push(id);
    await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);
  },

  async obtenerPasswordHash(id) {
    const [filas] = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1',
      [id]
    );
    return filas[0]?.password_hash || null;
  },

  async actualizarPassword(id, passwordHash) {
    await pool.query(
      'UPDATE usuarios SET password_hash = ? WHERE id = ?',
      [passwordHash, id]
    );
  },

  async actualizarFotoPerfil(id, fotoB64) {
    await pool.query('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [fotoB64, id]);
  },

  // ─── Activación de cuenta (trabajadores) ────────────────────

  /** Trabajadores activos con una cédula dada (puede haber más de uno). */
  async buscarTrabajadoresPorCedula(cedula) {
    const [filas] = await pool.query(
      'SELECT * FROM trabajadores WHERE cedula = ? AND activo = 1',
      [cedula]
    );
    return filas;
  },

  /**
   * Verifica si una cédula tiene invitación pendiente de empresa.
   * Retorna null si no existe trabajador, o un objeto con los datos relevantes.
   */
  async verificarCedula(cedula) {
    const [filas] = await pool.query(
      `SELECT t.id, t.tipo, t.usuario_id,
              u.rol       AS rol_usuario,
              te.estado   AS estado_vinculo,
              e.nombre    AS empresa_nombre
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN trabajador_empresa te
         ON te.trabajador_id = t.id
         AND te.estado = 'solicitado_por_empresa'
       LEFT JOIN empresas e ON e.id = te.empresa_id
       WHERE t.cedula = ? AND t.activo = 1
       ORDER BY te.id DESC
       LIMIT 1`,
      [cedula]
    );
    return filas[0] ?? null;
  },

  /**
   * Crea el usuario y lo vincula al trabajador en una sola transacción.
   * @returns {Promise<number>} id del usuario creado.
   */
  async activarCuentaTrabajador({
    trabajadorId,
    empresa_id,
    nombre,
    apellido,
    email,
    password_hash,
    rol,
  }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query(
        `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empresa_id, nombre, apellido, email, password_hash, rol]
      );
      await conn.query('UPDATE trabajadores SET usuario_id = ? WHERE id = ?', [
        res.insertId,
        trabajadorId,
      ]);
      await conn.commit();
      return res.insertId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // ─── Registro libre (trabajador_turnos marketplace) ──────────

  /**
   * Crea un usuario TRABAJADOR_TURNOS sin empresa_id (modelo marketplace).
   * Sin transacción: no hay tabla secundaria que actualizar.
   * @returns {Promise<number>} id del usuario creado.
   */
  async registrarTrabajadorLibre({ nombre, apellido, email, password_hash }) {
    const [res] = await pool.query(
      `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol)
       VALUES (NULL, ?, ?, ?, ?, 'trabajador_turnos')`,
      [nombre, apellido || null, email, password_hash]
    );
    return res.insertId;
  },

  /**
   * Crea una empresa nueva y su primer usuario admin_empresa en una transacción.
   * @returns {{ empresaId: number, usuarioId: number }}
   */
  async registrarEmpresa({ nombreEmpresa, slug, nit, descripcion, actividad, telefono, emailEmpresa, direccion, ciudad, nombre, apellido, email, passwordHash }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [empRes] = await conn.query(
        `INSERT INTO empresas (nombre, slug, nit, descripcion, actividad, telefono, email_empresa, direccion, ciudad, plan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'basico')`,
        [nombreEmpresa, slug, nit || null, descripcion || null, actividad || null, telefono || null, emailEmpresa || null, direccion || null, ciudad || null]
      );
      const empresaId = empRes.insertId;
      const [usrRes] = await conn.query(
        `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol)
         VALUES (?, ?, ?, ?, ?, 'admin_empresa')`,
        [empresaId, nombre, apellido || null, email, passwordHash]
      );
      await conn.commit();
      return { empresaId, usuarioId: usrRes.insertId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Crea un usuario gestor (jefe_turnos, jefe_nomina, nomina) para una empresa. */
  async crearGestor({ empresaId, nombre, apellido, email, passwordHash, rol }) {
    const [res] = await pool.query(
      `INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresaId, nombre, apellido || null, email, passwordHash, rol]
    );
    return res.insertId;
  },

  /** Lista todos los gestores (jefe_turnos, jefe_nomina, nomina) de la empresa. */
  async listarGestores(empresaId) {
    const [filas] = await pool.query(
      `SELECT id, nombre, apellido, email, rol, activo, created_at
       FROM usuarios
       WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'jefe_nomina', 'nomina')
       ORDER BY nombre`,
      [empresaId]
    );
    return filas;
  },

  /** Activa o desactiva un gestor. Retorna true si se actualizó. */
  async setActivoGestor(empresaId, gestorId, activo) {
    const [res] = await pool.query(
      `UPDATE usuarios SET activo = ?
       WHERE id = ? AND empresa_id = ? AND rol IN ('jefe_turnos', 'jefe_nomina', 'nomina')`,
      [activo ? 1 : 0, gestorId, empresaId]
    );
    return res.affectedRows > 0;
  },
};

module.exports = AuthModel;
