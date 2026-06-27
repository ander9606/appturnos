'use strict';

const { pool }        = require('../../config/database');
const { enviarEmail } = require('../../utils/mailer');
const WompiService    = require('../webhooks/wompi.service');
const logger          = require('../../utils/logger');

const INTERVALO_MS = 24 * 60 * 60 * 1000; // cada 24h

/**
 * Busca empresas cuya suscripción vence en 7, 3 o 0 días
 * y les envía un email con el link de pago de Wompi.
 * logiq360 está excluido (suscripcion_origen = 'logiq360').
 */
async function procesarRenovaciones() {
  const [empresas] = await pool.query(
    `SELECT e.id, e.nombre, e.plan, e.suscripcion_vigente_hasta,
            DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) AS dias_restantes,
            u.email, u.nombre AS admin_nombre
       FROM empresas e
       JOIN usuarios u ON u.empresa_id = e.id
                      AND u.rol = 'admin_empresa'
                      AND u.activo = 1
      WHERE e.activo = 1
        AND e.suscripcion_origen != 'logiq360'
        AND e.suscripcion_vigente_hasta IS NOT NULL
        AND DATEDIFF(e.suscripcion_vigente_hasta, CURDATE()) IN (7, 3, 0)
      LIMIT 100`
  );

  if (empresas.length === 0) return;

  logger.info(`[suscripcion-worker] ${empresas.length} empresa(s) con renovación pendiente`);

  for (const emp of empresas) {
    try {
      const link = await WompiService.generarLinkPago({
        empresaId:     emp.id,
        nombreEmpresa: emp.nombre,
        plan:          emp.plan,
        meses:         1,
      });

      const dias = emp.dias_restantes;
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
}

function emailHtml({ empresa, admin, dias, url, monto }) {
  const urgencia = dias === 0 ? 'vence <strong>hoy</strong>'
    : `vence en <strong>${dias} día${dias > 1 ? 's' : ''}</strong>`;

  const montoFmt = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(monto);

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;color:#1e293b">
      <h2 style="margin:0 0 8px">Zaturno</h2>
      <p style="color:#64748b;margin:0 0 24px">Gestión de turnos y nómina</p>
      <p>Hola <strong>${admin}</strong>,</p>
      <p>La suscripción de <strong>${empresa}</strong> ${urgencia}.</p>
      <p>Para continuar usando Zaturno sin interrupciones, renueva tu plan:</p>
      <a href="${url}"
         style="display:inline-block;margin:16px 0;padding:14px 28px;background:#2563eb;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Renovar suscripción — ${montoFmt}
      </a>
      <p style="color:#64748b;font-size:13px">
        Este link es de un solo uso y expira en 7 días.<br>
        Si ya realizaste el pago, ignora este mensaje.
      </p>
    </div>`;
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