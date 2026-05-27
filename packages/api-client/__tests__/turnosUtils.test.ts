/**
 * Tests for apps/mobile/features/turnos/turnosUtils.ts
 * Imported via the @/ alias (mapped to apps/mobile/) so ts-jest can resolve
 * the file without needing the mobile package's npm tree.
 */
import {
  fmtTime,
  fmtRange,
  getEstadoConfig,
  getWeekDays,
  toISODate,
} from '@/features/turnos/turnosUtils';

// ── fmtTime ───────────────────────────────────────────────────────────────────

describe('fmtTime', () => {
  test('strips leading zero from hour', () => {
    expect(fmtTime('08:00:00')).toBe('8:00');
    expect(fmtTime('09:30:00')).toBe('9:30');
  });

  test('keeps two-digit hour as-is', () => {
    expect(fmtTime('14:00:00')).toBe('14:00');
    expect(fmtTime('21:45:00')).toBe('21:45');
  });

  test('midnight displays as 0:00', () => {
    expect(fmtTime('00:00:00')).toBe('0:00');
  });

  test('works without seconds', () => {
    expect(fmtTime('08:00')).toBe('8:00');
  });
});

// ── fmtRange ──────────────────────────────────────────────────────────────────

describe('fmtRange', () => {
  test('formats start – end', () => {
    expect(fmtRange('08:00:00', '16:00:00')).toBe('8:00 – 16:00');
  });

  test('null end → only start', () => {
    expect(fmtRange('08:00:00', null)).toBe('8:00');
  });

  test('overnight range', () => {
    expect(fmtRange('22:00:00', '06:00:00')).toBe('22:00 – 6:00');
  });
});

// ── getEstadoConfig ───────────────────────────────────────────────────────────

describe('getEstadoConfig', () => {
  test('pendiente → warning badge + amber accent', () => {
    const cfg = getEstadoConfig('pendiente');
    expect(cfg.badgeVariant).toBe('warning');
    expect(cfg.label).toBe('Pendiente');
    expect(cfg.accentColor).toBeTruthy();
  });

  test('confirmado → info badge', () => {
    expect(getEstadoConfig('confirmado').badgeVariant).toBe('info');
  });

  test('en_progreso → success badge', () => {
    expect(getEstadoConfig('en_progreso').badgeVariant).toBe('success');
  });

  test('completado → default badge', () => {
    expect(getEstadoConfig('completado').badgeVariant).toBe('default');
  });

  test('no_presentado → danger badge', () => {
    expect(getEstadoConfig('no_presentado').badgeVariant).toBe('danger');
  });

  test('cancelado → danger badge', () => {
    expect(getEstadoConfig('cancelado').badgeVariant).toBe('danger');
  });

  test('all estados have a non-empty label', () => {
    const estados = ['pendiente', 'confirmado', 'en_progreso', 'completado', 'no_presentado', 'cancelado'] as const;
    for (const e of estados) {
      expect(getEstadoConfig(e).label.length).toBeGreaterThan(0);
    }
  });
});

// ── toISODate ─────────────────────────────────────────────────────────────────

describe('toISODate', () => {
  test('returns YYYY-MM-DD', () => {
    const d = new Date('2025-06-15T12:00:00Z');
    expect(toISODate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('strips time portion', () => {
    const d = new Date('2025-03-25T23:59:59.999Z');
    expect(toISODate(d)).toBe('2025-03-25');
  });
});

// ── getWeekDays ───────────────────────────────────────────────────────────────

describe('getWeekDays', () => {
  // Use a fixed Monday reference to have deterministic results.
  const refMonday = new Date('2025-06-09T12:00:00'); // Monday Jun 9 2025

  test('returns exactly 7 days', () => {
    expect(getWeekDays(refMonday)).toHaveLength(7);
  });

  test('first day is Monday', () => {
    const days = getWeekDays(refMonday);
    expect(days[0].dayLabel).toBe('Lun');
  });

  test('last day is Sunday', () => {
    const days = getWeekDays(refMonday);
    expect(days[6].dayLabel).toBe('Dom');
  });

  test('isoDate is in YYYY-MM-DD format', () => {
    const days = getWeekDays(refMonday);
    for (const d of days) {
      expect(d.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('isoDate spans Mon–Sun of the correct week', () => {
    const days = getWeekDays(refMonday);
    expect(days[0].isoDate).toBe('2025-06-09');
    expect(days[6].isoDate).toBe('2025-06-15');
  });

  test('dayNum matches the day of month', () => {
    const days = getWeekDays(refMonday);
    expect(days[0].dayNum).toBe(9);
    expect(days[6].dayNum).toBe(15);
  });

  test('isToday is false for days in a past week', () => {
    const past = new Date('2023-01-02T00:00:00');
    const days = getWeekDays(past);
    expect(days.every((d) => !d.isToday)).toBe(true);
  });

  test('works when ref is a Sunday (last day of the week)', () => {
    const sunday = new Date('2025-06-15T12:00:00');
    const days = getWeekDays(sunday);
    expect(days[0].isoDate).toBe('2025-06-09'); // same week's Monday
    expect(days[6].isoDate).toBe('2025-06-15'); // the Sunday itself
  });

  test('works when ref is in the middle of the week', () => {
    const wednesday = new Date('2025-06-11T12:00:00');
    const days = getWeekDays(wednesday);
    expect(days[0].isoDate).toBe('2025-06-09');
    expect(days[6].isoDate).toBe('2025-06-15');
  });
});
