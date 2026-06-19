'use strict';

const { delayPorRanking, nivelRanking } = require('../utils/rankingUtils');

// ── delayPorRanking ───────────────────────────────────────────────────────────

describe('delayPorRanking', () => {
  test('null → 15 min (trabajador nuevo sin historial)', () => {
    expect(delayPorRanking(null)).toBe(15);
    expect(delayPorRanking(undefined)).toBe(15);
  });

  test('≥ 4.5 → 0 min (elite: ve ofertas de inmediato)', () => {
    expect(delayPorRanking(4.5)).toBe(0);
    expect(delayPorRanking(5)).toBe(0);
    expect(delayPorRanking(4.99)).toBe(0);
  });

  test('≥ 3.5 y < 4.5 → 15 min (ranking alto)', () => {
    expect(delayPorRanking(3.5)).toBe(15);
    expect(delayPorRanking(4.0)).toBe(15);
    expect(delayPorRanking(4.49)).toBe(15);
  });

  test('≥ 2.5 y < 3.5 → 30 min (ranking medio)', () => {
    expect(delayPorRanking(2.5)).toBe(30);
    expect(delayPorRanking(3.0)).toBe(30);
    expect(delayPorRanking(3.49)).toBe(30);
  });

  test('< 2.5 → 60 min (ranking bajo/crítico)', () => {
    expect(delayPorRanking(0)).toBe(60);
    expect(delayPorRanking(1)).toBe(60);
    expect(delayPorRanking(2.49)).toBe(60);
  });

  test('acepta string numérico (como lo devuelve MySQL)', () => {
    expect(delayPorRanking('5')).toBe(0);
    expect(delayPorRanking('3.0')).toBe(30);
    expect(delayPorRanking('1.5')).toBe(60);
  });
});

// ── nivelRanking ──────────────────────────────────────────────────────────────

describe('nivelRanking', () => {
  test('null ranking → nuevo (sin importar totalCalificaciones)', () => {
    expect(nivelRanking(null, 10)).toBe('nuevo');
    expect(nivelRanking(undefined, 5)).toBe('nuevo');
  });

  test('0 calificaciones → nuevo (aunque exista ranking)', () => {
    expect(nivelRanking(4.8, 0)).toBe('nuevo');
    expect(nivelRanking(3.0)).toBe('nuevo'); // totalCalificaciones default = 0
  });

  test('≥ 4.5 con historial → elite', () => {
    expect(nivelRanking(4.5, 1)).toBe('elite');
    expect(nivelRanking(5.0, 20)).toBe('elite');
  });

  test('≥ 3.5 y < 4.5 → alto', () => {
    expect(nivelRanking(3.5, 1)).toBe('alto');
    expect(nivelRanking(4.49, 3)).toBe('alto');
  });

  test('≥ 2.5 y < 3.5 → medio', () => {
    expect(nivelRanking(2.5, 2)).toBe('medio');
    expect(nivelRanking(3.49, 10)).toBe('medio');
  });

  test('≥ 1.0 y < 2.5 → bajo', () => {
    expect(nivelRanking(1.0, 5)).toBe('bajo');
    expect(nivelRanking(2.49, 3)).toBe('bajo');
  });

  test('< 1.0 → critico', () => {
    expect(nivelRanking(0, 5)).toBe('critico');
    expect(nivelRanking(0.5, 2)).toBe('critico');
  });
});
