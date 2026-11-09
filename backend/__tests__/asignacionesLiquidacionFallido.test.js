'use strict';

// Un turno 'fallido' (compensación por fuerza mayor — ver
// OfertasService.marcarFallida) nunca tiene fila en contratos_diarios,
// porque no es un turno trabajado: no hay contrato que firmar. Sin un caso
// especial, el LEFT JOIN a contratos_diarios deja firmado_trabajador en NULL
// → COALESCE a 0 → la compensación quedaba atascada para siempre en
// turnos_pendientes_firma, sin sumarse nunca a lo que hay que pagarle.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const AsignacionesLiquidacionModel = require('../modules/turnos/asignaciones/asignaciones.liquidacion.model');

function filaBase(overrides) {
  return {
    asignacion_id: 1, estado: 'fallido', compensacion_motivo: 'Corte de luz',
    horas_trabajadas: 3, pago_total: 120000, pago_extra: 0, bono_monto: 0,
    bono_motivo: null, hora_ingreso_real: null, hora_egreso_real: null,
    oferta_id: 42, oferta_titulo: 'Montaje feria', oferta_fecha: '2026-01-05',
    hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00', lugar: 'Corferias',
    tarifa_dia: 120000, cargo_nombre: 'Auxiliar', calificacion: null,
    firmado_trabajador: 0, // nunca hubo contrato para este turno
    trabajador_id: 5, nombre: 'Ana', apellido: 'Pérez', cargo_descripcion: 'Auxiliar',
    usuario_id: 9, cedula: '123', ranking: null, total_calificaciones: 0,
    ...overrides,
  };
}

describe('AsignacionesLiquidacionModel.liquidacion — turnos fallidos', () => {
  test('la compensación se suma al pago_total, no queda atascada en turnos_pendientes_firma', async () => {
    pool.query.mockResolvedValue([[filaBase()]]);

    const [trabajador] = await AsignacionesLiquidacionModel.liquidacion(1, {});

    expect(trabajador.turnos_pendientes_firma).toBe(0);
    expect(trabajador.pago_total).toBe(120000);
    expect(trabajador.turnos[0].estado).toBe('fallido');
    expect(trabajador.turnos[0].compensacion_motivo).toBe('Corte de luz');
  });

  test('un turno completado sin firma sigue atascado como antes (no se rompió el caso normal)', async () => {
    pool.query.mockResolvedValue([[filaBase({ estado: 'completado', compensacion_motivo: null, firmado_trabajador: 0 })]]);

    const [trabajador] = await AsignacionesLiquidacionModel.liquidacion(1, {});

    expect(trabajador.turnos_pendientes_firma).toBe(1);
    expect(trabajador.pago_total).toBe(0);
  });

  // Propuesta de compensación sin respuesta del trabajador: el turno queda en el aire (ver
  // OfertasService.marcarFallida): no suma ni resta, y vuelve a contar según lo que decida.
  describe('propuesta de compensación sin responder', () => {
    const enEspera = (extra = {}) => filaBase({
      asignacion_id: 2, estado: 'completado', compensacion_motivo: 'Corte de luz', compensacion_decision: 'pendiente',
      firmado_trabajador: 1, pago_total: 135000, ...extra,
    });

    test('queda en espera: no suma ni resta en los totales y se cuenta aparte', async () => {
      pool.query.mockResolvedValue([[filaBase(), enEspera()]]); // un fallido normal ($120.000) y uno en espera ($135.000)

      const [trabajador] = await AsignacionesLiquidacionModel.liquidacion(1, {});

      expect(trabajador.pago_total).toBe(120000); // solo el fallido; el turno en espera no entra
      expect(trabajador.turnos_pendientes_autorizacion).toBe(1);
      expect(trabajador.turnos_pendientes_firma).toBe(0);
      expect(trabajador.turnos.find((t) => t.asignacion_id === 2)).toMatchObject({ pendiente_autorizacion: true, estado: 'completado' });
      expect(trabajador.turnos.find((t) => t.asignacion_id === 1).pendiente_autorizacion).toBe(false);
    });

    test('si el trabajador la rechazó, vuelve a contar según su contrato', async () => {
      pool.query.mockResolvedValue([[enEspera({ compensacion_decision: 'rechazada' })]]);

      const [trabajador] = await AsignacionesLiquidacionModel.liquidacion(1, {});

      expect(trabajador.pago_total).toBe(135000);
      expect(trabajador.turnos_pendientes_autorizacion).toBe(0);
    });
  });
});
