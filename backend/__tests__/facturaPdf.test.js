'use strict';

const { generarFacturaPdf, enLetras } = require('../utils/facturaPdf');

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

test('enLetras escribe los valores de los planes', () => {
  expect(enLetras(129_000)).toBe('CIENTO VEINTINUEVE MIL');
  expect(enLetras(169_000)).toBe('CIENTO SESENTA Y NUEVE MIL');
  expect(enLetras(1_700_000)).toBe('UN MILLÓN SETECIENTOS MIL');
  expect(enLetras(4_000_000)).toBe('CUATRO MILLONES');
  expect(enLetras(3_035_000)).toBe('TRES MILLONES TREINTA Y CINCO MIL');
  expect(enLetras(100_000)).toBe('CIEN MIL');
  expect(enLetras(21_000)).toBe('VEINTIÚN MIL');
});
