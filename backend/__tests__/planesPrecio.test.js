'use strict';

jest.mock('../config/database', () => ({ pool: {} }));
const { precioPlanCop, planParaTrabajadores } = require('../modules/suscripciones/planes.model');

// Mismos valores que la semilla de migrations/sql/100_planes.sql.
const PLANES = [
  { codigo: 'basico',      orden: 1, max_trabajadores: 10,   precio_cop: 129_000, incluidos: null, precio_adicional_cop: null },
  { codigo: 'profesional', orden: 2, max_trabajadores: 30,   precio_cop: 169_000, incluidos: null, precio_adicional_cop: null },
  { codigo: 'empresarial', orden: 3, max_trabajadores: null, precio_cop: 299_000, incluidos: 80,   precio_adicional_cop: 3_500 },
];
const [basico, profesional, empresarial] = PLANES;

describe('precios de suscripción por plan', () => {
  test('precio fijo para básico y profesional', () => {
    expect(precioPlanCop(basico, 7)).toBe(129_000);
    expect(precioPlanCop(profesional, 30)).toBe(169_000);
  });

  test('empresarial cobra el adicional por trabajador activo sobre los incluidos', () => {
    expect(precioPlanCop(empresarial, 80)).toBe(299_000);
    expect(precioPlanCop(empresarial, 100)).toBe(299_000 + 20 * 3_500);
  });

  test('elige el plan más barato que admite los trabajadores activos', () => {
    expect(planParaTrabajadores(PLANES, 0).codigo).toBe('basico');
    expect(planParaTrabajadores(PLANES, 10).codigo).toBe('basico');
    expect(planParaTrabajadores(PLANES, 11).codigo).toBe('profesional');
    expect(planParaTrabajadores(PLANES, 31).codigo).toBe('empresarial');
  });

  test('si el super_admin pone tope a todos los planes, cae en el último (nunca undefined)', () => {
    const conTope = PLANES.map((p) => ({ ...p, max_trabajadores: p.max_trabajadores ?? 100 }));
    expect(planParaTrabajadores(conTope, 500).codigo).toBe('empresarial');
  });

  test('plan desconocido lanza error (nunca generar un link con monto indefinido)', () => {
    expect(() => precioPlanCop(undefined, 1)).toThrow();
  });
});
