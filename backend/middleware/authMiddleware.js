'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

/**
 * Verifica el access token JWT y expone el payload en `req.usuario`.
 * Espera el header `Authorization: Bearer <jwt>`.
 */
function verificarToken(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token requerido', 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.usuario = payload;
    req.empresa_id = payload.empresa_id;
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

module.exports = { verificarToken, verificarRol, resolverEmpresa };
