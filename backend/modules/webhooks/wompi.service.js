'use strict';

const crypto = require('crypto');
const { pool } = require('../../config/database');
const logger   = require('../../utils/logger');
const { SUSCRIPCION_ESTANDAR_COP } = require('../../config/constants');
const NotificacionesService = require('../notificaciones/notificaciones.service');

const ESTADOS_RECHAZO = ['DECLINED', 'VOIDED', 'ERROR'];

const WOMPI_API = 'https://production.wompi.co/v1';

function verificarFirma(payload) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    logger.error('WOMPI_EVENTS_SECRET no configurado — evento de pago rechazado (fail-closed)');
    return false;
  }
  const { signature } = payload;
  if (!signature?.properties || !signature?.checksum) return false;
  const values = signature.properties.map((path) =>
    path.split('.').reduce((o, k) => o?.[k], payload)
  );
  const toHash   = values.join('') + payload.timestamp + secret;
  const expected = crypto.createHash('sha256').update(toHash).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature.checksum, 'hex'));
  } catch {
    return false;
  }
}

function parsearReferencia(ref) {
  const m = /^AT-(\d+)-(basico|profesional|empresarial)-(\d+)$/.exec(ref || '');
  if (!m) return null;
  return { empresaId: Number(m[1]), plan: m[2], meses: Number(m[3]) };
}

/** Activa la suscripción y marca el evento como procesado. Lanza si el UPDATE falla. */
async function activarSuscripcion(eventoId, { empresaId, plan, meses }) {
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
  await pool.query(
    `UPDATE wompi_eventos
        SET estado = 'procesado', procesado_at = NOW(), intentos = intentos + 1
      WHERE id = ?`,
    [eventoId]
  );
  logger.info(`Wompi: empresa ${empresaId} +${meses}m -> ${plan}`);
  return { ok: true, empresaId, plan, meses };
}

/** Marca el evento como error y loguea. */
async function marcarError(eventoId, err) {
  await pool.query(
    `UPDATE wompi_eventos SET estado = 'error', intentos = intentos + 1, error_detalle = ? WHERE id = ?`,
    [err.message, eventoId]
  );
  logger.error(`Wompi: error evento ${eventoId}: ${err.message}`);
}

/** Avisa a los admin_empresa de la empresa que un intento de pago fue rechazado. Best-effort. */
async function notificarPagoRechazado({ empresaId, plan, meses }, wompiStatus) {
  try {
    const [admins] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' AND activo = 1`,
      [empresaId]
    );
    if (admins.length === 0) return;
    await NotificacionesService.notificarVarios(admins.map((a) => a.id), {
      empresaId,
      tipo: 'suscripcion.pago_rechazado',
      titulo: 'Pago rechazado',
      mensaje: `El pago de la suscripción (plan ${plan}, ${meses} mes${meses !== 1 ? 'es' : ''}) fue rechazado por Wompi. Genera un nuevo link de pago para renovar.`,
      data: { plan, meses, wompi_status: wompiStatus },
    });
  } catch (err) {
    logger.error(`Wompi: no se pudo notificar pago rechazado (empresa ${empresaId}):`, err.message);
  }
}

