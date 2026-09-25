'use strict';

const PeriodosTurnosModel = require('./periodos-turnos.model');
const EmpresasModel = require('../../empresas/empresas.model');
const AppError = require('../../../utils/AppError');
const logger = require('../../../utils/logger');

/**
 * Calcula el período siguiente basado en el tipo y la fecha de fin.
 * Usado para auto-crear períodos encadenados.
 */
function calcularSiguientePeriodo(tipo, fechaFin) {
  const siguiente = new Date(fechaFin);
  siguiente.setDate(siguiente.getDate() + 1); // Empezar al día siguiente

  const fechaInicio = new Date(siguiente);
  const fechaFinal = new Date(siguiente);

  switch (tipo) {
    case 'semanal':
      fechaFinal.setDate(fechaFinal.getDate() + 6);
      break;
    case 'quincenal':
      fechaFinal.setDate(fechaFinal.getDate() + 14);
      break;
    case 'mensual':
      fechaFinal.setMonth(fechaFinal.getMonth() + 1);
      fechaFinal.setDate(0); // Último día del mes
      break;
    case 'trimestral':
      fechaFinal.setMonth(fechaFinal.getMonth() + 3);
      fechaFinal.setDate(0);
      break;
    default:
      throw new Error(`Tipo de período inválido: ${tipo}`);
  }

  const toISODate = (d) => d.toISOString().split('T')[0];
  return { fechaInicio: toISODate(fechaInicio), fechaFinal: toISODate(fechaFinal) };
}

const PeriodosTurnosService = {
  /**
   * Auto-crear períodos de turnos para hoy (si no existen).
   * Se invoca cada vez que hay actividad (turnos completados, etc.).
   *
   * Crea hasta 2 períodos adelante para evitar gaps.
   */
  async autoCrear(empresaId) {
    const empresa = await EmpresasModel.obtenerPorId(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);

    const hoy = new Date().toISOString().split('T')[0];
    const tipo = empresa.tipo_liquidacion || 'quincenal'; // Default quincenal

    try {
      // 1. Crear período regular (personal de turnos)
      await this.crearPeriodsParaTipo(empresaId, hoy, tipo, 0);

      // 2. Crear período de extras de nómina (trimestral, siempre)
      // Los turnos extras de trabajador_nomina son trimestrales, independiente del tipo de la empresa
      await this.crearPeriodsParaTipo(empresaId, hoy, 'trimestral', 1);
    } catch (err) {
      logger.warn(`[periodos-turnos] error auto-creando (empresa ${empresaId}):`, err.message);
      // No lanzar — es best-effort
    }
  },

  /**
   * Crear períodos hasta 2 adelante del día dado.
   */
  async crearPeriodsParaTipo(empresaId, fechaHoy, tipo, esExtraNomina) {
    const toISODate = (d) => d.toISOString().split('T')[0];
    let fechaActual = new Date(fechaHoy);

    // Crear hasta 2 períodos desde hoy
    for (let i = 0; i < 2; i++) {
      const inicio = toISODate(fechaActual);
      const fin = new Date(fechaActual);

      switch (tipo) {
        case 'semanal':
          fin.setDate(fin.getDate() + 6);
          break;
        case 'quincenal':
          fin.setDate(fin.getDate() + 14);
          break;
        case 'mensual':
          fin.setMonth(fin.getMonth() + 1);
          fin.setDate(0);
          break;
        case 'trimestral':
          fin.setMonth(fin.getMonth() + 3);
          fin.setDate(0);
          break;
      }

      const fechaFin = toISODate(fin);

      // Crear o recuperar el período
      await PeriodosTurnosModel.crearOActualizar(empresaId, {
        fechaInicio: inicio,
        fechaFin: fechaFin,
        tipo,
        esExtraNomina,
      });

      // Siguiente iteración comienza al día después del fin
      fechaActual = new Date(fin);
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
  },

  /**
   * Listar períodos de turnos.
   */
  async listar(empresaId, filtros, usuario) {
    const offset = (filtros.page - 1) * filtros.limit;
    const { data, total } = await PeriodosTurnosModel.listar(empresaId, {
      ...filtros,
      offset,
    });

    return {
      data,
      pagination: { page: filtros.page, limit: filtros.limit, total },
    };
  },

  /**
   * Obtener un período específico.
   */
  async obtener(empresaId, id) {
    const periodo = await PeriodosTurnosModel.obtenerPorId(empresaId, id);
    if (!periodo) throw new AppError('Período de turnos no encontrado', 404);
    return periodo;
  },

  /**
   * Cerrar un período e asignar asignaciones a él.
   */
  async cerrar(empresaId, id, usuarioId) {
    const periodo = await PeriodosTurnosModel.obtenerPorId(empresaId, id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado !== 'abierto') {
      throw new AppError(`Período ya está ${periodo.estado}`, 422);
    }

    // Cerrar
    const cerrado = await PeriodosTurnosModel.cerrar(empresaId, id, usuarioId);

    // Asignar todas las asignaciones de turno completadas en este rango a este período
    try {
      await PeriodosTurnosModel.asignarAsignacionesAlPeriodo(empresaId, id, {
        esExtraNomina: periodo.es_extra_nomina,
      });
    } catch (err) {
      logger.warn(`[periodos-turnos] error asignando asignaciones (período ${id}):`, err.message);
    }

    return cerrado;
  },

  /**
   * Liquidar un período (cambiar estado a liquidado).
   * En el futuro, esto también podría disparar el pago real en logiq360 o Wompi.
   */
  async liquidar(empresaId, id) {
    const periodo = await PeriodosTurnosModel.obtenerPorId(empresaId, id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado !== 'cerrado') {
      throw new AppError(`Período debe estar cerrado antes de liquidar (está ${periodo.estado})`, 422);
    }

    return PeriodosTurnosModel.liquidar(empresaId, id);
  },
};

module.exports = PeriodosTurnosService;
