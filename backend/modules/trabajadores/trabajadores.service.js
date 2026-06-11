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

  async buscarPorCedula(cedula) {
    if (!cedula) throw new AppError('cedula requerida', 400);
    const trabajador = await TrabajadoresModel.buscarPorCedula(cedula);
    if (!trabajador) throw new AppError('No se encontró un trabajador con esa cédula', 404);
    return trabajador;
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

  /** El propio trabajador obtiene su perfil completo (incluye experiencias, diplomas y cargos). */
  async me(usuarioId) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    const [experiencias, diplomas, cargos] = await Promise.all([
      TrabajadoresModel.listarExperiencias(trabajador.id),
      TrabajadoresModel.listarDiplomas(trabajador.id),
      TrabajadoresModel.listarCargos(trabajador.id),
    ]);
    return { ...trabajador, experiencias, diplomas, cargos };
  },

  /** El propio trabajador actualiza los campos escalares de su perfil. */
  async actualizarMe(usuarioId, datos) {
    await this.me(usuarioId); // 404 si no existe
    await TrabajadoresModel.actualizarPorUsuarioId(usuarioId, datos);
    return this.me(usuarioId);
  },

  /** El propio trabajador nomina actualiza su flag acepta_extras. */
  async actualizarExtras(usuarioId, acepta) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    await TrabajadoresModel.actualizarExtras(usuarioId, acepta);
    return TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
  },

  async crearExperiencia(usuarioId, datos) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    return TrabajadoresModel.crearExperiencia(trabajador.id, datos);
  },

  async eliminarExperiencia(usuarioId, expId) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    const rows = await TrabajadoresModel.eliminarExperiencia(trabajador.id, expId);
    if (!rows) throw new AppError('Experiencia no encontrada', 404);
  },

  async crearDiploma(usuarioId, datos) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    return TrabajadoresModel.crearDiploma(trabajador.id, datos);
  },

  async eliminarDiploma(usuarioId, dipId) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuarioId);
    if (!trabajador) throw new AppError('Perfil de trabajador no encontrado', 404);
    const rows = await TrabajadoresModel.eliminarDiploma(trabajador.id, dipId);
    if (!rows) throw new AppError('Diploma no encontrado', 404);
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
