'use strict';

// Cuando un jefe_turnos/admin_empresa crea un turno, los demás co-gestores de
// la empresa deben recibir un aviso (tipo 'oferta.creada') para no duplicar
// la creación sin saberlo — el creador mismo queda excluido.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const ofertaBase = {
  id: 10, empresa_id: 7, titulo: 'Turno bodega', fecha: '2099-01-01',
  hora_inicio: '08:00:00', hora_fin_estimada: null, lugar: null,
  estado: 'abierta', puestos: [], destinatarios: [], punto_marcaje_ids: [],
};

test('avisa a los demás co-gestores, excluyendo al creador', async () => {
  OfertasModel.crear.mockResolvedValue(10);
  OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase);
  // notificarPoolPorPuestos: sin puestos, no consulta pool. Solo queda la
  // consulta de co-gestores dentro de notificarCoGestores.
  pool.query.mockResolvedValueOnce([[{ id: 2 }, { id: 3 }]]);

  await OfertasService.crear(7, { titulo: 'Turno bodega', fecha: '2099-01-01', puestos: [] }, 1);

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('rol IN'),
    [7, 1]
  );
  expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
    [2, 3],
    expect.objectContaining({ tipo: 'oferta.creada', data: { oferta_id: 10 } })
  );
});

test('sin más gestores en la empresa, no notifica a nadie', async () => {
  OfertasModel.crear.mockResolvedValue(10);
  OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase);
  pool.query.mockResolvedValueOnce([[]]);

  await OfertasService.crear(7, { titulo: 'Turno bodega', fecha: '2099-01-01', puestos: [] }, 1);

  expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
});

test('duplicar() también avisa a los co-gestores', async () => {
  OfertasModel.obtenerPorId
    .mockResolvedValueOnce(ofertaBase) // original, dentro de duplicar()
    .mockResolvedValueOnce({ ...ofertaBase, id: 11, fecha: '2099-02-01' }); // duplicada
  OfertasModel.contarActivasPorEmpresa.mockResolvedValue(0);
  OfertasModel.duplicar.mockResolvedValue(11);
  pool.query.mockResolvedValueOnce([[{ id: 2 }]]);

  await OfertasService.duplicar(7, 10, '2099-02-01', 1, null);

  expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
    [2],
    expect.objectContaining({ tipo: 'oferta.creada', data: { oferta_id: 11 } })
  );
});
