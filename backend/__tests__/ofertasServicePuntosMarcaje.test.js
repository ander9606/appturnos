'use strict';

// Puntos de marcaje zonal acotados por turno (migración 099): crear() y
// actualizar() deben rechazar cualquier punto_marcaje_id que no pertenezca a
// la empresa — sin esto un cliente podría vincular el punto de otra empresa
// a su oferta (ver validarPuntosMarcaje en ofertas.gestion.service.js).
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const ofertaBase = {
  id: 1, empresa_id: 7, titulo: 'Turno bodega', fecha: '2099-01-01',
  hora_inicio: '08:00:00', hora_fin_estimada: null, lugar: null,
  estado: 'abierta', puestos: [], destinatarios: [], puntos_marcaje: [],
};

describe('OfertasService.crear — punto_marcaje_ids', () => {
  test('con puntos válidos de la empresa, crea normalmente', async () => {
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 7, nombre: 'Bodega Norte' });
    OfertasModel.crear.mockResolvedValue(1);
    OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase);

    await OfertasService.crear(
      7,
      { titulo: 'Turno bodega', fecha: '2099-01-01', hora_inicio: '08:00:00', puestos: [], punto_marcaje_ids: [5] },
      1
    );

    expect(OfertasModel.crear).toHaveBeenCalled();
  });

  test('con un punto que no pertenece a la empresa, rechaza y no crea', async () => {
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue(null); // no encontrado para esta empresa

    await expect(
      OfertasService.crear(
        7,
        { titulo: 'Turno bodega', fecha: '2099-01-01', hora_inicio: '08:00:00', puestos: [], punto_marcaje_ids: [999] },
        1
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });
});

describe('OfertasService.actualizar — punto_marcaje_ids', () => {
  beforeEach(() => {
    OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase);
    OfertasModel.actualizar.mockResolvedValue(1);
  });

  test('reemplaza el set con puntos válidos de la empresa', async () => {
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue({ id: 8, empresa_id: 7, nombre: 'Bodega Sur' });

    await OfertasService.actualizar(7, 1, { punto_marcaje_ids: [8] });

    expect(OfertasModel.actualizar).toHaveBeenCalledWith(7, 1, expect.objectContaining({ punto_marcaje_ids: [8] }));
  });

  test('con un punto ajeno a la empresa, rechaza y no actualiza', async () => {
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      OfertasService.actualizar(7, 1, { punto_marcaje_ids: [999] })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(OfertasModel.actualizar).not.toHaveBeenCalled();
  });

  test('vacío ([]) también es válido — limpia la acotación existente', async () => {
    await OfertasService.actualizar(7, 1, { punto_marcaje_ids: [] });

    expect(PuntosMarcajeModel.obtenerPorId).not.toHaveBeenCalled();
    expect(OfertasModel.actualizar).toHaveBeenCalledWith(7, 1, expect.objectContaining({ punto_marcaje_ids: [] }));
  });
});
