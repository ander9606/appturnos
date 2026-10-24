'use strict';

const { pool } = require('../../config/database');
const { CAMPOS_PERSONALES_TRABAJADOR, ROLES } = require('../../config/constants');
const AppError = require('../../utils/AppError');
const { enTransaccion: transaccionPropia } = require('../../utils/enTransaccion');

// Fechas llegan como 'YYYY-MM-DD' (dateStrings) y '' equivale a NULL.
const norm = (v) => (v == null || v === '' ? null : String(v));

/** ¿El trabajador (usuario) tiene otra ficha activa, en otra empresa? */
async function tieneOtraFichaActiva(c, usuarioId, id) {
  const [otras] = await c.query(
    'SELECT 1 FROM trabajadores WHERE usuario_id = ? AND id != ? AND activo = 1 LIMIT 1',
    [usuarioId, id]
  );
  return otras.length > 0;
}

/**
 * Corre fn dentro de una transacción. Si viene una conexión (conn), la usa sin
 * commit: la transacción la abre y la cierra quien llamó. Si no, abre la suya.
 */
async function enTransaccion(conn, fn) {
  return conn ? fn(conn) : transaccionPropia(fn);
}

/**
 * Acceso a datos de trabajadores.
 * Todas las consultas se filtran por empresa_id (aislamiento multi-tenant).
 */

const COLUMNAS = `t.id, t.empresa_id, t.usuario_id, t.nombre, t.apellido, t.cedula,
  t.tipo_documento, t.fecha_nacimiento, t.sexo,
  t.contacto_emergencia_nombre, t.contacto_emergencia_tel,
  t.telefono, t.email, t.tipo, t.cargo, t.descripcion, t.tarifa_hora, t.salario_base, t.acepta_extras,
  t.eps, t.afp, t.banco, t.tipo_cuenta, t.numero_cuenta, t.direccion,
  t.ant_judiciales_fecha, t.ant_disciplinarios_fecha,
  t.tipo_marcacion, t.punto_marcaje_id, t.hora_entrada_esperada,
  t.activo, t.external_ref, t.ranking, t.total_calificaciones, t.created_at,
  u.foto_perfil`;

// Allowlist de columnas modificables vía PUT. Lista fija de código,
// nunca construida a partir de input del cliente.
const CAMPOS_EDITABLES = [
  'nombre', 'apellido', 'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo',
  'telefono', 'email', 'tipo', 'cargo', 'descripcion', 'tarifa_hora', 'salario_base',
  'contacto_emergencia_nombre', 'contacto_emergencia_tel',
  'eps', 'afp', 'banco', 'tipo_cuenta', 'numero_cuenta', 'direccion',
  'ant_judiciales_fecha', 'ant_disciplinarios_fecha',
  'external_ref', 'hora_entrada_esperada',
];

/** Agrupa filas con columna trabajador_id en un Map<trabajador_id, filas[]>. */
function agruparPorTrabajador(filas) {
  const porTrabajador = new Map();
  for (const fila of filas) {
    if (!porTrabajador.has(fila.trabajador_id)) porTrabajador.set(fila.trabajador_id, []);
    porTrabajador.get(fila.trabajador_id).push(fila);
  }
  return porTrabajador;
}

