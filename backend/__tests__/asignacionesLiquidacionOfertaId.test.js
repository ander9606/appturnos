'use strict';

// La vista "por turno" de liquidación (agrupar por oferta en vez de por
// trabajador) necesita oferta_id en cada línea para agrupar de forma
// confiable — título+fecha no garantiza unicidad entre turnos distintos.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const AsignacionesLiquidacionModel = require('../modules/turnos/asignaciones/asignaciones.liquidacion.model');

describe('AsignacionesLiquidacionModel.liquidacion', () => {
  test('cada línea de turno incluye oferta_id para poder agruparse por turno', async () => {
    pool.query.mockResolvedValue([[
      {
        asignacion_id: 1, horas_trabajadas: 8, pago_total: 100000, pago_extra: 0, bono_monto: 0,
        bono_motivo: null, hora_ingreso_real: null, hora_egreso_real: null,
        oferta_id: 42, oferta_titulo: 'Montaje feria', oferta_fecha: '2026-01-05',
        hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00', lugar: 'Corferias',
        tarifa_dia: 100000, cargo_nombre: 'Auxiliar', calificacion: null, firmado_trabajador: 1,
        trabajador_id: 5, nombre: 'Ana', apellido: 'Pérez', cargo_descripcion: 'Auxiliar',
        usuario_id: 9, cedula: '123', ranking: null, total_calificaciones: 0,
      },
    ]]);

    const resultado = await AsignacionesLiquidacionModel.liquidacion(1, { fechaInicio: null, fechaFin: null });

    expect(resultado[0].turnos[0].oferta_id).toBe(42);
  });
});
