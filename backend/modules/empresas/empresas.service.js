'use strict';

const EmpresasModel = require('./empresas.model');
const IntegracionModel = require('../integracion/integracion.model');
const AppError = require('../../utils/AppError');

/** Fuente de verdad de "es logiq360": conexión activa con api_key, no una etiqueta manual. */
async function tieneIntegracionLogiq360Activa(empresaId) {
  return IntegracionModel.estaConectado(empresaId);
}

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

  async generarLinkPago(empresaId, { meses = 1 }) {
    const empresa = await EmpresasModel.obtenerParaPago(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    if (await tieneIntegracionLogiq360Activa(empresaId)) {
      throw new AppError('Esta empresa gestiona su suscripción a través de logiq360', 409);
    }
    const WompiService = require('../webhooks/wompi.service');
    return WompiService.generarLinkPago({ empresaId, nombreEmpresa: empresa.nombre, meses });
  },

  async estadoSuscripcion(empresaId) {
    const e = await EmpresasModel.obtenerEstadoSuscripcion(empresaId);
    if (!e) throw new AppError('Empresa no encontrada', 404);
    const esLogiq360 = await tieneIntegracionLogiq360Activa(empresaId);
    const hoy = new Date();
    const vence = e.suscripcion_vigente_hasta ? new Date(e.suscripcion_vigente_hasta) : null;
    const limite = vence ? new Date(vence) : null;
    if (limite) limite.setDate(limite.getDate() + 3);
    const activa = esLogiq360 || !vence || limite >= hoy;
    const diasRestantes = vence ? Math.ceil((vence - hoy) / 86400000) : null;
    return {
      activa,
      plan: e.plan,
      vigente_hasta: e.suscripcion_vigente_hasta,
      dias_restantes: diasRestantes,
      origen: esLogiq360 ? 'logiq360' : 'directo',
      logiq360_conectado: esLogiq360,
    };
  },
};

module.exports = EmpresasService;
