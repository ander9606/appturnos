'use strict';

// Bug real: con 2 cuentas de cobro generadas para el mismo período (original +
// complementaria por ajuste), el gestor solo veía/descargaba la última — la
// complementaria, casi siempre más pequeña — y pagaba de menos. liquidacion()
// debe devolver TODAS las cuentas del rango, no solo la de mayor secuencia.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const AsignacionesLiquidacionModel = require('../modules/turnos/asignaciones/asignaciones.liquidacion.model');

describe('AsignacionesLiquidacionModel.liquidacion — cuentas_cobro', () => {
  test('devuelve las dos cuentas (original y complementaria), no solo la última', async () => {
    pool.query.mockResolvedValue([[
      {
        asignacion_id: 1, horas_trabajadas: 8, pago_total: 100000, pago_extra: 0, bono_monto: 0,
        bono_motivo: null, hora_ingreso_real: null, hora_egreso_real: null,
        cuentas_cobro_json: JSON.stringify([
          { id: 10, secuencia: 1, valor_total: 500000, firmado_trabajador: 1 },
          { id: 11, secuencia: 2, valor_total: 20000, firmado_trabajador: 0 },
        ]),
        oferta_id: 42, oferta_titulo: 'Montaje feria', oferta_fecha: '2026-01-05',
        hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00', lugar: 'Corferias',
        tarifa_dia: 100000, cargo_nombre: 'Auxiliar', calificacion: null, firmado_trabajador: 1,
        trabajador_id: 5, nombre: 'Ana', apellido: 'Pérez', cargo_descripcion: 'Auxiliar',
        usuario_id: 9, cedula: '123', ranking: null, total_calificaciones: 0,
      },
    ]]);

    const [resultado] = await AsignacionesLiquidacionModel.liquidacion(1, { fechaInicio: '2026-01-01', fechaFin: '2026-01-15' });

    expect(resultado.cuentas_cobro).toEqual([
      { id: 10, secuencia: 1, valor_total: 500000, firmado_trabajador: true },
      { id: 11, secuencia: 2, valor_total: 20000, firmado_trabajador: false },
    ]);
  });

  test('sin cuentas generadas para el rango, devuelve []', async () => {
    pool.query.mockResolvedValue([[
      {
        asignacion_id: 1, horas_trabajadas: 8, pago_total: 100000, pago_extra: 0, bono_monto: 0,
        bono_motivo: null, hora_ingreso_real: null, hora_egreso_real: null,
        cuentas_cobro_json: null,
        oferta_id: 42, oferta_titulo: 'Montaje feria', oferta_fecha: '2026-01-05',
        hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00', lugar: 'Corferias',
        tarifa_dia: 100000, cargo_nombre: 'Auxiliar', calificacion: null, firmado_trabajador: 1,
        trabajador_id: 5, nombre: 'Ana', apellido: 'Pérez', cargo_descripcion: 'Auxiliar',
        usuario_id: 9, cedula: '123', ranking: null, total_calificaciones: 0,
      },
    ]]);

    const [resultado] = await AsignacionesLiquidacionModel.liquidacion(1, { fechaInicio: null, fechaFin: null });

    expect(resultado.cuentas_cobro).toEqual([]);
  });
});
