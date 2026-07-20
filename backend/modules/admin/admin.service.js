'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const AdminModel = require('./admin.model');
const AuthModel = require('../auth/auth.model');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { enviarEmail } = require('../../utils/mailer');
const { ROLES } = require('../../config/constants');

const DEFAULT_PAGE_SIZE = 20;
const BCRYPT_ROUNDS = 11;

/** Contraseña temporal aleatoria de alta entropía (9 bytes ≈ 12 caracteres URL-safe). */
function generarPasswordTemporal() {
  return crypto.randomBytes(9).toString('base64url');
}

function credencialesHtml({ nombre, empresa, email, password }) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;color:#1e293b">
      <h2 style="margin:0 0 8px">Zaturno</h2>
      <p style="color:#64748b;margin:0 0 24px">Gestión de turnos y nómina</p>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Se creó tu cuenta de administrador para <strong>${empresa}</strong> en Zaturno. Estas son tus credenciales de acceso:</p>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="color:#64748b;padding:4px 12px 4px 0">Email</td><td><strong>${email}</strong></td></tr>
        <tr><td style="color:#64748b;padding:4px 12px 4px 0">Contraseña</td><td><strong>${password}</strong></td></tr>
      </table>
      <p style="color:#64748b;font-size:13px">
        Por seguridad, cambia esta contraseña apenas ingreses.
      </p>
    </div>`;
}

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

  async crearEmpresa({ nombre, slug, nit, ciudad, plan, descripcion, admin_nombre, admin_email }) {
    if (!nombre?.trim()) throw new AppError('El nombre es obligatorio', 400);
    if (!slug?.trim()) throw new AppError('El slug es obligatorio', 400);
    if ((admin_nombre && !admin_email) || (!admin_nombre && admin_email)) {
      throw new AppError('admin_nombre y admin_email deben enviarse juntos', 400);
    }

    // Slug: solo letras minúsculas, números y guiones
    const slugLimpio = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugLimpio)) {
      throw new AppError('El slug solo puede contener letras minúsculas, números y guiones', 400);
    }

    const existe = await AdminModel.existeSlug(slugLimpio);
    if (existe) throw new AppError('El slug ya está en uso por otra empresa', 409);

    const emailAdmin = admin_email?.trim().toLowerCase() || null;
    if (emailAdmin) {
      const existente = await AuthModel.buscarUsuarioPorEmail(emailAdmin);
      if (existente) throw new AppError('El email del administrador ya está registrado', 409);
    }

    const id = await AdminModel.crearEmpresa({
      nombre: nombre.trim(),
      slug: slugLimpio,
      nit: nit?.trim() || null,
      ciudad: ciudad?.trim() || null,
      plan: plan || 'basico',
      descripcion: descripcion?.trim() || null,
    });

    let credencialesEnviadas = false;
    if (emailAdmin) {
      const passwordTemporal = generarPasswordTemporal();
      const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);
      await AuthModel.crearGestor({
        empresaId: id,
        nombre: admin_nombre.trim(),
        apellido: null,
        email: emailAdmin,
        passwordHash,
        rol: ROLES.ADMIN_EMPRESA,
      });
      try {
        await enviarEmail({
          to: emailAdmin,
          subject: 'Tu cuenta de administrador en Zaturno',
          html: credencialesHtml({ nombre: admin_nombre.trim(), empresa: nombre.trim(), email: emailAdmin, password: passwordTemporal }),
        });
        credencialesEnviadas = true;
      } catch (err) {
        // El usuario ya quedó creado — no reventar la creación de la empresa por un fallo de SMTP.
        logger.error(`No se pudo enviar credenciales a ${emailAdmin} (empresa ${id}): ${err.message}`);
      }
    }

    const empresa = await AdminModel.obtenerEmpresa(id);
    return { ...empresa, admin_creado: Boolean(emailAdmin), credenciales_email_enviado: credencialesEnviadas };
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

  async generarLinkPago(id, { plan, meses = 1 }) {
    const empresa = await AdminService.obtenerEmpresa(id);
    const WompiService = require('../webhooks/wompi.service');
    return WompiService.generarLinkPago({
      empresaId: id,
      nombreEmpresa: empresa.nombre,
      plan,
      meses,
    });
  },

  async gestionarSuscripcion(id, { plan, vigente_hasta, origen = 'manual' }) {
    const empresa = await AdminService.obtenerEmpresa(id); // throws 404 if not found
    const planesValidos = ['basico', 'profesional', 'empresarial'];
    if (plan && !planesValidos.includes(plan)) throw new AppError('plan inválido', 400);
    // vigente_hasta null explícito = indefinido (super_admin override)
    const vha = vigente_hasta === null ? null : vigente_hasta ? new Date(vigente_hasta) : undefined;
    if (vha instanceof Date && isNaN(vha)) throw new AppError('vigente_hasta no es una fecha válida', 400);
    await AdminModel.actualizarSuscripcion(id, {
      plan: plan ?? empresa.plan,
      vigente_hasta: vha instanceof Date ? vha.toISOString().slice(0, 10) : vha,
      origen,
    });
    return AdminModel.obtenerEmpresa(id);
  },

  // ── Wompi eventos ─────────────────────────────────────────────────────────

  async listarWompiEventos({ estado, page = 1, limit = 30 } = {}) {
    const offset = (page - 1) * limit;
    const { data, total } = await AdminModel.listarWompiEventos({ estado, limit, offset });
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  async reintentarWompiEvento(id) {
    const WompiService = require('../webhooks/wompi.service');
    return WompiService.reintentarEvento(id);
  },

  // ── Reportes ──────────────────────────────────────────────────────────────

  async obtenerReportesGlobales() {
    return AdminModel.obtenerReportesGlobales();
  },
};

module.exports = AdminService;
