'use strict';

const { enVentana } = require('../modules/nomina/registros/recordatorioIngreso.worker');

describe('enVentana', () => {
  it('is true right at the start of the 15-min window (15 min before)', () => {
    expect(enVentana('08:00:00', '07:45:00')).toBe(true);
  });

  it('is true a couple minutes before the expected time', () => {
    expect(enVentana('08:00:00', '07:58:00')).toBe(true);
  });

  it('is false more than 15 min before (outside the window)', () => {
    expect(enVentana('08:00:00', '07:44:00')).toBe(false);
  });

  it('is false exactly at the expected time (should have already fired earlier in the window)', () => {
    expect(enVentana('08:00:00', '08:00:00')).toBe(false);
  });

  it('is false after the expected time', () => {
    expect(enVentana('08:00:00', '08:05:00')).toBe(false);
  });

  it('handles a shift starting past midnight (wraparound)', () => {
    expect(enVentana('00:05:00', '23:55:00')).toBe(true);
    expect(enVentana('00:05:00', '23:30:00')).toBe(false);
  });

  it('accepts a HH:MM:SS TIME string as returned by mysql2 with dateStrings:true', () => {
    expect(enVentana('06:30:00', '06:20:00')).toBe(true);
  });
});
