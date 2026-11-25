import { ayerDe, calcularElapsedLabel, calcularElapsedMinutes, encontrarRegistroActivo, etiquetaPeriodo, getJornadaLegalSemanal, tramoSemanaPrevia, aplicarHorasPrevias, calcularResumenPeriodo, sumarHoras, estimarExtraSemanaCOP, tramosSemana, fmtRangoDias, aplicarCompensatorios, creditosDeCompensatorios, diasSemanaEnPeriodo, tramosContiguos, agruparRegistrosPorSemana, fmtPeriodo, abarcanVariosAnios, novedadesDeRegistros } from '../features/nomina/trabajador/nominaTrabajadorUtils';

describe('getJornadaLegalSemanal', () => {
  it('2026 en adelante → 42h (tope final de la Ley 2101, coincide con el backend)', () => {
    expect(getJornadaLegalSemanal(2026)).toBe(42);
    expect(getJornadaLegalSemanal(2030)).toBe(42);
  });

  it('años de la reducción progresiva', () => {
    expect(getJornadaLegalSemanal(2023)).toBe(47);
    expect(getJornadaLegalSemanal(2024)).toBe(46);
    expect(getJornadaLegalSemanal(2025)).toBe(44);
  });
});

// Regresión: el cálculo debe anclarse a hora Bogotá vía Date.now(), no al
// timezone del runtime/dispositivo (new Date(y,m,d,hh,mm) usa el local del
// proceso y reintroducía el desfase de 5h que ya se había corregido en el
// backend). Estos casos deben dar el mismo resultado sin importar TZ del
// entorno donde corran — no se toca process.env.TZ a propósito, esa es la garantía.

describe('calcularElapsedMinutes / calcularElapsedLabel', () => {
  const REAL_NOW = Date.now;
  afterEach(() => { Date.now = REAL_NOW; });

  it('da ~0 justo al marcar entrada', () => {
    // 2026-01-15 19:00:00 UTC = 2026-01-15 14:00:00 Bogotá (UTC-5)
    Date.now = () => Date.UTC(2026, 0, 15, 19, 0, 0);
    expect(calcularElapsedMinutes('14:00:00')).toBe(0);
    expect(calcularElapsedLabel('14:00:00')).toBe('0m');
  });

  it('calcula 1h 30m transcurridos', () => {
    Date.now = () => Date.UTC(2026, 0, 15, 19, 30, 0); // 14:30 Bogotá
    expect(calcularElapsedMinutes('13:00:00')).toBe(90);
    expect(calcularElapsedLabel('13:00:00')).toBe('1h 30m');
  });

  it('maneja el cruce de medianoche', () => {
    Date.now = () => Date.UTC(2026, 0, 15, 5, 0, 0); // 00:00 Bogotá
    // entrada 23:00 Bogotá de la noche anterior → 1h transcurrida
    expect(calcularElapsedMinutes('23:00:00')).toBe(60);
  });
});

describe('etiquetaPeriodo', () => {
  it('clasifica por duración del período', () => {
    expect(etiquetaPeriodo('2026-01-05', '2026-01-11')).toBe('Semana');
    expect(etiquetaPeriodo('2026-01-01', '2026-01-15')).toBe('Quincena');
    expect(etiquetaPeriodo('2026-01-16', '2026-01-31')).toBe('Quincena');
    expect(etiquetaPeriodo('2026-02-01', '2026-02-28')).toBe('Mes');
  });

  it('sin fechas → "Período"', () => {
    expect(etiquetaPeriodo()).toBe('Período');
    expect(etiquetaPeriodo('2026-01-01')).toBe('Período');
  });
});

