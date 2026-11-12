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
const CostoLaborService = require('../modules/integracion/costo-labor.service');
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
      compensaciones: [{ asignacion_id: 100, monto: 70000 }],
    });

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 70000 }], 'Corte de luz en el edificio', 999
    );
    // El motivo puntual del gestor debe quedar en el mensaje, no solo en el
    // detalle del turno — antes el texto venía fijo con "fuerza mayor" sin
    // importar lo que el gestor escribiera.
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: expect.stringContaining('Corte de luz en el edificio'),
    }));
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: expect.stringContaining('$70.000'),
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

    await OfertasService.marcarFallida(7, 999, 1, { compensaciones: [{ asignacion_id: 100, monto: 70000 }] });

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 70000 }], 'Fuerza mayor', 999
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

describe('OfertasService.marcarFallida — compensación mínima (la mitad de la tarifa del puesto)', () => {
  const enCurso = { id: 100, estado: 'en_progreso', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' };

  beforeEach(() => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([enCurso]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);
  });

  test('un monto por debajo de la mitad se rechaza con 422 y no toca nada', async () => {
    await expect(
      OfertasService.marcarFallida(7, 999, 1, { compensaciones: [{ asignacion_id: 100, monto: 59999 }] })
    ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('$60.000') });
    expect(OfertasModel.marcarFallida).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('exactamente la mitad se acepta', async () => {
    await OfertasService.marcarFallida(7, 999, 1, { compensaciones: [{ asignacion_id: 100, monto: 60000 }] });
    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 100, monto: 60000 }], 'Fuerza mayor', 999
    );
  });

  test('un monto que no es número se rechaza', async () => {
    await expect(
      OfertasService.marcarFallida(7, 999, 1, { compensaciones: [{ asignacion_id: 100, monto: 'abc' }] })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(OfertasModel.marcarFallida).not.toHaveBeenCalled();
  });

  test('sin monto digitado se usa la tarifa completa (siempre sobre el mínimo)', async () => {
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

describe('OfertasService.marcarFallida — reporte de costo a logiq360', () => {
  const enCurso = { id: 100, estado: 'en_progreso', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', tarifa_dia: '120000' };

  test('oferta que ya estaba completada (costo ya reportado): el reenvío va marcado como corrección', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'completada' });
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([{ ...enCurso, estado: 'completado' }]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(CostoLaborService.verificarYEmitir).toHaveBeenCalledWith(7, 1, { correccion: true });
  });

  test('oferta que nunca se había reportado: se emite normal, sin marca de corrección', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(OFERTA);
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([enCurso]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(CostoLaborService.verificarYEmitir).toHaveBeenCalledWith(7, 1, { correccion: false });
  });
});

describe('OfertasService.marcarFallida — bajarle el pago a quien ya trabajó necesita su autorización', () => {
  const trabajo = (extra = {}) => ({
    id: 100, estado: 'completado', trabajador_id: 1, usuario_id: 10, trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz',
    tarifa_dia: '120000', pago_total: '135000', bono_monto: '0', ...extra,
  });

  beforeEach(() => {
    OfertasModel.obtenerPorId.mockResolvedValue({ ...OFERTA, estado: 'completada' });
    OfertasModel.marcarFallida.mockResolvedValue([]);
  });

  test('si la compensación le baja el pago: queda como propuesta, no se aplica ni se toca su contrato', async () => {
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([trabajo()]);

    await OfertasService.marcarFallida(7, 999, 1); // por defecto: tarifa $120.000 < pago $135.000

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(7, 1, [], 'Fuerza mayor', 999, [{ asignacionId: 100, monto: 120000 }]);
    expect(ContratosModel.resetearFirma).not.toHaveBeenCalled();
    expect(CuentasCobroService.actualizarPorTurnoFirmado).not.toHaveBeenCalled();
  });

  test('al trabajador se le avisa que debe autorizar, con el pago actual y el propuesto; no el aviso de fallido', async () => {
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([trabajo()]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(NotificacionesService.notificar).toHaveBeenCalledTimes(1);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 10,
      tipo: 'asignacion.compensacion_propuesta',
      mensaje: expect.stringMatching(/\$135\.000 a \$120\.000.*queda en espera: no se suma a tu pago hasta que decidas/),
    }));
  });

  test('el bono ya otorgado cuenta: compensación + bono contra lo que ya tiene', async () => {
    // pago $135.000 (incluye bono $20.000); compensación $120.000 + bono $20.000 = $140.000 → no baja el pago.
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([trabajo({ bono_monto: '20000' })]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(7, 1, [{ asignacionId: 100, monto: 120000 }], 'Fuerza mayor', 999);
  });

  test('si la compensación es igual o mayor que su pago: se aplica de una vez, sin autorización', async () => {
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([trabajo({ pago_total: '120000' })]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(7, 1, [{ asignacionId: 100, monto: 120000 }], 'Fuerza mayor', 999);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'asignacion.fallido' }));
    expect(ContratosModel.obtenerPorAsignacion).toHaveBeenCalled();
  });

  test('quien sigue en curso nunca necesita autorización (aún no tiene pago por horas)', async () => {
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([trabajo({ estado: 'en_progreso', pago_total: '999999' })]);
    OfertasModel.marcarFallida.mockResolvedValue([100]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(7, 1, [{ asignacionId: 100, monto: 120000 }], 'Fuerza mayor', 999);
  });

  test('mezcla: uno que baja (propuesta) y uno que no (inmediato) en la misma oferta', async () => {
    AsignacionesModel.listarActivasConTarifa.mockResolvedValue([
      trabajo(),
      trabajo({ id: 101, usuario_id: 11, trabajador_id: 2, estado: 'en_progreso', pago_total: null }),
    ]);
    OfertasModel.marcarFallida.mockResolvedValue([101]);

    await OfertasService.marcarFallida(7, 999, 1);

    expect(OfertasModel.marcarFallida).toHaveBeenCalledWith(
      7, 1, [{ asignacionId: 101, monto: 120000 }], 'Fuerza mayor', 999, [{ asignacionId: 100, monto: 120000 }]
    );
  });
});

