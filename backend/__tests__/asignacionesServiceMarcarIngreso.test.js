'use strict';

// Regresión: un trabajador_turnos puede tener MÁS DE UNA fila en `trabajadores`
// para la misma empresa (la tabla no tiene UNIQUE(usuario_id, empresa_id)).
// marcarIngreso()/marcarEgreso()/obtener() verificaban la propiedad de la
// asignación resolviendo "cuál es mi trabajador en esta empresa" por separado
// (TrabajadoresModel.obtenerPorUsuarioId, sin ORDER BY) y comparando su id
// contra asignacion.trabajador_id — si esa búsqueda independiente devolvía
// una fila DISTINTA a la que realmente creó la asignación, el dueño legítimo
// recibía "Esta asignación no te pertenece" (403) al intentar marcar ingreso,
// aunque misTurnos() (que filtra por usuario_id vía JOIN) sí se la mostraba.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesService.marcarIngreso — validación de pertenencia sin queries redundantes', () => {
  const asignacion = {
    id: 500,
    empresa_id: 7,
    trabajador_id: 99,
    usuario_id: 42,
    trabajador_nombre: 'Ana',
    trabajador_apellido: 'Ruiz',
    estado: 'confirmado',
    oferta_id: 1,
    geofence_info: { tipo: 'libre' },
  };

  beforeEach(() => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asignacion);
    AsignacionesModel.registrarIngreso.mockResolvedValue(undefined);
    AsignacionesModel.listarIngresosCercanos.mockResolvedValue([]);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, estado: 'en_progreso' });
  });

  test('permite marcar ingreso validando usuario_id directamente desde la asignación', async () => {
    const resultado = await AsignacionesService.marcarIngreso(7, 500, 42, { latitud: 1, longitud: 1 });

    // No debe llamar a TrabajadoresModel — usuario_id ya viene en obtenerConDetalles
    expect(TrabajadoresModel.obtenerPorId).not.toHaveBeenCalled();
    expect(TrabajadoresModel.obtenerPorUsuarioId).not.toHaveBeenCalled();
    expect(AsignacionesModel.registrarIngreso).toHaveBeenCalled();
    expect(resultado).toEqual({ id: 500, estado: 'en_progreso' });
  });

  test('rechaza a un usuario que no coincide con usuario_id de la asignación', async () => {
    await expect(
      AsignacionesService.marcarIngreso(7, 500, 999, { latitud: 1, longitud: 1 })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(AsignacionesModel.registrarIngreso).not.toHaveBeenCalled();
  });
});