const TrabajadoresModel = {
  async listar(empresaId, { tipo, activo, limit, offset }) {
    const where = ['t.empresa_id = ?'];
    const params = [empresaId];
    if (tipo) { where.push('t.tipo = ?'); params.push(tipo); }
    if (activo !== undefined) { where.push('t.activo = ?'); params.push(activo ? 1 : 0); }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS},
         (SELECT AVG(a.pago_total) FROM asignaciones_turno a
          WHERE a.trabajador_id = t.id AND a.estado = 'completado') AS promedio_pago_turno
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

  /** IDs de trabajadores activos que marcan jornada (nomina o ambos) — para rellenar huecos al cerrar un período. */
  async listarActivosNomina(empresaId) {
    const [filas] = await pool.query(
      `SELECT id FROM trabajadores WHERE empresa_id = ? AND activo = 1 AND tipo IN ('nomina', 'ambos')`,
      [empresaId]
    );
    return filas.map((f) => f.id);
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

  /**
   * Banco de talento: trabajadores libres (sin empresa) navegables/buscables
   * por nombre o cargo — mismo criterio de elegibilidad que buscarPorCedula,
   * sin exigir conocer la cédula de antemano.
   */
  async listarBancoTalento({ q, limit, offset }) {
    const where = [`u.rol = 'trabajador_turnos'`, 'u.activo = 1', 't.empresa_id IS NULL', 't.activo = 1'];
    const params = [];
    if (q) {
      where.push('(t.nombre LIKE ? OR t.apellido LIKE ? OR t.cargo LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT t.id, t.nombre, t.apellido, t.cedula, t.tipo_documento, t.cargo, t.descripcion,
              t.ranking, t.total_calificaciones, u.foto_perfil
       FROM trabajadores t
       INNER JOIN usuarios u ON u.id = t.usuario_id
       WHERE ${whereSql}
       ORDER BY t.ranking DESC, t.nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM trabajadores t
       INNER JOIN usuarios u ON u.id = t.usuario_id
       WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
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

  /**
   * Cambia tarifa/salario y su registro de auditoría en UNA transacción: si no
   * se puede dejar el rastro, el sueldo tampoco cambia.
   * Si viene conn, corre dentro de la transacción de quien llama (ver enTransaccion).
   * @returns {Promise<null|{cambio: boolean, trabajadorId?, usuarioId?, nombre?}>} null si no existe.
   */
  async actualizarSalarioConAuditoria(empresaId, id, { tarifa_hora, salario_base }, auditoria, conn) {
    return enTransaccion(conn, async (c) => {
      const [[actual]] = await c.query(
        'SELECT usuario_id, nombre, apellido, tarifa_hora, salario_base FROM trabajadores WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [id, empresaId]
      );
      if (!actual) return null;

      const nuevaTarifa = tarifa_hora === undefined ? actual.tarifa_hora : tarifa_hora;
      const nuevoSalario = salario_base === undefined ? actual.salario_base : salario_base;
      const num = (v) => (v == null ? null : Number(v));
      const cambio =
        num(actual.tarifa_hora) !== num(nuevaTarifa) || num(actual.salario_base) !== num(nuevoSalario);
      const nombre = `${actual.nombre} ${actual.apellido}`.trim();
      if (!cambio) return { cambio: false };

      await c.query(
        'UPDATE trabajadores SET tarifa_hora = ?, salario_base = ? WHERE id = ? AND empresa_id = ?',
        [nuevaTarifa, nuevoSalario, id, empresaId]
      );
      await c.query(
        `INSERT INTO trabajadores_salario_auditoria
           (empresa_id, trabajador_id, trabajador_nombre, tarifa_hora_anterior, tarifa_hora_nueva,
            salario_base_anterior, salario_base_nueva, usuario_id, usuario_nombre, usuario_rol, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId, id, nombre,
          actual.tarifa_hora, nuevaTarifa, actual.salario_base, nuevoSalario,
          auditoria.usuario_id, auditoria.usuario_nombre, auditoria.usuario_rol, auditoria.ip ?? null,
        ]
      );
      return { cambio: true, trabajadorId: id, usuarioId: actual.usuario_id, nombre };
    });
  },

  async listarHistorialSalario(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT id, tarifa_hora_anterior, tarifa_hora_nueva, salario_base_anterior, salario_base_nueva,
              usuario_nombre, usuario_rol, ip, created_at
       FROM trabajadores_salario_auditoria
       WHERE empresa_id = ? AND trabajador_id = ?
       ORDER BY created_at DESC, id DESC`,
      [empresaId, id]
    );
    return filas;
  },

  /**
   * Trabajadores de nómina con horario fijo que todavía no marcaron ingreso
   * hoy, no están de ausencia aprobada, y no se les avisó ya en el día —
   * candidatos para recordatorioIngreso.worker.js (el filtro de ventana de
   * minutos se hace en JS por el wraparound de medianoche).
   */
  async listarCandidatosRecordatorioIngreso(hoy) {
    const [filas] = await pool.query(
      `SELECT t.id, t.usuario_id, t.empresa_id, t.nombre, t.apellido, t.hora_entrada_esperada
       FROM trabajadores t
       WHERE t.activo = 1
         AND t.tipo IN ('nomina', 'ambos')
         AND t.hora_entrada_esperada IS NOT NULL
         AND t.usuario_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM registros_diarios rd
           WHERE rd.trabajador_id = t.id AND rd.fecha = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM ausencias a
           WHERE a.trabajador_id = t.id AND a.estado = 'aprobada'
             AND ? BETWEEN a.fecha_inicio AND a.fecha_fin
         )
         AND NOT EXISTS (
           SELECT 1 FROM recordatorios_ingreso_enviados r
           WHERE r.trabajador_id = t.id AND r.fecha = ?
         )`,
      [hoy, hoy, hoy]
    );
    return filas;
  },

  /** Idempotencia: INSERT IGNORE tolera una segunda llamada el mismo día sin romper. */
  async marcarRecordatorioIngresoEnviado(trabajadorId, hoy) {
    await pool.query(
      'INSERT IGNORE INTO recordatorios_ingreso_enviados (trabajador_id, fecha) VALUES (?, ?)',
      [trabajadorId, hoy]
    );
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

  /**
   * Sin filtro de empresa — uso interno para resolver el usuario_id de un
   * trabajador cuyo trabajador_id ya viene validado (ej. desde una asignación
   * propia de la empresa). Necesario para notificar a trabajadores marketplace,
   * cuya empresa "dueña" (trabajadores.empresa_id) puede no ser la empresa que
   * gestiona el turno. Nunca exponer esta fila a un cliente sin re-validar tenant.
   */
  async obtenerUsuarioId(id) {
    const [[fila]] = await pool.query('SELECT usuario_id FROM trabajadores WHERE id = ?', [id]);
    return fila?.usuario_id ?? null;
  },

  /** Sin filtro de empresa — usuario_id + rol para chequeos de traslape entre empresas. */
  async obtenerUsuarioIdYRol(id) {
    const [[fila]] = await pool.query(
      `SELECT t.usuario_id, u.rol
       FROM trabajadores t JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.id = ?`,
      [id]
    );
    return fila || null;
  },

  async obtenerPorUsuarioId(empresaId, usuarioId) {
    // Sin empresaId, un usuario puede tener varias filas activas (una por empresa
    // vinculada) — ORDER BY evita que MySQL devuelva una fila arbitraria; la más
    // reciente es la mejor aproximación a "la empresa donde trabaja ahora".
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
           WHERE t.usuario_id = ? AND t.activo = 1
           ORDER BY t.id DESC LIMIT 1`,
          [usuarioId]
        );
    return filas[0] || null;
  },

  /** Batch de obtenerPorUsuarioId(null, ...) — evita N+1 al listar solicitudes de varias empresas. */
  async obtenerPorUsuarioIds(usuarioIds) {
    if (usuarioIds.length === 0) return new Map();
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}
       FROM trabajadores t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.usuario_id IN (?) AND t.activo = 1
       ORDER BY t.id DESC`,
      [usuarioIds]
    );
    const porUsuario = new Map();
    for (const fila of filas) {
      if (!porUsuario.has(fila.usuario_id)) porUsuario.set(fila.usuario_id, fila);
    }
    return porUsuario;
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
      `SELECT id, nombre, apellido, email, cedula, external_ref
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
    return transaccionPropia(async (conn) => {
      const [res] = await conn.query(
        `INSERT INTO trabajadores
           (empresa_id, nombre, apellido, cedula, tipo_documento, fecha_nacimiento, sexo,
            telefono, email, tipo, cargo, tarifa_hora, salario_base,
            contacto_emergencia_nombre, contacto_emergencia_tel,
            eps, afp, banco, tipo_cuenta, numero_cuenta, direccion,
            ant_judiciales_fecha, ant_disciplinarios_fecha, hora_entrada_esperada,
            empresas_postulacion, cargos_iniciales, external_ref, creado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          empresaId,
          datos.nombre,
          datos.apellido,
          datos.cedula || null,
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
          datos.direccion ?? null,
          datos.ant_judiciales_fecha ?? null,
          datos.ant_disciplinarios_fecha ?? null,
          datos.hora_entrada_esperada ?? null,
          datos.empresa_ids?.length ? JSON.stringify(datos.empresa_ids) : null,
          datos.cargo_ids?.length ? JSON.stringify(datos.cargo_ids) : null,
          datos.external_ref ?? null,
          datos.creado_por ?? null,
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

      return trabajadorId;
    });
  },

  /** Vincula una ficha recién creada a la cuenta del usuario. No pasar usuario_id
   *  por req.body a crear() — abriría a que un gestor secuestre otra cuenta. */
  async asignarUsuarioId(trabajadorId, usuarioId) {
    await pool.query('UPDATE trabajadores SET usuario_id = ? WHERE id = ?', [usuarioId, trabajadorId]);
  },

  /** Ficha "personal" sin empresa (registro libre, aún sin vincularse). */
  async obtenerPersonalPorUsuarioId(usuarioId) {
    const [filas] = await pool.query(
      `SELECT id FROM trabajadores WHERE usuario_id = ? AND empresa_id IS NULL AND activo = 1 LIMIT 1`,
      [usuarioId]
    );
    return filas[0]?.id ?? null;
  },

  /** Reclama la ficha personal (empresa_id IS NULL) al vincularse a la primera empresa. */
  async reclamarParaEmpresa(trabajadorId, empresaId) {
    await pool.query('UPDATE trabajadores SET empresa_id = ? WHERE id = ?', [empresaId, trabajadorId]);
  },

  /**
   * La cédula no se cambia desde una empresa si el trabajador tiene ficha activa
   * en otra: es su documento y choca con UNIQUE(empresa_id, cedula) — la cambia él
   * en actualizarPorUsuarioId. El resto de datos de la persona sí se copia a sus
   * otras fichas activas, para que queden iguales en todas sus empresas.
   */
  async actualizar(empresaId, id, datos, conn) {
    const sets = [];
    const params = [];
    const personales = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (datos[campo] !== undefined) {
        // '' se guarda como NULL — cedula '' no debe chocar con el UNIQUE(empresa_id, cedula).
        const valor = campo === 'cedula' && datos[campo] === '' ? null : datos[campo];
        sets.push(`${campo} = ?`);
        params.push(valor);
        if (CAMPOS_PERSONALES_TRABAJADOR.includes(campo)) personales[campo] = valor;
      }
    }
    if (sets.length === 0) return 0;

    return enTransaccion(conn, async (c) => {
      const [[actual]] = await c.query(
        'SELECT usuario_id, cedula FROM trabajadores WHERE id = ? AND empresa_id = ?',
        [id, empresaId]
      );
      if (
        personales.cedula !== undefined &&
        actual?.usuario_id &&
        norm(actual.cedula) !== norm(personales.cedula) &&
        (await tieneOtraFichaActiva(c, actual.usuario_id, id))
      ) {
        throw new AppError(
          'No se puede cambiar la cédula desde aquí: el trabajador tiene ficha en otra empresa y su cédula la actualiza él desde su perfil.',
          409
        );
      }

      params.push(id, empresaId);
      const [res] = await c.query(
        `UPDATE trabajadores SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
        params
      );

      // Datos de la persona (menos la cédula, ya validada arriba) a sus otras fichas activas.
      const copiar = Object.keys(personales).filter((col) => col !== 'cedula');
      if (res.affectedRows && copiar.length > 0 && actual?.usuario_id) {
        await c.query(
          `UPDATE trabajadores SET ${copiar.map((col) => `${col} = ?`).join(', ')} WHERE usuario_id = ? AND id != ? AND activo = 1`,
          [...copiar.map((col) => personales[col]), actual.usuario_id, id]
        );
      }
      return res.affectedRows;
    });
  },

  async desactivar(empresaId, id) {
    const [res] = await pool.query(
      'UPDATE trabajadores SET activo = 0 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
    return res.affectedRows;
  },

  /** Borra la fila. Falla con FK (ER_ROW_IS_REFERENCED_2) si tiene asignaciones, registros o calificaciones. */
  async eliminarDefinitivo(empresaId, id) {
    await pool.query(
      'DELETE FROM trabajadores WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
  },

  // ── Experiencias ──────────────────────────────────────────────────────────

  async listarExperiencias(trabajadorId) {
    const [filas] = await pool.query(
      'SELECT * FROM trabajador_experiencias WHERE trabajador_id = ? ORDER BY fecha_inicio DESC',
      [trabajadorId]
    );
    return filas;
  },

  /** Batch de listarExperiencias — evita N+1 al listar solicitudes de varias empresas. */
  async listarExperienciasPorTrabajadores(trabajadorIds) {
    if (trabajadorIds.length === 0) return new Map();
    const [filas] = await pool.query(
      'SELECT * FROM trabajador_experiencias WHERE trabajador_id IN (?) ORDER BY fecha_inicio DESC',
      [trabajadorIds]
    );
    return agruparPorTrabajador(filas);
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

  /** Batch de listarDiplomas — evita N+1 al listar solicitudes de varias empresas. */
  async listarDiplomasPorTrabajadores(trabajadorIds) {
    if (trabajadorIds.length === 0) return new Map();
    const [filas] = await pool.query(
      'SELECT * FROM trabajador_diplomas WHERE trabajador_id IN (?) ORDER BY anio DESC, id DESC',
      [trabajadorIds]
    );
    return agruparPorTrabajador(filas);
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
      'cedula', 'tipo_documento', 'fecha_nacimiento', 'sexo', 'telefono', 'descripcion',
      'contacto_emergencia_nombre', 'contacto_emergencia_tel',
      'eps', 'afp', 'banco', 'tipo_cuenta', 'numero_cuenta', 'direccion',
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
    // Una sola sentencia para todas sus fichas: MySQL la deshace entera si una choca.
    try {
      const [res] = await pool.query(
        `UPDATE trabajadores SET ${sets.join(', ')} WHERE usuario_id = ? AND activo = 1`,
        params
      );
      return res.affectedRows;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('Esa cédula ya está registrada en una de las empresas donde tienes ficha.', 409);
      }
      throw err;
    }
  },

  async actualizarExtras(usuarioId, acepta) {
    const [res] = await pool.query(
      'UPDATE trabajadores SET acepta_extras = ? WHERE usuario_id = ? AND activo = 1',
      [acepta ? 1 : 0, usuarioId]
    );
    return res.affectedRows;
  },

  /** Guarda la última firma dibujada como atajo reutilizable en futuros contratos. */
  async guardarFirma(trabajadorId, firmaB64) {
    await pool.query(
      'UPDATE trabajadores SET firma_guardada = ? WHERE id = ?',
      [firmaB64, trabajadorId]
    );
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
    await transaccionPropia(async (conn) => {
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
    });
  },

  // ── Consultas de apoyo de TrabajadoresService (cupo, identidad, avisos) ──
  // ponytail: tocan `usuarios`/`empresas`, pero solo las usa este flujo — upgrade path:
  // moverlas a UsuariosModel/EmpresasModel si otro módulo las necesita.

  /** ids de los admin_empresa activos de la empresa. */
  async idsAdminsEmpresa(empresaId) {
    const [admins] = await pool.query(
      'SELECT id FROM usuarios WHERE empresa_id = ? AND rol = ? AND activo = 1',
      [empresaId, ROLES.ADMIN_EMPRESA]
    );
    return admins.map((a) => a.id);
  },

  /** Plan de la empresa activa (undefined si no existe o está inactiva). */
  async planDeEmpresa(empresaId) {
    const [[empresa]] = await pool.query(
      'SELECT plan FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [empresaId]
    );
    return empresa;
  },

  async contarActivos(empresaId) {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM trabajadores WHERE empresa_id = ? AND activo = 1',
      [empresaId]
    );
    return total;
  },

  /** ¿Ese email ya es de un gestor (admin/jefe/nómina) de la empresa? */
  async existeGestorConEmail(empresaId, email) {
    const [filas] = await pool.query(
      `SELECT 1 FROM usuarios
       WHERE empresa_id = ? AND email = ? AND rol IN (?, ?, ?, ?) LIMIT 1`,
      [empresaId, email.trim().toLowerCase(), ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA]
    );
    return filas.length > 0;
  },

  /** Rol de la cuenta ya asociada a esa cédula o email (undefined si no hay). Al menos uno es obligatorio. */
  async buscarRolCuentaPorCedulaOEmail({ cedula, email }) {
    const condiciones = [];
    const valores = [];
    if (cedula) { condiciones.push('t.cedula = ?'); valores.push(cedula); }
    if (email)  { condiciones.push('t.email = ?');  valores.push(email.trim().toLowerCase()); }
    const [filas] = await pool.query(
      `SELECT u.rol FROM usuarios u
       INNER JOIN trabajadores t ON t.usuario_id = u.id
       WHERE ${condiciones.join(' OR ')} LIMIT 1`,
      valores
    );
    return filas[0]?.rol;
  },

  /** Resincroniza usuarios.rol con el tipo de la ficha. Va dentro de la transacción de quien llama (conn). */
  async sincronizarRolUsuario(usuarioId, rolNuevo, conn) {
    await conn.query(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [rolNuevo, usuarioId, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
  },
};

module.exports = TrabajadoresModel;
