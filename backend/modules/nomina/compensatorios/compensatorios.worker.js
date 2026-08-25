'use strict';

const CompensatoriosModel = require('./compensatorios.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const { pool } = require('../../../config/database');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const logger = require('../../../utils/logger');

/**
 * Avisa a admin_empresa/jefe_nomina/nomina quiénes están de descanso
 * compensatorio hoy — una sola vez por compensatorio (notificado_gestor).
 */

const INTERVALO_MS = 15 * 60_000; // 15 min, misma cadencia que registros.worker

async function notificarCompensatoriosDeHoy() {
  const hoy = ahoraColombiaSQL().slice(0, 10);
  const pendientes = await CompensatoriosModel.listarHoyPendientesNotificar(hoy);
  if (pendientes.length === 0) return;

  const porEmpresa = new Map();
  for (const p of pendientes) {
    if (!porEmpresa.has(p.empresa_id)) porEmpresa.set(p.empresa_id, []);
    porEmpresa.get(p.empresa_id).push(p);
  }

  for (const [empresaId, filas] of porEmpresa) {
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1`,
      [empresaId]
    );
    if (gestores.length > 0) {
      const nombres = filas.map((f) => `${f.nombre} ${f.apellido}`);
      await NotificacionesService.notificarVarios(gestores.map((g) => g.id), {
        empresaId,
        tipo: 'nomina.compensatorios_hoy',
        titulo: filas.length === 1
          ? '1 trabajador de compensatorio hoy'
          : `${filas.length} trabajadores de compensatorio hoy`,
        mensaje: nombres.join(', '),
        data: { fecha: hoy, total: filas.length },
      });
    }
    await CompensatoriosModel.marcarNotificadosGestor(filas.map((f) => f.id));
  }
  logger.info(`[compensatorios-worker] resumen diario enviado (${pendientes.length} compensatorio(s), ${porEmpresa.size} empresa(s))`);
}

function iniciarWorker() {
  const timer = setInterval(() => {
    notificarCompensatoriosDeHoy().catch((err) => logger.error('[compensatorios-worker]', err.message));
  }, INTERVALO_MS);
  timer.unref();
  logger.info('[compensatorios-worker] iniciado (cada 15 min, avisa al gestor quién está de compensatorio hoy)');
  return timer;
}

module.exports = { iniciarWorker };