const WompiService = {
  /**
   * Procesa un evento entrante de Wompi.
   * 1. Verifica firma
   * 2. Persiste el evento (idempotente via UNIQUE transaction_id)
   * 3. Activa suscripción si aplica
   * 4. Registra error en DB si el UPDATE falla (el worker reintenta)
   */
  async procesarEvento(payload) {
    if (!verificarFirma(payload)) {
      logger.warn('Wompi: firma invalida — evento descartado');
      return { ok: false, razon: 'firma_invalida' };
    }

    const tx            = payload.data?.transaction;
    const transactionId = tx?.id;
    if (!transactionId) return { ok: true, razon: 'sin_transaction_id' };

    const esActualizacion = payload.event === 'transaction.updated';
    // Parseamos la referencia para cualquier estado, no solo APPROVED —
    // así un rechazo también queda vinculado a la empresa que intentó pagar.
    const parsed = esActualizacion ? parsearReferencia(tx.reference) : null;

    // Persistir primero — si ya existe, ignorar (idempotencia)
    const [ins] = await pool.query(
      `INSERT IGNORE INTO wompi_eventos
         (transaction_id, referencia, empresa_id, plan, meses, estado, payload)
       VALUES (?, ?, ?, ?, ?, 'recibido', ?)`,
      [transactionId, tx.reference ?? null, parsed?.empresaId ?? null,
       parsed?.plan ?? null, parsed?.meses ?? null, JSON.stringify(payload)]
    );

    if (ins.affectedRows === 0) return { ok: true, razon: 'duplicado' };
    const eventoId = ins.insertId;

    if (esActualizacion && tx.status === 'APPROVED' && parsed) {
      try {
        return await activarSuscripcion(eventoId, parsed);
      } catch (err) {
        await marcarError(eventoId, err);
        return { ok: false, razon: 'error_db' };
      }
    }

    if (esActualizacion && parsed && ESTADOS_RECHAZO.includes(tx.status)) {
      await pool.query(`UPDATE wompi_eventos SET estado = 'rechazado' WHERE id = ?`, [eventoId]);
      await notificarPagoRechazado(parsed, tx.status);
      return { ok: true, razon: 'rechazado' };
    }

    // Evento irrelevante: otro tipo de evento, o transaction.updated sin referencia parseable.
    await pool.query(`UPDATE wompi_eventos SET estado = 'ignorado' WHERE id = ?`, [eventoId]);
    return { ok: true, razon: 'ignorado' };
  },

  /** Reintenta un evento en estado 'error' (llamado por el worker o el admin). */
  async reintentarEvento(eventoId) {
    const [[ev]] = await pool.query(
      `SELECT id, empresa_id, plan, meses FROM wompi_eventos WHERE id = ? AND estado = 'error' LIMIT 1`,
      [eventoId]
    );
    if (!ev) throw new Error('Evento no encontrado o no esta en estado error');
    if (!ev.empresa_id) throw new Error('Evento sin empresa_id — usa reconciliacion manual');

    try {
      return await activarSuscripcion(ev.id, { empresaId: ev.empresa_id, plan: ev.plan, meses: ev.meses });
    } catch (err) {
      await marcarError(ev.id, err);
      throw err;
    }
  },

  /** Procesa todos los eventos en error con menos de 3 intentos (para el worker). */
  async procesarPendientes() {
    const [eventos] = await pool.query(
      `SELECT id, empresa_id, plan, meses FROM wompi_eventos
        WHERE estado = 'error' AND intentos < 3 AND empresa_id IS NOT NULL`
    );
    let ok = 0;
    for (const ev of eventos) {
      try {
        await activarSuscripcion(ev.id, { empresaId: ev.empresa_id, plan: ev.plan, meses: ev.meses });
        ok++;
      } catch (err) {
        await marcarError(ev.id, err);
      }
    }
    if (ok > 0) logger.info(`[wompi-worker] ${ok} evento(s) reintentado(s) con exito`);
    return ok;
  },

  /**
   * Genera un link de pago de Wompi. Referencia AT-{empresaId}-{plan}-{meses}.
   * Precio fijo (SUSCRIPCION_ESTANDAR_COP) para toda empresa no-logiq360 — `plan`
   * no afecta el monto, pero SÍ debe ser uno de los valores del ENUM `empresas.plan`
   * (basico/profesional/empresarial): parsearReferencia() y activarSuscripcion()
   * lo leen de vuelta del webhook y lo escriben tal cual en esa columna.
   */
  async generarLinkPago({ empresaId, nombreEmpresa, plan = 'basico', meses = 1 }) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey) throw new Error('WOMPI_PRIVATE_KEY no configurada');

    const amountCents = SUSCRIPCION_ESTANDAR_COP * meses * 100;
    const reference   = `AT-${empresaId}-${plan}-${meses}`;
    const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + '.000Z';
    const redirectUrl = process.env.WOMPI_REDIRECT_URL || 'https://zaturno.app';

    const resp = await fetch(`${WOMPI_API}/payment_links`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${privateKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Zaturno — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        description: `Suscripcion ${meses} mes(es) para ${nombreEmpresa}`,
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

    return { url: json.data?.permalink, referencia: reference, monto_cop: SUSCRIPCION_ESTANDAR_COP * meses, expira_at: expiresAt };
  },
};

module.exports = WompiService;
