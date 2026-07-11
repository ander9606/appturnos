'use strict';

// Chequeo mínimo sin framework: node modules/webhooks/wompi.service.test.js
// Verifica que un evento sin WOMPI_EVENTS_SECRET configurado se RECHACE (fail-closed),
// no que se acepte como antes del fix. No toca la DB: la firma inválida corta antes de cualquier query.

const assert = require('assert');

delete process.env.WOMPI_EVENTS_SECRET;
const WompiService = require('./wompi.service');

async function main() {
  const payloadSinFirma = {
    event: 'transaction.updated',
    timestamp: Date.now(),
    data: { transaction: { id: 'fake-tx-sin-firma', status: 'APPROVED', reference: 'AT-1-basico-1' } },
    // sin `signature` — simula un atacante que no conoce el secreto
  };

  const resultado = await WompiService.procesarEvento(payloadSinFirma);
  assert.strictEqual(resultado.ok, false, 'un evento sin secreto configurado NO debe procesarse');
  assert.strictEqual(resultado.razon, 'firma_invalida', 'debe rechazarse por firma inválida, no por otra razón');

  console.log('OK: wompi.service falla cerrado cuando falta WOMPI_EVENTS_SECRET');
}

main().catch((err) => {
  console.error('FALLÓ:', err.message);
  process.exit(1);
});
