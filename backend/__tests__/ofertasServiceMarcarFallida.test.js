'use strict';

// "Turno fallido": cancelar la oferta por fuerza mayor. A diferencia de
// cancelar() (que simplemente pone 'cancelado' sin pago a todo el mundo),
// quien ya marcó ingreso ('en_progreso') debe quedar 'fallido' con una
// compensación — por default la tarifa_dia de su puesto, o el monto que el
// gestor digite para esa asignación puntual. El resto se cancela sin pago.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../modules/integracion/costo-labor.service', () => ({
  verificarYEmitir: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../modules/turnos/periodos/periodos-turnos.service', () => ({
  autoCrear: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const OFERTA = { id: 1, empresa_id: 7, titulo: 'Turno bodega', fecha: '2026-01-10', estado: 'publicada' };

describe('OfertasService.marcarFallida', () => {
  test('compensa a quien ya marcó ingreso con la tarifa_dia de su puesto por default', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      { id: 100, estado: 'en_progreso', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' },
      { id: 101, estado: 'confirmado', trabajador_id: 2, usuario_id: 20, trabajador_nombre: 'Luis', trabajador_apellido: 'Paz', tarifa_dia: '90000' },
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 120000 }], 'Fuerza mayor', 999
    );
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 10,
      tipo: 'asignacion.fallido',
      mensaje: expect.stringContaining('$120.000'),
    }));
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([20], expect.objectContaining({
      tipo: 'oferta.cancelada',
    }));
  });

  test('respeta el monto que el gestor digita para una asignación puntual', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      { id: 100, estado: 'en_progreso', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' },
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1, {
      motivo: 'Corte de luz en el edificio',
      compensaciones: [{ asignacion_id: 100, monto: 50000 }],
    });

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 50000 }], 'Corte de luz en el edificio', 999
    );
    // El motivo puntual del gestor debe quedar en el mensaje, no solo en el
    // detalle del turno — antes el texto venía fijo con "fuerza mayor" sin
    // importar lo que el gestor escribiera.
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: expect.stringContaining('Corte de luz en el edificio'),
    }));
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: expect.stringContaining('$50.000'),
    }));
  });

  test('no notifica a quien marcó egreso justo antes del UPDATE (carrera con marcarFallida)', async () => {
    // Dos trabajadores en_progreso, pero el modelo solo confirma que uno de
    // verdad quedó 'fallido' (al otro ya le ganó su propio marcarEgreso) —
    // no se le debe prometer al segundo una compensación que nunca se aplicó.
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      { id: 100, estado: 'en_progreso', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' },
      { id: 102, estado: 'en_progreso', trabajador_id: 3, usuario_id: 30, trabajador_nombre: 'Eva', trabajador_apellido: 'Gil', tarifa_dia: '80000' },
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([100]); // 102 no se actualizó

    await OfertasService.marcarFallida(7, 999, 1);

    expect(NotificacionesService.notificar).toHaveBeenCalledTimes(1);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 10 }));
    expect(NotificacionesService.notificar).not.toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 30 }));
  });

  test('rechaza marcar fallida una oferta ya completada', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'completada' });

    await expect(OfertasService.marcarFallida(7, 999, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.marcarFallida).not.toHaveBeenCalled();
  });

  test('no hace nada si la oferta ya estaba cancelada', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'cancelada' });

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });
});
