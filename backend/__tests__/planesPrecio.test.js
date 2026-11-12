'use strict';

jest.mock('../config/database', () => ({ pool: {} }));
const { precioPlanCop, montoSuscripcionCop, prorrateoCambioPlanCop, planParaTrabajadores } = require('../modules/suscripciones/planes.model');

// Mismos valores que la semilla de migrations/sql/100_planes.sql.
const PLANES = [
  { codigo: 'basico',      orden: 1, max_trabajadores: 10,   precio_cop: 129_000, precio_anual_cop: 1_300_000, incluidos: null, precio_adicional_cop: null },
  { codigo: 'profesional', orden: 2, max_trabajadores: 30,   precio_cop: 169_000, precio_anual_cop: 1_700_000, incluidos: null, precio_adicional_cop: null },
  { codigo: 'empresarial', orden: 3, max_trabajadores: null, precio_cop: 299_000, precio_anual_cop: 3_000_000, incluidos: 80,   precio_adicional_cop: 3_500 },
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

  test('plan anual: precio redondo de la tabla; adicionales a 10 mensualidades; otros períodos, precio lleno', () => {
    expect(montoSuscripcionCop(basico, 5, 12)).toBe(1_300_000);
    expect(montoSuscripcionCop(profesional, 25, 12)).toBe(1_700_000);
    expect(montoSuscripcionCop(profesional, 25, 1)).toBe(169_000);
    expect(montoSuscripcionCop(profesional, 25, 6)).toBe(6 * 169_000);
    expect(montoSuscripcionCop(empresarial, 100, 12)).toBe(3_000_000 + 20 * 35_000);
    expect(montoSuscripcionCop({ ...basico, precio_anual_cop: null }, 5, 12)).toBe(1_290_000); // sin precio anual: 10 mensualidades
  });

  test('el Ilimitado anual (4.000.000) conviene frente al Empresarial desde ~109 trabajadores', () => {
    const ilimitado = { codigo: 'ilimitado', precio_cop: 400_000, precio_anual_cop: 4_000_000, incluidos: null, precio_adicional_cop: null };
    expect(montoSuscripcionCop(ilimitado, 5_000, 12)).toBe(4_000_000);
    expect(montoSuscripcionCop(empresarial, 108, 12)).toBeLessThan(4_000_000);
    expect(montoSuscripcionCop(empresarial, 109, 12)).toBeGreaterThan(4_000_000);
  });

  test('prorrateo: sube de Profesional anual a Empresarial anual con 6 meses restantes paga solo la diferencia', () => {
    const valorMesActual = montoSuscripcionCop(profesional, 25, 12) / 12;
    const valorMesNuevo = montoSuscripcionCop(empresarial, 25, 12) / 12;
    expect(prorrateoCambioPlanCop({ valorMesActual, valorMesNuevo, diasRestantes: 180 }))
      .toBe(Math.round((3_000_000 - 1_700_000) / 12 * 6));
    expect(prorrateoCambioPlanCop({ valorMesActual, valorMesNuevo, diasRestantes: 0 })).toBe(0);
    expect(prorrateoCambioPlanCop({ valorMesActual: 500, valorMesNuevo: 400, diasRestantes: 30 })).toBe(0); // nunca negativo
  });

  test('plan desconocido lanza error (nunca generar un link con monto indefinido)', () => {
    expect(() => precioPlanCop(undefined, 1)).toThrow();
  });
});
