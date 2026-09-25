import type { CalendarDay } from '../lib/calendar';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function MonthCalendar({
  weeks, renderDay, onDayClick,
}: {
  weeks: CalendarDay[][];
  renderDay: (day: CalendarDay) => React.ReactNode;
  onDayClick?: (day: CalendarDay) => void;
}) {
  const Cell = onDayClick ? 'button' : 'div';
  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-border">
      <div className="grid grid-cols-7 gap-px">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="bg-muted text-muted-foreground text-xs uppercase text-center font-medium py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {weeks.flat().map(day => (
          <Cell
            key={day.date}
            type={onDayClick ? 'button' : undefined}
            onClick={onDayClick ? () => onDayClick(day) : undefined}
            className={`bg-card text-left p-1.5 min-h-20 flex flex-col gap-1 ${day.inCurrentMonth ? '' : 'opacity-40'} ${onDayClick ? 'hover:bg-muted transition-colors' : ''}`}
          >
            <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${day.isToday ? 'bg-primary text-white' : 'text-muted-foreground'}`}>
              {Number(day.date.slice(8, 10))}
            </span>
            {renderDay(day)}
          </Cell>
        ))}
      </div>
    </div>
  );
}
