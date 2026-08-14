export function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'));
}

export function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function fmtHrs(n: number) {
  // ponytail: MySQL DECIMAL vuelve como string (decimalNumbers:false en el pool) — upgrade path: castear en el backend
  return Number(n).toFixed(1);
}

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha de hoy en Bogotá (UTC-5, sin DST) como YYYY-MM-DD, para comparar contra columnas `date` del backend. */
export function bogotaToday(): string {
  const t = new Date(Date.now() - BOGOTA_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
