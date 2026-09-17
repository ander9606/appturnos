'use strict';

// El contrato de un turno se autofirma al marcar salida (misma firma del
// egreso), así que bloquear el bono "una vez firmado" lo dejaba inutilizable
// para turnos ya completados. En vez de bloquear, agregarBono ahora revierte
// la firma y avisa al trabajador que debe volver a firmar — solo cuando el
// bono realmente cambia.
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosModel = require('../modules/contratos/contratos.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesService.agregarBono', () => {
  const base = {
    id: 700, empresa_id: 7, usuario_id: 42, oferta_titulo: 'Turno test',
    bono_monto: 0, bono_motivo: null,
  };

  beforeEach(() => {
    AsignacionesModel.asignarBono.mockResolvedValue(undefined);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(base);
  });

  test('contrato ya firmado + bono cambia → revierte la firma y avisa que debe refirmar', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, contrato_firmado: 1 });
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 99 });

    await AsignacionesService.agregarBono(7, 700, { sub: 1 }, { monto: 20000, motivo: 'Propina cliente' });

    expect(ContratosModel.resetearFirma).toHaveBeenCalledWith(7, 99);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.stringContaining('Debes volver a firmar el contrato') })
    );
  });

  test('contrato ya firmado pero el bono NO cambia → no toca la firma', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, contrato_firmado: 1, bono_monto: 20000, bono_motivo: 'Propina cliente',
    });

    await AsignacionesService.agregarBono(7, 700, { sub: 1 }, { monto: 20000, motivo: 'Propina cliente' });

    expect(ContratosModel.obtenerPorAsignacion).not.toHaveBeenCalled();
    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.not.stringContaining('Debes volver a firmar') })
    );
  });

  test('contrato sin firmar → agrega el bono normalmente, sin aviso de refirma', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, contrato_firmado: 0 });

    await AsignacionesService.agregarBono(7, 700, { sub: 1 }, { monto: 15000, motivo: 'Buen desempeño' });

    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.not.stringContaining('Debes volver a firmar') })
    );
  });

  test('trabajador_nomina (sin contrato civil) → contrato_firmado siempre 0, nunca intenta refirmar', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, contrato_firmado: 0, trabajador_tipo: 'nomina' });

    await AsignacionesService.agregarBono(7, 700, { sub: 1 }, { monto: 10000 });

    expect(ContratosModel.obtenerPorAsignacion).not.toHaveBeenCalled();
    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
  });
});
