'use strict';

const PeriodosModel = require('./periodos.model');
const AppError = require('../../../utils/AppError');

/**
 * Lógica de períodos de nómina. Máquina de estados:
 *   abierto → cerrado → liquidado
 */
const PeriodosService = {
  async listar(empresaId, { estado, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await PeriodosModel.listar(empresaId, { estado, limit, offset });
    return { data, pagination: { page, limit, total } };
  },

  async obtener(empresaId, id) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    return periodo;
  },

  async crear(empresaId, datos) {
    if (datos.fecha_fin < datos.fecha_inicio) {
      throw new AppError('fecha_fin no puede ser anterior a fecha_inicio', 422);
    }
    const id = await PeriodosModel.crear(empresaId, datos);
    return PeriodosModel.obtenerPorId(empresaId, id);
  },

  async cerrar(empresaId, id, usuarioId) {
    const periodo = await this.obtener(empresaId, id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('Solo se puede cerrar un período abierto', 409);
    }
    // cerrarConSnapshot es atómico: cambia estado + congela valor_hora
    // en un solo commit, evitando que modificaciones de sueldo posteriores
    // afecten la liquidación de este período.
    await PeriodosModel.cerrarConSnapshot(empresaId, id, usuarioId);
    return PeriodosModel.obtenerPorId(empresaId, id);
  },

  async liquidar(empresaId, id) {
    const periodo = await this.obtener(empresaId, id);
    if (periodo.estado !== 'cerrado') {
      throw new AppError('Solo se puede liquidar un período cerrado', 409);
    }
    await PeriodosModel.liquidar(empresaId, id);
    return PeriodosModel.obtenerPorId(empresaId, id);
  },
};

module.exports = PeriodosService;
