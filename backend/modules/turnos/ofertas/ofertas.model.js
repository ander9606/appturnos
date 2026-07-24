'use strict';

const { pool } = require('../../../config/database');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');

/**
 * Acceso a datos de ofertas de turno (tabla ofertas_turno).
 * Las plazas y tarifas viven en `oferta_puestos` desde la migración 013;
 * `ofertas_turno` solo lleva los datos generales del evento.
 */

const COLUMNAS = `id, empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
  lugar, latitud, longitud, encargado_nombre, encargado_telefono, estado, para_quien,
  external_ref, alquiler_ref, externo_notas, cobertura_notificada, creado_por, created_at`;

// Subquery que adjunta los puestos como JSON array a cada oferta. Evita N+1
// al listar/obtener. mysql2 devuelve esto como string si es resultado de
// expresión (no columna JSON), así que el modelo se encarga de parsear.
const PUESTOS_JSON = `(
  SELECT JSON_ARRAYAGG(JSON_OBJECT(
    'id', p.id,
    'cargo_id', p.cargo_id,
    'cargo_codigo', c.codigo,
    'cargo_nombre', c.nombre,
    'plazas', p.plazas,
    'plazas_cubiertas', p.plazas_cubiertas,
    'tarifa_dia', p.tarifa_dia,
    'notas', p.notas
  ))
  FROM oferta_puestos p
  INNER JOIN cargos c ON c.id = p.cargo_id
  WHERE p.oferta_id = ofertas_turno.id
) AS puestos_json`;

// Variantes alias-prefijadas para JOINs (cuando ofertas_turno se alias como `o`).
const PUESTOS_JSON_ALIAS = PUESTOS_JSON.replace(
  'p.oferta_id = ofertas_turno.id',
  'p.oferta_id = o.id'
);

// Allowlist de columnas modificables vía PUT (lista fija de código).
const CAMPOS_EDITABLES = [
  'titulo',
  'descripcion',
  'fecha',
  'hora_inicio',
  'hora_fin_estimada',
  'lugar',
  'latitud',
  'longitud',
  'encargado_nombre',
  'encargado_telefono',
  'para_quien',
];

/** Convierte la columna `puestos_json` (string) en array de objetos. */
function parsearPuestos(fila) {
  if (!fila) return fila;
  const { puestos_json, ...resto } = fila;
  let puestos = [];
  if (puestos_json) {
    puestos = typeof puestos_json === 'string' ? JSON.parse(puestos_json) : puestos_json;
  }
  return { ...resto, puestos };
}

