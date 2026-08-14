import {
  buildFecha,
  buildTime,
  parseTarifa,
  calcularPresupuesto,
  validateStep1,
  validateStep2,
} from '../features/turnos/crear/utils';
import type { WizardData, PuestoInput } from '../features/turnos/crear/types';

// Fechas relativas a "hoy" — evita que el test se pudra cuando pase el tiempo
// (validateStep1 rechaza fechas pasadas).
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function timeAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ── buildFecha ────────────────────────────────────────────────────────────────

describe('buildFecha', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(buildFecha({ fecha: new Date(2026, 2, 5) } as WizardData)).toBe('2026-03-05');
  });

  it('pads single-digit month and day', () => {
    expect(buildFecha({ fecha: new Date(2026, 11, 15) } as WizardData)).toBe('2026-12-15');
  });
});

// ── buildTime ─────────────────────────────────────────────────────────────────

describe('buildTime', () => {
  it('pads single-digit hour and minute', () => {
    expect(buildTime(timeAt(7, 0))).toBe('07:00:00');
  });

  it('leaves double-digit values unchanged', () => {
    expect(buildTime(timeAt(14, 30))).toBe('14:30:00');
  });

  it('handles midnight', () => {
    expect(buildTime(timeAt(0, 0))).toBe('00:00:00');
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
    fecha: daysFromNow(30),
    hora_inicio: timeAt(7, 0),
    hora_fin: timeAt(15, 0),
    lugar: '', latitud: null, longitud: null,
    encargado_nombre: '', encargado_telefono: '',
    para_quien: 'turnos', visibilidad: 'abierta', destinatarios: [], puestos: [],
  };

  it('returns null for valid step-1 data', () => {
    expect(validateStep1(valid)).toBeNull();
  });

  it('accepts today as the fecha', () => {
    expect(validateStep1({ ...valid, fecha: daysFromNow(0) })).toBeNull();
  });

  it('requires a title', () => {
    expect(validateStep1({ ...valid, titulo: '   ' })).toMatch(/título/i);
  });

  it('requires a fecha', () => {
    expect(validateStep1({ ...valid, fecha: null })).toMatch(/fecha/i);
  });

  it('rejects a fecha in the past', () => {
    expect(validateStep1({ ...valid, fecha: daysFromNow(-1) })).toMatch(/fecha/i);
  });

  it('requires a start time', () => {
    expect(validateStep1({ ...valid, hora_inicio: null })).toMatch(/inicio/i);
  });

  it('requires an end time', () => {
    expect(validateStep1({ ...valid, hora_fin: null })).toMatch(/fin/i);
  });

  it('rejects hora_fin before hora_inicio', () => {
    expect(
      validateStep1({ ...valid, hora_inicio: timeAt(15, 0), hora_fin: timeAt(7, 0) })
    ).toMatch(/fin.*inicio/i);
  });

  it('rejects hora_fin equal to hora_inicio', () => {
    expect(
      validateStep1({ ...valid, hora_inicio: timeAt(9, 0), hora_fin: timeAt(9, 0) })
    ).toMatch(/fin.*inicio/i);
  });

  it('requires at least one destinatario when visibilidad is dirigida', () => {
    expect(validateStep1({ ...valid, visibilidad: 'dirigida', destinatarios: [] })).toMatch(/persona/i);
  });

  it('accepts dirigida with at least one destinatario', () => {
    expect(
      validateStep1({ ...valid, visibilidad: 'dirigida', destinatarios: [{ id: 1, nombre: 'Ana', apellido: 'Ruiz' }] })
    ).toBeNull();
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
