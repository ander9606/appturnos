'use strict';

// Resumen de costos de un grupo (función pura): mismas reglas que la liquidación y la cuenta de cobro.
const { resumirCostos, pagoNeto } = require('../modules/grupos-turno/grupos-turno.costos');

let n = 0;
const f = (estado, o = {}) => ({ id: ++n, estado, trabajador_id: 1, pago_total: 0, bono_monto: 0, horas_trabajadas: 0, tarifa_dia: 0, firmado: 1, descuento: 0, ...o });

describe('costo real: terminados y fallidos', () => {
  test('suma el pago de los completados firmados', () => {
    const r = resumirCostos([f('completado', { pago_total: 100000, horas_trabajadas: 8 }), f('completado', { trabajador_id: 2, pago_total: 60000, horas_trabajadas: 4.5 })]);
    expect(r.real).toMatchObject({ total: 160000, tarifas: 160000, bonos: 0, descuentos: 0, turnos_pagados: 2 });
    expect(r.horas).toBe(12.5);
    expect(r.trabajadores).toBe(2);
    expect(r.proyectado).toBe(160000);
  });

  test('un fallido (compensación por fuerza mayor) también es costo real', () => {
    const r = resumirCostos([f('fallido', { pago_total: 30000, firmado: 0 })]);
    expect(r.real.total).toBe(30000);
    expect(r.sin_firmar).toEqual({ cantidad: 0, monto: 0 }); // un fallido nunca tiene contrato que firmar
  });

  test('descuenta lo que el trabajador ya aceptó y separa tarifas, bonos y descuentos', () => {
    const r = resumirCostos([f('completado', { pago_total: 115000, bono_monto: 15000, descuento: 5000 })]);
    expect(r.real).toMatchObject({ total: 110000, tarifas: 100000, bonos: 15000, descuentos: 5000 });
  });

  test('el descuento nunca deja el pago por debajo de cero ni cuenta más que el pago', () => {
    const r = resumirCostos([f('completado', { pago_total: 40000, descuento: 90000 })]);
    expect(r.real).toMatchObject({ total: 0, descuentos: 40000 });
    expect(pagoNeto({ pago_total: 40000, descuento: 90000 })).toBe(0);
  });

  test('valores que MySQL manda como texto o nulos no rompen la suma', () => {
    const r = resumirCostos([f('completado', { pago_total: '100000.00', bono_monto: null, descuento: '2500.50', horas_trabajadas: null })]);
    expect(r.real.total).toBe(97499.5);
    expect(r.horas).toBe(0);
  });
});

describe('sin firmar: aparte, como la liquidación', () => {
  test('lo completado sin contrato firmado NO suma a «para pagar»: va aparte y sí cuenta en el proyectado', () => {
    const r = resumirCostos([f('completado', { pago_total: 100000 }), f('completado', { pago_total: 80000, descuento: 10000, firmado: 0 })]);
    expect(r.real.total).toBe(100000);
    expect(r.sin_firmar).toEqual({ cantidad: 1, monto: 70000 });
    expect(r.proyectado).toBe(170000);
  });

  test('lo sin firmar no infla tarifas, bonos ni descuentos de lo que ya se puede pagar', () => {
    const r = resumirCostos([f('completado', { pago_total: 90000, bono_monto: 20000, descuento: 5000, firmado: 0 })]);
    expect(r.real).toMatchObject({ total: 0, tarifas: 0, bonos: 0, descuentos: 0, turnos_pagados: 0 });
  });
});

describe('en espera: compensación propuesta sin respuesta del trabajador', () => {
  test('no suma ni resta en ningún total; solo se cuenta', () => {
    const r = resumirCostos([
      f('completado', { pago_total: 100000, compensacion_decision: 'pendiente' }),
      f('completado', { pago_total: 50000, firmado: 0, compensacion_decision: 'pendiente' }),
      f('completado', { pago_total: 40000 }),
    ]);
    expect(r.en_espera).toEqual({ cantidad: 2 });
    expect(r.real.total).toBe(40000);
    expect(r.sin_firmar.cantidad).toBe(0);
    expect(r.proyectado).toBe(40000);
  });

  test('si la propuesta se autoriza o se rechaza, el turno vuelve a contar como cualquier otro', () => {
    for (const decision of ['autorizada', 'rechazada', null]) {
      const r = resumirCostos([f('completado', { pago_total: 40000, compensacion_decision: decision })]);
      expect(r.en_espera.cantidad).toBe(0);
      expect(r.real.total).toBe(40000);
    }
  });
});

describe('por pagar (estimado)', () => {
  test('confirmados y en curso van a la tarifa de su puesto; no suman al costo real', () => {
    const r = resumirCostos([f('confirmado', { tarifa_dia: 80000 }), f('en_progreso', { trabajador_id: 2, tarifa_dia: 90000 })]);
    expect(r.estimado).toEqual({ total: 170000, turnos: 2 });
    expect(r.real.total).toBe(0);
    expect(r.proyectado).toBe(170000);
    expect(r.trabajadores).toBe(2);
  });

  test('postulaciones sin confirmar, por reconfirmar, cancelados y no presentados no comprometen nada', () => {
    const r = resumirCostos(['pendiente', 'por_reconfirmar', 'cancelado', 'no_presentado', 'rechazado'].map((e) => f(e, { tarifa_dia: 80000, pago_total: 80000 })));
    expect(r).toMatchObject({ estimado: { total: 0, turnos: 0 }, real: { total: 0, turnos_pagados: 0 }, proyectado: 0, trabajadores: 0 });
  });

  test('el proyectado es lo real más lo estimado', () => {
    const r = resumirCostos([f('completado', { pago_total: 100000 }), f('confirmado', { tarifa_dia: 80000 })]);
    expect(r.proyectado).toBe(180000);
  });
});

describe('casos de borde', () => {
  test('un grupo sin asignaciones da todo en cero', () => {
    expect(resumirCostos([])).toEqual({
      real: { total: 0, tarifas: 0, bonos: 0, descuentos: 0, turnos_pagados: 0 },
      sin_firmar: { cantidad: 0, monto: 0 }, en_espera: { cantidad: 0 }, estimado: { total: 0, turnos: 0 }, proyectado: 0, trabajadores: 0, horas: 0,
    });
  });

  test('el mismo trabajador en varios turnos cuenta una sola vez', () => {
    const r = resumirCostos([f('completado', { pago_total: 1 }), f('completado', { pago_total: 1 }), f('confirmado', { tarifa_dia: 1 })]);
    expect(r.trabajadores).toBe(1);
  });

  test('los centavos se redondean a dos decimales sin arrastrar error de coma flotante', () => {
    const r = resumirCostos([f('completado', { pago_total: 0.1 }), f('completado', { pago_total: 0.2 })]);
    expect(r.real.total).toBe(0.3);
  });

  test('un bono mayor que el pago no deja las tarifas negativas', () => {
    const r = resumirCostos([f('completado', { pago_total: 10000, bono_monto: 99999 })]);
    expect(r.real).toMatchObject({ tarifas: 0, bonos: 10000, total: 10000 });
  });
});
