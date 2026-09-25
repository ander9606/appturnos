'use strict';

// Un trabajador_nomina que toma un turno eventual (extra) se paga como bono
// sobre su salario ya existente, no como un contrato civil independiente —
// no debe pasar por ContratosService.generarParaAsignacion (que exige
// salario mínimo diario y audita acumulación de contratos, reglas pensadas
// para trabajador_turnos). Su firma ya queda en asignaciones_turno.firma_digital
// al marcar egreso (columna genérica, sin chequeo de rol).
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/contratos/contratos.service');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/integracion/costo-labor.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosService  = require('../modules/contratos/contratos.service');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesService.corregir — turno eventual de nómina', () => {
  const base = {
    id: 500, empresa_id: 7, oferta_id: 1, estado: 'en_progreso',
    hora_ingreso_real: '2026-09-14T10:00:00.000Z', tarifa_dia: 20000, bono_monto: 0,
  };

  beforeEach(() => {
    AsignacionesModel.obtenerPorId.mockResolvedValue(base);
    AsignacionesModel.corregir.mockResolvedValue(undefined);
    AsignacionesModel.actualizarPagoTotal.mockResolvedValue(undefined);
    ContratosService.generarParaAsignacion.mockResolvedValue(null);
  });

  test('nomina: no genera contrato ni notifica "falta firmar tu contrato"', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, usuario_id: 42, trabajador_tipo: 'nomina',
    });

    await AsignacionesService.corregir(7, 500, 1, {
      hora_ingreso_real: base.hora_ingreso_real,
      hora_egreso_real: '2026-09-14T14:00:00.000Z',
    }, 'Gestor');

    expect(ContratosService.generarParaAsignacion).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'contrato.pendiente_firma' })
    );
  });

  test('turnos: sigue generando contrato y notificando como antes', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, usuario_id: 42, trabajador_tipo: 'turnos',
    });

    await AsignacionesService.corregir(7, 500, 1, {
      hora_ingreso_real: base.hora_ingreso_real,
      hora_egreso_real: '2026-09-14T14:00:00.000Z',
    }, 'Gestor');

    expect(ContratosService.generarParaAsignacion).toHaveBeenCalledWith(7, 500);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'contrato.pendiente_firma' })
    );
  });
});

describe('AsignacionesService.cerrarMasivo — turno eventual de nómina', () => {
  test('filtra a los trabajadores nomina fuera de la generación de contrato y del aviso de firma', async () => {
    const { pool } = require('../config/database');
    pool.query
      .mockResolvedValueOnce([[{ id: 100 }]]) // oferta pertenece a la empresa
      .mockResolvedValueOnce([[
        { id: 501, usuario_id: 42, trabajador_tipo: 'nomina' },
        { id: 502, usuario_id: 43, trabajador_tipo: 'turnos' },
      ]]) // enProgreso
      .mockResolvedValueOnce([[]]); // confirmados

    AsignacionesModel.cerrarMasivo.mockResolvedValue({ cerradas: 2, noPresentados: 0 });
    ContratosService.generarParaAsignacion.mockResolvedValue(null);

    await AsignacionesService.cerrarMasivo(7, 100, []);

    expect(ContratosService.generarParaAsignacion).toHaveBeenCalledTimes(1);
    expect(ContratosService.generarParaAsignacion).toHaveBeenCalledWith(7, 502);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [43],
      expect.objectContaining({ tipo: 'turno.cerrado_gestor' })
    );
  });
});

describe('AsignacionesService.obtener — acceso de trabajador_nomina a su propia asignación', () => {
  test('trabajador_nomina puede ver su propia asignación', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ id: 500, usuario_id: 42 });

    const resultado = await AsignacionesService.obtener(7, 500, { rol: ROLES.TRABAJADOR_NOMINA, sub: 42 });

    expect(resultado.id).toBe(500);
  });

  test('trabajador_nomina NO puede ver la asignación de otro trabajador', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ id: 500, usuario_id: 42 });

    await expect(
      AsignacionesService.obtener(7, 500, { rol: ROLES.TRABAJADOR_NOMINA, sub: 999 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
