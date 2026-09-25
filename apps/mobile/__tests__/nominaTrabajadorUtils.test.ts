import { calcularElapsedLabel, calcularElapsedMinutes, getJornadaLegalSemanal } from '../features/nomina/trabajador/nominaTrabajadorUtils';

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
