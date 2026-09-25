'use strict';

const {
  calcularPascua,
  festivosDeAnio,
  esDiaFestivo,
  calcularHoras,
  calcularMinutosAlmuerzo,
  horaAMinutos,
  valorHora,
  calcularPagoNomina,
  desglosarPagoNomina,
  calcularSalarioBasePeriodo,
  diasComerciales,
  diasPagoPeriodo,
  horaInicioNocturno,
  recargoFestivo,
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

// Martes laboral, antes de la Ley 2466 (nocturno 21:00, dominical ×1.75).
const ANTES_REFORMA = '2025-06-10';

// ── calcularHoras ──────────────────────────────────────────────────────────────

describe('calcularHoras — jornada normal (no festivo)', () => {
  // jornadaContinua: true en estos casos para aislar la lógica de extras/nocturno
  // del descuento de almuerzo (probado aparte más abajo) — sin esto, cualquier
  // turno > 6h aquí perdería 1h por defecto y rompería estas aserciones.
  test('8 horas diurnas exactas → solo ordinarias', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', esFestivo: false, jornadaContinua: true });
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
    const r = calcularHoras({ horaEntrada: '20:00', horaSalida: '04:00', fecha: ANTES_REFORMA, esFestivo: false, jornadaContinua: true });
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
      horaEntrada: '07:00', horaSalida: '17:00', esFestivo: false, horasOrdinariasAcumuladas: 34, jornadaContinua: true,
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
      horaEntrada: '14:00', horaSalida: '02:00', fecha: ANTES_REFORMA, esFestivo: false, horasOrdinariasAcumuladas: 34, jornadaContinua: true,
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
    const r = calcularHoras({ horaEntrada: '08:01', horaSalida: '08:00', esFestivo: false, jornadaContinua: true });
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
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', esFestivo: true, jornadaContinua: true });
    expect(r.horas_festivo).toBe(8);
    expect(r.horas_ordinarias).toBe(0);
    expect(r.horas_extra_diurnas).toBe(0);
    expect(r.es_festivo).toBe(1);
  });

  test('detecta festivo por fecha (Navidad 2025)', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', fecha: '2025-12-25', jornadaContinua: true });
    expect(r.es_festivo).toBe(1);
    expect(r.horas_festivo).toBeCloseTo(8, 1);
  });

  test('detecta no-festivo por fecha (martes normal)', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', fecha: '2025-03-11', jornadaContinua: true });
    expect(r.es_festivo).toBe(0);
    expect(r.horas_ordinarias).toBeCloseTo(8, 1);
  });

  test('recargoFestivo: false (domingo ocasional, Art. 180 CST) → horas van a ordinarias, sin recargo, pero es_festivo sigue en 1', () => {
    const r = calcularHoras({
      horaEntrada: '08:00', horaSalida: '16:00', esFestivo: true, jornadaContinua: true, recargoFestivo: false,
    });
    expect(r.horas_festivo).toBe(0);
    expect(r.horas_ordinarias).toBe(8);
    expect(r.es_festivo).toBe(1); // sigue marcando que fue domingo/festivo — dispara el compensatorio
  });

  test('recargoFestivo: false respeta el tope semanal — el resto pasa a extra, no a ordinarias', () => {
    // 38h ya acumuladas esta semana → quedan 4h de cupo ordinario antes de pasar a extra.
    const r = calcularHoras({
      horaEntrada: '08:00', horaSalida: '16:00', esFestivo: true, jornadaContinua: true,
      recargoFestivo: false, horasOrdinariasAcumuladas: 38,
    });
    expect(r.horas_festivo).toBe(0);
    expect(r.horas_ordinarias).toBe(4);
    expect(r.horas_extra_diurnas).toBe(4);
  });
});

// ── calcularMinutosAlmuerzo ──────────────────────────────────────────────────

