'use strict';

// Bug reportado: "las notificaciones de nuevo turno disponible están
// llegando a todos los trabajadores sin importar el puntaje, lo que hace que
// se enteren que hay un turno pero igual no se pueden postular". La causa
// era que notificarPoolPorPuestos (ofertas.gestion.service.js) no aplicaba
// el delay de visibilidad por ranking que sí aplican listarMultiEmpresa/
// aplicar/obtener. Este barrido periódico es la mitad que faltaba: alcanza
// a cada trabajador cuando a él le toca, sin re-notificar a quien ya avisó
// el llamado inmediato de crear()/publicar().
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/ofertas/ofertas.service', () => ({
  notificarPoolPendiente: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.service', () => ({
  cerrarMasivo: jest.fn(),
}));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');
const { notificarPoolRetrasado } = require('../modules/turnos/turnos.worker');

afterEach(() => jest.clearAllMocks());

describe('turnos.worker — notificarPoolRetrasado', () => {
  test('reintenta el aviso para cada oferta abierta reciente', async () => {
    OfertasModel.listarAbiertasRecientesParaNotificar.mockResolvedValue([
      { id: 10, empresa_id: 1, titulo: 'Bodega' },
      { id: 11, empresa_id: 2, titulo: 'Evento' },
    ]);

    await notificarPoolRetrasado();

    expect(OfertasService.notificarPoolPendiente).toHaveBeenCalledTimes(2);
    expect(OfertasService.notificarPoolPendiente).toHaveBeenCalledWith(1, { id: 10, empresa_id: 1, titulo: 'Bodega' });
    expect(OfertasService.notificarPoolPendiente).toHaveBeenCalledWith(2, { id: 11, empresa_id: 2, titulo: 'Evento' });
  });

  test('sin ofertas pendientes → no llama a notificarPoolPendiente', async () => {
    OfertasModel.listarAbiertasRecientesParaNotificar.mockResolvedValue([]);

    await notificarPoolRetrasado();

    expect(OfertasService.notificarPoolPendiente).not.toHaveBeenCalled();
  });

  test('un fallo en una oferta no detiene el resto', async () => {
    OfertasModel.listarAbiertasRecientesParaNotificar.mockResolvedValue([
      { id: 10, empresa_id: 1 },
      { id: 11, empresa_id: 2 },
    ]);
    OfertasService.notificarPoolPendiente
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await expect(notificarPoolRetrasado()).resolves.toBeUndefined();
    expect(OfertasService.notificarPoolPendiente).toHaveBeenCalledTimes(2);
  });
});
