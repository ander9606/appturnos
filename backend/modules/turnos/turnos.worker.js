'use strict';

const OfertasModel = require('./ofertas/ofertas.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const logger = require('../../utils/logger');

const INTERVALO_MS = 30 * 60_000; // 30 min
const HORAS_ANTES  = 24;

async function verificarPersonalIncompleto() {
  const ofertas = await OfertasModel.listarProximasConPersonalIncompleto(HORAS_ANTES);
  for (const oferta of ofertas) {
    const faltantes = oferta.total_plazas - oferta.cubiertas;
    await NotificacionesService.notificarVarios(oferta.gestor_ids, {
      empresaId: oferta.empresa_id,
      tipo:      'oferta.personal_incompleto',
      titulo:    'Personal incompleto en turno',
      mensaje:   `"${oferta.titulo}" (${oferta.fecha} ${oferta.hora_inicio.slice(0, 5)}) — faltan ${faltantes} plaza${faltantes > 1 ? 's' : ''}.`,
      data:      { oferta_id: oferta.id },
    });
    await OfertasModel.marcarAlertaEnviada(oferta.id);
    logger.info(`[turnos-worker] alerta personal_incompleto → oferta ${oferta.id} (faltan ${faltantes})`);
  }
}

function iniciarWorker() {
  const timer = setInterval(() => {
    verificarPersonalIncompleto().catch((err) =>
      logger.error('[turnos-worker]', err.message)
    );
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[turnos-worker] iniciado (cada 30 min, ventana 24 h)');
  return timer;
}

module.exports = { iniciarWorker };