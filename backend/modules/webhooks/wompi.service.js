'use strict';

const crypto = require('crypto');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const { PLANES } = require('../../config/constants');

const WOMPI_API = 'https://production.wompi.co/v1';

/**
 * Verificación de firma Wompi.
 * Wompi concatena los valores de signature.properties + timestamp + WOMPI_EVENTS_SECRET,
 * hashea con SHA256 y lo compara con signature.checksum.
 * Ref: https://docs.wompi.co/docs/en/widget-checkout-web#eventos
 */
function verificarFirma(payload) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    logger.warn('WOMPI_EVENTS_SECRET no configurado — verificación de firma omitida');
    return true; // ponytail: permite pruebas locales sin creds; en prod la variable debe estar
  }
  const { signature } = payload;
  if (!signature?.properties || !signature?.checksum) return false;

  const values = signature.properties.map((path) =>
    path.split('.').reduce((o, k) => o?.[k], payload)
  );
  const toHash = values.join('') + payload.timestamp + secret;
  const expected = crypto.createHash('sha256').update(toHash).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.checksum, 'hex')
  );
}

/**
 * Parsea la referencia AT-{empresaId}-{plan}-{meses}.
 * Devuelve null si el formato no coincide (pago de otro sistema).
 */
function parsearReferencia(ref) {
  const m = /^AT-(\d+)-(basico|profesional|empresarial)-(\d+)$/.exec(ref || '');
  if (!m) return null;
  return { empresaId: Number(m[1]), plan: m[2], meses: Number(m[3]) };
}

const WompiService = {
  async procesarEvento(payload) {
    if (!verificarFirma(payload)) {
      logger.warn('Wompi: firma invalida — evento descartado');
      return { ok: false, razon: 'firma_invalida' };
    }

    const { event, data } = payload;
    if (event !== 'transaction.updated') return { ok: true, razon: 'evento_ignorado' };

    const tx = data?.transaction;
    if (tx?.status !== 'APPROVED') return { ok: true, razon: 'estado_no_aprobado' };

    const parsed = parsearReferencia(tx.reference);
    if (!parsed) return { ok: true, razon: 'referencia_no_reconocida' };

    const { empresaId, plan, meses } = parsed;

    // Extiende desde la fecha vigente actual (o desde hoy si ya vencio)
    await pool.query(
      `UPDATE empresas
          SET plan                      = ?,
              suscripcion_vigente_hasta = DATE_ADD(
                GREATEST(COALESCE(suscripcion_vigente_hasta, CURDATE()), CURDATE()),
                INTERVAL ? MONTH
              ),
              suscripcion_origen        = 'wompi'
        WHERE id = ? AND activo = 1`,
      [plan, meses, empresaId]
    );

    logger.info(`Wompi: suscripcion empresa ${empresaId} extendida ${meses} mes(es) -> ${plan}`);
    return { ok: true, empresaId, plan, meses };
  },

  /**
   * Genera un link de pago de Wompi para suscribir una empresa.
   * Referencia: AT-{empresaId}-{plan}-{meses}
   * El link expira en 7 días y es de un solo uso.
   */
  async generarLinkPago({ empresaId, nombreEmpresa, plan, meses = 1 }) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey) throw new Error('WOMPI_PRIVATE_KEY no configurada');

    const planCfg = PLANES[plan];
    if (!planCfg) throw new Error(`Plan inválido: ${plan}`);

    const amountCents = planCfg.precio_mes_cop * meses * 100;
    const reference = `AT-${empresaId}-${plan}-${meses}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + '.000Z';
    const redirectUrl = process.env.WOMPI_REDIRECT_URL || 'https://appturnos.com';

    const resp = await fetch(`${WOMPI_API}/payment_links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `App Turnos — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        description: `Suscripción ${meses} mes(es) para ${nombreEmpresa}`,
        single_use: true,
        collect_shipping: false,
        amount_in_cents: amountCents,
        currency: 'COP',
        redirect_url: redirectUrl,
        reference,
        expires_at: expiresAt,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      logger.error('Wompi generarLinkPago error:', json);
      throw new Error(json?.error?.reason || `Wompi error HTTP ${resp.status}`);
    }

    return {
      url: json.data?.permalink,
      referencia: reference,
      monto_cop: planCfg.precio_mes_cop * meses,
      expira_at: expiresAt,
    };
  },
};

module.exports = WompiService;
