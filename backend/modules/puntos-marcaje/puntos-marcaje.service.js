'use strict';

const PuntosMarcajeModel = require('./puntos-marcaje.model');
const AppError = require('../../utils/AppError');

const PuntosMarcajeService = {
  async listar(empresaId) {
    return PuntosMarcajeModel.listar(empresaId);
  },

  async crear(empresaId, datos) {
    const id = await PuntosMarcajeModel.crear({ empresaId, ...datos });
    return PuntosMarcajeModel.obtenerPorId(empresaId, id);
  },

  async actualizar(empresaId, id, cambios) {
    const punto = await PuntosMarcajeModel.obtenerPorId(empresaId, id);
    if (!punto) throw new AppError('Punto de marcaje no encontrado', 404);
    await PuntosMarcajeModel.actualizar(empresaId, id, cambios);
    return PuntosMarcajeModel.obtenerPorId(empresaId, id);
  },

  async eliminar(empresaId, id) {
    const punto = await PuntosMarcajeModel.obtenerPorId(empresaId, id);
    if (!punto) throw new AppError('Punto de marcaje no encontrado', 404);
    const usos = await PuntosMarcajeModel.contarUsos(id);
    if (usos > 0) throw new AppError(
      `No se puede eliminar: ${usos} cargo(s) o trabajador(es) usan este punto. Reasígnalos primero.`,
      409
    );
    await PuntosMarcajeModel.eliminar(empresaId, id);
  },
};

module.exports = PuntosMarcajeService;
