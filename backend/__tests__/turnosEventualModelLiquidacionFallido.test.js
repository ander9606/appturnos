'use strict';

// La liquidación por ciclo de turnos eventuales debe incluir la compensación de un
// turno 'fallido' (fuerza mayor) igual que un 'completado'.
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));

const { pool } = require('../config/database');
const TurnosEventualModel = require('../modules/turnos-eventual/turnos-eventual.model');

test("liquidacion suma los turnos 'completado' y 'fallido'", async () => {
  await TurnosEventualModel.liquidacion(7, 5, ['turnos', 'ambos']);
  const sql = pool.query.mock.calls[0][0];
  expect(sql).toMatch(/a\.estado IN \('completado', 'fallido'\)/);
});

test('la liquidación eventual no cuenta un turno en espera de que el trabajador autorice una compensación', async () => {
  pool.query.mockClear();
  await TurnosEventualModel.liquidacion(7, 5, ['turnos']);
  const sql = pool.query.mock.calls[0][0];
  expect(sql).toMatch(/a\.compensacion_decision IS NULL OR a\.compensacion_decision <> 'pendiente'/);
});