describe('encontrarRegistroActivo — turno que cruza la medianoche', () => {
  const reg = (o: Record<string, unknown>) => ({ id: 1, tipo_dia: 'ordinario', hora_entrada: null, hora_salida: null, ...o }) as never;
  // 00:30 del 14-oct en Bogotá (UTC-5).
  const AHORA = Date.parse('2026-10-14T05:30:00Z');

  it('ayerDe resta un día, también al cambiar de mes', () => {
    expect(ayerDe('2026-10-14')).toBe('2026-10-13');
    expect(ayerDe('2026-11-01')).toBe('2026-10-31');
  });

  it('hoy ya tiene entrada → es el de hoy', () => {
    const hoy = reg({ id: 2, fecha: '2026-10-14', hora_entrada: '00:10:00' });
    const ayer = reg({ id: 1, fecha: '2026-10-13', hora_entrada: '22:53:00' });
    expect(encontrarRegistroActivo([ayer, hoy], '2026-10-14', AHORA)?.id).toBe(2);
  });

  it('sin registro de hoy y el de ayer sigue abierto → el de ayer (debe marcar SALIDA)', () => {
    const ayer = reg({ id: 1, fecha: '2026-10-13', hora_entrada: '22:53:00' });
    expect(encontrarRegistroActivo([ayer], '2026-10-14', AHORA)?.id).toBe(1);
  });

  it('el registro de hoy no tiene entrada (ej. compensatorio) pero ayer sigue abierto → el de ayer', () => {
    const hoy = reg({ id: 2, fecha: '2026-10-14', tipo_dia: 'compensatorio' });
    const ayer = reg({ id: 1, fecha: '2026-10-13', hora_entrada: '22:53:00' });
    expect(encontrarRegistroActivo([hoy, ayer], '2026-10-14', AHORA)?.id).toBe(1);
  });

  it('ayer ya tiene salida → no hay registro activo', () => {
    const ayer = reg({ id: 1, fecha: '2026-10-13', hora_entrada: '14:00:00', hora_salida: '22:00:00' });
    expect(encontrarRegistroActivo([ayer], '2026-10-14', AHORA)).toBeNull();
  });

  it('abierto hace más de 24 h (salida olvidada) → no se toma como activo', () => {
    // Entró ayer 08:00; ahora son las 14:00 de hoy (30 h).
    const ayer = reg({ id: 1, fecha: '2026-10-13', hora_entrada: '08:00:00' });
    expect(encontrarRegistroActivo([ayer], '2026-10-14', Date.parse('2026-10-14T19:00:00Z'))).toBeNull();
  });
});

// Regresión: período que empieza a mitad de semana. Las 42 h ya completadas en el período anterior
// deben contar: 5.5 h el viernes son extra, no "5.5h / 42h".
describe('tramoSemanaPrevia / aplicarHorasPrevias', () => {
  it('viernes 2026-10-16 → tramo lunes 12 a jueves 15; lunes → null', () => {
    expect(tramoSemanaPrevia('2026-10-16')).toEqual({ desde: '2026-10-12', hasta: '2026-10-15' });
    expect(tramoSemanaPrevia('2026-10-12')).toBeNull();
  });

  const base = {
    totalHoras: 5.5, horasOrdinarias: 5.5, horasExtraDiurnas: 0, horasExtraNocturnas: 0, horasNocturnas: 0,
    horasFestivo: 0, diasRegistrados: 1, diasConExtras: 0, diasEspeciales: 0, valorExtraCOP: 0,
    semanas: [{ inicioSemana: '2026-10-12', horasTotales: 5.5, limiteHoras: 42, horasExtra: 0 }],
  };

  it('suma las horas previas a esa semana y recalcula el extra; el total del período no cambia', () => {
    const r = aplicarHorasPrevias(base, '2026-10-12', 42);
    expect(r.semanas[0]).toMatchObject({ horasTotales: 47.5, horasExtra: 5.5, horasPrevias: 42 });
    expect(r.totalHoras).toBe(5.5);
  });

  it('sin horas previas o semana distinta no cambia nada', () => {
    expect(aplicarHorasPrevias(base, '2026-10-12', 0)).toBe(base);
    expect(aplicarHorasPrevias(base, '2026-10-05', 10).semanas[0].horasTotales).toBe(5.5);
  });
});

// Semanas partidas por el corte del período (quincena o mes): qué días son de cada período.
describe('tramosSemana / fmtRangoDias', () => {
  it('quincena 16–31 oct: la semana del 12 queda partida con su tramo anterior', () => {
    expect(tramosSemana('2026-10-12', '2026-10-16', '2026-10-31')).toEqual({
      enPeriodo: { desde: '2026-10-16', hasta: '2026-10-18' },
      anterior: { desde: '2026-10-12', hasta: '2026-10-15' },
      siguiente: null,
    });
  });
  it('la última semana sigue en el período siguiente (cruza de mes)', () => {
    expect(tramosSemana('2026-10-26', '2026-10-16', '2026-10-31')).toEqual({
      enPeriodo: { desde: '2026-10-26', hasta: '2026-10-31' },
      anterior: null,
      siguiente: { desde: '2026-11-01', hasta: '2026-11-01' },
    });
  });
  it('mes completo: semanas del medio enteras, extremos partidos', () => {
    const t = tramosSemana('2026-11-09', '2026-11-01', '2026-11-30');
    expect(t.anterior).toBeNull();
    expect(t.siguiente).toBeNull();
    expect(tramosSemana('2026-10-26', '2026-11-01', '2026-11-30').anterior).toEqual({ desde: '2026-10-26', hasta: '2026-10-31' });
    expect(tramosSemana('2026-11-30', '2026-11-01', '2026-11-30').siguiente).toEqual({ desde: '2026-12-01', hasta: '2026-12-06' });
  });
  it('formatea rangos', () => {
    expect(fmtRangoDias('2026-10-12', '2026-10-18')).toBe('Lun 12 – Dom 18 Oct');
    expect(fmtRangoDias('2026-10-26', '2026-11-01')).toBe('Lun 26 Oct – Dom 1 Nov');
    expect(fmtRangoDias('2026-10-16', '2026-10-16')).toBe('Vie 16 Oct');
  });
});

