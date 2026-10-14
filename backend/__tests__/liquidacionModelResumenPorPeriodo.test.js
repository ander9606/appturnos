'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));

const { pool } = require('../config/database');
const LiquidacionModel = require('../modules/nomina/liquidacion/liquidacion.model');

describe('LiquidacionModel.resumenPorPeriodo — dias_sin_subsidio', () => {
  test('solo cuenta ausencia/incapacidad/licencia/vacación SIN hora_entrada (no hubo desplazamiento)', async () => {
    await LiquidacionModel.resumenPorPeriodo(1, 2);

    const [sql] = pool.query.mock.calls[0];
    // Un día de incapacidad con hora_entrada marcada (medio día trabajado) sí
    // tuvo desplazamiento y no debe restar del auxilio de transporte.
    expect(sql).toMatch(/hora_entrada\s+IS\s+NULL/i);
    expect(sql).toMatch(/tipo_dia IN \('ausencia', 'incapacidad', 'licencia', 'vacacion'\)/);
  });
});
