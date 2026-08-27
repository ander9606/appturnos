import { bogotaToday, toISODate } from './formatters';

// ponytail: el array de nombres de mes, el header de navegación (‹ mes/año ›) y el wraparound
// diciembre/enero del cursor están copiados en app/(tabs)/turnos.tsx, app/(tabs)/nomina.tsx y
// features/nomina/trabajador/NominaTrabajadorView.tsx (3-8 veces en total) en vez de vivir acá una
// sola vez — apps/web/CalendarioPage.tsx sí lo resolvió una vez con un helper cambiarMes(delta).
// Upgrade path: exportar MESES_LARGOS y un shiftMonth(cursor, delta) desde este archivo (o un
// useMonthView() hook) e importarlos en los 3 consumidores en vez de retipearlos.

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/** Grilla de semanas (lunes a domingo) que cubre el mes, con relleno de días adyacentes. */
export function getMonthGrid(year: number, month: number /* 1-12 */): CalendarDay[][] {
  const today = bogotaToday();
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Lun=0 ... Dom=6
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(year, month - 1, 1 - startOffset);
  for (let i = 0; i < totalCells; i++) {
    if (i % 7 === 0) weeks.push([]);
    const iso = toISODate(cursor);
    weeks[weeks.length - 1].push({
      date: iso,
      inCurrentMonth: cursor.getMonth() === month - 1,
      isToday: iso === today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
}
