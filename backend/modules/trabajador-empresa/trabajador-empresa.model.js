'use strict';

const { pool } = require('../../config/database');
const { enTransaccion } = require('../../utils/enTransaccion');

/**
 * Acceso a datos de la relación trabajador ↔ empresa (tabla trabajador_empresa).
 * Implementa el doble opt-in: trabajador solicita → empresa aprueba,
 * o empresa invita → trabajador acepta.
 */

const COLUMNAS = `te.id, te.usuario_id, te.empresa_id, te.trabajador_id,
  te.estado, te.iniciado_por, te.tipo_ofrecido, te.activo_antes_de_oferta,
  te.cargos_interes,
  te.fecha_solicitud, te.fecha_resuelto, te.motivo_rechazo,
  e.nombre AS empresa_nombre, e.slug AS empresa_slug, e.logo_url AS empresa_logo,
  e.ciudad AS empresa_ciudad,
  e.telefono AS empresa_telefono, e.email_empresa AS empresa_email`;

const TrabajadorEmpresaModel = {
  /** Ids de las empresas ACTIVAS donde el usuario tiene una relación activa. */
  async empresaIdsActivas(usuarioId) {
    const [filas] = await pool.query(
      `SELECT te.empresa_id FROM trabajador_empresa te
       JOIN empresas e ON e.id = te.empresa_id AND e.activo = 1
       WHERE te.usuario_id = ? AND te.estado = 'activo'`,
      [usuarioId]
    );
    return filas.map((f) => f.empresa_id);
  },

  async obtenerPorId(id) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       WHERE te.id = ? LIMIT 1`,
      [id]
    );
    return filas[0] || null;
  },

  async obtenerPorUsuarioEmpresa(usuarioId, empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       WHERE te.usuario_id = ? AND te.empresa_id = ? LIMIT 1`,
      [usuarioId, empresaId]
    );
    return filas[0] || null;
  },

  async obtenerPorTrabajadorEmpresa(trabajadorId, empresaId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       WHERE te.trabajador_id = ? AND te.empresa_id = ? LIMIT 1`,
      [trabajadorId, empresaId]
    );
    return filas[0] || null;
  },

  /** Todas las relaciones de un trabajador (para "Mis empresas").
   *  Las activas incluyen ranking y total_calificaciones de esa empresa concreta.
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS},
              ROUND(AVG(ct.calificacion), 2) AS ranking,
              COUNT(ct.id)                   AS total_calificaciones
       FROM trabajador_empresa te
       INNER JOIN empresas e ON e.id = te.empresa_id
       LEFT JOIN calificaciones_turno ct
              ON ct.empresa_id    = te.empresa_id
             AND ct.trabajador_id = te.trabajador_id
       WHERE te.usuario_id = ?
       GROUP BY te.id
       ORDER BY te.fecha_solicitud DESC`,
      [usuarioId]
    );
    // ROUND(AVG(...)) es DECIMAL — mysql2 lo devuelve como string, el cliente espera number.
    return filas.map((f) => ({ ...f, ranking: f.ranking != null ? Number(f.ranking) : null }));
  },

  /** Solicitudes pendientes para una empresa (panel del jefe de turnos). */
  async listarPorEmpresa(empresaId, estado) {
    const params = [empresaId];
    let estadoSql = '';
    if (estado) {
      estadoSql = 'AND te.estado = ?';
      params.push(estado);
    } else {
      // Por defecto solo las pendientes (ambos sentidos).
      estadoSql = "AND te.estado IN ('solicitado_por_trabajador', 'solicitado_por_empresa')";
    }
    const [filas] = await pool.query(
      `SELECT te.id, te.usuario_id, te.empresa_id, te.trabajador_id,
              te.estado, te.iniciado_por, te.fecha_solicitud, te.cargos_interes,
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido,
              u.email AS usuario_email, u.telefono AS usuario_telefono,
              u.foto_perfil AS usuario_foto_perfil
       FROM trabajador_empresa te
       INNER JOIN usuarios u ON u.id = te.usuario_id
       WHERE te.empresa_id = ? ${estadoSql}
       ORDER BY te.fecha_solicitud DESC`,
      params
    );
    return filas;
  },

  /**
   * Empresas activas del trabajador con su ranking en cada una.
   * Usado para calcular el delay de visibilidad de ofertas por empresa.
   */
  async listarActivasConRanking(usuarioId) {
    const [filas] = await pool.query(
      `SELECT te.empresa_id, t.ranking, t.id AS trabajador_id
       FROM trabajador_empresa te
       LEFT JOIN trabajadores t ON t.id = te.trabajador_id AND t.activo = 1
       WHERE te.usuario_id = ? AND te.estado = 'activo'`,
      [usuarioId]
    );
    return filas;
  },

  /** Solo los IDs de empresas activas (para el filtro IN de ofertas). */
  async listarEmpresaIds(usuarioId) {
    const [filas] = await pool.query(
      `SELECT empresa_id FROM trabajador_empresa
       WHERE usuario_id = ? AND estado = 'activo'`,
      [usuarioId]
    );
    return filas.map((f) => f.empresa_id);
  },

  async crear({ usuarioId, empresaId, estado, iniciadoPor, tipoOfrecido = 'turnos', cargosInteres }) {
    const [res] = await pool.query(
      `INSERT INTO trabajador_empresa
         (usuario_id, empresa_id, estado, iniciado_por, tipo_ofrecido, cargos_interes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, empresaId, estado, iniciadoPor, tipoOfrecido, cargosInteres?.length ? JSON.stringify(cargosInteres) : null]
    );
    return res.insertId;
  },

  async cambiarEstado(id, estado, { motivo, trabajadorId, tipoOfrecido, fechaResuelto, activoAntesDeOferta, cargosInteres } = {}, conn = pool) {
    const sets = ['estado = ?'];
    const params = [estado];

    if (motivo !== undefined) {
      sets.push('motivo_rechazo = ?');
      params.push(motivo);
    }
    if (cargosInteres !== undefined) {
      sets.push('cargos_interes = ?');
      params.push(cargosInteres?.length ? JSON.stringify(cargosInteres) : null);
    }
    if (trabajadorId !== undefined) {
      sets.push('trabajador_id = ?');
      params.push(trabajadorId);
    }
    if (tipoOfrecido !== undefined) {
      sets.push('tipo_ofrecido = ?');
      params.push(tipoOfrecido);
    }
    if (activoAntesDeOferta !== undefined) {
      sets.push('activo_antes_de_oferta = ?');
      params.push(activoAntesDeOferta ? 1 : 0);
    }
    if (estado !== 'solicitado_por_trabajador' && estado !== 'solicitado_por_empresa') {
      sets.push('fecha_resuelto = ?');
      params.push(fechaResuelto ?? new Date());
    }

    params.push(id);
    const [res] = await conn.query(
      `UPDATE trabajador_empresa SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return res.affectedRows;
  },

  /**
   * Archiva las demás relaciones del usuario (activas, o solicitudes/invitaciones
   * pendientes) al convertirse a nómina — exclusiva a una sola empresa. Deja
   * intactas las ya cerradas (rechazado/archivado), no hay nada que tocar ahí.
   */
  async archivarOtrasRelacionesDeUsuario(usuarioId, exceptoId, conn = pool) {
    const [filas] = await conn.query(
      `SELECT id, empresa_id, trabajador_id FROM trabajador_empresa
       WHERE usuario_id = ? AND id != ?
         AND estado IN ('activo', 'solicitado_por_trabajador', 'solicitado_por_empresa')`,
      [usuarioId, exceptoId]
    );
    if (filas.length) {
      const ids = filas.map((f) => f.id);
      await conn.query(
        `UPDATE trabajador_empresa SET estado = 'archivado', fecha_resuelto = NOW()
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }
    return filas;
  },

  /**
   * El trabajador acepta una oferta de nómina. Los 4 cambios que sostienen la regla
   * "nómina es exclusiva de una empresa" van en UNA transacción: estado de la relación,
   * tipo de la ficha, rol de la cuenta y archivado de las demás relaciones. Si algo
   * falla no queda nada aplicado y el trabajador puede reintentar.
   * Devuelve las relaciones archivadas (el caller suspende sus fichas y notifica).
   */
  async aceptarConversionANomina({ relacionId, trabajadorId, usuarioId, empresaId, rolNomina }) {
    return enTransaccion(async (conn) => {
      await TrabajadorEmpresaModel.cambiarEstado(
        relacionId, 'activo', { trabajadorId, activoAntesDeOferta: false }, conn
      );
      await TrabajadorEmpresaModel.convertirANomina(trabajadorId, usuarioId, empresaId, rolNomina, conn);
      return TrabajadorEmpresaModel.archivarOtrasRelacionesDeUsuario(usuarioId, relacionId, conn);
    });
  },

  // ponytail: consultas sobre `usuarios`/`trabajadores` que solo usa este flujo de vinculación,
  // viven aquí en vez de abrir un modelo nuevo — upgrade path: moverlas a UsuariosModel/TrabajadoresModel.

  /** admin_empresa + jefe_turnos activos de la empresa — gestionan solicitudes de vinculación. */
  async idsGestores(empresaId) {
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios
     WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
      [empresaId]
    );
    return gestores.map((g) => g.id);
  },

  /** id de la ficha de trabajadores del usuario en la empresa, o null. */
  async idTrabajadorDeUsuario(usuarioId, empresaId) {
    const [filas] = await pool.query(
      'SELECT id FROM trabajadores WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
      [usuarioId, empresaId]
    );
    return filas.length ? filas[0].id : null;
  },

  /** Datos básicos y rol global del usuario (undefined si no existe). */
  async obtenerUsuario(usuarioId) {
    const [[u]] = await pool.query(
      'SELECT nombre, apellido, email, rol FROM usuarios WHERE id = ? LIMIT 1',
      [usuarioId]
    );
    return u;
  },

  /** Ficha con esa cédula en ESTA empresa (puede no tener cuenta aún). */
  async fichaPorCedula(cedula, empresaId) {
    const [[ficha]] = await pool.query(
      `SELECT t.id, t.usuario_id, t.empresa_id
       FROM trabajadores t
       WHERE t.cedula = ? AND t.empresa_id = ? LIMIT 1`,
      [cedula, empresaId]
    );
    return ficha;
  },

  /** Cualquier cuenta ya asociada a la cédula, sin importar empresa ni rol. */
  async cuentaPorCedula(cedula) {
    const [[cuenta]] = await pool.query(
      `SELECT u.id AS usuario_id, u.rol FROM usuarios u
       INNER JOIN trabajadores t ON t.usuario_id = u.id
       WHERE t.cedula = ? LIMIT 1`,
      [cedula]
    );
    return cuenta;
  },

  /** Deja la empresa anotada en la ficha para que activarCuenta la procese. */
  async agregarEmpresaInvitacion(trabajadorId, empresaId) {
    await pool.query(
      `UPDATE trabajadores
         SET empresas_invitacion = JSON_ARRAY_APPEND(COALESCE(empresas_invitacion, JSON_ARRAY()), '$', ?)
         WHERE id = ?`,
      [empresaId, trabajadorId]
    );
  },

  /** Asocia la ficha a su usuario (solo si aún no tenía uno). */
  async vincularUsuarioAFicha(trabajadorId, usuarioId) {
    await pool.query('UPDATE trabajadores SET usuario_id = ? WHERE id = ? AND usuario_id IS NULL', [usuarioId, trabajadorId]);
  },

  /** Fija el track de la ficha y cambia el rol global del usuario (nómina = exclusivo a una empresa). */
  async convertirANomina(trabajadorId, usuarioId, empresaId, rolNomina, conn = pool) {
    await conn.query('UPDATE trabajadores SET tipo = ? WHERE id = ?', ['nomina', trabajadorId]);
    await conn.query(
      'UPDATE usuarios SET rol = ?, empresa_id = ? WHERE id = ?',
      [rolNomina, empresaId, usuarioId]
    );
  },
};

module.exports = TrabajadorEmpresaModel;
