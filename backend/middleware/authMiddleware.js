'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { pool } = require('../config/database');
const { ROLES } = require('../config/constants');

/**
 * Verifica el access token JWT y expone el payload en `req.usuario`.
 * Espera el header `Authorization: Bearer <jwt>`.
 *
 * Para TRABAJADOR_TURNOS: `req.empresa_id` puede ser null (multi-empresa).
 * El middleware `resolverEmpresasActivas` resuelve la lista completa
 * de empresas activas para esos usuarios cuando sea necesario.
 */
function verificarToken(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token requerido', 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.usuario = payload;
    req.empresa_id = payload.empresa_id ?? null;
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401));
  }
}

/**
 * Restringe el acceso a una lista de roles.
 * Uso: router.post('/', verificarToken, verificarRol([ROLES.ADMIN_EMPRESA]), ...)
 * @param {string[]} roles  Roles autorizados.
 */
function verificarRol(roles) {
  const permitidos = Array.isArray(roles) ? roles : [roles];
  return (req, _res, next) => {
    if (!req.usuario) {
      return next(new AppError('No autenticado', 401));
    }
    if (!permitidos.includes(req.usuario.rol)) {
      return next(new AppError('Sin permisos para esta acción', 403));
    }
    next();
  };
}

/**
 * Resuelve el tenant (empresa) de la petición.
 * Prioriza el claim `empresa_id` del JWT; si no hay token, acepta el header
 * `X-Empresa-Slug` para endpoints públicos multi-tenant (ej. activar cuenta).
 */
function resolverEmpresa(req, _res, next) {
  if (req.usuario?.empresa_id) {
    req.empresa_id = req.usuario.empresa_id;
    return next();
  }
  const slug = req.headers['x-empresa-slug'];
  if (slug) {
    req.empresa_slug = String(slug);
    return next();
  }
  return next(new AppError('No se pudo determinar la empresa', 400));
}

/**
 * Para TRABAJADOR_TURNOS: resuelve la lista de empresas activas y la inyecta
 * en `req.empresasActivas` (array de IDs).
 * Para otros roles: no-op (sus endpoints usan `req.empresa_id` directamente).
 *
 * Usa una única query por request; el resultado no se cachea entre requests.
 */
async function resolverEmpresasActivas(req, _res, next) {
  if (req.usuario?.rol !== ROLES.TRABAJADOR_TURNOS) {
    return next();
  }
  try {
    const [filas] = await pool.query(
      `SELECT empresa_id FROM trabajador_empresa
       WHERE usuario_id = ? AND estado = 'activo'`,
      [req.usuario.sub]
    );
    req.empresasActivas = filas.map((f) => f.empresa_id);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verificarToken, verificarRol, resolverEmpresa, resolverEmpresasActivas };
