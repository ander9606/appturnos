'use strict';

const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');

/**
 * Helpers privados compartidos entre los submódulos de OfertasService (no
 * forman parte de la interfaz pública) — usados tanto por consultas como
 * por postulación.
 */

/** Resuelve el trabajador vinculado al usuario autenticado en una empresa concreta. */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo en esta empresa', 403);
  }
  return trabajador;
}

async function validarAceptaExtras(usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_NOMINA) return;
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuario.sub);
  if (!trabajador || !trabajador.acepta_extras) {
    throw new AppError('No tienes activada la opción de turnos extra', 403);
  }
}

module.exports = { resolverTrabajador, validarAceptaExtras };
