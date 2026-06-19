'use strict';

/**
 * Check runnable (sin framework) del emparejamiento de App Turnos.
 * Mockea fetch y el modelo; verifica que el código se decodifica y que el bundle
 * de secretos de logiq360 se persiste con el mapeo correcto.
 *
 * Uso:  node modules/integracion/emparejar.check.js
 */

const assert = require('node:assert');

const IntegracionModel = require('./integracion.model');
const IntegracionService = require('./integracion.service');

(async () => {
  // ── Arrange ────────────────────────────────────────────────────────────────
  let guardado = null;
  IntegracionModel.guardarConfig = async (empresaId, d) => { guardado = { empresaId, ...d }; };

  global.fetch = async (urlLlamada, opts) => {
    assert.match(urlLlamada, /\/api\/integracion\/emparejar\/confirmar$/, 'URL de confirmar incorrecta');
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.nonce, 'nonce123');
    assert.strictEqual(body.app_turnos_webhook_url, 'https://turnos.test/api/integracion/eventos');
    return {
      ok: true,
      json: async () => ({
        data: {
          tenant_id: 42,
          logiq360_base_url: 'https://logiq360.test',
          webhook_url: 'https://logiq360.test/api/integracion/eventos',
          incoming_secret: 'S_A',
          webhook_secret: 'S_B',
          api_key: 'lt_K',
        },
      }),
    };
  };

  const codigo = Buffer.from(
    JSON.stringify({ url: 'https://logiq360.test', nonce: 'nonce123' }), 'utf8'
  ).toString('base64url');

  // ── Act ────────────────────────────────────────────────────────────────────
  const res = await IntegracionService.emparejar(7, codigo, 'https://turnos.test/');

  // ── Assert ─────────────────────────────────────────────────────────────────
  assert.deepStrictEqual(res, { conectado: true, logiq360_tenant_id: 42 });
  assert.strictEqual(guardado.empresaId, 7);
  assert.strictEqual(guardado.logiq360_tenant_id, 42, 'debe persistir el tenant_id de logiq360');
  assert.strictEqual(guardado.incoming_secret, 'S_A');
  assert.strictEqual(guardado.webhook_secret, 'S_B');
  assert.strictEqual(guardado.api_key, 'lt_K');
  assert.strictEqual(guardado.activo, 1);

  // Código inválido → AppError 400
  await assert.rejects(
    () => IntegracionService.emparejar(7, 'no-es-base64-json', 'https://turnos.test'),
    /inválido/
  );

  console.log('✓ emparejar.check OK');
  process.exit(0);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
