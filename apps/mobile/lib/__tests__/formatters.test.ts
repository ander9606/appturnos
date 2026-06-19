import {
  formatDate,
  formatDateObj,
  toISODate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatTimestampHora,
  formatDuration,
  getInitials,
  shortName,
} from '../formatters';

describe('formatDate', () => {
  it('convierte ISO a DD/MM/YYYY', () => {
    expect(formatDate('2026-05-21')).toBe('21/05/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });
});

describe('formatDateObj', () => {
  it('formatea un objeto Date a DD/MM/YYYY', () => {
    expect(formatDateObj(new Date(2026, 4, 21))).toBe('21/05/2026');
  });
});

describe('toISODate', () => {
  it('devuelve YYYY-MM-DD desde un Date', () => {
    expect(toISODate(new Date(2026, 4, 21))).toBe('2026-05-21');
  });
});

describe('formatShortDate', () => {
  it('2026-06-19 (viernes) → "Vie 19 Jun"', () => {
    expect(formatShortDate('2026-06-19')).toBe('Vie 19 Jun');
  });
});

describe('formatTime', () => {
  it('recorta segundos de HH:MM:SS', () => {
    expect(formatTime('14:30:00')).toBe('14:30');
    expect(formatTime('08:05:59')).toBe('08:05');
  });
});

describe('formatTimeRange', () => {
  it('une dos tiempos con guión', () => {
    expect(formatTimeRange('08:00:00', '14:00:00')).toBe('08:00 – 14:00');
  });
});

describe('formatTimestampHora', () => {
  it('extrae la hora de un timestamp completo', () => {
    expect(formatTimestampHora('2026-06-03 06:10:00')).toBe('6:10');
    expect(formatTimestampHora('2026-06-03T14:05:00')).toBe('14:05');
  });

  it('devuelve "—" para valores nulos o vacíos', () => {
    expect(formatTimestampHora(null)).toBe('—');
    expect(formatTimestampHora(undefined)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('muestra solo horas cuando no hay minutos', () => {
    expect(formatDuration(360)).toBe('6h');
  });

  it('muestra horas y minutos cuando hay residuo', () => {
    expect(formatDuration(390)).toBe('6h 30m');
  });
});

describe('getInitials', () => {
  it('devuelve iniciales en mayúscula', () => {
    expect(getInitials('María', 'García')).toBe('MG');
    expect(getInitials('juan', 'pérez')).toBe('JP');
  });
});

describe('shortName', () => {
  it('abrevia el apellido con punto', () => {
    expect(shortName('María', 'García López')).toBe('María G.');
  });
});
