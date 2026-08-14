/**
 * Validación compartida de fecha/hora — evita fechas de calendario
 * imposibles (31/02) y rangos invertidos (fin antes que inicio).
 */

/** true si day/month/year forman una fecha real (rechaza 31/02, 30/02, etc) */
export function isValidCalendarDate(day: number, month: number, year: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** true si a <= b — sirve para fechas ISO ("2026-05-21") y horas ("08:00") por igual */
export function isChronological(a: string, b: string): boolean {
  return a <= b;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** true si el string tiene forma YYYY-MM-DD y es una fecha real de calendario */
export function isValidISODate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return isValidCalendarDate(d, m, y);
}
