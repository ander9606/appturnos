'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.service', () => ({
  cerrarMasivo: jest.fn(),
}));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');
const { resolverAsignacionesVencidas } = require('../modules/turnos/turnos.worker');

// Regresión: cerrarVencidas() (ofertas.model.js) salta a propósito cualquier
// oferta con asignaciones 'confirmado'/'en_progreso' colgadas — sin este
// resolver, esas asignaciones quedaban mostrando "Aceptado" + "Cancelar"
// para siempre porque nadie las cerraba a mano.
describe('turnos.worker — resolverAsignacionesVencidas', () => {
  beforeEach(() => jest.clearAllMocks());

  test('llama cerrarMasivo una vez por cada oferta vencida con pendientes', async () => {
    OfertasModel.listarVencidasConPendientes.mockResolvedValue([
      { id: 10, empresa_id: 1 },
      { id: 11, empresa_id: 2 },
    ]);
    AsignacionesService.cerrarMasivo.mockResolvedValue({ cerradas: 0, noPresentados: 1 });

    await resolverAsignacionesVencidas();

    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledTimes(2);
    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledWith(1, 10);
    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledWith(2, 11);
  });

  test('sin ofertas pendientes → no llama cerrarMasivo', async () => {
    OfertasModel.listarVencidasConPendientes.mockResolvedValue([]);

    await resolverAsignacionesVencidas();

    expect(AsignacionesService.cerrarMasivo).not.toHaveBeenCalled();
  });

  test('un fallo en una oferta no detiene el resto', async () => {
    OfertasModel.listarVencidasConPendientes.mockResolvedValue([
      { id: 10, empresa_id: 1 },
      { id: 11, empresa_id: 2 },
    ]);
    AsignacionesService.cerrarMasivo
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ cerradas: 1, noPresentados: 0 });

    await expect(resolverAsignacionesVencidas()).resolves.toBeUndefined();
    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledTimes(2);
  });
});
