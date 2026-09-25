'use strict';

// Regresión: asignarDirecto() nunca validaba que el trabajador_id recibido
// perteneciera a la empresa que asigna — TrabajadoresModel.obtenerPorId ya
// filtra por empresa_id y devuelve null si no matchea, pero el código
// ignoraba ese null y seguía adelante, dejando que AsignacionesModel
// insertara la asignación con un trabajador_id de OTRA empresa (mismo bug
// de fondo que corrompió data real: ver commit 563a743 y el script
// reparar-trabajador-114-vs-61.js).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesService.asignarDirecto', () => {
  test('rechaza un trabajador_id que no pertenece a la empresa', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue(null); // otra empresa o inexistente

    await expect(
      AsignacionesService.asignarDirecto(3, 100, { puesto_id: 1, trabajador_id: 114 })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(AsignacionesModel.asignarDirecto).not.toHaveBeenCalled();
  });

  test('trabajador_id válido de la empresa sigue funcionando', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 61, empresa_id: 3, usuario_id: null });
    TrabajadoresModel.obtenerUsuarioId.mockResolvedValue(null);
    AsignacionesModel.asignarDirecto.mockResolvedValue({ ok: true, asignacionId: 500 });
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500 });
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(null); // sin detalles → salta notificación

    const resultado = await AsignacionesService.asignarDirecto(3, 100, { puesto_id: 1, trabajador_id: 61 });

    expect(AsignacionesModel.asignarDirecto).toHaveBeenCalledWith(3, 100, 1, 61);
    expect(resultado).toEqual({ id: 500 });
  });
});
