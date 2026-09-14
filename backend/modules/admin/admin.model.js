'use strict';

const { pool } = require('../../config/database');
const { SUSCRIPCION_ESTANDAR_COP } = require('../../config/constants');

/**
 * Acceso a datos del módulo admin (super_admin).
 * No filtra por empresa_id — opera a nivel de sistema.
 */
const AdminModel = {
  // ── Empresas ──────────────────────────────────────────────────────────────

  /** Lista todas las empresas con conteo de trabajadores, usuarios e ingresos históricos. */
  async listarEmpresas({ busqueda, activo, plan, limit, offset }) {
    const where = ['1=1'];
    const params = [];

    if (busqueda) {
      where.push('(e.nombre LIKE ? OR e.slug LIKE ? OR e.nit LIKE ?)');
      params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    }
    if (activo !== undefined) {
      where.push('e.activo = ?');
      params.push(activo ? 1 : 0);
    }
    if (plan) {
      where.push('e.plan = ?');
      params.push(plan);
    }

    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT
         e.id, e.nombre, e.slug, e.nit, e.ciudad, e.activo, e.plan,
         e.suscripcion_vigente_hasta, e.suscripcion_origen,
         e.acepta_postulaciones, e.logo_url, e.descripcion, e.created_at,
         COUNT(DISTINCT t.id)  AS total_trabajadores,
         COUNT(DISTINCT u.id)  AS total_usuarios,
         COUNT(DISTINCT CASE WHEN t.tipo = 'turnos' THEN t.id END) AS trabajadores_turnos,
         COUNT(DISTINCT CASE WHEN t.tipo = 'nomina' THEN t.id END) AS trabajadores_nomina,
         COUNT(DISTINCT CASE WHEN t.tipo = 'ambos'  THEN t.id END) AS trabajadores_ambos,
         (MAX(ic.activo) = 1 AND MAX(ic.api_key) IS NOT NULL) AS logiq360_conectado,
         COALESCE(MAX(wp.meses_pagados), 0) AS ingresos_meses_pagados
       FROM empresas e
       LEFT JOIN trabajadores t ON t.empresa_id = e.id
       LEFT JOIN usuarios u     ON u.empresa_id = e.id
       LEFT JOIN integracion_config ic ON ic.empresa_id = e.id
       LEFT JOIN (
         SELECT empresa_id, SUM(meses) AS meses_pagados
         FROM wompi_eventos
         WHERE estado = 'procesado'
         GROUP BY empresa_id
       ) wp ON wp.empresa_id = e.id
       WHERE ${whereSql}
       GROUP BY e.id
       ORDER BY e.nombre
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    filas.forEach((f) => {
      f.logiq360_conectado = Boolean(f.logiq360_conectado);
      f.ingresos_totales_cop = Number(f.ingresos_meses_pagados) * SUSCRIPCION_ESTANDAR_COP;
      delete f.ingresos_meses_pagados;
    });

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM empresas e WHERE ${whereSql}`,
      params
    );

    return { data: filas, total };
  },

  /**
   * Detalle de una empresa con sus métricas.
   * logiq360_conectado se deriva en vivo de integracion_config (misma condición
   * que IntegracionModel.estaConectado) — no de suscripcion_origen, que ya no se
   * otorga automáticamente al emparejar y puede quedar desactualizado.
   */
  async obtenerEmpresa(id) {
    const [filas] = await pool.query(
      `SELECT
         e.id, e.nombre, e.slug, e.nit, e.ciudad, e.activo, e.plan,
         e.suscripcion_vigente_hasta, e.suscripcion_origen,
         e.acepta_postulaciones, e.logo_url, e.descripcion, e.created_at,
         COUNT(DISTINCT t.id)  AS total_trabajadores,
         COUNT(DISTINCT u.id)  AS total_usuarios,
         COUNT(DISTINCT ot.id) AS total_ofertas,
         COUNT(DISTINCT pn.id) AS total_periodos,
         COUNT(DISTINCT CASE WHEN t.tipo = 'turnos' THEN t.id END) AS trabajadores_turnos,
         COUNT(DISTINCT CASE WHEN t.tipo = 'nomina' THEN t.id END) AS trabajadores_nomina,
         COUNT(DISTINCT CASE WHEN t.tipo = 'ambos'  THEN t.id END) AS trabajadores_ambos,
         (MAX(ic.activo) = 1 AND MAX(ic.api_key) IS NOT NULL) AS logiq360_conectado
       FROM empresas e
       LEFT JOIN trabajadores t  ON t.empresa_id = e.id
       LEFT JOIN usuarios u      ON u.empresa_id = e.id
       LEFT JOIN ofertas_turno ot ON ot.empresa_id = e.id
       LEFT JOIN periodos_nomina pn ON pn.empresa_id = e.id
       LEFT JOIN integracion_config ic ON ic.empresa_id = e.id
       WHERE e.id = ?
       GROUP BY e.id
       LIMIT 1`,
      [id]
    );
    const fila = filas[0];
    if (fila) fila.logiq360_conectado = Boolean(fila.logiq360_conectado);
    return fila || null;
  },

  /** Crea una nueva empresa. Devuelve el id insertado. */
  async crearEmpresa({ nombre, slug, nit, ciudad, plan, descripcion }) {
    const [result] = await pool.query(
      `INSERT INTO empresas (nombre, slug, nit, ciudad, plan, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, slug, nit || null, ciudad || null, plan || 'basico', descripcion || null]
    );
    return result.insertId;
  },

  /** Actualiza campos de una empresa. */
  async actualizarEmpresa(id, campos) {
    const permitidos = [
      'nombre', 'nit', 'ciudad', 'plan',
      'acepta_postulaciones', 'descripcion', 'logo_url',
    ];
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        vals.push(v);
      }
    }
    if (sets.length === 0) return;
    vals.push(id);
    await pool.query(`UPDATE empresas SET ${sets.join(', ')} WHERE id = ?`, vals);
  },

  /** Activa o desactiva una empresa. */
  async cambiarEstado(id, activo) {
    await pool.query('UPDATE empresas SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
  },

  /**
   * Actualiza la suscripción de una empresa.
   * vigente_hasta null = acceso indefinido.
   * Exportado para uso en Wompi webhook y logiq360 pairing.
   */
  async actualizarSuscripcion(id, { plan, vigente_hasta, origen }) {
    const sets = [];
    const vals = [];
    if (plan !== undefined)        { sets.push('plan = ?');                     vals.push(plan); }
    if (vigente_hasta !== undefined){ sets.push('suscripcion_vigente_hasta = ?'); vals.push(vigente_hasta); }
    if (origen !== undefined)      { sets.push('suscripcion_origen = ?');        vals.push(origen); }
    if (sets.length === 0) return;
    vals.push(id);
    await pool.query(`UPDATE empresas SET ${sets.join(', ')} WHERE id = ?`, vals);
  },

  /** Verifica si un slug ya existe (para validar unicidad al crear). */
  async existeSlug(slug, excluirId = null) {
    const params = [slug];
    let sql = 'SELECT id FROM empresas WHERE slug = ?';
    if (excluirId) {
      sql += ' AND id != ?';
      params.push(excluirId);
    }
    const [filas] = await pool.query(sql, params);
    return filas.length > 0;
  },

  // ── Reportes globales ─────────────────────────────────────────────────────

  /** Estadísticas globales del sistema. */
  async obtenerReportesGlobales() {
    const [[empresas]] = await pool.query(
      `SELECT
         COUNT(*)              AS total_empresas,
         SUM(activo = 1)       AS empresas_activas,
         SUM(activo = 0)       AS empresas_inactivas
       FROM empresas`
    );

    const [[usuarios]] = await pool.query(
      `SELECT COUNT(*) AS total_usuarios FROM usuarios WHERE rol != 'super_admin'`
    );

    const [[trabajadores]] = await pool.query(
      `SELECT
         COUNT(*)          AS total_trabajadores,
         SUM(activo = 1)   AS trabajadores_activos
       FROM trabajadores`
    );

    const [[turnos]] = await pool.query(
      `SELECT
         COUNT(*) AS total_turnos_mes
       FROM asignaciones_turno
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    const [[periodos]] = await pool.query(
      `SELECT
         COUNT(*) AS periodos_abiertos
       FROM periodos_nomina
       WHERE estado = 'abierto'`
    );

    // logiq360_conectado se deriva en vivo (misma condición que listarEmpresas);
    // pago_directo = suscripcion_origen 'wompi' entre empresas activas.
    const [[integraciones]] = await pool.query(
      `SELECT
         SUM(logiq360_conectado)                    AS empresas_logiq360,
         SUM(suscripcion_origen = 'wompi')           AS empresas_pago_directo
       FROM (
         SELECT e.id, e.suscripcion_origen,
                (MAX(ic.activo) = 1 AND MAX(ic.api_key) IS NOT NULL) AS logiq360_conectado
         FROM empresas e
         LEFT JOIN integracion_config ic ON ic.empresa_id = e.id
         WHERE e.activo = 1
         GROUP BY e.id
       ) sub`
    );

    // Proyección: empresas que pagan directo (wompi) con suscripción vigente hoy.
    const [[proyeccion]] = await pool.query(
      `SELECT COUNT(*) AS empresas_pagando
       FROM empresas
       WHERE activo = 1
         AND suscripcion_origen = 'wompi'
         AND (suscripcion_vigente_hasta IS NULL OR suscripcion_vigente_hasta >= CURDATE())`
    );

    // Ganado el mes pasado: pagos Wompi procesados en el mes calendario anterior.
    const [[mesPasado]] = await pool.query(
      `SELECT COALESCE(SUM(meses), 0) AS meses_pagados
       FROM wompi_eventos
       WHERE estado = 'procesado'
         AND procesado_at >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
         AND procesado_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );

    // Generado en lo que va del mes actual: pagos Wompi ya procesados (no proyección).
    const [[mesActual]] = await pool.query(
      `SELECT COALESCE(SUM(meses), 0) AS meses_pagados
       FROM wompi_eventos
       WHERE estado = 'procesado'
         AND procesado_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );

    // Histórico de ingresos (últimos 6 meses, incluye el actual en curso) para
    // la tendencia de MRR. Se rellenan en JS los meses sin pagos procesados
    // para que el arreglo siempre tenga 6 puntos consecutivos.
    const [historicoRows] = await pool.query(
      `SELECT DATE_FORMAT(procesado_at, '%Y-%m') AS mes, COALESCE(SUM(meses), 0) AS meses_pagados
       FROM wompi_eventos
       WHERE estado = 'procesado'
         AND procesado_at >= DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01')
       GROUP BY mes`
    );
    const mesesPagadosPorMes = new Map(historicoRows.map((r) => [r.mes, Number(r.meses_pagados)]));
    const hoy = new Date();
    const mrrHistorico = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mrrHistorico.push({
        mes,
        ingresos_cop: (mesesPagadosPorMes.get(mes) ?? 0) * SUSCRIPCION_ESTANDAR_COP,
      });
    }

    // Renovaciones en riesgo: empresas activas que pagan directo (no logiq360)
    // cuya suscripción vence en 7 días o menos, o ya venció. Mismo criterio que
    // el email de suscripcion.worker.js, pero como lista continua (no solo los
    // checkpoints 7/3/0/-3) para verla de un vistazo en el panel.
    const [renovacionesRows] = await pool.query(
      `SELECT e.id, e.nombre, e.suscripcion_vigente_hasta,
              DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) AS dias_restantes
       FROM empresas e
       WHERE e.activo = 1
         AND e.suscripcion_origen != 'logiq360'
         AND e.suscripcion_vigente_hasta IS NOT NULL
         AND DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) <= 7
       ORDER BY dias_restantes ASC
       LIMIT 20`
    );

    return {
      empresas: {
        total: Number(empresas.total_empresas),
        activas: Number(empresas.empresas_activas),
        inactivas: Number(empresas.empresas_inactivas),
      },
      usuarios: {
        total: Number(usuarios.total_usuarios),
      },
      trabajadores: {
        total: Number(trabajadores.total_trabajadores),
        activos: Number(trabajadores.trabajadores_activos),
      },
      turnos: {
        ultimo_mes: Number(turnos.total_turnos_mes),
      },
      nomina: {
        periodos_abiertos: Number(periodos.periodos_abiertos),
      },
      integraciones: {
        logiq360: Number(integraciones.empresas_logiq360) || 0,
        pago_directo: Number(integraciones.empresas_pago_directo) || 0,
      },
      ingresos: {
        mes_actual: Number(mesActual.meses_pagados) * SUSCRIPCION_ESTANDAR_COP,
        proyeccion_mes_actual: Number(proyeccion.empresas_pagando) * SUSCRIPCION_ESTANDAR_COP,
        ganado_mes_pasado: Number(mesPasado.meses_pagados) * SUSCRIPCION_ESTANDAR_COP,
        tarifa_cop: SUSCRIPCION_ESTANDAR_COP,
        mrr_historico: mrrHistorico,
      },
      renovaciones_riesgo: renovacionesRows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        vigente_hasta: r.suscripcion_vigente_hasta,
        dias_restantes: Number(r.dias_restantes),
      })),
    };
  },

  // ── Wompi eventos ─────────────────────────────────────────────────────────

  async listarWompiEventos({ estado, limit, offset }) {
    const where = estado ? 'WHERE we.estado = ?' : '';
    const params = estado ? [estado, limit, offset] : [limit, offset];
    const [rows] = await pool.query(
      `SELECT we.id, we.transaction_id, we.referencia, we.empresa_id, e.nombre AS empresa_nombre,
              we.plan, we.meses, we.estado, we.intentos, we.error_detalle, we.created_at, we.procesado_at
         FROM wompi_eventos we
         LEFT JOIN empresas e ON e.id = we.empresa_id
         ${where}
        ORDER BY we.created_at DESC
        LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM wompi_eventos ${where.replace('we.estado', 'estado')}`,
      estado ? [estado] : []
    );
    return { data: rows, total: Number(total) };
  },
};

module.exports = AdminModel;
