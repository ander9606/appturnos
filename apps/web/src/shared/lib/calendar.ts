import { bogotaToday } from './format';

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
