'use strict';

const { pool } = require('../../config/database');

/**
 * Consultas de agregación para los reportes. Todas se acotan por empresa_id
 * y por un rango de fechas [desde, hasta].
 */
const ReportesModel = {
  /** Asistencia a turnos por trabajador (cuenta por estado de la asignación). */
  async asistenciaTurnos(empresaId, desde, hasta) {
    const [filas] = await pool.query(
      `SELECT t.id AS trabajador_id, t.nombre, t.apellido,
              COUNT(*) AS total_turnos,
              SUM(a.estado = 'completado') AS completados,
              SUM(a.estado = 'no_presentado') AS no_presentados,
              SUM(a.estado = 'en_progreso') AS en_progreso,
              SUM(a.estado = 'confirmado') AS confirmados
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.empresa_id = ? AND o.fecha BETWEEN ? AND ?
       GROUP BY t.id, t.nombre, t.apellido
       ORDER BY t.apellido, t.nombre`,
      [empresaId, desde, hasta]
    );
    return filas;
  },

  /** Días registrados en nómina por trabajador. */
  async asistenciaNomina(empresaId, desde, hasta) {
    const [filas] = await pool.query(
      `SELECT t.id AS trabajador_id, t.nombre, t.apellido,
              COUNT(*) AS dias_registrados
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE r.empresa_id = ? AND r.fecha BETWEEN ? AND ?
       GROUP BY t.id, t.nombre, t.apellido
       ORDER BY t.apellido, t.nombre`,
      [empresaId, desde, hasta]
    );
    return filas;
  },

  /** Costo de los turnos completados en el rango (suma de pago_total). */
  async costoTurnos(empresaId, desde, hasta) {
    const [[fila]] = await pool.query(
      `SELECT COUNT(*) AS turnos_completados, COALESCE(SUM(a.pago_total), 0) AS costo
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE a.empresa_id = ? AND a.estado = 'completado'
         AND o.fecha BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );
    return fila;
  },

  /** Horas de nómina acumuladas por trabajador en el rango. */
  async horasNominaPorTrabajador(empresaId, desde, hasta) {
    const [filas] = await pool.query(
      `SELECT r.trabajador_id, t.nombre, t.apellido, t.salario_base, t.tarifa_hora,
              SUM(r.horas_ordinarias) AS horas_ordinarias,
              SUM(r.horas_extra_diurnas) AS horas_extra_diurnas,
              SUM(r.horas_extra_nocturnas) AS horas_extra_nocturnas,
              SUM(r.horas_nocturnas) AS horas_nocturnas,
              SUM(r.horas_festivo) AS horas_festivo
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE r.empresa_id = ? AND r.fecha BETWEEN ? AND ?
       GROUP BY r.trabajador_id, t.nombre, t.apellido, t.salario_base, t.tarifa_hora`,
      [empresaId, desde, hasta]
    );
    return filas;
  },

  /** Totales de turnos del rango: asistencia y costo (el bono ya viene dentro de pago_total). */
  async resumenTurnos(empresaId, desde, hasta) {
    const [[fila]] = await pool.query(
      `SELECT COUNT(*) AS convocados,
              COALESCE(SUM(a.estado = 'completado'), 0) AS completados,
              COALESCE(SUM(a.estado = 'no_presentado'), 0) AS no_presentados,
              COALESCE(SUM(CASE WHEN a.estado = 'completado' THEN a.pago_total END), 0) AS costo,
              COALESCE(SUM(CASE WHEN a.estado = 'completado' THEN a.bono_monto END), 0) AS bonos
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE a.empresa_id = ? AND o.fecha BETWEEN ? AND ?
         AND a.estado IN ('completado', 'no_presentado', 'confirmado', 'en_progreso')`,
      [empresaId, desde, hasta]
    );
    return fila;
  },

  /** Plazas pedidas vs cubiertas en las ofertas del rango (sin las canceladas ni borradores). */
  async coberturaTurnos(empresaId, desde, hasta) {
    const [[fila]] = await pool.query(
      `SELECT COALESCE(SUM(p.plazas), 0) AS plazas, COALESCE(SUM(p.plazas_cubiertas), 0) AS cubiertas
       FROM oferta_puestos p
       JOIN ofertas_turno o ON o.id = p.oferta_id
       WHERE o.empresa_id = ? AND o.fecha BETWEEN ? AND ?
         AND o.estado NOT IN ('borrador', 'cancelada')`,
      [empresaId, desde, hasta]
    );
    return fila;
  },

  /** Horas totales (todos los baldes, que son disjuntos) y días con horas por trabajador de nómina. */
  async horasTotalesPorTrabajador(empresaId, desde, hasta) {
    const total = 'r.horas_ordinarias + r.horas_extra_diurnas + r.horas_extra_nocturnas + r.horas_nocturnas + r.horas_festivo';
    const [filas] = await pool.query(
      `SELECT r.trabajador_id, t.nombre, t.apellido,
              SUM(${total}) AS horas,
              SUM((${total}) > 0) AS dias
       FROM registros_diarios r
       JOIN trabajadores t ON t.id = r.trabajador_id
       WHERE r.empresa_id = ? AND r.fecha BETWEEN ? AND ?
       GROUP BY r.trabajador_id, t.nombre, t.apellido`,
      [empresaId, desde, hasta]
    );
    return filas;
  },

  /**
   * Turnos completados y pago por cargo y trabajador. Mira también `ventanaDias` antes de `desde`
   * para encontrar a quienes ya hicieron ese cargo pero no tuvieron turnos en el rango (turnos = 0).
   */
  async turnosPorCargoYTrabajador(empresaId, desde, hasta, ventanaDias) {
    const [filas] = await pool.query(
      `SELECT p.cargo_id, c.nombre AS cargo, a.trabajador_id, t.nombre, t.apellido,
              COALESCE(SUM(o.fecha >= ?), 0) AS turnos,
              COALESCE(SUM(CASE WHEN o.fecha >= ? THEN a.pago_total END), 0) AS pago
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       JOIN oferta_puestos p ON p.id = a.puesto_id
       JOIN cargos c ON c.id = p.cargo_id
       JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE a.empresa_id = ? AND a.estado = 'completado' AND t.activo = 1
         AND o.fecha BETWEEN DATE_SUB(?, INTERVAL ? DAY) AND ?
       GROUP BY p.cargo_id, c.nombre, a.trabajador_id, t.nombre, t.apellido`,
      [desde, desde, empresaId, desde, ventanaDias, hasta]
    );
    return filas;
  },

  async turnosDeTrabajador(empresaId, trabajadorId, desde, hasta) {
    const [filas] = await pool.query(
      `SELECT a.id, a.estado, a.horas_trabajadas, a.pago_total,
              a.hora_ingreso_real, a.hora_egreso_real,
              o.titulo AS oferta_titulo, o.fecha, o.hora_inicio, o.lugar
       FROM asignaciones_turno a
       JOIN ofertas_turno o ON o.id = a.oferta_id
       WHERE a.empresa_id = ? AND a.trabajador_id = ? AND o.fecha BETWEEN ? AND ?
       ORDER BY o.fecha DESC`,
      [empresaId, trabajadorId, desde, hasta]
    );
    return filas;
  },

  async registrosDeTrabajador(empresaId, trabajadorId, desde, hasta) {
    const [filas] = await pool.query(
      `SELECT id, periodo_id, fecha, hora_entrada, hora_salida, horas_ordinarias,
              horas_extra_diurnas, horas_extra_nocturnas, horas_nocturnas,
              horas_festivo, es_festivo, novedad
       FROM registros_diarios
       WHERE empresa_id = ? AND trabajador_id = ? AND fecha BETWEEN ? AND ?
       ORDER BY fecha DESC`,
      [empresaId, trabajadorId, desde, hasta]
    );
    return filas;
  },
};

module.exports = ReportesModel;
