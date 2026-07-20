'use strict';

// Regresión: trabajador_turnos multi-empresa tiene req.empresa_id === null.
// obtener() no debe usar ese null para el fetch inicial de la oferta.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');

const OfertasModel      = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const OfertasService    = require('../modules/turnos/ofertas/ofertas.service');

describe('OfertasService.obtener — trabajador multi-empresa (empresaId null)', () => {
  test('resuelve la oferta cuando pertenece a una empresa activa del trabajador', async () => {
    OfertasModel.obtenerEmpresaId.mockResolvedValue(7);
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7, titulo: 'Evento' });
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ ranking: 3 });
    AsignacionesModel.listarPorOferta.mockResolvedValue([]);

    const usuario = { rol: 'trabajador_turnos', sub: 42 };
    const result = await OfertasService.obtener(null, 1, usuario, [7, 8]);

    expect(result.id).toBe(1);
    expect(OfertasModel.obtenerPorId).toHaveBeenCalledWith(7, 1, expect.any(Number));
  });

  test('empresa fuera de las activas del trabajador → 404, no expone la oferta', async () => {
    OfertasModel.obtenerEmpresaId.mockResolvedValue(99);

    const usuario = { rol: 'trabajador_turnos', sub: 42 };
    await expect(
      OfertasService.obtener(null, 1, usuario, [7, 8])
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
