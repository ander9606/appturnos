import { festivosColombia, nombreFestivo } from '@api-client';

// Mismo cálculo que el backend: si divergen, el calendario marcaría festivos que nómina no paga.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { festivosDeAnio } = require('../../../../backend/utils/laboralUtils');

describe('festivosColombia', () => {
  test.each([2024, 2025, 2026, 2027, 2028, 2030])('coincide con el backend en %i', (anio) => {
    expect(Object.keys(festivosColombia(anio)).sort()).toEqual(festivosDeAnio(anio));
  });

  test('nombres de festivos conocidos', () => {
    expect(nombreFestivo('2026-10-12')).toBe('Día de la Raza'); // lunes: no se traslada
    expect(nombreFestivo('2026-04-03')).toBe('Viernes Santo');
    expect(nombreFestivo('2026-12-25')).toBe('Navidad');
  });

  test('un día normal y un domingo sin festivo no devuelven nombre', () => {
    expect(nombreFestivo('2026-10-22')).toBeUndefined();
    expect(nombreFestivo('2026-10-18')).toBeUndefined();
  });
});
