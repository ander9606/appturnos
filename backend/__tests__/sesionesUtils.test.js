'use strict';

const { validarSesiones, calcularHorasSesiones } = require('../utils/sesionesUtils');
const { calcularHoras } = require('../utils/laboralUtils');

const s = (hora_entrada, hora_salida) => ({ hora_entrada, hora_salida });

describe('validarSesiones', () => {
  test('lista válida → normaliza a HH:MM:SS', () => {
    const r = validarSesiones([s('08:00', '12:00'), s('14:00:00', '18:30')], { cantidad: 2 });
    expect(r).toEqual([s('08:00:00', '12:00:00'), s('14:00:00', '18:30:00')]);
  });

  test('cantidad distinta a la del registro → 422 (no se agregan ni quitan sesiones)', () => {
    expect(() => validarSesiones([s('08:00', '12:00')], { cantidad: 2 })).toThrow(/2 sesiones/);
    expect(() => validarSesiones([s('08:00', '12:00'), s('13:00', '14:00'), s('15:00', '16:00')], { cantidad: 2 }))
      .toThrow(/2 sesiones/);
  });

  test('no es una lista → 422', () => {
    expect(() => validarSesiones(undefined, { cantidad: 2 })).toThrow(/2 sesiones/);
  });

  test('hora con formato inválido → 422 indicando la sesión', () => {
    expect(() => validarSesiones([s('08:00', '12:00'), s('25:00', '18:00')], { cantidad: 2 }))
      .toThrow(/Sesión 2: hora de entrada inválida/);
    expect(() => validarSesiones([s('08:00', 'abc'), s('14:00', '18:00')], { cantidad: 2 }))
      .toThrow(/Sesión 1: hora de salida inválida/);
  });

  test('salida igual a la entrada → 422', () => {
    expect(() => validarSesiones([s('08:00', '08:00'), s('14:00', '18:00')], { cantidad: 2 }))
      .toThrow(/Sesión 1: la salida no puede ser igual/);
  });

  test('sesiones solapadas (la 2 entra antes de que salga la 1) → 422: no se toma como día siguiente', () => {
    // 07:00 en vez de 17:00: leído como "después de medianoche" pasaría de 24 h desde las 08:00.
    expect(() => validarSesiones([s('08:00', '12:00'), s('07:00', '09:00')], { cantidad: 2 }))
      .toThrow(/en orden y caber en 24 h/);
  });

  test('turno nocturno que cruza la medianoche entre sesiones es válido', () => {
    expect(() => validarSesiones([s('20:00', '23:00'), s('00:30', '02:00')], { cantidad: 2 })).not.toThrow();
  });

  test('una sesión que cruza la medianoche por dentro es válida', () => {
    expect(() => validarSesiones([s('08:00', '12:00'), s('22:00', '01:00')], { cantidad: 2 })).not.toThrow();
  });

  test('todo el día debe caber en 24 h', () => {
    expect(() => validarSesiones([s('08:00', '12:00'), s('13:00', '08:30')], { cantidad: 2 }))
      .toThrow(/24 h/);
  });

  test('última sesión abierta: permitida solo si ya estaba abierta, y sin salida', () => {
    expect(validarSesiones([s('08:00', '12:00'), { hora_entrada: '14:00', hora_salida: null }], { cantidad: 2, ultimaAbierta: true }))
      .toEqual([s('08:00:00', '12:00:00'), { hora_entrada: '14:00:00', hora_salida: null }]);
    // Estaba abierta y ahora le ponen salida → no es una corrección de horas.
    expect(() => validarSesiones([s('08:00', '12:00'), s('14:00', '18:00')], { cantidad: 2, ultimaAbierta: true }))
      .toThrow(/sigue abierta/);
    // Estaba cerrada y se intenta dejar abierta.
    expect(() => validarSesiones([s('08:00', '12:00'), { hora_entrada: '14:00' }], { cantidad: 2 }))
      .toThrow(/hora de salida inválida/);
  });
});

describe('calcularHorasSesiones', () => {
  const sumar = (h) => h.horas_ordinarias + h.horas_extra_diurnas + h.horas_extra_nocturnas + h.horas_nocturnas + h.horas_festivo;

  test('suma las horas de cada sesión (08–12 + 14–16 un martes → 6 h ordinarias)', () => {
    const t = calcularHorasSesiones({
      sesiones: [s('08:00:00', '12:00:00'), s('14:00:00', '16:00:00')],
      fecha: '2026-10-13',
    });
    expect(t.horas_ordinarias).toBe(6);
    expect(sumar(t)).toBe(6);
  });

  test('el tope semanal se reparte entre sesiones: si la 1 agota las 42 h, la 2 es extra', () => {
    // Ya lleva 40 h ordinarias esta semana: la sesión 1 (4 h) completa 2 ordinarias + 2 extras,
    // y la sesión 2 (2 h) es toda extra.
    const t = calcularHorasSesiones({
      sesiones: [s('08:00:00', '12:00:00'), s('14:00:00', '16:00:00')],
      fecha: '2026-10-13',
      ordinariasAcum: 40,
    });
    expect(t.horas_ordinarias).toBe(2);
    expect(t.horas_extra_diurnas).toBe(4);
  });

  test('mismo resultado que sumar calcularHoras sesión por sesión con el acumulador de marcarSalida()', () => {
    const sesiones = [s('06:00:00', '10:00:00'), s('18:00:00', '23:30:00')];
    const h1 = calcularHoras({ horaEntrada: '06:00:00', horaSalida: '10:00:00', fecha: '2026-10-13', horasOrdinariasAcumuladas: 10 });
    const h2 = calcularHoras({
      horaEntrada: '18:00:00', horaSalida: '23:30:00', fecha: '2026-10-13',
      horasOrdinariasAcumuladas: 10 + h1.horas_ordinarias + h1.horas_nocturnas,
    });
    const t = calcularHorasSesiones({ sesiones, fecha: '2026-10-13', ordinariasAcum: 10 });
    expect(t.horas_ordinarias).toBe(h1.horas_ordinarias + h2.horas_ordinarias);
    expect(t.horas_nocturnas).toBe(h1.horas_nocturnas + h2.horas_nocturnas);
    expect(t.horas_extra_diurnas).toBe(h1.horas_extra_diurnas + h2.horas_extra_diurnas);
  });

  test('una sesión abierta no suma horas', () => {
    const t = calcularHorasSesiones({
      sesiones: [s('08:00:00', '12:00:00'), { hora_entrada: '14:00:00', hora_salida: null }],
      fecha: '2026-10-13',
    });
    expect(sumar(t)).toBe(4);
  });

  test('día festivo → es_festivo = 1', () => {
    const t = calcularHorasSesiones({ sesiones: [s('08:00:00', '12:00:00'), s('14:00:00', '16:00:00')], fecha: '2026-12-25' });
    expect(t.es_festivo).toBe(1);
  });
});
