'use strict';

const EmpresasModel   = require('../empresas/empresas.model');
const { enviarEmail } = require('../../utils/mailer');
const { plantillaCorreo, esc } = require('../../utils/plantillaCorreo');
const WompiService    = require('../webhooks/wompi.service');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const logger          = require('../../utils/logger');

const INTERVALO_MS = 24 * 60 * 60 * 1000; // cada 24h

/**
 * Busca empresas cuya suscripción vence en 7, 3 o 0 días
 * y les envía un email con el link de pago de Wompi.
 * logiq360 está excluido (suscripcion_origen = 'logiq360').
 */
async function procesarRenovaciones() {
  const empresas = await EmpresasModel.listarConRenovacionPendiente();

  if (empresas.length === 0) return;

  logger.info(`[suscripcion-worker] ${empresas.length} empresa(s) con renovación pendiente`);

  for (const emp of empresas) {
    const dias = emp.dias_restantes;

    // El email de renovación solo aplica antes/el día del vencimiento — mismos
    // 3 checkpoints de siempre. -3 (ya vencida) es nuevo y solo es para super_admin.
    if (dias >= 0) {
      try {
        const link = await WompiService.generarLinkPago({
          empresaId:     emp.id,
          nombreEmpresa: emp.nombre,
          meses:         1,
        });

        const asunto =
          dias === 0 ? `⚠️ Tu suscripción de Zaturno vence hoy`
          : `Tu suscripción de Zaturno vence en ${dias} día${dias > 1 ? 's' : ''}`;

        await enviarEmail({
          to:      emp.email,
          subject: asunto,
          html:    emailHtml({ empresa: emp.nombre, admin: emp.admin_nombre, dias, url: link.url, monto: link.monto_cop }),
        });

        logger.info(`[suscripcion-worker] email enviado a ${emp.email} (empresa ${emp.id}, ${dias}d restantes)`);
      } catch (err) {
        logger.error(`[suscripcion-worker] error empresa ${emp.id}: ${err.message}`);
      }
    }

    const mensaje = dias >= 0
      ? `${emp.nombre}: suscripción vence en ${dias} día${dias !== 1 ? 's' : ''}.`
      : `${emp.nombre}: suscripción vencida hace ${-dias} días (ya pasó el período de gracia).`;
    await NotificacionesService.notificarSuperAdmins({
      empresaId: emp.id,
      tipo: 'admin.suscripcion_vencimiento',
      titulo: dias >= 0 ? 'Suscripción por vencer' : 'Suscripción vencida',
      mensaje,
      data: { empresa_id: emp.id },
    }).catch((err) => logger.error(`[suscripcion-worker] no se pudo notificar a super_admin (empresa ${emp.id}):`, err.message));
  }
}

function emailHtml({ empresa, admin, dias, url, monto }) {
  const urgencia = dias === 0 ? 'vence <strong>hoy</strong>'
    : `vence en <strong>${dias} día${dias > 1 ? 's' : ''}</strong>`;

  const montoFmt = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(monto);

  return plantillaCorreo({
    titulo: 'Tu suscripción está por vencer',
    cuerpo:
      `<p style="margin:0 0 12px">Hola <strong>${esc(admin)}</strong>,</p>` +
      `<p style="margin:0 0 12px">La suscripción de <strong>${esc(empresa)}</strong> ${urgencia}.</p>` +
      `<p style="margin:0">Para continuar usando Zaturno sin interrupciones, renueva tu plan:</p>`,
    boton: { texto: `Renovar suscripción — ${montoFmt}`, url },
    nota: 'Este link es de un solo uso y expira en 7 días. Si ya realizaste el pago, ignora este mensaje.',
  });
}

function iniciarWorker() {
  // Ejecutar al arrancar (con 1 min de delay para que el pool esté listo)
  // y luego cada 24h.
  setTimeout(() => {
    procesarRenovaciones().catch((err) =>
      logger.error('[suscripcion-worker] error inicial:', err.message)
    );
  }, 60_000);

  const timer = setInterval(() => {
    procesarRenovaciones().catch((err) =>
      logger.error('[suscripcion-worker]', err.message)
    );
  }, INTERVALO_MS);

  timer.unref();
  logger.info('[suscripcion-worker] iniciado (cada 24h)');
  return timer;
}

module.exports = { iniciarWorker };