const OfertasModel = {
  async listar(empresaId, { fecha, estado, disponibles, antiguedadMinMin, paraQuien, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (fecha) { where.push('fecha = ?'); params.push(fecha); }
    if (estado) { where.push('estado = ?'); params.push(estado); }
    if (paraQuien === 'nomina') {
      where.push("para_quien IN ('nomina','ambos')");
    } else if (paraQuien === 'turnos') {
      where.push("para_quien IN ('turnos','ambos')");
    }
    if (disponibles) {
      where.push(`estado IN ('abierta', 'publicada') AND EXISTS (
        SELECT 1 FROM oferta_puestos p
        WHERE p.oferta_id = ofertas_turno.id AND p.plazas_cubiertas < p.plazas
      )`);
    }
    if (antiguedadMinMin && antiguedadMinMin > 0) {
      where.push('TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= ?');
      params.push(antiguedadMinMin);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}, ${PUESTOS_JSON}
       FROM ofertas_turno
       WHERE ${whereSql}
       ORDER BY fecha DESC, hora_inicio
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ofertas_turno WHERE ${whereSql}`,
      params
    );
    return { data: filas.map(parsearPuestos), total };
  },

  /**
   * Lista ofertas para un TRABAJADOR_TURNOS multi-empresa.
   * Aplica:
   *   - Delay de visibilidad por ranking (POR empresa).
   *   - Filtro por cargos: solo ofertas con al menos un puesto cuyo cargo
   *     el trabajador tiene certificado en esa empresa.
   */
  async listarMultiEmpresa(usuarioId, empresaIds, { fecha, estado, disponibles, paraQuien, limit, offset }) {
    if (!empresaIds || empresaIds.length === 0) {
      return { data: [], total: 0 };
    }

    const where = ['o.empresa_id IN (?)'];
    const params = [empresaIds];

    if (fecha) { where.push('o.fecha = ?'); params.push(fecha); }
    if (estado) { where.push('o.estado = ?'); params.push(estado); }
    if (paraQuien === 'nomina') {
      where.push("o.para_quien IN ('nomina','ambos')");
    } else if (paraQuien === 'turnos') {
      where.push("o.para_quien IN ('turnos','ambos')");
    }
    if (disponibles) {
      where.push(`o.estado IN ('abierta', 'publicada') AND EXISTS (
        SELECT 1 FROM oferta_puestos p
        WHERE p.oferta_id = o.id AND p.plazas_cubiertas < p.plazas
      )`);
    }

    // Visibilidad escalonada por ranking POR empresa.
    where.push(`
      TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) >=
        CASE
          WHEN t.ranking IS NULL THEN 15
          WHEN t.ranking >= 4.5  THEN 0
          WHEN t.ranking >= 3.5  THEN 15
          WHEN t.ranking >= 2.5  THEN 30
          ELSE                        60
        END
    `);

    // Filtro por cargos certificados: existe al menos un puesto en la oferta
    // cuyo cargo está en `trabajador_cargos` del vínculo activo del trabajador
    // con la empresa de la oferta.
    where.push(`EXISTS (
      SELECT 1
      FROM oferta_puestos p
      JOIN trabajador_empresa te
        ON te.usuario_id = ? AND te.empresa_id = o.empresa_id AND te.estado = 'activo'
      JOIN trabajador_cargos tc
        ON tc.trabajador_empresa_id = te.id AND tc.cargo_id = p.cargo_id
      WHERE p.oferta_id = o.id
    )`);
    params.push(usuarioId);  // (segundo bind del usuario_id en este predicate)

    const whereSql = where.join(' AND ');
    const joinSql = `
      LEFT JOIN trabajador_empresa te
        ON te.empresa_id = o.empresa_id
       AND te.usuario_id = ?
       AND te.estado = 'activo'
      LEFT JOIN trabajadores t ON t.id = te.trabajador_id AND t.activo = 1
      JOIN empresas e ON e.id = o.empresa_id
    `;
    const colsAliased = COLUMNAS.split(',').map((c) => `o.${c.trim()}`).join(', ');

    // Feed agregado de varias empresas — a diferencia de listar()/obtener() (donde el
    // gestor ya sabe en qué empresa está), acá el nombre es indispensable para distinguir
    // de un vistazo de qué empresa es cada oferta.
    const [filas] = await pool.query(
      `SELECT ${colsAliased}, e.nombre AS empresa_nombre, ${PUESTOS_JSON_ALIAS}
       FROM ofertas_turno o
       ${joinSql}
       WHERE ${whereSql}
       ORDER BY o.fecha DESC, o.hora_inicio
       LIMIT ? OFFSET ?`,
      [usuarioId, ...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ofertas_turno o
       ${joinSql}
       WHERE ${whereSql}`,
      [usuarioId, ...params]
    );

    return { data: filas.map(parsearPuestos), total };
  },

  /** Resuelve la empresa dueña de una oferta sin conocerla de antemano — usada
   *  para validar membresía de trabajadores multi-empresa antes del fetch scoped. */
  async obtenerEmpresaId(id) {
    const [filas] = await pool.query(
      'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1',
      [id]
    );
    return filas[0]?.empresa_id ?? null;
  },

  async obtenerPorId(empresaId, id, antiguedadMinMin = 0) {
    const params = [id, empresaId];
    let extra = '';
    if (antiguedadMinMin > 0) {
      extra = ' AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= ?';
      params.push(antiguedadMinMin);
    }
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}, ${PUESTOS_JSON}
       FROM ofertas_turno WHERE id = ? AND empresa_id = ?${extra} LIMIT 1`,
      params
    );
    return parsearPuestos(filas[0]) || null;
  },

  async obtenerPorExternalRef(empresaId, externalRef) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS}, ${PUESTOS_JSON}
       FROM ofertas_turno WHERE external_ref = ? AND empresa_id = ? LIMIT 1`,
      [externalRef, empresaId]
    );
    return parsearPuestos(filas[0]) || null;
  },

  async cambiarEstado(empresaId, id, estado) {
    const [res] = await pool.query(
      'UPDATE ofertas_turno SET estado = ? WHERE id = ? AND empresa_id = ?',
      [estado, id, empresaId]
    );
    return res.affectedRows;
  },

  /**
   * Crea oferta + puestos en una transacción.
   * @param datos.puestos — array `[{ cargo_id, plazas, tarifa_dia, notas? }]`.
   *                       Si viene vacío, la oferta queda sin puestos (el jefe
   *                       los agrega después via /puestos). Esto se permite
   *                       para que ordenes externas (logiq360) puedan llegar
   *                       en estado 'borrador' sin tarifas decididas.
   */
  async crear(empresaId, datos, creadoPor) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [res] = await conn.query(
        `INSERT INTO ofertas_turno
           (empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
            lugar, latitud, longitud, encargado_nombre, encargado_telefono,
            estado, para_quien, external_ref, alquiler_ref, externo_notas, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          datos.titulo,
          datos.descripcion ?? null,
          datos.fecha,
          datos.hora_inicio,
          datos.hora_fin_estimada ?? null,
          datos.lugar ?? null,
          datos.latitud ?? null,
          datos.longitud ?? null,
          datos.encargado_nombre ?? null,
          datos.encargado_telefono ?? null,
          datos.estado ?? 'abierta',
          datos.para_quien ?? 'turnos',
          datos.external_ref ?? null,
          datos.alquiler_ref ?? null,
          datos.externo_notas ?? null,
          creadoPor,
        ]
      );
      const ofertaId = res.insertId;

      // Insertar puestos en la misma transacción.
      if (Array.isArray(datos.puestos)) {
        for (const p of datos.puestos) {
          await conn.query(
            `INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia, notas)
             VALUES (?, ?, ?, ?, ?)`,
            [ofertaId, p.cargo_id, p.plazas ?? 1, p.tarifa_dia, p.notas ?? null]
          );
        }
      }

      await conn.commit();
      return ofertaId;
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
      `UPDATE ofertas_turno SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );
    return res.affectedRows;
  },

  /**
   * Ofertas próximas (en las próximas `horasAntes` horas) con personal incompleto
   * y que aún no han disparado la alerta. Incluye IDs de gestores a notificar.
   */
  async listarProximasConPersonalIncompleto(horasAntes = 24) {
    const ahora = ahoraColombiaSQL();
    const limite = ahoraColombiaSQL(horasAntes * 3_600_000);
    const [filas] = await pool.query(
      `SELECT o.id, o.empresa_id, o.titulo, o.fecha, o.hora_inicio,
              SUM(p.plazas) AS total_plazas,
              SUM(p.plazas_cubiertas) AS cubiertas,
              JSON_ARRAYAGG(u.id) AS gestor_ids
       FROM ofertas_turno o
       JOIN oferta_puestos p ON p.oferta_id = o.id
       JOIN usuarios u ON u.empresa_id = o.empresa_id
                      AND u.rol IN ('jefe_turnos', 'admin_empresa')
                      AND u.activo = 1
       WHERE o.estado IN ('abierta', 'publicada')
         AND o.alerta_personal_enviada = 0
         AND TIMESTAMP(o.fecha, o.hora_inicio) BETWEEN ? AND ?
       GROUP BY o.id, o.empresa_id, o.titulo, o.fecha, o.hora_inicio
       HAVING SUM(p.plazas_cubiertas) < SUM(p.plazas)`,
      [ahora, limite]
    );
    return filas.map((f) => ({
      ...f,
      gestor_ids: typeof f.gestor_ids === 'string' ? JSON.parse(f.gestor_ids) : (f.gestor_ids ?? []),
    }));
  },

  async marcarAlertaEnviada(id) {
    await pool.query(
      'UPDATE ofertas_turno SET alerta_personal_enviada = 1 WHERE id = ?',
      [id]
    );
  },

  async marcarCoberturaNotificada(empresaId, id) {
    await pool.query(
      'UPDATE ofertas_turno SET cobertura_notificada = 1 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
  },

  /**
   * Copia una oferta a una nueva fecha, con plazas_cubiertas = 0 en todos los puestos.
   */
  async duplicar(empresaId, id, nuevaFecha, creadoPor) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[original]] = await conn.query(
        'SELECT * FROM ofertas_turno WHERE id = ? AND empresa_id = ? LIMIT 1',
        [id, empresaId]
      );
      if (!original) { await conn.rollback(); return null; }

      const [res] = await conn.query(
        `INSERT INTO ofertas_turno
           (empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
            lugar, latitud, longitud, estado, para_quien, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'abierta', ?, ?)`,
        [
          empresaId, original.titulo, original.descripcion, nuevaFecha,
          original.hora_inicio, original.hora_fin_estimada,
          original.lugar, original.latitud, original.longitud,
          original.para_quien, creadoPor,
        ]
      );
      const nuevaId = res.insertId;

      await conn.query(
        `INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia, notas)
         SELECT ?, cargo_id, plazas, tarifa_dia, notas FROM oferta_puestos WHERE oferta_id = ?`,
        [nuevaId, id]
      );

      await conn.commit();
      return nuevaId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async cancelar(empresaId, id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "UPDATE ofertas_turno SET estado = 'cancelada' WHERE id = ? AND empresa_id = ?",
        [id, empresaId]
      );
      await conn.query(
        `UPDATE asignaciones_turno SET estado = 'cancelado'
         WHERE oferta_id = ? AND empresa_id = ?
           AND estado NOT IN ('completado', 'cancelado')`,
        [id, empresaId]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async eliminarDefinitivo(empresaId, id) {
    await pool.query(
      'DELETE FROM ofertas_turno WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );
  },
};

module.exports = OfertasModel;
