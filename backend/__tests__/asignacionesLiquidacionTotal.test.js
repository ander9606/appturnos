'use strict';

// El total del tablero de Turnos se calcula en SQL (SUM) en vez de traer la
// liquidación completa. Debe respetar las mismas reglas que liquidacion().
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const Model = require('../modules/turnos/asignaciones/asignaciones.liquidacion.model');

describe('AsignacionesLiquidacionModel.totalLiquidacion', () => {
  beforeEach(() => pool.query.mockReset());

  test('devuelve el total como número y filtra por empresa y rango', async () => {
    pool.query.mockResolvedValue([[{ total: '1250500.00' }]]);

    const total = await Model.totalLiquidacion(7, { fechaInicio: '2026-06-01', fechaFin: '2026-06-15' });

    expect(total).toBe(1250500);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([7, '2026-06-01', '2026-06-15']);
    expect(sql).toMatch(/SUM\(/);
    // reglas compartidas con liquidacion(): sin nómina, solo firmados o fallidos, descuentos aceptados
    expect(sql).toContain("t.tipo != 'nomina'");
    expect(sql).toContain("a.estado = 'fallido' OR COALESCE(cd.firmado_trabajador, 0) = 1");
    expect(sql).toContain("d.estado = 'aceptado'");
  });

  test('sin rango no agrega filtros de fecha', async () => {
    pool.query.mockResolvedValue([[{ total: 0 }]]);
    const total = await Model.totalLiquidacion(7, {});
    expect(total).toBe(0);
    expect(pool.query.mock.calls[0][1]).toEqual([7]);
  });
});
