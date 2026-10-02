'use strict';

const AppError = require('./AppError');
const { ROLES } = require('../config/constants');

/**
 * Regla única de "empresa suspendida" al iniciar/renovar sesión.
 * - Cualquier rol con empresa fija suspendida → 403.
 * - trabajador_turnos es multi-empresa (su empresa_id es solo la de origen):
 *   no se bloquea; se devuelve sin empresa fija para que las rutas lo resuelvan
 *   por sus empresas activas (resolverEmpresasActivas) y nunca opere sobre la
 *   suspendida.
 * `u` necesita { empresa_id, empresa_activo, rol }.
 */
function aplicarEmpresaSuspendida(u) {
  if (!u.empresa_id || u.empresa_activo !== 0) return u;
  if (u.rol === ROLES.TRABAJADOR_TURNOS) return { ...u, empresa_id: null };
  throw new AppError('Empresa suspendida. Contacta al administrador del sistema.', 403);
}

module.exports = { aplicarEmpresaSuspendida };
