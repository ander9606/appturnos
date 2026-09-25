import { bogotaToday, toISODate } from './formatters';

export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface MonthCursor {
  year: number;
  month: number; // 1-12
}

/** Cursor de mes ± delta meses, con acarreo de año. */
export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + (cursor.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

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
