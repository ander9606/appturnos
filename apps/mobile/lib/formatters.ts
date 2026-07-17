/**
 * Formatters centralizados para AppTurnos.
 * - Fechas:  DD/MM/YYYY (display), ISO 8601 (transporte)
 * - Hora:    HH:mm 24h
 * - Moneda:  $1.234.567 COP (sin decimales)
 * - Números: separador miles ".", decimal ","
 */

// ── Fechas ────────────────────────────────────────────────────────────────

/** "2026-05-21" → "21/05/2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Date object → "21/05/2026" */
export function formatDateObj(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Date object → ISO "2026-05-21" usando partes locales del dispositivo */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Colombia = UTC-5, sin DST. Necesario para saber qué día/hora es en Bogotá
// independientemente del timezone configurado en el dispositivo.
export const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha de HOY en Bogotá (UTC-5), ignorando el timezone del dispositivo */
export function bogotaToday(): string {
  const t = new Date(Date.now() - BOGOTA_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** "2026-05-21" → "Jue 21 May" */
const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const dow = SHORT_DAYS[date.getDay()];
  const d   = date.getDate();
  const mon = SHORT_MONTHS[date.getMonth()];
  return `${dow} ${d} ${mon}`;
}

/** "2026-05-21" → "Jueves, 21 de mayo de 2026" */
export function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Hora ──────────────────────────────────────────────────────────────────

/** "14:30:00" → "14:30" */
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

/** "08:00:00" + "14:00:00" → "8:00 – 14:00" */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** "2026-06-03 06:10:00" o "2026-06-03T06:10:00" → "6:10" (sin cero inicial) */
export function formatTimestampHora(ts: string | null | undefined): string {
  if (!ts) return '—';
  const parts = ts.replace('T', ' ').split(' ');
  const time  = parts.length > 1 ? parts[1] : parts[0];
  return time.slice(0, 5).replace(/^0/, '');
}

/** Date → "14:30" */
export function formatTimeObj(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ── Moneda / Números ──────────────────────────────────────────────────────

/** 1234567 → "$1.234.567" */
export function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

/** 1234.56 → "1.234,56" */
export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── Duración ──────────────────────────────────────────────────────────────

/** 360 (minutos) → "6h" o "6h 30m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Nombres ───────────────────────────────────────────────────────────────

/** "María", "García" → "MG" */
export function getInitials(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

/** "María García López" → "María G." */
export function shortName(nombre: string, apellido: string): string {
  return `${nombre} ${apellido.charAt(0)}.`;
}
