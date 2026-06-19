import { nivelRanking, rankingLabel, delayMinutos, delayLabel } from '../rankingUtils';

describe('nivelRanking', () => {
  it('devuelve "nuevo" cuando no hay calificaciones', () => {
    expect(nivelRanking(4.8, 0)).toBe('nuevo');
    expect(nivelRanking(null)).toBe('nuevo');
    expect(nivelRanking(undefined)).toBe('nuevo');
  });

  it('clasifica los rangos correctamente', () => {
    expect(nivelRanking(4.5, 5)).toBe('elite');
    expect(nivelRanking(5.0, 5)).toBe('elite');
    expect(nivelRanking(3.5, 5)).toBe('alto');
    expect(nivelRanking(4.4, 5)).toBe('alto');
    expect(nivelRanking(2.5, 5)).toBe('medio');
    expect(nivelRanking(3.4, 5)).toBe('medio');
    expect(nivelRanking(1.0, 5)).toBe('bajo');
    expect(nivelRanking(2.4, 5)).toBe('bajo');
    expect(nivelRanking(0.9, 5)).toBe('critico');
  });
});

describe('rankingLabel', () => {
  it('devuelve etiqueta legible para cada nivel', () => {
    expect(rankingLabel('elite')).toBe('Elite');
    expect(rankingLabel('nuevo')).toBe('Nuevo');
    expect(rankingLabel('critico')).toBe('Crítico');
  });
});

describe('delayMinutos', () => {
  it('elite tiene 0 minutos de espera', () => {
    expect(delayMinutos('elite')).toBe(0);
  });

  it('crítico y bajo tienen 60 minutos', () => {
    expect(delayMinutos('critico')).toBe(60);
    expect(delayMinutos('bajo')).toBe(60);
  });

  it('los demás niveles tienen esperas intermedias', () => {
    expect(delayMinutos('medio')).toBe(30);
    expect(delayMinutos('alto')).toBe(15);
    expect(delayMinutos('nuevo')).toBe(15);
  });
});

describe('delayLabel', () => {
  it('muestra "Acceso inmediato" para elite', () => {
    expect(delayLabel('elite')).toBe('Acceso inmediato');
  });

  it('muestra los minutos para los demás niveles', () => {
    expect(delayLabel('critico')).toBe('60 min de espera');
    expect(delayLabel('medio')).toBe('30 min de espera');
  });
});
