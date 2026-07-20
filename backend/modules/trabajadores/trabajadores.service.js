'use strict';

const TrabajadoresModel = require('./trabajadores.model');
const AppError = require('../../utils/AppError');
const { pool } = require('../../config/database');
const { PLANES } = require('../../config/constants');

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

  async actualizarMarcacion(empresaId, id, body) {
    return TrabajadoresModel.actualizarMarcacion(empresaId, id, body);
  },

  async obtener(empresaId, id) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, id);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);
    return trabajador;
  },

  async crear(empresaId, datos) {
    const [[empresa]] = await pool.query(
      'SELECT plan FROM empresas WHERE id = ? AND activo = 1 LIMIT 1',
      [empresaId]
    );
    if (!empresa) throw new AppError('Empresa no encontrada', 404);

    const limite = PLANES[empresa.plan]?.max_trabajadores ?? null;
    if (limite !== null) {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) AS total FROM trabajadores WHERE empresa_id = ? AND activo = 1',
        [empresaId]
      );
      if (total >= limite) {
        throw new AppError(
          `Tu plan ${empresa.plan} permite máximo ${limite} trabajadores activos. Actualiza tu plan para agregar más.`,
          402
        );
      }
    }

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

  // ── Cargos certificados ──────────────────────────────────────────────────
  // trabajador_cargos cuelga de trabajador_empresa, no del trabajador
  // directamente — estos métodos resuelven ese vínculo dentro de la empresa
  // del gestor para poder gestionar cargos desde la ficha del trabajador.

  async listarCargos(empresaId, id) {
    await this.obtener(empresaId, id); // 404 si no existe / no es de esta empresa
    return TrabajadoresModel.listarCargos(id);
  },

  async _resolverVinculo(empresaId, id) {
    const TrabajadorEmpresaModel = require('../trabajador-empresa/trabajador-empresa.model');
    await this.obtener(empresaId, id); // 404 si no existe / no es de esta empresa
    const vinculo = await TrabajadorEmpresaModel.obtenerPorTrabajadorEmpresa(id, empresaId);
    if (!vinculo || vinculo.estado !== 'activo') {
      throw new AppError('Este trabajador no tiene un vínculo activo con tu empresa.', 409);
    }
    return vinculo;
  },

  async asignarCargo(empresaId, id, cargoId, asignadoPor) {
    const CargosModel = require('../cargos/cargos.model');
    const vinculo = await this._resolverVinculo(empresaId, id);
    if (await CargosModel.tieneAsignacion(vinculo.id, cargoId)) {
      throw new AppError('El trabajador ya tiene este cargo asignado', 409);
    }
    const cargo = await CargosModel.obtenerPorId(cargoId);
    if (!cargo) throw new AppError('Cargo no encontrado', 404);
    if (!cargo.activo) throw new AppError('El cargo está desactivado', 409);
    if (cargo.empresa_id !== null && cargo.empresa_id !== empresaId) {
      throw new AppError('Este cargo no pertenece a tu empresa', 403);
    }
    await CargosModel.asignar({ trabajadorEmpresaId: vinculo.id, cargoId, asignadoPor });
    return TrabajadoresModel.listarCargos(id);
  },

  async desasignarCargo(empresaId, id, cargoId) {
    const CargosModel = require('../cargos/cargos.model');
    const vinculo = await this._resolverVinculo(empresaId, id);
    await CargosModel.desasignar(vinculo.id, cargoId);
    return TrabajadoresModel.listarCargos(id);
  },

  // ── Disponibilidad ────────────────────────────────────────────────────────

  async resolverIdPorUsuario(empresaId, usuarioId) {
    const t = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
    if (!t) throw new AppError('Perfil de trabajador no encontrado', 404);
    return t.id;
  },

  async obtenerDisponibilidad(empresaId, trabajadorId) {
    return TrabajadoresModel.obtenerDisponibilidad(empresaId, trabajadorId);
  },

  async guardarDisponibilidad(empresaId, trabajadorId, slots) {
    if (!Array.isArray(slots)) throw new AppError('slots debe ser un array', 400);
    for (const s of slots) {
      if (s.dia_semana < 0 || s.dia_semana > 6) throw new AppError('dia_semana inválido (0-6)', 400);
    }
    await TrabajadoresModel.guardarDisponibilidad(empresaId, trabajadorId, slots);
  },
};

module.exports = TrabajadoresService;
