'use strict';

// El trabajador decide sobre la propuesta de bajarle el pago de un turno que ya trabajó (dar por fallido por
// fuerza mayor). Autorizar aplica el cambio y ajusta contrato/cuenta/logiq360; rechazar deja su pago según contrato.
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/notificaciones/notificaciones.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn() }));
jest.mock('../modules/integracion/cobertura.service', () => ({ verificarYEmitir: jest.fn() }));
jest.mock('../modules/integracion/costo-labor.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.service', () => ({ actualizarPorTurnoFirmado: jest.fn().mockResolvedValue(null) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosModel = require('../modules/contratos/contratos.model');
const NotificacionesModel = require('../modules/notificaciones/notificaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const CostoLaborService = require('../modules/integracion/costo-labor.service');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

const pendiente = {
  id: 500, empresa_id: 7, oferta_id: 3, trabajador_id: 99, usuario_id: 42, estado: 'completado',
  compensacion_decision: 'pendiente', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', oferta_titulo: 'Montaje Gala',
};

beforeEach(() => {
  AsignacionesModel.obtenerConDetalles.mockResolvedValue(pendiente);
  NotificacionesModel.idsGestoresTurnos.mockResolvedValue([1, 2]);
});

describe.each([
  ['autorizarCompensacion'],
  ['rechazarCompensacion'],
])('AsignacionesService.%s — validaciones', (metodo) => {
  test('404 si la asignación no existe', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(null);
    await expect(AsignacionesService[metodo](7, 500, 42)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('403 si es de otro trabajador', async () => {
    await expect(AsignacionesService[metodo](7, 500, 99)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('409 si no hay una propuesta pendiente (ya decidida o nunca hubo)', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...pendiente, compensacion_decision: 'autorizada', estado: 'fallido' });
    await expect(AsignacionesService[metodo](7, 500, 42)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('AsignacionesService.autorizarCompensacion', () => {
  test('aplica el cambio, anula la firma del contrato, ajusta la cuenta, corrige a logiq360 y avisa a los gestores', async () => {
    AsignacionesModel.autorizarCompensacion.mockResolvedValue(true);
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 77, firmado_trabajador: 1 });

    await AsignacionesService.autorizarCompensacion(null, 500, 42);

    expect(AsignacionesModel.autorizarCompensacion).toHaveBeenCalledWith(7, 500);
    expect(ContratosModel.resetearFirma).toHaveBeenCalledWith(7, 77);
    expect(CuentasCobroService.actualizarPorTurnoFirmado).toHaveBeenCalledWith(7, 500, 99);
    expect(CostoLaborService.verificarYEmitir).toHaveBeenCalledWith(7, 3, { correccion: true });
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([1, 2], expect.objectContaining({
      tipo: 'asignacion.compensacion_decision', titulo: 'Compensación autorizada',
    }));
  });

  test('doble toque: si otra llamada ya la aplicó, 409 y no repite nada', async () => {
    AsignacionesModel.autorizarCompensacion.mockResolvedValue(false);

    await expect(AsignacionesService.autorizarCompensacion(7, 500, 42)).rejects.toMatchObject({ statusCode: 409 });
    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(CostoLaborService.verificarYEmitir).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });
});

describe('AsignacionesService.rechazarCompensacion', () => {
  test('no cambia el pago ni toca contrato/cuenta/logiq360; solo avisa a los gestores', async () => {
    AsignacionesModel.rechazarCompensacion.mockResolvedValue(true);

    await AsignacionesService.rechazarCompensacion(7, 500, 42);

    expect(AsignacionesModel.rechazarCompensacion).toHaveBeenCalledWith(7, 500);
    expect(AsignacionesModel.autorizarCompensacion).not.toHaveBeenCalled();
    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(CuentasCobroService.actualizarPorTurnoFirmado).not.toHaveBeenCalled();
    expect(CostoLaborService.verificarYEmitir).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([1, 2], expect.objectContaining({
      titulo: 'Compensación no autorizada', mensaje: expect.stringContaining('Se le paga según su contrato'),
    }));
  });
});
