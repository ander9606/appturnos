'use strict';

const AdminModel = require('./admin.model');
const AppError = require('../../utils/AppError');

const DEFAULT_PAGE_SIZE = 20;

const AdminService = {
  // ── Empresas ──────────────────────────────────────────────────────────────

  async listarEmpresas({ busqueda, activo, plan, page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
    const offset = (page - 1) * limit;
    const { data, total } = await AdminModel.listarEmpresas({
      busqueda: busqueda?.trim() || undefined,
      activo,
      plan,
      limit,
      offset,
    });
    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  async obtenerEmpresa(id) {
    const empresa = await AdminModel.obtenerEmpresa(id);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },

  async crearEmpresa({ nombre, slug, nit, ciudad, plan, descripcion }) {
    if (!nombre?.trim()) throw new AppError('El nombre es obligatorio', 400);
    if (!slug?.trim()) throw new AppError('El slug es obligatorio', 400);

    // Slug: solo letras minúsculas, números y guiones
    const slugLimpio = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugLimpio)) {
      throw new AppError('El slug solo puede contener letras minúsculas, números y guiones', 400);
    }

    const existe = await AdminModel.existeSlug(slugLimpio);
    if (existe) throw new AppError('El slug ya está en uso por otra empresa', 409);

    const id = await AdminModel.crearEmpresa({
      nombre: nombre.trim(),
      slug: slugLimpio,
      nit: nit?.trim() || null,
      ciudad: ciudad?.trim() || null,
      plan: plan || 'basico',
      descripcion: descripcion?.trim() || null,
    });

    return AdminModel.obtenerEmpresa(id);
  },

  async actualizarEmpresa(id, datos) {
    await AdminService.obtenerEmpresa(id); // throws 404 if not found

    const campos = {};
    if (datos.nombre !== undefined) campos.nombre = datos.nombre.trim();
    if (datos.nit !== undefined) campos.nit = datos.nit?.trim() || null;
    if (datos.ciudad !== undefined) campos.ciudad = datos.ciudad?.trim() || null;
    if (datos.plan !== undefined) campos.plan = datos.plan;
    if (datos.acepta_postulaciones !== undefined)
      campos.acepta_postulaciones = datos.acepta_postulaciones ? 1 : 0;
    if (datos.descripcion !== undefined) campos.descripcion = datos.descripcion?.trim() || null;
    if (datos.logo_url !== undefined) campos.logo_url = datos.logo_url?.trim() || null;

    await AdminModel.actualizarEmpresa(id, campos);
    return AdminModel.obtenerEmpresa(id);
  },

  async cambiarEstadoEmpresa(id, activo) {
    await AdminService.obtenerEmpresa(id); // throws 404 if not found
    await AdminModel.cambiarEstado(id, activo);
    return AdminModel.obtenerEmpresa(id);
  },

  // ── Reportes ──────────────────────────────────────────────────────────────

  async obtenerReportesGlobales() {
    return AdminModel.obtenerReportesGlobales();
  },
};

module.exports = AdminService;
