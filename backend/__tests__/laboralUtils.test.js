'use strict';

const {
  calcularPascua,
  festivosDeAnio,
  esDiaFestivo,
  calcularHoras,
  horaAMinutos,
  valorHora,
  calcularPagoNomina,
} = require('../utils/laboralUtils');

// ── calcularPascua ────────────────────────────────────────────────────────────

describe('calcularPascua', () => {
  // Fechas verificadas contra tablas históricas.
  const casos = [
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2000, '2000-04-23'], // año bisiesto
    [1996, '1996-04-07'],
  ];

  test.each(casos)('año %i → %s', (anio, esperado) => {
    const resultado = calcularPascua(anio);
    expect(resultado.toISOString().slice(0, 10)).toBe(esperado);
  });
});

// ── festivosDeAnio ─────────────────────────────────────────────────────────────

describe('festivosDeAnio', () => {
  test('siempre contiene Año Nuevo', () => {
    for (const anio of [2024, 2025, 2026]) {
      expect(festivosDeAnio(anio)).toContain(`${anio}-01-01`);
    }
  });

  test('siempre contiene Navidad', () => {
    for (const anio of [2024, 2025, 2026]) {
      expect(festivosDeAnio(anio)).toContain(`${anio}-12-25`);
    }
  });

  test('siempre contiene Día del Trabajo (1 mayo)', () => {
    expect(festivosDeAnio(2025)).toContain('2025-05-01');
  });

  test('Jueves Santo y Viernes Santo 2025 son correctos', () => {
    // Pascua 2025 = 20 abr → Jueves 17 abr, Viernes 18 abr
    const festivos2025 = festivosDeAnio(2025);
    expect(festivos2025).toContain('2025-04-17');
    expect(festivos2025).toContain('2025-04-18');
  });

  test('no hay duplicados', () => {
    const festivos = festivosDeAnio(2025);
    const set = new Set(festivos);
    expect(set.size).toBe(festivos.length);
  });

  test('devuelve al menos 16 festivos', () => {
    // Colombia tiene entre 16 y 18 festivos según el año (los Ley Emiliani
    // pueden coincidir con los de Pascua, reduciendo el total único).
    expect(festivosDeAnio(2025).length).toBeGreaterThanOrEqual(16);
  });
});

// ── esDiaFestivo ───────────────────────────────────────────────────────────────

describe('esDiaFestivo', () => {
  test('Año Nuevo es festivo', () => {
    expect(esDiaFestivo('2025-01-01')).toBe(true);
  });

  test('Navidad es festivo', () => {
    expect(esDiaFestivo('2025-12-25')).toBe(true);
  });

  test('Domingo cualquiera es festivo', () => {
    expect(esDiaFestivo('2025-03-09')).toBe(true); // domingo
  });

  test('lunes normal de trabajo no es festivo', () => {
    expect(esDiaFestivo('2025-03-10')).toBe(false); // lunes
  });

  test('acepta objetos Date', () => {
    expect(esDiaFestivo(new Date('2025-01-01T12:00:00Z'))).toBe(true);
  });

  test('Jueves Santo 2025 es festivo', () => {
    expect(esDiaFestivo('2025-04-17')).toBe(true);
  });

  test('Viernes Santo 2025 es festivo', () => {
    expect(esDiaFestivo('2025-04-18')).toBe(true);
  });

  test('Miércoles antes de Pascua no es festivo (y no es domingo)', () => {
    // 2025-04-16 = miércoles
    expect(esDiaFestivo('2025-04-16')).toBe(false);
  });
});

// ── horaAMinutos ───────────────────────────────────────────────────────────────

describe('horaAMinutos', () => {
  test.each([
    ['00:00', 0],
    ['08:00', 480],
    ['17:30', 1050],
    ['21:00', 1260],
    ['23:59', 1439],
    ['08:30:00', 510], // con segundos — se ignoran
  ])('%s → %i min', (hora, esperado) => {
    expect(horaAMinutos(hora)).toBe(esperado);
  });
});

// ── calcularHoras ──────────────────────────────────────────────────────────────

