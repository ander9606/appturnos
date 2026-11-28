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

  // sale_dia_siguiente (análogo a ofertas_turno.fin_dia_siguiente): la última sesión declara
  // explícitamente que su salida cae en el día calendario siguiente, en vez de inferirlo por
  // magnitud — así una sesión con hueco grande (caso real: registro 1260) no choca con el
  // límite de 24h de arriba, que sigue protegiendo contra typos cuando el flag no viene.
  describe('sale_dia_siguiente', () => {
    test('dos sesiones con hueco grande y la última cruzando medianoche: válida con el flag', () => {
      // Caso real: 10:16→16:39 y 20:43→13:02 del día siguiente (26h46 transcurridas en total).
      expect(() => validarSesiones(
        [s('10:16', '16:39'), { hora_entrada: '20:43', hora_salida: '13:02', sale_dia_siguiente: true }],
        { cantidad: 2 }
      )).not.toThrow();
    });

    test('normaliza la hora de salida tal cual, sin desplazarla', () => {
      const r = validarSesiones(
        [s('10:16', '16:39'), { hora_entrada: '20:43', hora_salida: '13:02', sale_dia_siguiente: true }],
        { cantidad: 2 }
      );
      expect(r[1]).toEqual({ hora_entrada: '20:43:00', hora_salida: '13:02:00' });
    });

    test('solo la última sesión puede traer el flag', () => {
      expect(() => validarSesiones(
        [{ hora_entrada: '08:00', hora_salida: '12:00', sale_dia_siguiente: true }, s('13:00', '18:00')],
        { cantidad: 2 }
      )).toThrow(/Sesión 1: solo la última sesión puede terminar al día siguiente/);
    });

    test('sin el flag, el mismo hueco grande sigue rechazado (protección anti-typo intacta)', () => {
      expect(() => validarSesiones([s('10:16', '16:39'), s('20:43', '13:02')], { cantidad: 2 }))
        .toThrow(/24 h/);
    });
  });

  test('última sesión abierta: puede seguir abierta si ya lo estaba', () => {
    expect(validarSesiones([s('08:00', '12:00'), { hora_entrada: '14:00', hora_salida: null }], { cantidad: 2, ultimaAbierta: true }))
      .toEqual([s('08:00:00', '12:00:00'), { hora_entrada: '14:00:00', hora_salida: null }]);
  });

  test('última sesión abierta: se le puede poner la salida (salida olvidada)', () => {
    expect(validarSesiones([s('08:00', '12:00'), s('14:00', '18:00')], { cantidad: 2, ultimaAbierta: true }))
      .toEqual([s('08:00:00', '12:00:00'), s('14:00:00', '18:00:00')]);
  });

  test('salida olvidada de un turno nocturno: entró 22:53 y sale 01:10 del día siguiente', () => {
    expect(() => validarSesiones([s('08:00', '12:00'), s('22:53', '01:10')], { cantidad: 2, ultimaAbierta: true })).not.toThrow();
  });

  test('una sesión que no es la última nunca puede quedar abierta', () => {
    expect(() => validarSesiones([{ hora_entrada: '08:00', hora_salida: null }, s('14:00', '18:00')], { cantidad: 2, ultimaAbierta: true }))
      .toThrow(/Sesión 1: hora de salida inválida/);
  });

  test('si el registro estaba cerrado, no se puede dejar la última abierta', () => {
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
