'use strict';

const EmpresasModel = require('./empresas.model');
const AppError = require('../../utils/AppError');

const EmpresasService = {
  /**
   * Directorio público de empresas que aceptan postulaciones.
   * Disponible para cualquier usuario autenticado con rol TRABAJADOR_TURNOS.
   */
  async directorio({ busqueda, ciudad, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await EmpresasModel.listarDirectorio({
      busqueda: busqueda || null,
      ciudad: ciudad || null,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  /** Detalle público de una empresa (para decidir si solicitar vinculación). */
  async detalle(empresaId) {
    const empresa = await EmpresasModel.obtenerDetalle(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },
};

module.exports = EmpresasService;
