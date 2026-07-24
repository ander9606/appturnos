'use strict';

// Regresión: una oferta 'borrador' creada desde logiq360 (orden.creada) solo podía
// pasar a 'publicada' si logiq360 enviaba el evento orden.publicada. Sin ruta manual,
// una oferta quedaba atascada en borrador para siempre si ese webhook nunca llegaba.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

describe('OfertasService.publicar', () => {
  const ofertaBorrador = {
    id: 1, empresa_id: 7, titulo: 'Montaje — Boda García', fecha: '2026-06-01',
    estado: 'borrador',
    puestos: [{ id: 10, cargo_id: 3, cargo_nombre: 'auxiliar', plazas: 5, tarifa_dia: 80000 }],
  };

  test('publica una oferta en borrador con puestos y notifica al pool', async () => {
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(ofertaBorrador)
      .mockResolvedValueOnce({ ...ofertaBorrador, estado: 'publicada' });
    OfertasModel.cambiarEstado.mockResolvedValue(1);
    pool.query.mockResolvedValue([[{ usuario_id: 55 }]]);

    const resultado = await OfertasService.publicar(7, 1);

    expect(OfertasModel.cambiarEstado).toHaveBeenCalledWith(7, 1, 'publicada');
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [55], expect.objectContaining({ tipo: 'oferta.nueva' })
    );
    expect(resultado.estado).toBe('publicada');
  });

  test('rechaza publicar una oferta que no está en borrador', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...ofertaBorrador, estado: 'publicada' });

    await expect(OfertasService.publicar(7, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('rechaza publicar una oferta sin puestos', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...ofertaBorrador, puestos: [] });

    await expect(OfertasService.publicar(7, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('oferta inexistente → 404', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(null);

    await expect(OfertasService.publicar(7, 999)).rejects.toMatchObject({ statusCode: 404 });
  });
});
