'use strict';

const ContratosModel = require('./contratos.model');
const IntegracionService = require('../integracion/integracion.service');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

function verificarAcceso(contrato, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    contrato.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a este contrato', 403);
  }
}

const ContratosService = {
  async listarMisContratos(empresaId, usuario) {
    const trabajadorId = await TrabajadoresModel.resolverIdPorUsuario(empresaId, usuario.sub);
    if (!trabajadorId) throw new AppError('Trabajador no encontrado', 404);
    return ContratosModel.listarPorTrabajador(empresaId, trabajadorId);
  },

  async obtenerPorAsignacion(empresaId, asignacionId, usuario) {
    const contrato = await ContratosModel.obtenerPorAsignacion(empresaId, asignacionId);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

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
    await IntegracionService.emitir(empresaId, 'contrato.completado', {
      contrato_id: id,
      asignacion_id: contrato.asignacion_id,
      numero_contrato: contrato.numero_contrato,
    });
    return ContratosModel.obtenerPorId(empresaId, id);
  },
};

module.exports = ContratosService;
