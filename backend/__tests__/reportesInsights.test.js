jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { generarInsightsTurnos, generarInsightsNomina, generarInsightsPersonas } = require('../modules/reportes/reportes.insights');
const { rangoAnterior } = require('../modules/reportes/reportes.service');

const costoIgual = { total: 100, previo: 100, delta_pct: 0 };
const turnosBase = { costo: costoIgual, turnos: { convocados: 20, no_presentados: 0 }, cobertura: { plazas: 10, cubiertas: 10, pct: 100 } };
const nominaBase = { costo: costoIgual, nomina: { costo: 1000, horas_extra: 0, desglose: { extras: 0 }, top_extras: [] } };

describe('rangoAnterior', () => {
  it('toma los mismos días justo antes del rango', () => {
    expect(rangoAnterior('2026-03-01', '2026-03-31')).toEqual({ desde: '2026-01-29', hasta: '2026-02-28' });
    expect(rangoAnterior('2026-10-01', '2026-10-15')).toEqual({ desde: '2026-09-16', hasta: '2026-09-30' });
  });
});

describe('avisos de turnos', () => {
  it('sin nada raro dice que todo está bien', () => {
    expect(generarInsightsTurnos(turnosBase)).toEqual([expect.objectContaining({ id: 'turnos_ok', nivel: 'ok' })]);
  });

  it('el costo de turnos sube: aviso, y alerta sobre 25 %', () => {
    const r = generarInsightsTurnos({ ...turnosBase, costo: { total: 130, previo: 100, delta_pct: 30 } });
    expect(r[0]).toMatchObject({ id: 'turnos_costo_sube', nivel: 'alerta' });
    expect(r[0].texto).toMatch(/los turnos/);
  });

  it('ordena por gravedad', () => {
    const r = generarInsightsTurnos({
      costo: { total: 111, previo: 100, delta_pct: 11 },
      turnos: { convocados: 10, no_presentados: 3 },
      cobertura: { plazas: 10, cubiertas: 5, pct: 50 },
    });
    expect(r.map((i) => i.nivel)).toEqual(['alerta', 'alerta', 'aviso']);
  });
});

describe('avisos de calificaciones (turnos)', () => {
  const cal = (o) => ({ promedio: 4.3, previo: 4.3, delta: 0, calificadas: 20, sin_calificar: 0, ...o });
  const con = (c, completados = 20) => generarInsightsTurnos({ ...turnosBase, turnos: { ...turnosBase.turnos, completados }, calificaciones: c });

  it('sin cambios ni pendientes no avisa nada', () => {
    expect(con(cal({}))).toEqual([expect.objectContaining({ id: 'turnos_ok' })]);
  });

  it('promedio bajo 3 es alerta; una caída de 0,3 o más es aviso; una subida es informativa', () => {
    expect(con(cal({ promedio: 2.8, delta: -0.1 }))[0]).toMatchObject({ id: 'turnos_calif_baja', nivel: 'alerta' });
    const baja = con(cal({ promedio: 3.9, previo: 4.3, delta: -0.4 }))[0];
    expect(baja).toMatchObject({ id: 'turnos_calif_baja', nivel: 'aviso' });
    expect(baja.texto).toMatch(/bajó de 4,3 a 3,9/);
    expect(con(cal({ promedio: 4.7, previo: 4.3, delta: 0.4 }))[0]).toMatchObject({ id: 'turnos_calif_sube', nivel: 'info' });
  });

  it('con pocas calificaciones no opina sobre el promedio', () => {
    expect(con(cal({ promedio: 2, calificadas: 3 }), 3)).toEqual([expect.objectContaining({ id: 'turnos_ok' })]);
  });

  it('avisa cuando muchos turnos completados siguen sin calificar', () => {
    const r = con(cal({ sin_calificar: 8 }), 20);
    expect(r.find((i) => i.id === 'turnos_sin_calificar').texto).toMatch(/8 de 20 turnos completados siguen sin calificar \(40%\)/);
    expect(con(cal({ sin_calificar: 2 }), 20).some((i) => i.id === 'turnos_sin_calificar')).toBe(false); // pocos
  });

  it('nombra a las personas con promedio bajo, solo con calificaciones suficientes', () => {
    const p = (nombre, n, promedio) => ({ nombre, apellido: '', n, promedio });
    const r = generarInsightsPersonas({ horas: null, cargos: [], calificadas: [p('Ana', 5, 2.1), p('Beto', 2, 1.0), p('Cris', 6, 4.5)] });
    const aviso = r.turnos.find((i) => i.id === 'turnos_calif_personas_bajas');
    expect(aviso.texto).toMatch(/1 persona tiene.*Ana \(2,1\)/);
    expect(aviso.texto).not.toMatch(/Beto|Cris/);
  });
});

describe('avisos de nómina', () => {
  it('sin nada raro dice que todo está bien', () => {
    expect(generarInsightsNomina(nominaBase)).toEqual([expect.objectContaining({ id: 'nomina_ok', nivel: 'ok' })]);
  });

  it('detecta horas extra concentradas y nombra a las personas', () => {
    const top = [
      { nombre: 'Ana', apellido: 'Ruiz', horas_extra: 30 },
      { nombre: 'Luis', apellido: 'Paz', horas_extra: 20 },
    ];
    const r = generarInsightsNomina({ ...nominaBase, nomina: { ...nominaBase.nomina, horas_extra: 60, top_extras: top } });
    expect(r.find((i) => i.id === 'nomina_extras_concentradas').texto).toMatch(/Ana Ruiz, Luis Paz/);
  });

  it('un sube del costo de turnos no se cuela en nómina', () => {
    const r = generarInsightsNomina({ ...nominaBase });
    expect(r.every((i) => i.id.startsWith('nomina_'))).toBe(true);
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
    expect(r.turnos.find((i) => i.id === 'turnos_acapara_1').texto).toMatch(/Ana se llevó el 75%/);
  });

  it('no juzga el reparto en cargos con pocas personas (no se pueden rotar)', () => {
    const r = generarInsightsPersonas({ horas: null, cargos: [cargo([persona('Jefe', 10, 1000), persona('Otro', 0, 0)])] });
    expect(r.turnos).toEqual([]);
  });

  it('nombra a quienes no tuvieron turnos', () => {
    const r = generarInsightsPersonas({ horas: null, cargos: [cargo([persona('A', 3, 300), persona('B', 3, 300), persona('C', 3, 300), persona('D', 0, 0)])] });
    expect(r.turnos.find((i) => i.id === 'turnos_banca_1').texto).toMatch(/D/);
  });

  it('avisa de quien promedia más de la jornada, con margen de 1 h', () => {
    const h = (n, v) => ({ nombre: n, apellido: '', prom_semana: v });
    const r = generarInsightsPersonas({ horas: { ranking: [h('Uno', 50), h('Dos', 42.5)] }, cargos: [] });
    expect(r.nomina[0].texto).toMatch(/1 persona promedia.*Uno/);
    expect(r.nomina[0].texto).not.toMatch(/Dos/);
    expect(r.turnos).toEqual([]); // las horas de nómina no producen avisos de turnos
  });
});
