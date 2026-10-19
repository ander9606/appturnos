jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { generarInsights, generarInsightsPersonas } = require('../modules/reportes/reportes.insights');
const { rangoAnterior } = require('../modules/reportes/reportes.service');

const base = {
  costo: { total: 100, previo: 100, delta_pct: 0 },
  nomina: { costo: 1000, horas_extra: 0, desglose: { extras: 0 }, top_extras: [] },
  turnos: { convocados: 20, no_presentados: 0 },
  cobertura: { plazas: 10, cubiertas: 10, pct: 100 },
};

describe('rangoAnterior', () => {
  it('toma los mismos días justo antes del rango', () => {
    expect(rangoAnterior('2026-03-01', '2026-03-31')).toEqual({ desde: '2026-01-29', hasta: '2026-02-28' });
    expect(rangoAnterior('2026-10-01', '2026-10-15')).toEqual({ desde: '2026-09-16', hasta: '2026-09-30' });
  });
});

describe('generarInsights', () => {
  it('sin nada raro dice que todo está bien', () => {
    expect(generarInsights(base)).toEqual([expect.objectContaining({ id: 'todo_bien', nivel: 'ok' })]);
  });

  it('avisa cuando el costo sube y escala a alerta sobre 25 %', () => {
    const r = generarInsights({ ...base, costo: { total: 130, previo: 100, delta_pct: 30 } });
    expect(r[0]).toMatchObject({ id: 'costo_sube', nivel: 'alerta' });
  });

  it('detecta horas extra concentradas y nombra a las personas', () => {
    const top = [
      { nombre: 'Ana', apellido: 'Ruiz', horas_extra: 30 },
      { nombre: 'Luis', apellido: 'Paz', horas_extra: 20 },
    ];
    const r = generarInsights({ ...base, nomina: { ...base.nomina, horas_extra: 60, top_extras: top } });
    expect(r.find((i) => i.id === 'extras_concentradas').texto).toMatch(/Ana Ruiz, Luis Paz/);
  });

  it('ordena por gravedad y limita la lista', () => {
    const r = generarInsights({
      ...base,
      turnos: { convocados: 10, no_presentados: 3 },
      cobertura: { plazas: 10, cubiertas: 5, pct: 50 },
      costo: { total: 111, previo: 100, delta_pct: 11 },
    });
    expect(r.map((i) => i.nivel)).toEqual(['alerta', 'alerta', 'aviso']);
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('sin nómina (jefe de turnos) no habla de pagos', () => {
    const r = generarInsights({ ...base, nomina: null });
    expect(r.some((i) => i.id.startsWith('extras'))).toBe(false);
  });
});

describe('generarInsightsPersonas', () => {
  const persona = (nombre, turnos, pago) => ({ nombre, apellido: '', turnos, pago });
  const cargo = (personas, extra = {}) => ({
    cargo_id: 1, cargo: 'Auxiliar', personas,
    total_pago: personas.reduce((s, p) => s + p.pago, 0), rotable: personas.length >= 4, ...extra,
  });

  it('avisa si una persona acapara los turnos de un cargo con varias personas', () => {
    const r = generarInsightsPersonas({ horas: null, cargos: [cargo([persona('Ana', 9, 900), persona('Beto', 1, 100), persona('Cris', 1, 100), persona('Dani', 1, 100)])] });
    expect(r.find((i) => i.id === 'acapara_1').texto).toMatch(/Ana se llevó el 75%/);
  });

  it('no juzga el reparto en cargos con pocas personas (no se pueden rotar)', () => {
    const r = generarInsightsPersonas({ horas: null, cargos: [cargo([persona('Jefe', 10, 1000), persona('Otro', 0, 0)])] });
    expect(r).toEqual([]);
  });

  it('nombra a quienes no tuvieron turnos', () => {
    const r = generarInsightsPersonas({ horas: null, cargos: [cargo([persona('A', 3, 300), persona('B', 3, 300), persona('C', 3, 300), persona('D', 0, 0)])] });
    expect(r.find((i) => i.id === 'banca_1').texto).toMatch(/D/);
  });

  it('avisa de quien promedia más de la jornada, con margen de 1 h', () => {
    const h = (n, v) => ({ nombre: n, apellido: '', prom_semana: v });
    const r = generarInsightsPersonas({ horas: { ranking: [h('Uno', 50), h('Dos', 42.5)] }, cargos: [] });
    expect(r[0].texto).toMatch(/1 persona promedia.*Uno/);
    expect(r[0].texto).not.toMatch(/Dos/);
  });
});
