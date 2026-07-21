import type { EstadoAsignacion } from '@api-client';

// ── Week helpers ──────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface WeekDay {
  date: Date;
  isoDate: string; // YYYY-MM-DD
  dayLabel: string; // "Lun"
  dayNum: number;   // 19
  monthLabel: string; // "May"
  isToday: boolean;
}

/** Flat range of days around today for the scrollable date strip. */
export function getDateRange(daysBack = 7, daysAhead = 42): WeekDay[] {
  const today = bogotaToday();
  const [y, mo, d] = today.split('-').map(Number);
  return Array.from({ length: daysBack + daysAhead }, (_, i) => {
    const dt = new Date(y, mo - 1, d - daysBack + i, 12); // noon avoids DST shift
    const iso = toISODate(dt);
    return {
      date:       dt,
      isoDate:    iso,
      dayLabel:   SHORT_DAYS[dt.getDay()],
      dayNum:     dt.getDate(),
      monthLabel: SHORT_MONTHS[dt.getMonth()],
      isToday:    iso === today,
    };
  });
}

/** Returns the 7 days of the week containing `ref` (Mon → Sun). */
export function getWeekDays(ref: Date = new Date()): WeekDay[] {
  const dow = ref.getDay(); // 0=Sun
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const today = bogotaToday();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISODate(d);
    return {
      date: d,
      isoDate: iso,
      dayLabel: SHORT_DAYS[d.getDay()],
      dayNum: d.getDate(),
      monthLabel: SHORT_MONTHS[d.getMonth()],
      isToday: iso === today,
    };
  });
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, sin DST

/** Fecha de HOY en Bogotá — independiente del timezone del dispositivo */
export function bogotaToday(): string {
  const t = new Date(Date.now() - BOGOTA_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Date → "YYYY-MM-DD" usando partes de fecha locales del dispositivo */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ¿Ya pasó la hora de inicio del turno (fecha + hora_inicio) en Bogotá? */
export function turnoYaInicio(fecha: string, horaInicio: string): boolean {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [hh, mm, ss] = horaInicio.split(':').map(Number);
  const nowBogota = new Date(Date.now() - BOGOTA_OFFSET_MS); // getUTC* == hora Bogotá
  const inicioBogotaMs = Date.UTC(y, mo - 1, d, hh, mm ?? 0, ss ?? 0);
  return nowBogota.getTime() >= inicioBogotaMs;
}

// ── Estado → visual ───────────────────────────────────────────────────────

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary';

interface EstadoConfig {
  label: string;
  badgeVariant: BadgeVariant;
  accentColor: string; // hex, for the left accent bar
}

const ESTADO_CONFIG: Record<EstadoAsignacion, EstadoConfig> = {
  pendiente:      { label: 'Pendiente',    badgeVariant: 'warning', accentColor: '#F59E0B' },
  confirmado:     { label: 'Confirmado',   badgeVariant: 'info',    accentColor: '#3B82F6' },
  en_progreso:    { label: 'En curso',     badgeVariant: 'success', accentColor: '#059669' },
  completado:     { label: 'Completado',   badgeVariant: 'default', accentColor: '#64748B' },
  no_presentado:  { label: 'No presentado',badgeVariant: 'danger',  accentColor: '#EF4444' },
  cancelado:      { label: 'Cancelado',    badgeVariant: 'danger',  accentColor: '#EF4444' },
};

export function getEstadoConfig(estado: EstadoAsignacion): EstadoConfig {
  return ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.pendiente;
}

// ── Time formatting ───────────────────────────────────────────────────────

/** "08:00:00" → "8:00" */
export function fmtTime(t: string): string {
  return t.slice(0, 5).replace(/^0/, '');
}

/** "08:00:00", "14:00:00" → "8:00 – 14:00" */
export function fmtRange(start: string, end: string | null): string {
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}
