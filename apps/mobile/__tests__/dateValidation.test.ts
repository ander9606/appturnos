import { isValidCalendarDate, isChronological, isValidISODate } from '../lib/dateValidation';

describe('isValidCalendarDate', () => {
  it('accepts a real date', () => {
    expect(isValidCalendarDate(15, 6, 2026)).toBe(true);
  });

  it('rejects Feb 30 instead of letting it roll over to Mar', () => {
    expect(isValidCalendarDate(30, 2, 2024)).toBe(false);
  });

  it('accepts Feb 29 on a leap year', () => {
    expect(isValidCalendarDate(29, 2, 2024)).toBe(true);
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(isValidCalendarDate(29, 2, 2025)).toBe(false);
  });

  it('rejects month 13', () => {
    expect(isValidCalendarDate(1, 13, 2026)).toBe(false);
  });
});

describe('isChronological', () => {
  it('true when a is before b', () => {
    expect(isChronological('07:00', '15:00')).toBe(true);
  });

  it('true when a equals b', () => {
    expect(isChronological('07:00', '07:00')).toBe(true);
  });

  it('false when a is after b', () => {
    expect(isChronological('15:00', '07:00')).toBe(false);
  });

  it('works on ISO dates too', () => {
    expect(isChronological('2026-01-01', '2026-06-15')).toBe(true);
  });
});

describe('isValidISODate', () => {
  it('accepts a well-formed real date', () => {
    expect(isValidISODate('2026-05-21')).toBe(true);
  });

  it('rejects a calendar-invalid date', () => {
    expect(isValidISODate('2024-02-30')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidISODate('21/05/2026')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});