describe('calcularMinutosAlmuerzo', () => {
  test('jornada ≤ umbral → ningún minuto', () => {
    const minutos = calcularMinutosAlmuerzo(horaAMinutos('08:00'), horaAMinutos('14:00'), false);
    expect(minutos.size).toBe(0);
  });

  test('jornada > umbral → 60 minutos, tomados del final', () => {
    const inicio = horaAMinutos('08:00');
    const fin = horaAMinutos('16:00');
    const minutos = calcularMinutosAlmuerzo(inicio, fin, false);
    expect(minutos.size).toBe(60);
    expect(minutos.has(fin - 1)).toBe(true); // 15:59
    expect(minutos.has(inicio)).toBe(false); // 08:00 no se toca
  });

  test('jornadaContinua: true → ningún minuto aunque la jornada sea larga', () => {
    const minutos = calcularMinutosAlmuerzo(horaAMinutos('08:00'), horaAMinutos('16:00'), true);
    expect(minutos.size).toBe(0);
  });

  test('salta minutos nocturnos: el almuerzo se toma solo del bloque diurno', () => {
    // 20:00–04:00: solo 20:00–21:00 es diurno (60 min) — se consume entero.
    const inicio = horaAMinutos('20:00');
    const fin = horaAMinutos('04:00') + 24 * 60;
    const minutos = calcularMinutosAlmuerzo(inicio, fin, false, 21); // regla previa a la Ley 2466
    expect(minutos.size).toBe(60);
    for (const m of minutos) {
      expect(m).toBeGreaterThanOrEqual(inicio);
      expect(m).toBeLessThan(inicio + 60); // dentro de 20:00–21:00
    }
  });
});

// ── calcularHoras — descuento de almuerzo ──────────────────────────────────────

describe('calcularHoras — descuento de almuerzo', () => {
  test('jornada de 5h (≤ umbral) → no descuenta almuerzo', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '13:00' });
    expect(r.total_horas).toBe(5);
    expect(r.horas_ordinarias).toBe(5);
  });

  test('jornada de exactamente 6h (umbral) → no descuenta (solo aplica si supera el umbral)', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '14:00' });
    expect(r.total_horas).toBe(6);
    expect(r.horas_ordinarias).toBe(6);
  });

  test('jornada de 7h (> umbral) → descuenta 1h de almuerzo por defecto', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '15:00' });
    expect(r.total_horas).toBe(6);
    expect(r.horas_ordinarias).toBe(6);
  });

  test('jornadaContinua: true evita el descuento aunque la jornada sea larga', () => {
    const r = calcularHoras({ horaEntrada: '08:00', horaSalida: '16:00', jornadaContinua: true });
    expect(r.total_horas).toBe(8);
    expect(r.horas_ordinarias).toBe(8);
  });

  test('turno que cruza a nocturno: el almuerzo se descuenta del bloque diurno, no del nocturno', () => {
    // 20:00–04:00 (8h): solo 1h es diurna (20–21), el resto (21–04) es nocturna.
    // El almuerzo (1h) se toma de esa única hora diurna; las 7h nocturnas quedan intactas.
    const r = calcularHoras({ horaEntrada: '20:00', horaSalida: '04:00', fecha: ANTES_REFORMA });
    expect(r.horas_ordinarias).toBe(0);
    expect(r.horas_nocturnas).toBeCloseTo(7, 1);
    expect(r.total_horas).toBeCloseTo(7, 1);
  });
});

// ── valorHora ─────────────────────────────────────────────────────────────────

