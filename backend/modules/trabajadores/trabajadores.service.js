'use strict';

const TrabajadoresModel = require('./trabajadores.model');
const AppError = require('../../utils/AppError');

/**
 * Lógica de negocio de trabajadores. Recibe siempre el empresaId del
 * usuario autenticado para garantizar el aislamiento entre tenants.
 */
const TrabajadoresService = {
  async listar(empresaId, { tipo, activo, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await TrabajadoresModel.listar(empresaId, {
      tipo,
      activo,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async obtener(empresaId, id) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, id);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);
    return trabajador;
  },

  async crear(empresaId, datos) {
    const id = await TrabajadoresModel.crear(empresaId, datos);
    return TrabajadoresModel.obtenerPorId(empresaId, id);
  },

  async actualizar(empresaId, id, datos) {
    await this.obtener(empresaId, id); // 404 si no existe / no es de esta empresa
    await TrabajadoresModel.actualizar(empresaId, id, datos);
    return TrabajadoresModel.obtenerPorId(empresaId, id);
  },

  /** El propio trabajador obtiene su perfil completo buscando por usuario_id. */
  async me(usuarioId) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    return trabajador;
  },

  /** El propio trabajador actualiza los campos de su perfil que le pertenecen. */
  async actualizarMe(usuarioId, datos) {
    await this.me(usuarioId); // 404 si no existe
    await TrabajadoresModel.actualizarPorUsuarioId(usuarioId, datos);
    return TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
  },

  /** Soft delete idempotente: si ya está inactivo no hace nada. */
  async eliminar(empresaId, id) {
    const trabajador = await this.obtener(empresaId, id);
    if (trabajador.activo) {
      await TrabajadoresModel.desactivar(empresaId, id);
    }
  },
};

module.exports = TrabajadoresService;