// Franja de la semana: cada día con su zona respecto del período, y la lista del mes cortada por semana.
describe('diasSemanaEnPeriodo / tramosContiguos / agruparRegistrosPorSemana', () => {
  it('semana partida por el inicio del período: 4 días del anterior y 3 de este', () => {
    const dias = diasSemanaEnPeriodo('2026-10-12', '2026-10-16', '2026-10-31');
    expect(dias.map((d) => d.fecha[8] + d.fecha[9])).toEqual(['12', '13', '14', '15', '16', '17', '18']);
    expect(tramosContiguos(dias)).toEqual([{ zona: 'anterior', n: 4 }, { zona: 'este', n: 3 }]);
  });

  it('semana que cruza el fin del período (y de mes): este seguido de siguiente', () => {
    const dias = diasSemanaEnPeriodo('2026-10-26', '2026-10-16', '2026-10-31');
    expect(tramosContiguos(dias)).toEqual([{ zona: 'este', n: 6 }, { zona: 'siguiente', n: 1 }]);
    expect(dias[6].fecha).toBe('2026-11-01');
  });

  it('semana completa dentro del período: un solo tramo', () => {
    expect(tramosContiguos(diasSemanaEnPeriodo('2026-11-09', '2026-11-01', '2026-11-30'))).toEqual([{ zona: 'este', n: 7 }]);
  });

  it('agrupa registros por semana respetando el orden de llegada (más recientes primero)', () => {
    const r = (fecha: string) => ({ fecha });
    const g = agruparRegistrosPorSemana([r('2026-11-12'), r('2026-11-10'), r('2026-11-05'), r('2026-11-03')]);
    expect(g.map((x) => [x.lunes, x.data.length])).toEqual([['2026-11-09', 2], ['2026-11-02', 2]]);
    expect(agruparRegistrosPorSemana([])).toEqual([]);
  });
});

// Selector de período (año cuando hace falta) y novedades del equipo.
describe('fmtPeriodo / abarcanVariosAnios / novedadesDeRegistros', () => {
  const per = (fecha_inicio: string, fecha_fin: string) => ({ fecha_inicio, fecha_fin }) as never;

  it('fmtPeriodo agrega el año solo si se pide', () => {
    expect(fmtPeriodo(per('2026-11-16', '2026-11-30'))).toBe('16–30 Nov');
    expect(fmtPeriodo(per('2026-11-16', '2026-11-30'), true)).toBe('16–30 Nov 2026');
    expect(fmtPeriodo(per('2026-12-16', '2027-01-15'), true)).toBe('16 Dic – 15 Ene 2027');
  });

  it('abarcanVariosAnios', () => {
    expect(abarcanVariosAnios([per('2026-11-01', '2026-11-15'), per('2026-10-16', '2026-10-31')])).toBe(false);
    expect(abarcanVariosAnios([per('2027-01-01', '2027-01-15'), per('2026-12-16', '2026-12-31')])).toBe(true);
  });

  it('novedades: días pasados sin salida y sospechosos; el turno de hoy en curso no cuenta', () => {
    const r = (fecha: string, hora_entrada: string | null, hora_salida: string | null, sospechoso: 0 | 1 = 0) =>
      ({ fecha, hora_entrada, hora_salida, sospechoso });
    const n = novedadesDeRegistros([
      r('2026-11-20', '08:00:00', null),            // olvidó marcar salida
      r('2026-11-21', '08:00:00', '16:00:00', 1),   // sospechoso
      r('2026-11-22', '08:00:00', '16:00:00'),      // normal
      r('2026-11-25', '08:00:00', null),            // hoy, en curso
      r('2026-11-23', null, null),                  // descanso, sin entrada
    ], '2026-11-25');
    expect(n).toEqual({ sinSalida: 1, sospechosos: 1 });
  });
});

