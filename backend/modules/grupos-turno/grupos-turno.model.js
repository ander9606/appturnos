'use strict';

const { pool } = require('../../config/database');

// latitud/longitud son DECIMAL — mysql2 los devuelve como string. El cliente espera number.
const aNumero = (v) => (v == null ? null : Number(v));

// Resumen del grupo. Las fechas y el conteo se CALCULAN con sus turnos (nunca se guardan,
// para que no queden desactualizadas); los turnos cancelados no cuentan.
const RESUMEN = `
  g.id, g.empresa_id, g.nombre, g.descripcion, g.lugar, g.latitud, g.longitud,
  g.estado, g.cerrado_at, g.created_at,
  COUNT(o.id)  AS total_turnos,
  MIN(o.fecha) AS fecha_inicio,
  MAX(o.fecha) AS fecha_fin`;
const DESDE_RESUMEN = `
  FROM grupos_turno g
  LEFT JOIN ofertas_turno o
         ON o.grupo_id = g.id AND o.empresa_id = g.empresa_id AND o.estado <> 'cancelada'`;

function normalizar(fila) {
  if (!fila) return null;
  return {
    ...fila,
    latitud: aNumero(fila.latitud),
    longitud: aNumero(fila.longitud),
    total_turnos: Number(fila.total_turnos ?? 0),
  };
}

const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'lugar', 'latitud', 'longitud'];

const GruposTurnoModel = {
  /** ¿La empresa tiene activada la función de grupos? (interruptor del super_admin) */
  async empresaUsaGrupos(empresaId) {
    const [[fila]] = await pool.query('SELECT usa_grupos_turno FROM empresas WHERE id = ? LIMIT 1', [empresaId]);
    return Boolean(fila?.usa_grupos_turno);
  },

  /** estado: 'activo' | 'cerrado' | null (todos). */
  async listar(empresaId, estado = null) {
    const params = [empresaId];
    let filtro = '';
    if (estado) { filtro = 'AND g.estado = ?'; params.push(estado); }
    const [filas] = await pool.query(
      `SELECT ${RESUMEN} ${DESDE_RESUMEN}
       WHERE g.empresa_id = ? ${filtro}
       GROUP BY g.id
       ORDER BY g.estado, COALESCE(MAX(o.fecha), DATE(g.created_at)) DESC, g.nombre`,
      params
    );
    return filas.map(normalizar);
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT ${RESUMEN} ${DESDE_RESUMEN}
       WHERE g.id = ? AND g.empresa_id = ?
       GROUP BY g.id`,
      [id, empresaId]
    );
    return normalizar(filas[0]);
  },

  /** Id del grupo de la empresa con ese nombre (sin importar mayúsculas), o null. */
  async idPorNombre(empresaId, nombre) {
    const [[fila]] = await pool.query(
      'SELECT id FROM grupos_turno WHERE empresa_id = ? AND nombre = ? LIMIT 1',
      [empresaId, nombre]
    );
    return fila?.id ?? null;
  },

  /** Turnos del grupo por fecha (los cancelados también, para que el gestor los vea). */
  async turnos(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT id, titulo, fecha, hora_inicio, hora_fin_estimada, fin_dia_siguiente, lugar, estado,
              (SELECT COALESCE(SUM(p.plazas), 0) FROM oferta_puestos p WHERE p.oferta_id = ofertas_turno.id) AS plazas,
              (SELECT COALESCE(SUM(p.plazas_cubiertas), 0) FROM oferta_puestos p WHERE p.oferta_id = ofertas_turno.id) AS plazas_cubiertas
       FROM ofertas_turno
       WHERE grupo_id = ? AND empresa_id = ?
       ORDER BY fecha, hora_inicio, id`,
      [id, empresaId]
    );
    return filas.map((f) => ({ ...f, plazas: Number(f.plazas), plazas_cubiertas: Number(f.plazas_cubiertas) }));
  },

  async crear(empresaId, datos, creadoPor) {
    const [res] = await pool.query(
      `INSERT INTO grupos_turno (empresa_id, nombre, descripcion, lugar, latitud, longitud, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, datos.nombre, datos.descripcion ?? null, datos.lugar ?? null,
        datos.latitud ?? null, datos.longitud ?? null, creadoPor ?? null]
    );
    return res.insertId;
  },

  /** Solo toca los campos que vienen en `cambios` (los nombres salen de una lista fija). */
  async actualizar(empresaId, id, cambios) {
    const campos = CAMPOS_EDITABLES.filter((c) => cambios[c] !== undefined);
    if (campos.length === 0) return;
    await pool.query(
      `UPDATE grupos_turno SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND empresa_id = ?`,
      [...campos.map((c) => cambios[c]), id, empresaId]
    );
  },

  async cambiarEstado(empresaId, id, estado) {
    await pool.query(
      `UPDATE grupos_turno SET estado = ?, cerrado_at = ${estado === 'cerrado' ? 'NOW()' : 'NULL'}
       WHERE id = ? AND empresa_id = ?`,
      [estado, id, empresaId]
    );
  },

  /**
   * Turnos que impiden cerrar el grupo: los que aún no terminan (abiertos o en proceso, con fin
   * en el futuro) y los que tienen a alguien trabajando ahora. `ahora` es la hora de Colombia.
   */
  async contarPendientes(empresaId, id, ahora) {
    const [[fila]] = await pool.query(
      `SELECT COUNT(*) AS n FROM ofertas_turno o
       WHERE o.grupo_id = ? AND o.empresa_id = ?
         AND ( (o.estado IN ('abierta', 'en_proceso') AND o.fin_ts >= ?)
            OR EXISTS (SELECT 1 FROM asignaciones_turno a WHERE a.oferta_id = o.id AND a.estado = 'en_progreso') )`,
      [id, empresaId, ahora]
    );
    return Number(fila.n);
  },
};

module.exports = GruposTurnoModel;