describe('valorHora', () => {
  test('usa tarifa_hora si existe', () => {
    expect(valorHora({ tarifa_hora: 25000 })).toBe(25000);
  });

  test('calcula hora desde salario_base (÷210, jornada de 42 h)', () => {
    // 2_100_000 / 210 = 10_000
    expect(valorHora({ salario_base: 2_100_000 })).toBe(10_000);
  });

  test('salario_base tiene prioridad sobre tarifa_hora', () => {
    // 2_100_000 / 210 = 10_000, no los 15_000 de tarifa_hora
    expect(valorHora({ tarifa_hora: 15000, salario_base: 2_100_000 })).toBe(10_000);
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

  test('hora nocturna ordinaria por tarifa_hora → ×1.35 (base + 35 %)', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 1,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 0,
    };
    expect(calcularPagoNomina(desglose, VH)).toBe(13_500);
  });

  test('hora festiva antes del 1-jul-2025 → ×1.75', () => {
    const desglose = {
      horas_ordinarias: 0,
      horas_nocturnas: 0,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_festivo: 1,
    };
    expect(calcularPagoNomina(desglose, VH, ANTES_REFORMA)).toBe(17_500);
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

// ── desglosarPagoNomina ────────────────────────────────────────────────────────

describe('desglosarPagoNomina', () => {
  const VH = 10_000;

  test('desglosa cada concepto y suma al mismo total que calcularPagoNomina', () => {
    // Mismo caso que "jornada mixta completa" arriba: 129_250 en total.
    const desglose = {
      horas_ordinarias: 8,
      horas_nocturnas: 0.5,
      horas_extra_diurnas: 2,
      horas_extra_nocturnas: 1,
      horas_festivo: 0,
    };
    const d = desglosarPagoNomina(desglose, VH);
    expect(d.pago_ordinario).toBeCloseTo(80_000, 0);
    expect(d.pago_nocturno).toBeCloseTo(6_750, 0);
    expect(d.pago_extra_diurno).toBeCloseTo(25_000, 0);
    expect(d.pago_extra_nocturno).toBeCloseTo(17_500, 0);
    expect(d.pago_festivo).toBe(0);
    const suma = d.pago_ordinario + d.pago_nocturno + d.pago_extra_diurno + d.pago_extra_nocturno + d.pago_festivo;
    expect(d.total).toBeCloseTo(suma, 6);
    expect(d.total).toBeCloseTo(calcularPagoNomina(desglose, VH), 6);
  });

  test('tolera valores undefined/null en el desglose', () => {
    const d = desglosarPagoNomina({}, VH);
    expect(d).toMatchObject({
      pago_ordinario: 0, pago_nocturno: 0, pago_extra_diurno: 0, pago_extra_nocturno: 0, pago_festivo: 0, total: 0,
    });
  });
});

// ── calcularSalarioBasePeriodo ──────────────────────────────────────────────────

describe('calcularSalarioBasePeriodo', () => {
  test('asalariado: prorratea el salario mensual por días del período, sin importar las horas', () => {
    // Quincena de 15 días, salario 2.150.000 → 2.150.000/30*15 = 1.075.000
    const pago = calcularSalarioBasePeriodo({
      tarifaHora: null, salarioBase: 2_150_000, horasOrdinarias: 5, valorHoraTrabajador: 8_958.33, diasPeriodo: 15,
    });
    expect(pago).toBeCloseTo(1_075_000, 0);
  });

  test('asalariado: el resultado no cambia aunque horas_ordinarias sea 0', () => {
    const pago = calcularSalarioBasePeriodo({
      tarifaHora: null, salarioBase: 2_150_000, horasOrdinarias: 0, valorHoraTrabajador: 8_958.33, diasPeriodo: 15,
    });
    expect(pago).toBeCloseTo(1_075_000, 0);
  });

  test('por tarifa_hora: paga horas_ordinarias × valor_hora, no prorratea salario', () => {
    const pago = calcularSalarioBasePeriodo({
      tarifaHora: 7_500, salarioBase: null, horasOrdinarias: 41.9, valorHoraTrabajador: 7_500, diasPeriodo: 15,
    });
    expect(pago).toBeCloseTo(314_250, 0);
  });

  test('ambos definidos → salario_base tiene prioridad, ignora tarifa_hora', () => {
    // Igual que arriba pero con salarioBase cargado: debe prorratear, no pagar por horas.
    const pago = calcularSalarioBasePeriodo({
      tarifaHora: 7_500, salarioBase: 2_150_000, horasOrdinarias: 41.9, valorHoraTrabajador: 7_500, diasPeriodo: 15,
    });
    expect(pago).toBeCloseTo(1_075_000, 0);
  });

  test('sin tarifa_hora ni salario_base → 0', () => {
    const pago = calcularSalarioBasePeriodo({
      tarifaHora: null, salarioBase: null, horasOrdinarias: 10, valorHoraTrabajador: 0, diasPeriodo: 15,
    });
    expect(pago).toBe(0);
  });
});

// ── Reforma laboral (Ley 2466 de 2025) ─────────────────────────────────────────

describe('Ley 2466 de 2025 — reglas por fecha', () => {
  test('nocturno empieza a las 21:00 hasta el 24-dic-2025 y a las 19:00 desde el 25-dic-2025', () => {
    expect(horaInicioNocturno('2025-12-24')).toBe(21);
    expect(horaInicioNocturno('2025-12-25')).toBe(19);
    expect(horaInicioNocturno(new Date(Date.UTC(2026, 8, 23)))).toBe(19);
  });

  test('recargo dominical/festivo gradual: 75 % → 80 % → 90 % → 100 %', () => {
    expect(recargoFestivo('2025-06-30')).toBe(1.75);
    expect(recargoFestivo('2025-07-01')).toBe(1.80);
    expect(recargoFestivo('2026-06-30')).toBe(1.80);
    expect(recargoFestivo('2026-07-01')).toBe(1.90);
    expect(recargoFestivo('2027-07-01')).toBe(2.00);
  });

  test('turno 17:00–01:00 después de la reforma: 2 h diurnas + 6 h nocturnas (19–01)', () => {
    const r = calcularHoras({
      horaEntrada: '17:00', horaSalida: '01:00', fecha: '2026-09-22', esFestivo: false, jornadaContinua: true,
    });
    expect(r.horas_ordinarias).toBeCloseTo(2, 2);
    expect(r.horas_nocturnas).toBeCloseTo(6, 2);
  });

  test('el mismo turno antes de la reforma: 4 h diurnas + 4 h nocturnas (21–01)', () => {
    const r = calcularHoras({
      horaEntrada: '17:00', horaSalida: '01:00', fecha: ANTES_REFORMA, esFestivo: false, jornadaContinua: true,
    });
    expect(r.horas_ordinarias).toBeCloseTo(4, 2);
    expect(r.horas_nocturnas).toBeCloseTo(4, 2);
  });

  test('20:00–04:00 después de la reforma: todo nocturno, sin bloque diurno del que descontar almuerzo', () => {
    const r = calcularHoras({ horaEntrada: '20:00', horaSalida: '04:00', fecha: '2026-09-22', esFestivo: false });
    expect(r.horas_ordinarias).toBe(0);
    expect(r.horas_nocturnas).toBeCloseTo(8, 2);
  });

  test('hora festiva en sep-2026 → ×1.90 y el desglose informa el recargo aplicado', () => {
    const d = desglosarPagoNomina({ horas_festivo: 1 }, 10_000, '2026-09-30');
    expect(d.recargo_festivo).toBe(1.90);
    expect(d.pago_festivo).toBeCloseTo(19_000, 5);
  });
});

describe('recargo nocturno según tipo de pago', () => {
  const VH = 10_000;

  test('asalariado: la hora nocturna ordinaria paga solo el 35 % adicional (el sueldo ya paga la base)', () => {
    const d = desglosarPagoNomina({ horas_nocturnas: 1 }, VH, undefined, { salarioFijo: true });
    expect(d.recargo_nocturno).toBeCloseTo(0.35, 10);
    expect(d.pago_nocturno).toBeCloseTo(3_500, 5);
  });

  test('por tarifa_hora: base + 35 % porque sus horas nocturnas no están en horas_ordinarias', () => {
    const d = desglosarPagoNomina({ horas_nocturnas: 1 }, VH);
    expect(d.recargo_nocturno).toBeCloseTo(1.35, 10);
    expect(d.pago_nocturno).toBeCloseTo(13_500, 5);
  });

  test('las extra nocturnas no cambian: ×1.75 también para el asalariado', () => {
    const d = desglosarPagoNomina({ horas_extra_nocturnas: 1 }, VH, undefined, { salarioFijo: true });
    expect(d.pago_extra_nocturno).toBeCloseTo(17_500, 5);
  });
});

describe('mes comercial de 30 días', () => {
  test('toda quincena vale 15 días, traiga el mes 28, 30 o 31', () => {
    expect(diasComerciales('2026-02-01', '2026-02-15')).toBe(15);
    expect(diasComerciales('2026-02-16', '2026-02-28')).toBe(15); // febrero: 13 días calendario
    expect(diasComerciales('2028-02-16', '2028-02-29')).toBe(15); // bisiesto
    expect(diasComerciales('2026-01-16', '2026-01-31')).toBe(15); // mes de 31: 16 días calendario
    expect(diasComerciales('2026-09-16', '2026-09-30')).toBe(15);
  });

  test('todo mes vale 30 días', () => {
    expect(diasComerciales('2026-01-01', '2026-01-31')).toBe(30);
    expect(diasComerciales('2026-02-01', '2026-02-28')).toBe(30);
    expect(diasComerciales('2026-04-01', '2026-04-30')).toBe(30);
  });

  test('un rango de varios meses suma 30 por mes', () => {
    expect(diasComerciales('2026-01-01', '2026-03-31')).toBe(90);
  });

  test('período semanal siempre paga 7 días, aunque cruce fin de mes', () => {
    expect(diasPagoPeriodo({ tipo: 'semanal', fecha_inicio: '2026-02-23', fecha_fin: '2026-03-01' })).toBe(7);
  });

  test('período quincenal y mensual usan días comerciales', () => {
    expect(diasPagoPeriodo({ tipo: 'quincenal', fecha_inicio: '2026-01-16', fecha_fin: '2026-01-31' })).toBe(15);
    expect(diasPagoPeriodo({ tipo: 'mensual', fecha_inicio: '2026-02-01', fecha_fin: '2026-02-28' })).toBe(30);
  });

  test('el salario de una quincena es siempre la mitad del mensual', () => {
    const quincena = (desde, hasta) => calcularSalarioBasePeriodo({ salarioBase: 1_750_905, diasPeriodo: diasComerciales(desde, hasta) });
    expect(quincena('2026-02-16', '2026-02-28')).toBeCloseTo(875_452.5, 2);
    expect(quincena('2026-01-16', '2026-01-31')).toBeCloseTo(875_452.5, 2);
  });
});
