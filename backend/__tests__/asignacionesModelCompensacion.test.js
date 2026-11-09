'use strict';

// Las dos UPDATE de la propuesta de compensación son atómicas: solo actúan sobre un turno 'completado' con la
// propuesta 'pendiente'; una segunda llamada (doble toque) no hace nada.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/fechaColombia', () => ({ ahoraColombiaSQL: jest.fn(() => '2026-11-09 10:00:00') }));

const { pool } = require('../config/database');
const AsignacionesPostulacionModel = require('../modules/turnos/asignaciones/asignaciones.postulacion.model');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesPostulacionModel — propuesta de compensación', () => {
  test('autorizar: pasa a fallido con propuesta + bono, sin pago extra, solo si sigue completado y pendiente', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(AsignacionesPostulacionModel.autorizarCompensacion(7, 500)).resolves.toBe(true);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("estado = 'fallido'");
    expect(sql).toContain('pago_total = compensacion_propuesta + bono_monto');
    expect(sql).toContain('pago_extra = 0');
    expect(sql).toMatch(/estado = 'completado' AND compensacion_decision = 'pendiente'/);
    expect(params).toEqual(['2026-11-09 10:00:00', '2026-11-09 10:00:00', 500, 7]);
  });

  test('autorizar: si ya no estaba pendiente (doble toque) devuelve false', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(AsignacionesPostulacionModel.autorizarCompensacion(7, 500)).resolves.toBe(false);
  });

  test('rechazar: solo marca la decisión; no toca el estado ni el pago', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(AsignacionesPostulacionModel.rechazarCompensacion(7, 500)).resolves.toBe(true);

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("compensacion_decision = 'rechazada'");
    expect(sql).not.toMatch(/pago_total|SET estado/);
    expect(sql).toMatch(/estado = 'completado' AND compensacion_decision = 'pendiente'/);
  });
});
