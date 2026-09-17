'use strict';

const OfertasModel = require('./ofertas/ofertas.model');
const AsignacionesService = require('./asignaciones/asignaciones.service');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const { ahoraColombiaSQL } = require('../../utils/fechaColombia');
const logger = require('../../utils/logger');

const INTERVALO_MS = 30 * 60_000; // 30 min
const HORAS_ANTES  = 24;

async function cerrarOfertasVencidas() {
  const hoy = ahoraColombiaSQL().slice(0, 10);
  const cerradas = await OfertasModel.cerrarVencidas(hoy);
  if (cerradas > 0) {
    logger.info(`[turnos-worker] ${cerradas} oferta(s) vencida(s) cerrada(s) automáticamente`);
  }
}

/**
 * Resuelve postulaciones 'confirmado'/'en_progreso' colgadas en ofertas
 * vencidas hace 2+ días — mismo cierre que dispara un gestor a mano
 * ("Cerrar jornada"), reusado acá para que un turno no se quede mostrando
 * "Aceptado" + "Cancelar" para siempre solo porque nadie lo cerró. Corre
 * antes de cerrarOfertasVencidas() para que, una vez resueltas, la oferta
 * también quede 'cerrada' en el mismo ciclo.
 */
async function resolverAsignacionesVencidas() {
  const hoy = ahoraColombiaSQL().slice(0, 10);
  const ofertas = await OfertasModel.listarVencidasConPendientes(hoy);
  for (const { id, empresa_id } of ofertas) {
    try {
      const { cerradas, noPresentados } = await AsignacionesService.cerrarMasivo(empresa_id, id);
      logger.info(`[turnos-worker] oferta ${id} vencida resuelta automáticamente (${cerradas} completada(s), ${noPresentados} no presentado(s))`);
    } catch (err) {
      logger.error(`[turnos-worker] no se pudo resolver oferta vencida ${id}:`, err.message);
    }
  }
}

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

function resolverYCerrarVencidas() {
  // Resolver primero: una vez que las asignaciones colgadas quedan en
  // completado/no_presentado, cerrarOfertasVencidas() ya puede cerrar la
  // oferta en el mismo ciclo (su NOT EXISTS deja de bloquearla).
  return resolverAsignacionesVencidas()
    .then(cerrarOfertasVencidas)
    .catch((err) => logger.error('[turnos-worker]', err.message));
}

function iniciarWorker() {
  // setInterval no dispara de inmediato — sin esto, ofertas vencidas quedarían
  // mostrando "abierta" hasta 30 min después de cada reinicio/deploy.
  resolverYCerrarVencidas();

  const timer = setInterval(() => {
    verificarPersonalIncompleto().catch((err) =>
      logger.error('[turnos-worker]', err.message)
    );
    resolverYCerrarVencidas();
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[turnos-worker] iniciado (cada 30 min, ventana 24 h)');
  return timer;
}

module.exports = { iniciarWorker, resolverAsignacionesVencidas };