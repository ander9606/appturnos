'use strict';

const { pool } = require('../../../config/database');
const ContratosModel = require('../../contratos/contratos.model');
const { recalcularRanking } = require('../../../utils/rankingUtils');

/**
 * Acceso a datos de asignaciones de turno (tabla asignaciones_turno).
 * `confirmar` abarca también ofertas_turno porque debe ajustar
 * plazas_cubiertas de forma atómica.
 */
const AsignacionesModel = {
  /** Crea una postulación en estado 'pendiente' apuntada a un puesto concreto. */
  async crear(empresaId, ofertaId, puestoId, trabajadorId) {
    const [res] = await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado)
       VALUES (?, ?, ?, ?, 'pendiente')`,
      [empresaId, ofertaId, puestoId, trabajadorId]
    );
    return res.insertId;
  },

  async obtenerPorId(empresaId, id) {
    const [filas] = await pool.query(
      'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
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

  /** Asignaciones de una oferta, con nombre del trabajador (para el detalle). */
  async listarPorOferta(empresaId, ofertaId) {
    const [filas] = await pool.query(
      `SELECT a.*, t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
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
              p.tarifa_dia,
              t.external_ref AS trabajador_external_ref,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.tipo AS trabajador_tipo
       FROM asignaciones_turno a
       JOIN trabajadores t ON t.id = a.trabajador_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
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

  /**
   * Confirma una asignación pendiente y suma una plaza cubierta al PUESTO
   * (no a la oferta — la oferta ya no lleva ese contador desde mig 013).
   * Todo en una transacción con bloqueo de fila.
   * @returns {Promise<{ok:boolean, motivo?:string}>}
   */
  async confirmar(empresaId, id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[asig]] = await conn.query(
        'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [id, empresaId]
      );
      if (!asig) {
        await conn.rollback();
        return { ok: false, motivo: 'no_existe' };
      }
      if (asig.estado !== 'pendiente') {
        await conn.rollback();
        return { ok: false, motivo: 'estado' };
      }

      const [[oferta]] = await conn.query(
        'SELECT * FROM ofertas_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [asig.oferta_id, empresaId]
      );
      if (!oferta || !['abierta', 'publicada'].includes(oferta.estado)) {
        await conn.rollback();
        return { ok: false, motivo: 'oferta' };
      }

      const [[puesto]] = await conn.query(
        'SELECT * FROM oferta_puestos WHERE id = ? FOR UPDATE',
        [asig.puesto_id]
      );
      if (!puesto) {
        await conn.rollback();
        return { ok: false, motivo: 'puesto' };
      }
      if (puesto.plazas_cubiertas >= puesto.plazas) {
        await conn.rollback();
        return { ok: false, motivo: 'lleno' };
      }

      // Bloqueo de traslape: el trabajador no puede tener dos turnos confirmados simultáneos.
      const finNuevo = oferta.hora_fin_estimada ?? '23:59:59';
      const [[traslape]] = await conn.query(
        `SELECT a.id
         FROM asignaciones_turno a
         JOIN ofertas_turno o ON o.id = a.oferta_id
         WHERE a.trabajador_id = ?
           AND a.id != ?
           AND a.estado IN ('confirmado', 'en_progreso')
           AND o.fecha = ?
           AND o.hora_inicio < ?
           AND COALESCE(o.hora_fin_estimada, '23:59:59') > ?
         LIMIT 1`,
        [asig.trabajador_id, id, oferta.fecha, finNuevo, oferta.hora_inicio]
      );
      if (traslape) {
        await conn.rollback();
        return { ok: false, motivo: 'traslape' };
      }

      await conn.query(
        "UPDATE asignaciones_turno SET estado = 'confirmado' WHERE id = ?",
        [id]
      );
      await conn.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id = ?',
        [asig.puesto_id]
      );

      // Contrato diario atómico al confirmar. Tarifa la fija el PUESTO.
      await ContratosModel.crear(
        empresaId,
        {
          asignacionId: id,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: puesto.tarifa_dia,
        },
        conn
      );

      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Cancela una asignación confirmada (confirmado → cancelado).
   * Devuelve la plaza al puesto dentro de una transacción.
   * @returns {Promise<{ok:boolean, motivo?:string}>}
   */
  async cancelar(empresaId, id, gestorId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[asig]] = await conn.query(
        'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [id, empresaId]
      );
      if (!asig) {
        await conn.rollback();
        return { ok: false, motivo: 'no_existe' };
      }
      if (asig.estado !== 'confirmado') {
        await conn.rollback();
        return { ok: false, motivo: 'estado' };
      }

      await conn.query(
        "UPDATE asignaciones_turno SET estado = 'cancelado', cancelado_por = ?, cancelado_at = NOW() WHERE id = ?",
        [gestorId, id]
      );
      await conn.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = GREATEST(0, plazas_cubiertas - 1) WHERE id = ?',
        [asig.puesto_id]
      );

      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Rechaza una postulación pendiente (pendiente → cancelado).
   * No requiere transacción: plazas_cubiertas no fue incrementado aún.
   * @returns {Promise<{ok:boolean, motivo?:string}>}
   */
  async rechazar(empresaId, id, gestorId) {
    const [[asig]] = await pool.query(
      'SELECT estado FROM asignaciones_turno WHERE id = ? AND empresa_id = ? LIMIT 1',
      [id, empresaId]
    );
    if (!asig) return { ok: false, motivo: 'no_existe' };
    if (asig.estado !== 'pendiente') return { ok: false, motivo: 'estado' };

    await pool.query(
      "UPDATE asignaciones_turno SET estado = 'cancelado', rechazado_por = ?, rechazado_at = NOW() WHERE id = ? AND empresa_id = ?",
      [gestorId, id, empresaId]
    );
    return { ok: true };
  },

  /** Marca la llegada del trabajador con coordenadas GPS. */
  async registrarIngreso(empresaId, id, latitud, longitud) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET hora_ingreso_real = NOW(), latitud_ingreso = ?, longitud_ingreso = ?,
           estado = 'en_progreso'
       WHERE id = ? AND empresa_id = ? AND estado = 'confirmado'`,
      [latitud, longitud, id, empresaId]
    );
    // affectedRows = 0 means another concurrent request already marked ingreso
    if (res.affectedRows === 0) {
      const AppError = require('../../utils/AppError');
      throw new AppError('El ingreso ya fue registrado o el turno no está confirmado', 409);
    }
    return res.affectedRows;
  },

  /**
   * Marca la salida, guarda la firma y calcula horas y pago.
   * `pago_total` toma la tarifa del PUESTO al que postuló el trabajador
   * (no la oferta — desde la migración 013 la tarifa vive por puesto).
   */
  async registrarEgreso(empresaId, id, firmaB64) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno a
       JOIN oferta_puestos p ON p.id = a.puesto_id
       SET a.hora_egreso_real = NOW(),
           a.firma_digital = ?,
           a.estado = 'completado',
           a.horas_trabajadas = TIMESTAMPDIFF(MINUTE, a.hora_ingreso_real, NOW()) / 60,
           a.pago_total = p.tarifa_dia
       WHERE a.id = ? AND a.empresa_id = ?
         AND a.estado = 'en_progreso'
         AND a.hora_ingreso_real IS NOT NULL`,
      [firmaB64, id, empresaId]
    );
    // affectedRows = 0 means concurrent egreso, missing ingreso, or invalid state
    if (res.affectedRows === 0) {
      const AppError = require('../../utils/AppError');
      throw new AppError('El egreso ya fue registrado o el ingreso no está marcado', 409);
    }
    return res.affectedRows;
  },

  /** Listado para jefes/admin, con datos de oferta y trabajador. */
  async listar(empresaId, { fecha, ofertaId, trabajadorId, estado, limit, offset }) {
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
    const whereSql = where.join(' AND ');

    const [filas] = await pool.query(
      `SELECT a.*, o.titulo AS oferta_titulo, o.fecha AS oferta_fecha, o.hora_inicio,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN trabajadores t ON t.id = a.trabajador_id
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

  /**
   * Registra una calificación de la asignación y recomputa el ranking del
   * trabajador. Lanza ER_DUP_ENTRY si la asignación ya tenía calificación.
   * calificadoPor = null → calificación automática del sistema (ej. no_presentado).
   */
  async calificar(empresaId, asignacionId, { trabajadorId, calificacion, comentario, calificadoPor }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO calificaciones_turno
           (empresa_id, asignacion_id, trabajador_id, calificacion, comentario, calificado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, asignacionId, trabajadorId, calificacion, comentario ?? null, calificadoPor ?? null]
      );
      const resultado = await recalcularRanking(conn, empresaId, trabajadorId);
      await conn.commit();
      return resultado;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Marca una asignación como no_presentado, devuelve la plaza al puesto
   * e inserta automáticamente una calificación de 0 estrellas.
   * Todo atómico en una transacción.
   * @returns {Promise<{ok:boolean, motivo?:string, trabajador_id?:number}>}
   */
  async marcarNoPresentado(empresaId, id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[asig]] = await conn.query(
        'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [id, empresaId]
      );
      if (!asig) {
        await conn.rollback();
        return { ok: false, motivo: 'no_existe' };
      }
      if (!['confirmado', 'en_progreso'].includes(asig.estado)) {
        await conn.rollback();
        return { ok: false, motivo: 'estado' };
      }

      await conn.query(
        "UPDATE asignaciones_turno SET estado = 'no_presentado' WHERE id = ?",
        [id]
      );

      // Devolver la plaza al puesto (igual que cancelar).
      await conn.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = GREATEST(0, plazas_cubiertas - 1) WHERE id = ?',
        [asig.puesto_id]
      );

      // Insertar 0-star solo si la asignación aún no tiene calificación.
      const [[ya]] = await conn.query(
        'SELECT id FROM calificaciones_turno WHERE asignacion_id = ? LIMIT 1',
        [id]
      );
      if (!ya) {
        await conn.query(
          `INSERT INTO calificaciones_turno
             (empresa_id, asignacion_id, trabajador_id, calificacion, calificado_por)
           VALUES (?, ?, ?, 0, NULL)`,
          [empresaId, id, asig.trabajador_id]
        );
        await recalcularRanking(conn, empresaId, asig.trabajador_id);
      }

      await conn.commit();
      return { ok: true, trabajador_id: asig.trabajador_id, oferta_id: asig.oferta_id };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Turnos y postulaciones de un trabajador (vista "mis-turnos"). Incluye calificación. */
  async listarPorTrabajador(empresaId, trabajadorId) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos carg ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE a.empresa_id = ? AND a.trabajador_id = ?
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [empresaId, trabajadorId]
    );
    return filas;
  },

  /**
   * Mis-turnos para trabajador_turnos (empresa_id = null en JWT).
   * Localiza todos los trabajador_id del usuario vía trabajador_empresa
   * y devuelve sus asignaciones de todas las empresas vinculadas.
   */
  async listarPorUsuario(usuarioId) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              emp.nombre AS empresa_nombre,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN trabajador_empresa te ON te.trabajador_id = a.trabajador_id
       JOIN ofertas_turno o       ON o.id = a.oferta_id
       JOIN empresas emp          ON emp.id = a.empresa_id
       JOIN oferta_puestos p      ON p.id = a.puesto_id
       JOIN cargos carg           ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE te.usuario_id = ? AND te.estado = 'activo'
       ORDER BY o.fecha DESC, o.hora_inicio`,
      [usuarioId]
    );
    return filas;
  },

  /**
   * Asignación completa con datos de oferta, trabajador y calificación.
   * Usada por gestores al acceder al detalle de una asignación concreta.
   */
  /**
   * Liquidación de turnos: agrupa asignaciones completadas por trabajador.
   * Devuelve un array de trabajadores con sus turnos y totales a pagar.
   */
  async liquidacion(empresaId, { fechaInicio, fechaFin }) {
    const where = ['a.empresa_id = ?', "a.estado = 'completado'"];
    const params = [empresaId];

    if (fechaInicio) { where.push('o.fecha >= ?'); params.push(fechaInicio); }
    if (fechaFin)    { where.push('o.fecha <= ?'); params.push(fechaFin); }

    const [filas] = await pool.query(
      `SELECT
         a.id          AS asignacion_id,
         a.horas_trabajadas,
         a.pago_total,
         COALESCE(a.pago_extra, 0)   AS pago_extra,
         a.hora_ingreso_real,
         a.hora_egreso_real,
         o.titulo      AS oferta_titulo,
         o.fecha       AS oferta_fecha,
         o.hora_inicio,
         o.hora_fin_estimada,
         o.lugar,
         p.tarifa_dia,
         carg.nombre   AS cargo_nombre,
         cal.calificacion,
         t.id          AS trabajador_id,
         t.nombre, t.apellido,
         t.cargo       AS cargo_descripcion,
         t.ranking,
         t.total_calificaciones
       FROM asignaciones_turno a
       JOIN trabajadores t    ON t.id   = a.trabajador_id
       JOIN ofertas_turno o   ON o.id   = a.oferta_id
       JOIN oferta_puestos p  ON p.id   = a.puesto_id
       JOIN cargos carg       ON carg.id = p.cargo_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE ${where.join(' AND ')}
       ORDER BY t.apellido, t.nombre, o.fecha`,
      params
    );

    const workers = new Map();
    for (const row of filas) {
      if (!workers.has(row.trabajador_id)) {
        workers.set(row.trabajador_id, {
          trabajador_id:      row.trabajador_id,
          nombre:             row.nombre,
          apellido:           row.apellido,
          cargo:              row.cargo_descripcion,
          ranking:            row.ranking ? Number(row.ranking) : null,
          total_calificaciones: row.total_calificaciones,
          total_turnos:       0,
          total_horas:        0,
          pago_base:          0,
          pago_extra:         0,
          pago_total:         0,
          turnos:             [],
        });
      }
      const w = workers.get(row.trabajador_id);
      const extra  = Number(row.pago_extra ?? 0);
      const total  = Number(row.pago_total ?? 0);
      const horas  = Number(row.horas_trabajadas ?? 0);
      w.total_turnos++;
      w.total_horas  = parseFloat((w.total_horas + horas).toFixed(4));
      w.pago_extra   += extra;
      w.pago_base    += total - extra;
      w.pago_total   += total;
      w.turnos.push({
        asignacion_id:   row.asignacion_id,
        oferta_titulo:   row.oferta_titulo,
        oferta_fecha:    row.oferta_fecha,
        hora_inicio:     row.hora_inicio,
        hora_fin_estimada: row.hora_fin_estimada,
        lugar:           row.lugar,
        hora_ingreso_real: row.hora_ingreso_real,
        hora_egreso_real:  row.hora_egreso_real,
        horas_trabajadas:  horas,
        tarifa_dia:      Number(row.tarifa_dia),
        cargo_nombre:    row.cargo_nombre,
        pago_extra:      extra,
        pago_total:      total,
        calificacion:    row.calificacion,
      });
    }
    return Array.from(workers.values());
  },

  /**
   * Asignación directa: crea la asignación en estado 'confirmado' sin postulación previa.
   * Hace las mismas validaciones atómicas que `confirmar` (plazas, traslape, duplicados).
   * @returns {Promise<{ok:boolean, asignacionId?:number, motivo?:string}>}
   */
  async asignarDirecto(empresaId, ofertaId, puestoId, trabajadorId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[oferta]] = await conn.query(
        'SELECT * FROM ofertas_turno WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [ofertaId, empresaId]
      );
      if (!oferta || !['abierta', 'publicada'].includes(oferta.estado)) {
        await conn.rollback();
        return { ok: false, motivo: 'oferta' };
      }

      const [[puesto]] = await conn.query(
        'SELECT * FROM oferta_puestos WHERE id = ? AND oferta_id = ? FOR UPDATE',
        [puestoId, ofertaId]
      );
      if (!puesto) {
        await conn.rollback();
        return { ok: false, motivo: 'puesto' };
      }
      if (puesto.plazas_cubiertas >= puesto.plazas) {
        await conn.rollback();
        return { ok: false, motivo: 'lleno' };
      }

      const finNuevo = oferta.hora_fin_estimada ?? '23:59:59';
      const [[traslape]] = await conn.query(
        `SELECT a.id FROM asignaciones_turno a
         JOIN ofertas_turno o ON o.id = a.oferta_id
         WHERE a.trabajador_id = ?
           AND a.estado IN ('confirmado', 'en_progreso')
           AND o.fecha = ?
           AND o.hora_inicio < ?
           AND COALESCE(o.hora_fin_estimada, '23:59:59') > ?
         LIMIT 1`,
        [trabajadorId, oferta.fecha, finNuevo, oferta.hora_inicio]
      );
      if (traslape) {
        await conn.rollback();
        return { ok: false, motivo: 'traslape' };
      }

      const [[existente]] = await conn.query(
        `SELECT id FROM asignaciones_turno
         WHERE puesto_id = ? AND trabajador_id = ? AND estado NOT IN ('cancelado')
         LIMIT 1`,
        [puestoId, trabajadorId]
      );
      if (existente) {
        await conn.rollback();
        return { ok: false, motivo: 'duplicado' };
      }

      const [res] = await conn.query(
        `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado)
         VALUES (?, ?, ?, ?, 'confirmado')`,
        [empresaId, ofertaId, puestoId, trabajadorId]
      );
      const asignacionId = res.insertId;

      await conn.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id = ?',
        [puestoId]
      );

      await ContratosModel.crear(
        empresaId,
        {
          asignacionId,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: puesto.tarifa_dia,
        },
        conn
      );

      await conn.commit();
      return { ok: true, asignacionId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** Corrección manual de ingreso/egreso por un gestor (sin GPS ni firma). */
  async corregir(empresaId, id, { horaIngreso, horaEgreso, horasTrabajadas, estado }) {
    const [res] = await pool.query(
      `UPDATE asignaciones_turno
       SET hora_ingreso_real = ?, hora_egreso_real = ?,
           horas_trabajadas  = ?, estado = ?
       WHERE id = ? AND empresa_id = ?`,
      [horaIngreso ?? null, horaEgreso ?? null, horasTrabajadas ?? null, estado, id, empresaId]
    );
    return res.affectedRows;
  },

  async obtenerConDetalles(empresaId, id) {
    const [filas] = await pool.query(
      `SELECT a.*,
              o.titulo AS oferta_titulo, o.descripcion AS oferta_descripcion,
              o.externo_notas AS oferta_externo_notas,
              o.fecha AS oferta_fecha, o.hora_inicio, o.hora_fin_estimada,
              o.lugar, o.latitud, o.longitud,
              o.external_ref AS oferta_external_ref,
              p.tarifa_dia, p.cargo_id,
              carg.codigo AS cargo_codigo, carg.nombre AS cargo_nombre,
              carg.tipo_geofence,
              pm.id   AS punto_id,      pm.nombre AS punto_nombre,
              pm.latitud AS punto_latitud, pm.longitud AS punto_longitud,
              pm.radio_metros AS punto_radio,
              t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
              t.cargo AS trabajador_cargo, t.external_ref AS trabajador_external_ref,
              cal.calificacion, cal.comentario AS calificacion_comentario
       FROM asignaciones_turno a
       JOIN ofertas_turno o    ON o.id   = a.oferta_id
       JOIN oferta_puestos p   ON p.id   = a.puesto_id
       JOIN cargos carg        ON carg.id = p.cargo_id
       JOIN trabajadores t     ON t.id   = a.trabajador_id
       LEFT JOIN puntos_marcaje pm ON pm.id = carg.punto_marcaje_id
       LEFT JOIN calificaciones_turno cal ON cal.asignacion_id = a.id
       WHERE a.id = ?${empresaId != null ? ' AND a.empresa_id = ?' : ''} LIMIT 1`,
      empresaId != null ? [id, empresaId] : [id]
    );
    const row = filas[0];
    if (!row) return null;

    // Construye geofence_info según tipo_geofence del cargo
    const tipo = row.tipo_geofence ?? 'oferta';
    if (tipo === 'fijo' && row.punto_latitud != null) {
      row.geofence_info = {
        tipo: 'fijo',
        nombre: row.punto_nombre,
        latitud: Number(row.punto_latitud),
        longitud: Number(row.punto_longitud),
        radio_metros: row.punto_radio ?? 100,
      };
    } else if (tipo === 'libre') {
      row.geofence_info = { tipo: 'libre' };
    } else if (tipo === 'zonal') {
      row.geofence_info = { tipo: 'zonal' };
    } else {
      row.geofence_info = {
        tipo: 'oferta',
        nombre: row.lugar,
        latitud: row.latitud != null ? Number(row.latitud) : null,
        longitud: row.longitud != null ? Number(row.longitud) : null,
        radio_metros: 1000,
      };
    }

    return row;
  },
};

module.exports = AsignacionesModel;
