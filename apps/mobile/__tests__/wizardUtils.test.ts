import {
  pad,
  buildFecha,
  buildTime,
  isValidDate,
  isValidTime,
  parseTarifa,
  calcularPresupuesto,
  validateStep1,
  validateStep2,
} from '../features/turnos/crear/utils';
import type { WizardData, PuestoInput } from '../features/turnos/crear/types';

// ── pad ───────────────────────────────────────────────────────────────────────

describe('pad', () => {
  it('pads a single digit to 2 chars', () => {
    expect(pad('5')).toBe('05');
  });

  it('leaves a 2-digit string unchanged', () => {
    expect(pad('12')).toBe('12');
  });

  it('pads year to 4 chars', () => {
    expect(pad('26', 4)).toBe('0026');
  });

  it('leaves 4-digit year unchanged', () => {
    expect(pad('2026', 4)).toBe('2026');
  });
});

// ── buildFecha ────────────────────────────────────────────────────────────────

describe('buildFecha', () => {
  const base = (overrides: Partial<WizardData>): WizardData => ({
    titulo: '', descripcion: '', dia: '1', mes: '6', anio: '2026',
    hora_inicio_h: '', hora_inicio_m: '', hora_fin_h: '', hora_fin_m: '',
    lugar: '', latitud: null, longitud: null, para_quien: 'turnos', puestos: [],
    ...overrides,
  });

  it('formats single-digit day and month', () => {
    expect(buildFecha(base({ dia: '5', mes: '3', anio: '2026' }))).toBe('2026-03-05');
  });

  it('formats double-digit day and month', () => {
    expect(buildFecha(base({ dia: '15', mes: '12', anio: '2026' }))).toBe('2026-12-15');
  });
});

// ── buildTime ─────────────────────────────────────────────────────────────────

describe('buildTime', () => {
  it('pads single-digit hour and minute', () => {
    expect(buildTime('7', '0')).toBe('07:00:00');
  });

  it('leaves double-digit values unchanged', () => {
    expect(buildTime('14', '30')).toBe('14:30:00');
  });

  it('handles midnight', () => {
    expect(buildTime('0', '0')).toBe('00:00:00');
  });
});

// ── isValidDate ───────────────────────────────────────────────────────────────

describe('isValidDate', () => {
  it('accepts a valid date', () => {
    expect(isValidDate('15', '6', '2026')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isValidDate('', '6', '2026')).toBe(false);
  });

  it('rejects month 0', () => {
    expect(isValidDate('1', '0', '2026')).toBe(false);
  });

  it('rejects month 13', () => {
    expect(isValidDate('1', '13', '2026')).toBe(false);
  });

  it('rejects day 0', () => {
    expect(isValidDate('0', '6', '2026')).toBe(false);
  });

  it('rejects day 32', () => {
    expect(isValidDate('32', '6', '2026')).toBe(false);
  });

  it('rejects year below 2024', () => {
    expect(isValidDate('1', '1', '2023')).toBe(false);
  });

  it('rejects year above 2099', () => {
    expect(isValidDate('1', '1', '2100')).toBe(false);
  });

  it('accepts boundary year 2024', () => {
    expect(isValidDate('1', '1', '2024')).toBe(true);
  });
});

// ── isValidTime ───────────────────────────────────────────────────────────────

describe('isValidTime', () => {
  it('accepts valid hour and minute', () => {
    expect(isValidTime('7', '30')).toBe(true);
  });

  it('accepts midnight 0:00', () => {
    expect(isValidTime('0', '0')).toBe(true);
  });

  it('accepts end-of-day 23:59', () => {
    expect(isValidTime('23', '59')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isValidTime('', '0')).toBe(false);
    expect(isValidTime('7', '')).toBe(false);
  });

  it('rejects hour 24', () => {
    expect(isValidTime('24', '0')).toBe(false);
  });

  it('rejects minute 60', () => {
    expect(isValidTime('12', '60')).toBe(false);
  });
});

// ── parseTarifa ───────────────────────────────────────────────────────────────

describe('parseTarifa', () => {
  it('parses plain number', () => {
    expect(parseTarifa('120000')).toBe(120000);
  });

  it('handles Colombian dot thousands separator', () => {
    expect(parseTarifa('120.000')).toBe(120000);
  });

  it('handles comma as decimal separator', () => {
    expect(parseTarifa('120,5')).toBe(120.5);
  });

  it('returns 0 for empty string', () => {
    expect(parseTarifa('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseTarifa('abc')).toBe(0);
  });
});

// ── calcularPresupuesto ───────────────────────────────────────────────────────

describe('calcularPresupuesto', () => {
  it('returns 0 for empty puestos', () => {
    expect(calcularPresupuesto([])).toBe(0);
  });

  it('sums tarifa × plazas across puestos', () => {
    const puestos: PuestoInput[] = [
      { key: '1', cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 2, tarifa_dia: '100.000' },
      { key: '2', cargo_id: 2, cargo_nombre: 'SISO',     plazas: 1, tarifa_dia: '150.000' },
    ];
    expect(calcularPresupuesto(puestos)).toBe(350000);
  });

  it('ignores invalid tarifa (treats as 0)', () => {
    const puestos: PuestoInput[] = [
      { key: '1', cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 3, tarifa_dia: '' },
    ];
    expect(calcularPresupuesto(puestos)).toBe(0);
  });
});

// ── validateStep1 ─────────────────────────────────────────────────────────────

describe('validateStep1', () => {
  const valid: WizardData = {
    titulo: 'Turno Corferias', descripcion: '',
    dia: '15', mes: '6', anio: '2026',
    hora_inicio_h: '7', hora_inicio_m: '0',
    hora_fin_h: '', hora_fin_m: '',
    lugar: '', latitud: null, longitud: null, para_quien: 'turnos', puestos: [],
  };

  it('returns null for valid step-1 data', () => {
    expect(validateStep1(valid)).toBeNull();
  });

  it('requires a title', () => {
    expect(validateStep1({ ...valid, titulo: '   ' })).toMatch(/título/i);
  });

  it('requires a valid date', () => {
    expect(validateStep1({ ...valid, dia: '', mes: '', anio: '' })).toMatch(/fecha/i);
  });

  it('requires a valid start time', () => {
    expect(validateStep1({ ...valid, hora_inicio_h: '', hora_inicio_m: '' })).toMatch(/inicio/i);
  });
});

// ── validateStep2 ─────────────────────────────────────────────────────────────

describe('validateStep2', () => {
  it('requires at least one puesto', () => {
    expect(validateStep2([])).toMatch(/rol/i);
  });

  it('returns null for valid puestos', () => {
    const puestos: PuestoInput[] = [
      { key: '1', cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 2, tarifa_dia: '100.000' },
    ];
    expect(validateStep2(puestos)).toBeNull();
  });

  it('rejects puesto with 0 plazas', () => {
    const puestos: PuestoInput[] = [
      { key: '1', cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 0, tarifa_dia: '100.000' },
    ];
    expect(validateStep2(puestos)).toMatch(/plaza/i);
  });

  it('rejects puesto with empty tarifa', () => {
    const puestos: PuestoInput[] = [
      { key: '1', cargo_id: 1, cargo_nombre: 'Auxiliar', plazas: 1, tarifa_dia: '' },
    ];
    expect(validateStep2(puestos)).toMatch(/tarifa/i);
  });
});
