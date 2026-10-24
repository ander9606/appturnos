import { fmtDate } from '../oferta/fechasOferta';

// fmtDate de la pantalla de oferta produce "Lun 5 de Ene". NO es el mismo formato que formatShortDate de
// lib/formatters ("Lun 5 Ene"), ni que el fmtDate de egreso/ingreso ("Lun, 5 de Ene"): hay varias funciones con
// nombres parecidos y resultados distintos, así que este test fija el de la oferta para que nadie la "unifique"
// sin querer y cambie un texto visible.
describe('fmtDate (oferta)', () => {
  // El primer día de cada mes de 2026: cubre las 12 abreviaturas de mes y varios días de la semana.
  test.each([
    ['2026-01-01', 'Jue 1 de Ene'],
    ['2026-02-01', 'Dom 1 de Feb'],
    ['2026-03-01', 'Dom 1 de Mar'],
    ['2026-04-01', 'Mié 1 de Abr'],
    ['2026-05-01', 'Vie 1 de May'],
    ['2026-06-01', 'Lun 1 de Jun'],
    ['2026-07-01', 'Mié 1 de Jul'],
    ['2026-08-01', 'Sáb 1 de Ago'],
    ['2026-09-01', 'Mar 1 de Sep'],
    ['2026-10-01', 'Jue 1 de Oct'],
    ['2026-11-01', 'Dom 1 de Nov'],
    ['2026-12-01', 'Mar 1 de Dic'],
  ])('%s → %s', (iso, esperado) => {
    expect(fmtDate(iso)).toBe(esperado);
  });

  test.each([
    ['2026-01-05', 'Lun 5 de Ene'],
    ['2026-06-17', 'Mié 17 de Jun'],
    ['2026-12-31', 'Jue 31 de Dic'],
  ])('día cualquiera: %s → %s', (iso, esperado) => {
    expect(fmtDate(iso)).toBe(esperado);
  });

  test('sin coma después del día de la semana y con "de" antes del mes', () => {
    const texto = fmtDate('2026-03-10');
    expect(texto).not.toContain(',');
    expect(texto).toMatch(/^[A-Za-zé]{3} \d{1,2} de [A-Za-z]{3}$/);
  });
});
