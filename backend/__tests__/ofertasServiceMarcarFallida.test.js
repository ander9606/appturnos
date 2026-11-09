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
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/cuentas-cobro/cuentas-cobro.service', () => ({
  actualizarPorTurnoFirmado: jest.fn().mockResolvedValue(null),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const ContratosModel = require('../modules/contratos/contratos.model');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');
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

  test('permite marcar fallida una oferta ya completada (se completa sola al marcar salida)', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'completada' });
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      { id: 100, estado: 'completado', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' },
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1, { compensaciones: [{ asignacion_id: 100, monto: 50000 }] });

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 50000 }], 'Fuerza mayor', 999
    );
  });

  test('no hace nada si la oferta ya estaba cancelada', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'cancelada' });

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });
});

describe('OfertasService.marcarFallida — quien ya marcó salida', () => {
  test('también se compensa a quien ya quedó completado', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      { id: 100, estado: 'completado', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' },
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 120000 }], 'Fuerza mayor', 999
    );
  });
});

describe('OfertasService.marcarFallida — quien ya tenía contrato y cuenta de cobro', () => {
  const completado = { id: 100, estado: 'completado', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' };

  test('anula la firma del contrato firmado y pide ajustar la cuenta de cobro', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([completado]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 77, firmado_trabajador: 1 });

    await OfertasService.marcarFallida(7, 999, 1);

    expect(ContratosModel.resetearFirma).toHaveBeenCalledWith(7, 77);
    expect(CuentasCobroService.actualizarPorTurnoFirmado).toHaveBeenCalledWith(7, 100, 1);
  });

  test('contrato sin firmar: no toca la firma, pero igual actualiza la cuenta de cobro', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([completado]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 77, firmado_trabajador: 0 });

    await OfertasService.marcarFallida(7, 999, 1);

    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(CuentasCobroService.actualizarPorTurnoFirmado).toHaveBeenCalledWith(7, 100, 1);
  });

  test('quien estaba en curso (nunca tuvo contrato) no dispara nada de esto', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([{ ...completado, estado: 'en_progreso' }]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(ContratosModel.obtenerPorAsignacion).not.toHaveBeenCalled();
    expect(CuentasCobroService.actualizarPorTurnoFirmado).not.toHaveBeenCalled();
  });

  test('si falla el ajuste de contrato/cuenta, el turno fallido igual queda guardado', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([completado]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);
    ContratosModel.obtenerPorAsignacion.mockRejectedValue(new Error('boom'));

    await expect(OfertasService.marcarFallida(7, 999, 1)).resolves.toBeUndefined();
    expect(OfertasModel.marcarFallida).toHaveBeenCalled();
  });
});
