'use strict';

const RegistrosModel = require('./registros.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const { pool } = require('../../../config/database');
const { calcularHoras } = require('../../../utils/laboralUtils');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const logger = require('../../../utils/logger');

/**
 * Detecta cuándo un trabajador de nómina, todavía en jornada activa, empieza
 * a acumular horas extra — y avisa una sola vez (alerta_extra_enviada).
 */

const INTERVALO_MS = 15 * 60_000; // 15 min

function getLunesDeSemana(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=dom…6=sab
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

function ahoraHHMMSS() {
  return ahoraColombiaSQL().slice(11, 19);
}

async function verificarHorasExtra() {
  const activos = await RegistrosModel.listarActivosSinAlertaExtra();

  for (const r of activos) {
    const lunes = getLunesDeSemana(r.fecha);
    const { ordinarias: ordinariasAcum } = await RegistrosModel.sumarOrdinariasEnSemana(
      r.empresa_id, r.trabajador_id, lunes, r.fecha
    );
    const ordinariasBase = ordinariasAcum +
      (r.sesiones > 1 ? Number(r.horas_ordinarias) + Number(r.horas_nocturnas) : 0);

    const horas = calcularHoras({
      horaEntrada: r.hora_entrada,
      horaSalida: ahoraHHMMSS(),
      fecha: r.fecha,
      horasOrdinariasAcumuladas: ordinariasBase,
    });

    const enExtra = (horas.horas_extra_diurnas + horas.horas_extra_nocturnas) > 0;
    if (!enExtra) continue;

    const [gestores] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1`,
      [r.empresa_id]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(gestores.map((g) => g.id), {
        empresaId: r.empresa_id,
        tipo: 'nomina.horas_extra_iniciadas',
        titulo: 'Horas extra en curso',
        mensaje: `${r.nombre} ${r.apellido} empezó a trabajar horas extra hoy.`,
        data: { registro_id: r.id, trabajador_id: r.trabajador_id },
      });
    }
    await RegistrosModel.marcarAlertaExtraEnviada(r.id);
    logger.info(`[registros-worker] horas_extra_iniciadas → registro ${r.id} (trabajador ${r.trabajador_id})`);
  }
}

function iniciarWorker() {
  const timer = setInterval(() => {
    verificarHorasExtra().catch((err) => logger.error('[registros-worker]', err.message));
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[registros-worker] iniciado (cada 15 min, detecta inicio de horas extra en jornadas activas)');
  return timer;
}

module.exports = { iniciarWorker };