describe('calcularHoras — jornada normal (no festivo)', () => {
  test('8 horas diurnas exactas → solo ordinarias', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', esFestivo: false });
    expect(r.horas_ordinarias).toBe(8);
    expect(r.horas_extra_diurnas).toBe(0);
    expect(r.horas_extra_nocturnas).toBe(0);
    expect(r.horas_nocturnas).toBe(0);
    expect(r.horas_festivo).toBe(0);
    expect(r.total_horas).toBe(8);
    expect(r.es_festivo).toBe(0);
  });

  test('8 horas con tramo nocturno → ordinarias + nocturnas', () => {
    // 20:00 – 04:00 (8 h) → 1 h ordinaria diurna (20–21) + 7 h nocturnas (21–04)
    const r = calcularHoras({ horaEntrada: '20:00', horaSalida: '04:00', esFestivo: false });
    expect(r.horas_ordinarias).toBeCloseTo(1, 1);
    expect(r.horas_nocturnas).toBeCloseTo(7, 1);
    expect(r.total_horas).toBeCloseTo(8, 1);
    expect(r.horas_extra_diurnas).toBe(0);
    expect(r.horas_extra_nocturnas).toBe(0);
  });

  test('10 horas diurnas, semana ya con 34h ordinarias → 8 ordinarias + 2 extra diurnas', () => {
    // El tope de ordinarias es semanal (42h), no por turno — con 34h ya acumuladas
    // esta semana, quedan 8h de cupo ordinario antes de pasar a extra.
    const r = calcularHoras({
      horaEntrada: '07:00', horaSalida: '17:00', esFestivo: false, horasOrdinariasAcumuladas: 34,
    });
    expect(r.horas_ordinarias).toBe(8);
    expect(r.horas_extra_diurnas).toBe(2);
    expect(r.horas_nocturnas).toBe(0);
    expect(r.horas_extra_nocturnas).toBe(0);
  });

  test('12 horas cruzando nocturno, semana ya con 34h ordinarias → extra diurnas + extra nocturnas', () => {
    // 14:00 – 02:00 (12 h), con 8h de cupo ordinario restante esta semana (34h + 8h = 42h)
    // ordinarias diurnas: 14–21 = 7 h (1h falta para agotar el cupo)
    // ordinarias nocturnas: 21–22 = 1 h
    // extra nocturnas: 22–02 = 4 h
    const r = calcularHoras({
      horaEntrada: '14:00', horaSalida: '02:00', esFestivo: false, horasOrdinariasAcumuladas: 34,
    });
    expect(r.total_horas).toBeCloseTo(12, 1);
    expect(r.horas_ordinarias).toBeCloseTo(7, 1);
    expect(r.horas_nocturnas).toBeCloseTo(1, 1);
    expect(r.horas_extra_diurnas).toBe(0);
    expect(r.horas_extra_nocturnas).toBeCloseTo(4, 1);
  });

  test('horaSalida 1 minuto antes de horaEntrada → jornada de ~24h (cruza medianoche)', () => {
    // El código trata fin <= inicio como turno que cruza medianoche.
    // '08:01' → '08:00' significa que el trabajador salió justo 1 min antes → 23h 59m.
    const r = calcularHoras({ horaEntrada: '08:01', horaSalida: '08:00', esFestivo: false });
    expect(r.total_horas).toBeCloseTo(23.98, 1); // 23 h 59 m
    expect(r.total_horas).toBeGreaterThan(23);
  });

  test('sin parámetros → todo cero', () => {
    const r = calcularHoras();
    expect(r.total_horas).toBe(0);
    expect(r.horas_ordinarias).toBe(0);
  });
});

describe('calcularHoras — jornada en festivo', () => {
  test('todas las horas van a horas_festivo', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', esFestivo: true });
    expect(r.horas_festivo).toBe(8);
    expect(r.horas_ordinarias).toBe(0);
    expect(r.horas_extra_diurnas).toBe(0);
    expect(r.es_festivo).toBe(1);
  });

  test('detecta festivo por fecha (Navidad 2025)', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', fecha: '2025-12-25' });
    expect(r.es_festivo).toBe(1);
    expect(r.horas_festivo).toBeCloseTo(8, 1);
  });

  test('detecta no-festivo por fecha (martes normal)', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', fecha: '2025-03-11' });
    expect(r.es_festivo).toBe(0);
    expect(r.horas_ordinarias).toBeCloseTo(8, 1);
  });
});

// ── valorHora ─────────────────────────────────────────────────────────────────

describe('valorHora', () => {
  test('usa tarifa_hora si existe', () => {
    expect(valorHora({ tarifa_hora: 25000 })).toBe(25000);
  });

  test('calcula hora desde salario_base (÷240)', () => {
    // 2_400_000 / 240 = 10_000
    expect(valorHora({ salario_base: 2_400_000 })).toBe(10_000);
  });

  test('tarifa_hora tiene prioridad sobre salario_base', () => {
    expect(valorHora({ tarifa_hora: 15000, salario_base: 2_400_000 })).toBe(15000);
  });

  test('sin salario → 0', () => {
    expect(valorHora({})).toBe(0);
    expect(valorHora({ tarifa_hora: null, salario_base: null })).toBe(0);
  });

  test('acepta valores string (como los devuelve MySQL)', () => {
    expect(valorHora({ tarifa_hora: '25000' })).toBe(25000);
  });
});

// ── calcularPagoNomina ────────────────────────────────────────────────────────

describe('calcularPagoNomina', () => {
  const VH = 10_000; // valor hora base

  test('solo horas ordinarias → 1.0 × vh × h', () => {
    const desglose = {
      horas_ordinarias: 8,
      horas_nocturnas: 0,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(80_000);
  });

  test('hora extra diurna → ×1.25', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 0,
      horas_extra_diurnas: 1,
      horas_extra_nocturnas: 0,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(12_500);
  });

  test('hora extra nocturna → ×1.75', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 0,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 1,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(17_500);
  });

  test('hora nocturna ordinaria → ×1.35', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 1,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(13_500);
  });

  test('hora festiva diurna → ×1.75', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 0,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 1,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(17_500);
  });

  test('jornada mixta completa', () => {
    // 8 ord + 2 extra_d + 1 extra_n + 0.5 noc + 0 fest
    // = 10000*(8 + 1.25*2 + 1.75*1 + 1.35*0.5)
    // = 10000*(8 + 2.5 + 1.75 + 0.675) = 10000*12.925 = 129250
    const desglose = {
      horas_ordinarias: 8,
      horas_nocturnas: 0.5,
      horas_extra_diurnas: 2,
      horas_extra_nocturnas: 1,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBeCloseTo(129_250, 0);
  });

  test('valor hora = 0 → pago = 0', () => {
    const desglose = {
      horas_ordinarias: 8,
      horas_nocturnas: 0,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, 0)).toBe(0);
  });

  test('tolera valores undefined/null en el desglose', () => {
    // calcularHoras puede devolver 0s explícitamente, pero la función debería
    // ser robusta ante campos faltantes.
    const desglose = {};
    expect(calcularPagoNomina(desglose, VH)).toBe(0);
  });
});
