'use strict';

const ContratosModel = require('./contratos.model');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

/**
 * Un trabajador solo puede acceder a su propio contrato; admin y
 * jefe_turnos acceden a cualquiera de su empresa.
 */
function verificarAcceso(contrato, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    contrato.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a este contrato', 403);
  }
}

const ContratosService = {
  async obtener(empresaId, id, usuario) {
    const contrato = await ContratosModel.obtenerPorId(empresaId, id);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  async firmar(empresaId, id, usuario, firmaB64) {
    const contrato = await ContratosModel.obtenerPorId(empresaId, id);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    if (contrato.trabajador_usuario_id !== usuario.sub) {
      throw new AppError('Solo el trabajador del contrato puede firmarlo', 403);
    }
    if (contrato.firmado_trabajador) {
      throw new AppError('El contrato ya está firmado', 409);
    }
    await ContratosModel.firmar(empresaId, id, firmaB64);
    return ContratosModel.obtenerPorId(empresaId, id);
  },
};

module.exports = ContratosService;
