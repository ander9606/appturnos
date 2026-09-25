export function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

/** Nombre completo del mes en español, ej. "agosto". */
function nombreMes(anio: number, mesIndex1: number): string {
  return new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(anio, mesIndex1 - 1, 1));
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Rango de un período legible rápido: si cubre un mes calendario completo
 * muestra solo "Agosto 2026"; si no, un rango corto tipo "7 – 22 de julio 2026"
 * o "28 jul – 3 ago 2026" cuando cruza de mes.
 */
export function fmtPeriodo(fechaInicio: string, fechaFin: string): string {
  const [yi, mi, di] = fechaInicio.split('-').map(Number);
  const [yf, mf, df] = fechaFin.split('-').map(Number);
  const ultimoDiaMesFin = new Date(yf, mf, 0).getDate();

  if (yi === yf && mi === mf && di === 1 && df === ultimoDiaMesFin) {
    return `${capitalizar(nombreMes(yi, mi))} ${yi}`;
  }
  if (yi === yf && mi === mf) {
    return `${di} – ${df} de ${nombreMes(yi, mi)} ${yi}`;
  }
  const mesInicioAbrev = nombreMes(yi, mi).slice(0, 3);
  const mesFinAbrev = nombreMes(yf, mf).slice(0, 3);
  return yi === yf
    ? `${di} ${mesInicioAbrev} – ${df} ${mesFinAbrev} ${yf}`
    : `${di} ${mesInicioAbrev} ${yi} – ${df} ${mesFinAbrev} ${yf}`;
}

export function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function fmtHrs(n: number) {
  // ponytail: MySQL DECIMAL vuelve como string (decimalNumbers:false en el pool) — upgrade path: castear en el backend
  return Number(n).toFixed(1);
}

/** Fecha con nombre de día, sin año — ej. "Jueves 6 ago". Para filas dentro de un
 *  período ya identificado (el año/mes ya está en el encabezado de la página). */
export function fmtDiaSemana(s: string): string {
  const d = new Date(s + 'T00:00:00');
  const dia = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(d);
  const diaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(d);
  return `${capitalizar(dia)} ${diaMes}`;
}

/** "09:12:00" (TIME de MySQL) → "9:12 a. m." Legible en vez de 24h con segundos. */
export function fmtHora(s: string | null): string {
  if (!s) return '—';
  const [h, m] = s.split(':').map(Number);
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, h, m));
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha de hoy en Bogotá (UTC-5, sin DST) como YYYY-MM-DD, para comparar contra columnas `date` del backend. */
export function bogotaToday(): string {
  const t = new Date(Date.now() - BOGOTA_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Primer día del mes actual (Bogotá) como YYYY-MM-DD — rango por defecto para vistas de liquidación mes-a-la-fecha. */
export function inicioMesActual(): string {
  return `${bogotaToday().slice(0, 7)}-01`;
}
