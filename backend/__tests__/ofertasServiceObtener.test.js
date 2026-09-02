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
jest.mock('../modules/cargos/cargos.model');

const OfertasModel           = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel      = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel      = require('../modules/trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const CargosModel            = require('../modules/cargos/cargos.model');
const OfertasService         = require('../modules/turnos/ofertas/ofertas.service');

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

describe('OfertasService.aplicar — trabajador multi-empresa (empresaId null)', () => {
  afterEach(() => jest.clearAllMocks());

  test('usa el ranking de la empresa dueña de la oferta, no el de otra empresa vinculada', async () => {
    const { pool } = require('../config/database');
    const oferta = {
      id: 1,
      empresa_id: 7,
      estado: 'publicada',
      fecha: '2099-01-01',
      hora_inicio: '09:00',
      visibilidad: 'abierta',
      titulo: 'Evento',
      puestos: [{ id: 20, cargo_id: 3, cargo_nombre: 'auxiliar', plazas: 1, plazas_cubiertas: 0 }],
    };

    // 1ª query: resuelve la empresa dueña de la oferta. 2ª: gestores a notificar (ninguno).
    pool.query
      .mockResolvedValueOnce([[{ empresa_id: 7 }]])
      .mockResolvedValueOnce([[]]);

    // El trabajador tiene ranking distinto por empresa: elite (delay 0) en la
    // empresa 7 (dueña de la oferta) pero bajo (delay 60) en la empresa 8,
    // su vínculo más reciente. Antes del fix, resolverTrabajador(empresaId=null, ...)
    // devolvía el de la empresa 8 por error.
    TrabajadoresModel.obtenerPorUsuarioId.mockImplementation((empresaId) => {
      if (empresaId === 7) return Promise.resolve({ id: 99, ranking: 4.8 });
      return Promise.resolve({ id: 55, ranking: 1 }); // no debería usarse
    });

    // Simula la query real: solo "encuentra" la oferta si el delay pedido es 0
    // (la oferta se creó hace muy poco — con delay 60 el TIMESTAMPDIFF real fallaría).
    OfertasModel.obtenerPorId.mockImplementation((_empresaId, _id, delay = 0) =>
      Promise.resolve(delay === 0 ? oferta : null)
    );

    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue({ id: 200, estado: 'activo' });
    CargosModel.tieneAsignacion.mockResolvedValue(true);
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(null);
    AsignacionesModel.crear.mockResolvedValue(500);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500 });

    const resultado = await OfertasService.aplicar(null, 1, 20, 42, [7, 8], { rol: 'trabajador_turnos' });

    expect(TrabajadoresModel.obtenerPorUsuarioId).toHaveBeenCalledWith(7, 42);
    expect(AsignacionesModel.crear).toHaveBeenCalledWith(7, 1, 20, 99);
    expect(resultado).toEqual({ id: 500 });
  });
});
