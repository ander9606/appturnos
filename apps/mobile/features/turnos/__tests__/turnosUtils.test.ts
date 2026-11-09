import { getWeekDays, toISODate, getEstadoConfig, turnoEnEspera, cuentaComoGanancia } from '../turnosUtils';
import { bogotaToday } from '@/lib/formatters';
import type { EstadoAsignacion } from '@api-client';
import { ESTADOS_ASIGNACION } from '@api-client';

describe('toISODate', () => {
  it('convierte un Date a YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 5, 19))).toBe('2026-06-19');
  });
});

describe('getWeekDays', () => {
  // 2026-06-19 es viernes (índice 5)
  const REF = new Date(2026, 5, 19);

  it('devuelve 7 días', () => {
    expect(getWeekDays(REF)).toHaveLength(7);
  });

  it('la semana empieza en lunes', () => {
    const semana = getWeekDays(REF);
    expect(semana[0].dayLabel).toBe('Lun');
    expect(semana[6].dayLabel).toBe('Dom');
  });

  it('el lunes de la semana de 2026-06-19 es 2026-06-15', () => {
    const semana = getWeekDays(REF);
    expect(semana[0].isoDate).toBe('2026-06-15');
  });

  it('marca correctamente el día de hoy', () => {
    const hoy = new Date();
    const isoHoy = bogotaToday();
    const semana = getWeekDays(hoy);
    const diaHoy = semana.find((d) => d.isoDate === isoHoy);
    expect(diaHoy?.isToday).toBe(true);
    const otrosDias = semana.filter((d) => d.isoDate !== isoHoy);
    expect(otrosDias.every((d) => !d.isToday)).toBe(true);
  });
});

describe('getEstadoConfig', () => {
  it('devuelve config para todos los estados conocidos', () => {
    for (const estado of ESTADOS_ASIGNACION) {
      const cfg = getEstadoConfig(estado as EstadoAsignacion);
      expect(cfg).toBeDefined();
      expect(cfg.label).toBeTruthy();
      expect(cfg.badgeVariant).toBeTruthy();
    }
  });

  it('tiene color de acento en formato hex para cada estado', () => {
    for (const estado of ESTADOS_ASIGNACION) {
      const cfg = getEstadoConfig(estado as EstadoAsignacion);
      expect(cfg.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('turnos en espera de autorización (propuesta de compensación sin responder)', () => {
  test('completado con propuesta pendiente: en espera, no cuenta como ganancia', () => {
    const a = { estado: 'completado', compensacion_decision: 'pendiente' } as const;
    expect(turnoEnEspera(a)).toBe(true);
    expect(cuentaComoGanancia(a)).toBe(false);
  });

  test('completado normal, sin propuesta o con propuesta rechazada: cuenta (se paga según contrato)', () => {
    expect(cuentaComoGanancia({ estado: 'completado' })).toBe(true);
    expect(cuentaComoGanancia({ estado: 'completado', compensacion_decision: null })).toBe(true);
    expect(cuentaComoGanancia({ estado: 'completado', compensacion_decision: 'rechazada' })).toBe(true);
    expect(turnoEnEspera({ estado: 'completado', compensacion_decision: 'rechazada' })).toBe(false);
  });

  test('fallido (propuesta autorizada o compensación directa) cuenta; lo demás no', () => {
    expect(cuentaComoGanancia({ estado: 'fallido', compensacion_decision: 'autorizada' })).toBe(true);
    expect(cuentaComoGanancia({ estado: 'fallido' })).toBe(true);
    expect(cuentaComoGanancia({ estado: 'cancelado' })).toBe(false);
    expect(cuentaComoGanancia({ estado: 'en_progreso' })).toBe(false);
  });
});