// Compensatorio: acredita al tope de 42 h de la semana en que se toma las horas del festivo habitual
// trabajado antes (otra semana u otro período). Mismo criterio que sumarOrdinariasEnSemana del backend.
describe('compensatorio acredita horas a la semana', () => {
  const base = {
    totalHoras: 30, horasOrdinarias: 30, horasExtraDiurnas: 0, horasExtraNocturnas: 0, horasNocturnas: 0,
    horasFestivo: 0, diasRegistrados: 3, diasConExtras: 0, diasEspeciales: 0, valorExtraCOP: 0,
    semanas: [{ inicioSemana: '2026-11-16', horasTotales: 30, limiteHoras: 42, horasExtra: 0 }],
  };
  const comp = (o: Record<string, unknown>) => ({
    trabajador_id: 7, estado: 'asignado', fecha_asignada: '2026-11-19', origen_fecha: '2026-11-15', horas_festivo_origen: '8.00', ...o,
  }) as never;

  it('suma el festivo del domingo anterior a la semana del descanso y recalcula el extra', () => {
    const creditos = creditosDeCompensatorios([comp({})], 7, '2026-11-20');
    expect(creditos).toEqual([{ fecha_asignada: '2026-11-19', origen_fecha: '2026-11-15', horas: 8 }]);
    const r = aplicarCompensatorios(base, creditos);
    expect(r.semanas[0]).toMatchObject({
      horasTotales: 38, horasExtra: 0, horasCompensatorio: 8, origenesCompensatorio: ['2026-11-15'], fechasCompensatorio: ['2026-11-19'],
    });
    expect(aplicarCompensatorios({ ...base, semanas: [{ ...base.semanas[0], horasTotales: 36 }] }, creditos).semanas[0])
      .toMatchObject({ horasTotales: 44, horasExtra: 2 });
    expect(r.totalHoras).toBe(30);
  });

  it('ignora ocasional (0 h), pendiente, otro trabajador y descansos que aún no llegan', () => {
    const lista = [
      comp({ horas_festivo_origen: '0.00' }), comp({ estado: 'pendiente' }), comp({ trabajador_id: 9 }),
      comp({ fecha_asignada: '2026-11-25' }), comp({ fecha_asignada: null }),
    ];
    expect(creditosDeCompensatorios(lista, 7, '2026-11-20')).toEqual([]);
    expect(aplicarCompensatorios(base, [])).toBe(base);
  });
});

// Festivo habitual (3.º del mes en adelante): sus horas van a horas_festivo y NO consumen el cupo de 42 h.
// El ocasional (1.º y 2.º) ya viene como horas normales y sí suma a la semana.
describe('festivo y cupo semanal', () => {
  const dia = (fecha: string, o: Record<string, number>) => ({
    id: 1, fecha, tipo_dia: 'ordinario', es_festivo: 0, hora_entrada: '08:00:00', hora_salida: '16:00:00',
    horas_ordinarias: 0, horas_extra_diurnas: 0, horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0, ...o,
  }) as never;

  it('el festivo habitual queda fuera de horasTotales y aparece en horasFestivo', () => {
    const r = calcularResumenPeriodo([dia('2026-10-12', { horas_ordinarias: 8 }), dia('2026-10-13', { horas_festivo: 8 })], 0);
    expect(r.semanas[0]).toMatchObject({ horasTotales: 8, horasFestivo: 8, horasExtra: 0 });
  });

  it('el festivo ocasional (horas normales) sí suma a la semana', () => {
    const r = calcularResumenPeriodo([dia('2026-10-12', { horas_ordinarias: 8 }), dia('2026-10-13', { horas_ordinarias: 8, es_festivo: 1 })], 0);
    expect(r.semanas[0].horasTotales).toBe(16);
    expect(r.semanas[0].horasFestivo).toBeUndefined();
  });

  it('sumarHoras (horas previas) también excluye el festivo habitual', () => {
    expect(sumarHoras([dia('2026-10-12', { horas_ordinarias: 8 }), dia('2026-10-13', { horas_festivo: 8 })])).toBe(8);
  });
});

// El estimado en pesos del extra usa la tasa de cada tipo: ×1.25 diurna, ×1.75 nocturna.
describe('estimarExtraSemanaCOP', () => {
  const sem = (o: object) => ({ inicioSemana: '2026-10-12', horasTotales: 50, limiteHoras: 42, horasExtra: 8, ...o });

  it('pondera diurnas y nocturnas con su tasa', () => {
    // 4 h × 1.25 + 4 h × 1.75 = 12 h-equivalentes × $10.000
    expect(estimarExtraSemanaCOP(sem({ horasExtraDiurnas: 4, horasExtraNocturnas: 4 }), 10_000)).toBe(120_000);
  });

  it('sin extras por tipo guardadas, estima todo como diurno', () => {
    expect(estimarExtraSemanaCOP(sem({}), 10_000)).toBe(100_000);
  });

  it('sin extra o sin valor hora → 0', () => {
    expect(estimarExtraSemanaCOP(sem({ horasExtra: 0 }), 10_000)).toBe(0);
    expect(estimarExtraSemanaCOP(sem({}), 0)).toBe(0);
  });
});
