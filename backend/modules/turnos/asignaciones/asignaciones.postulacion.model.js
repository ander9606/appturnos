'use strict';

const { pool } = require('../../../config/database');
const ContratosModel = require('../../contratos/contratos.model');
const { recalcularRanking } = require('../../../utils/rankingUtils');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');

/**
 * Ciclo de vida de la postulación/asignación: crear, confirmar, cancelar,
 * rechazar, asignación directa, no-presentado y calificación. Es la parte
 * más transaccional de AsignacionesModel (ver asignaciones.model.js).
 */
module.exports = {
  /** Crea una postulación en estado 'pendiente' apuntada a un puesto concreto. */
  async crear(empresaId, ofertaId, puestoId, trabajadorId) {
    const [res] = await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado)
       VALUES (?, ?, ?, ?, 'pendiente')`,
      [empresaId, ofertaId, puestoId, trabajadorId]
    );
    return res.insertId;
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
      if (oferta.fecha < ahoraColombiaSQL().slice(0, 10)) {
        await conn.rollback();
        return { ok: false, motivo: 'vencida' };
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
      const [[empresaContrato]] = await conn.query(
        'SELECT tipo_contrato FROM empresas WHERE id = ?', [empresaId]
      );
      await ContratosModel.crear(
        empresaId,
        {
          asignacionId: id,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: puesto.tarifa_dia,
          tipoContrato: (empresaContrato?.tipo_contrato || 'laboral').toUpperCase(),
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

      const [[empresaContrato]] = await conn.query(
        'SELECT tipo_contrato FROM empresas WHERE id = ?', [empresaId]
      );
      await ContratosModel.crear(
        empresaId,
        {
          asignacionId,
          anio: String(oferta.fecha).slice(0, 4),
          fecha: oferta.fecha,
          descripcionLabor: oferta.descripcion || oferta.titulo,
          valorDia: puesto.tarifa_dia,
          tipoContrato: (empresaContrato?.tipo_contrato || 'laboral').toUpperCase(),
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
};
