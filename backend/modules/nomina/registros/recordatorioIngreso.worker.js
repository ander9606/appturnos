'use strict';

const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const logger = require('../../../utils/logger');

/**
 * Recuerda a un trabajador de nómina con horario fijo (hora_entrada_esperada)
 * que su turno está por empezar, si a esa hora todavía no marcó ingreso —
 * una sola vez por día (recordatorios_ingreso_enviados).
 */

const INTERVALO_MS = 15 * 60_000; // 15 min, misma cadencia que el resto de workers de nómina
const VENTANA_MIN = 15; // avisa dentro de los 15 min previos a la hora esperada

function minutosDesdeMedianoche(hhmmss) {
  const [h, m] = String(hhmmss).split(':').map(Number);
  return h * 60 + m;
}

/**
 * true si "ahora" cae dentro de los VENTANA_MIN minutos previos a horaEsperada.
 * `% 1440` maneja el caso de un turno que empieza pasada la medianoche.
 */
function enVentana(horaEsperada, ahoraHHMMSS) {
  const faltan = ((minutosDesdeMedianoche(horaEsperada) - minutosDesdeMedianoche(ahoraHHMMSS)) + 1440) % 1440;
  return faltan > 0 && faltan <= VENTANA_MIN;
}

async function recordarInicioDeTurno() {
  const ahoraSQL = ahoraColombiaSQL();
  const hoy = ahoraSQL.slice(0, 10);
  const horaActual = ahoraSQL.slice(11, 19);

  const candidatos = await TrabajadoresModel.listarCandidatosRecordatorioIngreso(hoy);

  for (const t of candidatos) {
    if (!enVentana(t.hora_entrada_esperada, horaActual)) continue;

    await NotificacionesService.notificar({
      empresaId: t.empresa_id,
      usuarioId: t.usuario_id,
      tipo: 'nomina.recordatorio_ingreso',
      titulo: 'Tu turno está por empezar',
      mensaje: `No olvides marcar tu ingreso — empiezas a las ${String(t.hora_entrada_esperada).slice(0, 5)}.`,
      data: { trabajador_id: t.id },
    });
    await TrabajadoresModel.marcarRecordatorioIngresoEnviado(t.id, hoy);
    logger.info(`[recordatorio-ingreso-worker] recordatorio enviado → trabajador ${t.id}`);
  }
}

function iniciarWorker() {
  const timer = setInterval(() => {
    recordarInicioDeTurno().catch((err) => logger.error('[recordatorio-ingreso-worker]', err.message));
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[recordatorio-ingreso-worker] iniciado (cada 15 min, recuerda el inicio de turno a nómina con horario fijo)');
  return timer;
}

module.exports = { iniciarWorker, enVentana };
