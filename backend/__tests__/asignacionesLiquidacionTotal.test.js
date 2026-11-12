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
    // un turno completado con compensación aún pendiente de autorización no cuenta,
    // aunque ya tenga el contrato diario firmado (liquidacion() lo deja en
    // turnos_pendientes_autorizacion y no lo suma a pago_total)
    expect(sql).toContain("NOT (a.estado = 'completado' AND a.compensacion_decision = 'pendiente')");
  });

  test('no suma un turno completado con compensación pendiente aunque esté firmado', async () => {
    // Regresión: antes del fix, firmado_trabajador=1 bastaba para sumarlo aunque
    // compensacion_decision siguiera 'pendiente' — liquidacion() lo excluye.
    pool.query.mockResolvedValue([[{ total: 0 }]]);
    await Model.totalLiquidacion(7, {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("NOT (a.estado = 'completado' AND a.compensacion_decision = 'pendiente')");
  });

  test('sin rango no agrega filtros de fecha', async () => {
    pool.query.mockResolvedValue([[{ total: 0 }]]);
    const total = await Model.totalLiquidacion(7, {});
    expect(total).toBe(0);
    expect(pool.query.mock.calls[0][1]).toEqual([7]);
  });
});
