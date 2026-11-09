'use strict';

// OfertasModel.marcarFallida registra la PROPUESTA (no la aplica) para quien ya trabajó y quedaría con menos pago,
// guardando lo que pagaba el turno antes (constancia del antes) y dejando su estado y pago intactos.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/fechaColombia', () => ({ ahoraColombiaSQL: jest.fn(() => '2026-11-09 10:00:00') }));
jest.mock('../utils/enTransaccion', () => ({
  enTransaccion: jest.fn(async (fn) => fn(global.__conn)),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');

beforeEach(() => {
  global.__conn = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };
});

test('la propuesta guarda el pago anterior y la deja pendiente, sin cambiar estado ni pago_total', async () => {
  await OfertasModel.marcarFallida(7, 3, [], 'Corte de luz', 999, [{ asignacionId: 500, monto: 120000 }]);

  const [sql, params] = global.__conn.query.mock.calls[0];
  expect(sql).toContain('compensacion_propuesta = ?');
  expect(sql).toContain('compensacion_pago_anterior = pago_total');
  expect(sql).toContain("compensacion_decision = 'pendiente'");
  expect(sql).toContain("estado = 'completado'");
  expect(sql).not.toMatch(/SET[^]*\bestado = 'fallido'/);
  expect(sql).not.toMatch(/pago_total = \?/);
  expect(params).toEqual([120000, 999, '2026-11-09 10:00:00', 'Corte de luz', 500, 7, 3]);
});

test('sin propuestas no ejecuta ninguna consulta de propuesta (solo las de siempre)', async () => {
  await OfertasModel.marcarFallida(7, 3, [], 'Fuerza mayor', 999);
  const sqls = global.__conn.query.mock.calls.map(([s]) => s);
  expect(sqls.some((s) => s.includes('compensacion_propuesta'))).toBe(false);
});
