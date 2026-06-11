'use strict';

const EmpresasModel = require('./empresas.model');
const AppError = require('../../utils/AppError');

const EmpresasService = {
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

  async detalle(empresaId) {
    const empresa = await EmpresasModel.obtenerDetalle(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },

  async miEmpresa(empresaId) {
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },

  async actualizarMiEmpresa(empresaId, datos) {
    await EmpresasModel.actualizarPorAdmin(empresaId, datos);
    return EmpresasModel.obtenerParaAdmin(empresaId);
  },
};

module.exports = EmpresasService;
