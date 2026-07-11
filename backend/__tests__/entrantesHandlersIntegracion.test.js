'use strict';

jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const IntegracionModel = require('../modules/integracion/integracion.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const { procesar } = require('../modules/integracion/entrantes.handlers');

afterEach(() => jest.clearAllMocks());

describe('entrantes.handlers — integracion.activada / integracion.desactivada', () => {
  test('integracion.activada marca integracion_config.activo = true y notifica a los admin_empresa', async () => {
    pool.query.mockResolvedValue([[{ usuario_id: 42 }]]);

    const manejado = await procesar('integracion.activada', 7, {});

    expect(manejado).toBe(true);
    expect(IntegracionModel.actualizarActivo).toHaveBeenCalledWith(7, true);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [42],
      expect.objectContaining({ empresaId: 7, tipo: 'integracion.activada' })
    );
  });

  test('integracion.desactivada marca integracion_config.activo = false y notifica a los admin_empresa', async () => {
    pool.query.mockResolvedValue([[{ usuario_id: 42 }, { usuario_id: 43 }]]);

    const manejado = await procesar('integracion.desactivada', 7, {});

    expect(manejado).toBe(true);
    expect(IntegracionModel.actualizarActivo).toHaveBeenCalledWith(7, false);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [42, 43],
      expect.objectContaining({ empresaId: 7, tipo: 'integracion.desactivada' })
    );
  });

  test('sin admin_empresa activos, no llama a notificarVarios', async () => {
    pool.query.mockResolvedValue([[]]);

    await procesar('integracion.desactivada', 7, {});

    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });
});
