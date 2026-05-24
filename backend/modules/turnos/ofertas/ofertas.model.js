'use strict';

const { pool } = require('../../../config/database');

/**
 * Acceso a datos de ofertas de turno (tabla ofertas_turno).
 * Todas las consultas se aíslan por empresa_id.
 */

const COLUMNAS = `id, empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
  lugar, latitud, longitud, plazas_disponibles, plazas_cubiertas, tarifa_dia, estado,
  external_ref, alquiler_ref, externo_notas, creado_por, created_at`;

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
  'plazas_disponibles',
  'tarifa_dia',
];

const OfertasModel = {
  async listar(empresaId, { fecha, estado, disponibles, antiguedadMinMin, limit, offset }) {
    const where = ['empresa_id = ?'];
    const params = [empresaId];
    if (fecha) {
      where.push('fecha = ?');
      params.push(fecha);
    }
    if (estado) {
      where.push('estado = ?');
      params.push(estado);
    }
    if (disponibles) {
      where.push("estado = 'abierta' AND plazas_cubiertas < plazas_disponibles");
    }
    // Visibilidad escalonada por ranking: la oferta solo es visible si ya
    // pasaron `antiguedadMinMin` minutos desde su creación.
    if (antiguedadMinMin && antiguedadMinMin > 0) {
      where.push('TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= ?');
      params.push(antiguedadMinMin);
    }
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ofertas_turno
       WHERE ${whereSql}
       ORDER BY fecha DESC, hora_inicio
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ofertas_turno WHERE ${whereSql}`,
      params
    );
    return { data: filas, total };
  },

  /**
   * Lista ofertas para un TRABAJADOR_TURNOS multi-empresa.
   * Aplica el delay de visibilidad POR empresa según el ranking del
   * trabajador en cada una (JOIN con trabajador_empresa + trabajadores).
   *
   * @param {number}   usuarioId  — id del usuario autenticado
   * @param {number[]} empresaIds — empresas activas del trabajador
   * @param {object}   filtros    — fecha, estado, disponibles, limit, offset
   */
  async listarMultiEmpresa(usuarioId, empresaIds, { fecha, estado, disponibles, limit, offset }) {
    if (!empresaIds || empresaIds.length === 0) {
      return { data: [], total: 0 };
    }

    const where = ['o.empresa_id IN (?)'];
    const params = [empresaIds];

    if (fecha) {
      where.push('o.fecha = ?');
      params.push(fecha);
    }
    if (estado) {
      where.push('o.estado = ?');
      params.push(estado);
    }
    if (disponibles) {
      where.push("o.estado = 'abierta' AND o.plazas_cubiertas < o.plazas_disponibles");
    }

    // Visibilidad escalonada por ranking POR empresa:
    // el delay se calcula comparando el ranking del trabajador en la empresa
    // de cada oferta. Si no hay ficha de trabajador, se aplica el delay de 15m.
    where.push(`
      TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) >=
        CASE
          WHEN t.ranking IS NULL    THEN 15
          WHEN t.ranking >= 4.5     THEN 0
          WHEN t.ranking >= 3.5     THEN 15
          WHEN t.ranking >= 2.5     THEN 30
          ELSE                           60
        END
    `);

    const whereSql = where.join(' AND ');
    const joinSql = `
      LEFT JOIN trabajador_empresa te
        ON te.empresa_id = o.empresa_id
       AND te.usuario_id = ?
       AND te.estado = 'activo'
      LEFT JOIN trabajadores t ON t.id = te.trabajador_id AND t.activo = 1
    `;

    // Prefija cada columna con alias 'o.' para evitar ambigüedad con el JOIN.
    const colsAliased = COLUMNAS.split(',').map((c) => `o.${c.trim()}`).join(', ');

    const [filas] = await pool.query(
      `SELECT ${colsAliased}
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

    return { data: filas, total };
  },

  async obtenerPorId(empresaId, id, antiguedadMinMin = 0) {
    const params = [id, empresaId];
    let extra = '';
    if (antiguedadMinMin > 0) {
      extra = ' AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= ?';
      params.push(antiguedadMinMin);
    }
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ofertas_turno WHERE id = ? AND empresa_id = ?${extra} LIMIT 1`,
      params
    );
    return filas[0] || null;
  },

  /** Oferta por referencia externa (sincronización con órdenes de logiq360). */
  async obtenerPorExternalRef(empresaId, externalRef) {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} FROM ofertas_turno WHERE external_ref = ? AND empresa_id = ? LIMIT 1`,
      [externalRef, empresaId]
    );
    return filas[0] || null;
  },

  async cambiarEstado(empresaId, id, estado) {
    const [res] = await pool.query(
      'UPDATE ofertas_turno SET estado = ? WHERE id = ? AND empresa_id = ?',
      [estado, id, empresaId]
    );
    return res.affectedRows;
  },

  async crear(empresaId, datos, creadoPor) {
    const [res] = await pool.query(
      `INSERT INTO ofertas_turno
         (empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
          lugar, latitud, longitud, plazas_disponibles, tarifa_dia,
          estado, external_ref, alquiler_ref, externo_notas, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        datos.plazas_disponibles ?? 1,
        datos.tarifa_dia,
        // ofertas desde logiq360 arrancan en 'borrador'; las manuales en 'abierta' (default)
        datos.estado ?? 'abierta',
        datos.external_ref ?? null,
        datos.alquiler_ref ?? null,
        datos.externo_notas ?? null,
        creadoPor,
      ]
    );
    return res.insertId;
  },

  /** Actualiza solo los campos presentes (PUT parcial). */
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
   * Cancela la oferta y, en la misma transacción, cancela sus asignaciones
   * que aún no estén completadas ni canceladas.
   */
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
};

module.exports = OfertasModel;
