'use strict';

const { armarReporteGrupos } = require('../modules/reportes/reportes.grupos');

const asis = (grupo_id, nombre, o = {}) => ({ grupo_id, nombre, estado: 'activo', convocados: 0, completados: 0, no_presentados: 0, costo: 0, ...o });
const cob = (grupo_id, nombre, o = {}) => ({ grupo_id, nombre, estado: 'activo', turnos: 0, plazas: 0, cubiertas: 0, ...o });

describe('armarReporteGrupos', () => {
  test('sin datos: todo en cero y sin porcentajes', () => {
    expect(armarReporteGrupos([], [])).toEqual({ costo_total: 0, sin_grupo: { completados: 0, costo: 0 }, grupos: [] });
  });

  test('une asistencia y cobertura, y ordena por costo', () => {
    const r = armarReporteGrupos(
      [asis(1, 'Feria', { convocados: 4, completados: 3, no_presentados: 1, costo: '300000.00' }),
       asis(2, 'Obra', { convocados: 2, completados: 2, costo: '500000' })],
      [cob(1, 'Feria', { turnos: 2, plazas: 5, cubiertas: 4 }), cob(2, 'Obra', { turnos: 1, plazas: 2, cubiertas: 2 })]
    );
    expect(r.grupos.map((g) => g.nombre)).toEqual(['Obra', 'Feria']);
    expect(r.grupos[1]).toMatchObject({ grupo_id: 1, turnos: 2, convocados: 4, completados: 3, no_presentados: 1, costo: 300000, plazas: 5, cubiertas: 4 });
    expect(r.costo_total).toBe(800000);
  });

  test('el porcentaje se calcula sobre todo el costo de turnos, incluidos los turnos sin grupo', () => {
    const r = armarReporteGrupos(
      [asis(1, 'Feria', { costo: 250000 }), asis(null, null, { completados: 5, costo: 750000 })],
      []
    );
    expect(r.sin_grupo).toEqual({ completados: 5, costo: 750000 });
    expect(r.costo_total).toBe(1000000);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].pct).toBe(25);
  });

  test('un grupo con turnos abiertos y nadie asignado aparece con costo 0', () => {
    const r = armarReporteGrupos([], [cob(7, 'Gala', { turnos: 3, plazas: 6, cubiertas: 0 })]);
    expect(r.grupos).toEqual([expect.objectContaining({ grupo_id: 7, nombre: 'Gala', costo: 0, turnos: 3, plazas: 6, cubiertas: 0, pct: null })]);
  });

  test('empate de costo: orden alfabético', () => {
    const r = armarReporteGrupos([asis(1, 'Zeta', { costo: 10 }), asis(2, 'Álamo', { costo: 10 })], []);
    expect(r.grupos.map((g) => g.nombre)).toEqual(['Álamo', 'Zeta']);
  });

  test('redondea a 2 decimales', () => {
    const r = armarReporteGrupos([asis(1, 'A', { costo: 1 }), asis(2, 'B', { costo: 2 })], []);
    expect(r.grupos.map((g) => g.pct)).toEqual([66.67, 33.33]);
  });
});
