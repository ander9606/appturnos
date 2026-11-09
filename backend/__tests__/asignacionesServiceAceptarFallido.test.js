'use strict';

// El trabajador da por enterado un turno fallido (fuerza mayor) y su compensación.
// Es solo un "enterado": no cambia el pago. Solo el dueño, solo si está 'fallido'.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/integracion/cobertura.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

const fallida = { id: 500, empresa_id: 7, usuario_id: 42, estado: 'fallido', fallido_aceptado_at: null };

describe('AsignacionesService.aceptarFallido', () => {
  test('404 si la asignación no existe', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(null);
    await expect(AsignacionesService.aceptarFallido(7, 500, 42)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('403 si la asignación es de otro trabajador', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(fallida);
    await expect(AsignacionesService.aceptarFallido(7, 500, 99)).rejects.toMatchObject({ statusCode: 403 });
    expect(AsignacionesModel.aceptarFallido).not.toHaveBeenCalled();
  });

  test('409 si el turno no está fallido', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...fallida, estado: 'completado' });
    await expect(AsignacionesService.aceptarFallido(7, 500, 42)).rejects.toMatchObject({ statusCode: 409 });
    expect(AsignacionesModel.aceptarFallido).not.toHaveBeenCalled();
  });

  test('el dueño acepta: usa la empresa de la fila y devuelve la asignación actualizada', async () => {
    AsignacionesModel.obtenerConDetalles
      .mockResolvedValueOnce(fallida)
      .mockResolvedValueOnce({ ...fallida, fallido_aceptado_at: '2026-11-09 10:00:00' });
    AsignacionesModel.aceptarFallido.mockResolvedValue(true);

    const res = await AsignacionesService.aceptarFallido(null, 500, 42);

    expect(AsignacionesModel.aceptarFallido).toHaveBeenCalledWith(7, 500);
    expect(res.fallido_aceptado_at).toBe('2026-11-09 10:00:00');
  });

  test('es idempotente: aceptar otra vez no falla', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...fallida, fallido_aceptado_at: '2026-11-09 10:00:00' });
    AsignacionesModel.aceptarFallido.mockResolvedValue(false);

    await expect(AsignacionesService.aceptarFallido(7, 500, 42)).resolves.toMatchObject({ id: 500 });
  });
});
