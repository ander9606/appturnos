'use strict';

const { precioPlanCop, planParaTrabajadores } = require('../config/constants');

describe('precios de suscripción por plan', () => {
  test('precio fijo para básico y profesional', () => {
    expect(precioPlanCop('basico', 7)).toBe(79_000);
    expect(precioPlanCop('profesional', 30)).toBe(169_000);
  });

  test('empresarial cobra $3.500 por trabajador activo sobre los 80 incluidos', () => {
    expect(precioPlanCop('empresarial', 80)).toBe(299_000);
    expect(precioPlanCop('empresarial', 100)).toBe(299_000 + 20 * 3_500);
  });

  test('elige el plan más barato que admite los trabajadores activos', () => {
    expect(planParaTrabajadores(0)).toBe('basico');
    expect(planParaTrabajadores(10)).toBe('basico');
    expect(planParaTrabajadores(11)).toBe('profesional');
    expect(planParaTrabajadores(31)).toBe('empresarial');
  });

  test('plan desconocido lanza error (nunca generar un link con monto indefinido)', () => {
    expect(() => precioPlanCop('gratis', 1)).toThrow();
  });
});
