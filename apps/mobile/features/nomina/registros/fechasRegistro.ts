

export const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Modal: editar registro existente ─────────────────────────────────────

/** Parsea "HH:MM:SS" o "HH:MM" del registro a un Date de hoy con esa hora, para el picker. */
export function horaAFecha(hora: string | null | undefined): Date | null {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
