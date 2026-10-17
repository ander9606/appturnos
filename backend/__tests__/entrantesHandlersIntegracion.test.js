'use strict';

jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
  notificarSuperAdmins: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const IntegracionModel = require('../modules/integracion/integracion.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const { procesar } = require('../modules/integracion/entrantes.handlers');
const AppError = require('../utils/AppError');

afterEach(() => jest.clearAllMocks());

describe('entrantes.handlers — empleado.creado', () => {
  test('si la cédula choca con otra ficha activa del mismo usuario (409), aplica el resto del sync sin ella', async () => {
    TrabajadoresModel.obtenerPorExternalRef.mockResolvedValue({ id: 55 });
    TrabajadoresModel.actualizar
      .mockRejectedValueOnce(new AppError('cédula en conflicto', 409))
      .mockResolvedValueOnce(1);

    const data = { external_ref: 'ext-1', nombre: 'Ana', cedula: '999' };
    const manejado = await procesar('empleado.creado', 7, data);

    expect(manejado).toBe(true);
    expect(TrabajadoresModel.actualizar).toHaveBeenCalledTimes(2);
    const segundaLlamada = TrabajadoresModel.actualizar.mock.calls[1];
    expect(segundaLlamada[2].cedula).toBeUndefined();
    expect(segundaLlamada[2].nombre).toBe('Ana');
  });
});

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
