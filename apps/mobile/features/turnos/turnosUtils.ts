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

/** Returns the 7 days of the week containing `ref` (Mon → Sun). */
export function getWeekDays(ref: Date = new Date()): WeekDay[] {
  const dow = ref.getDay(); // 0=Sun
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const today = toISODate(new Date());

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

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
