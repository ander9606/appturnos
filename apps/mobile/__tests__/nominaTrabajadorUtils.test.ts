import { ayerDe, calcularElapsedLabel, calcularElapsedMinutes, encontrarRegistroActivo, etiquetaPeriodo, getJornadaLegalSemanal, tramoSemanaPrevia, aplicarHorasPrevias, calcularResumenPeriodo, sumarHoras } from '../features/nomina/trabajador/nominaTrabajadorUtils';

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
