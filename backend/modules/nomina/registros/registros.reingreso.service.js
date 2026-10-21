'use strict';

const RegistrosModel = require('./registros.model');
const SolicitudesReingresoModel = require('./solicitudes-reingreso.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const NotificacionesModel = require('../../notificaciones/notificaciones.model');
const AppError = require('../../../utils/AppError');
const { resolverTrabajadorPropio, hoyISO } = require('./registros.helpers');

/**
 * Segundo ingreso al día: el trabajador lo solicita y un gestor lo aprueba o rechaza.
 * Parte de RegistrosService (ver registros.service.js, que reúne los tres sub-services).
 */
async function _notificarDecisionReingreso(empresaId, solicitudId, tipo, titulo, mensaje) {
  const sol = await SolicitudesReingresoModel.obtenerConUsuario(solicitudId);
  if (sol?.usuario_id) {
    await NotificacionesService.notificar({
      empresaId, usuarioId: sol.usuario_id, tipo, titulo, mensaje,
      data: { solicitud_id: solicitudId },
    });
  }
}

const RegistrosReingresoService = {
  /** Trabajador solicita un segundo ingreso al día; queda pendiente de aprobación. */
  async solicitarReingreso(empresaId, usuario, { motivo } = {}) {
    const trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);

    const registro = await RegistrosModel.obtenerPorFecha(empresaId, trabajadorId, hoyISO());
    if (!registro?.hora_salida) {
      throw new AppError('Solo puedes solicitar reingreso después de marcar la salida', 409);
    }

    const activa = await SolicitudesReingresoModel.obtenerActivaPorRegistro(empresaId, registro.id);
    if (activa) {
      throw new AppError('Ya tienes una solicitud de reingreso pendiente o aprobada', 409);
    }

    const id = await SolicitudesReingresoModel.crear(empresaId, registro.id, trabajadorId, motivo);

    // Notificar a gestores de nómina.
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    const gestoresIds = await NotificacionesModel.idsGestoresNomina(empresaId);
    if (gestoresIds.length > 0) {
      await NotificacionesService.notificarVarios(gestoresIds, {
        empresaId,
        tipo: 'reingreso.solicitado',
        titulo: 'Solicitud de reingreso',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} solicita reingreso para hoy.`,
        data: { solicitud_id: id, registro_id: registro.id },
      }).catch(() => {});
    }

    return { id, registro_id: registro.id };
  },

  async listarReingresosPendientes(empresaId) {
    return SolicitudesReingresoModel.listarPendientes(empresaId);
  },

  async aprobarReingreso(empresaId, gestorId, solicitudId) {
    if (!await SolicitudesReingresoModel.aprobar(empresaId, solicitudId, gestorId))
      throw new AppError('Solicitud no encontrada o ya fue procesada', 404);
    await _notificarDecisionReingreso(empresaId, solicitudId,
      'reingreso.aprobado', 'Reingreso aprobado',
      'Tu solicitud de reingreso fue aprobada. Ya puedes marcar tu entrada.');
  },

  async rechazarReingreso(empresaId, gestorId, solicitudId) {
    if (!await SolicitudesReingresoModel.rechazar(empresaId, solicitudId, gestorId))
      throw new AppError('Solicitud no encontrada o ya fue procesada', 404);
    await _notificarDecisionReingreso(empresaId, solicitudId,
      'reingreso.rechazado', 'Reingreso no autorizado',
      'Tu solicitud de reingreso fue rechazada por el gestor.');
  },
};

module.exports = RegistrosReingresoService;
