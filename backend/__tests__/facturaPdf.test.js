'use strict';

const { generarFacturaPdf } = require('../utils/facturaPdf');

test('generarFacturaPdf devuelve un PDF válido aunque falte el NIT del cliente', async () => {
  const pdf = await generarFacturaPdf({
    numero: 'ZT-000001',
    fecha: '5/10/2026',
    emisor: { nombre: 'Emisor', documento: 'CC 1', email: 'emisor@ejemplo.co' },
    cliente: { nombre: 'Empresa', nit: null, email: 'cliente@ejemplo.co' },
    concepto: 'Suscripción Zaturno plan basico — 1 mes',
    montoCop: 129000,
  });

  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(1000);
});
