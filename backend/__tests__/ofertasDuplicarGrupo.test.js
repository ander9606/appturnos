'use strict';

// Duplicar un turno que está en un grupo deja la copia en ese mismo grupo; si el grupo
// está cerrado no se le agregan turnos: se avisa claro (409) y no se crea nada.
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
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const oferta = (extra = {}) => ({
  id: 10, empresa_id: 7, titulo: 'Montaje', fecha: '2099-01-01', hora_inicio: '08:00:00',
  estado: 'abierta', puestos: [], destinatarios: [], punto_marcaje_ids: [],
  grupo_id: null, grupo_nombre: null, grupo_estado: null, ...extra,
});

test('grupo cerrado: responde 409 con el nombre del grupo y no duplica nada', async () => {
  OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta({ grupo_id: 3, grupo_nombre: 'Feria del Libro', grupo_estado: 'cerrado' }));

  await expect(OfertasService.duplicar(7, 10, '2099-01-02', 1, null)).rejects.toMatchObject({
    statusCode: 409,
    message: expect.stringContaining('Feria del Libro'),
  });
  expect(OfertasModel.duplicar).not.toHaveBeenCalled();
});

test('grupo activo: duplica con normalidad', async () => {
  OfertasModel.obtenerPorId
    .mockResolvedValueOnce(oferta({ grupo_id: 3, grupo_nombre: 'Feria del Libro', grupo_estado: 'activo' }))
    .mockResolvedValueOnce(oferta({ id: 11, grupo_id: 3, grupo_nombre: 'Feria del Libro', grupo_estado: 'activo' }));
  OfertasModel.contarActivasPorEmpresa.mockResolvedValue(0);
  OfertasModel.duplicar.mockResolvedValue(11);
  pool.query.mockResolvedValueOnce([[]]);

  const nueva = await OfertasService.duplicar(7, 10, '2099-01-02', 1, null);

  expect(OfertasModel.duplicar).toHaveBeenCalledWith(7, 10, '2099-01-02', 1, null);
  expect(nueva.grupo_id).toBe(3);
});

test('sin grupo: todo igual que antes', async () => {
  OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta()).mockResolvedValueOnce(oferta({ id: 11 }));
  OfertasModel.contarActivasPorEmpresa.mockResolvedValue(0);
  OfertasModel.duplicar.mockResolvedValue(11);
  pool.query.mockResolvedValueOnce([[]]);

  await expect(OfertasService.duplicar(7, 10, '2099-01-02', 1, null)).resolves.toMatchObject({ id: 11, grupo_id: null });
});
