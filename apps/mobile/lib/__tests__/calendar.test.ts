import { etiquetaDia, shiftMonth } from '../calendar';

describe('calendar', () => {
  test('etiquetaDia escribe el día de la semana y el mes en español', () => {
    expect(etiquetaDia('2026-10-22')).toBe('Jueves 22 de octubre');
    expect(etiquetaDia('2026-01-01')).toBe('Jueves 1 de enero');
  });

  test('shiftMonth cambia de año al pasar diciembre y enero', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});
