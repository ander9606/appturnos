'use strict';

// generarParaPeriodo agrega turnos de AsignacionesModel.liquidacion() en cuentas de
// cobro por trabajador — lógica de dinero, no trivial. Reglas que fijan estos tests:
//  - La cuenta original solo se genera si TODOS los turnos del período están firmados;
//    si falta alguno no se genera y se avisa (trabajador + gestores).
//  - Una cuenta firmada no se reescribe: un cambio posterior (bono) o un turno firmado
//    tarde genera una cuenta COMPLEMENTARIA solo por la diferencia (solo si es positiva).
//  - Una cuenta sin firmar se refresca en el lugar, sin volver a avisar.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('./../modules/cuentas-cobro/cuentas-cobro.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const CuentasCobroModel = require('../modules/cuentas-cobro/cuentas-cobro.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');

afterEach(() => jest.clearAllMocks());

const turno = (extra = {}) => ({
  asignacion_id: 1, oferta_titulo: 'Turno A', oferta_fecha: '2026-09-03',
  hora_inicio: '08:00', hora_fin_estimada: '16:00', horas_trabajadas: 8,
  pago_total: 60000, firmado_trabajador: true, ...extra,
});
const trabajador = (turnos) => ({
  trabajador_id: 61, usuario_id: 69, nombre: 'Ana', apellido: 'Pérez', turnos,
});

describe('CuentasCobroService.generarParaPeriodo', () => {
  const periodo = { id: 10, empresa_id: 7, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-15' };

  beforeEach(() => {
    PeriodosModel.obtenerPorId.mockResolvedValue(periodo);
    CuentasCobroModel.crear.mockResolvedValue(555);
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([]);
    CuentasCobroModel.listarGestoresUsuarioIds.mockResolvedValue([5, 6]);
  });

  test('con todos los turnos firmados genera la cuenta original y avisa al trabajador', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno(), turno({ asignacion_id: 2, oferta_fecha: '2026-09-05', pago_total: 70000 })]),
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado).toEqual({ generadas: 1, bloqueados: 0 });
    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({
      periodoId: 10, trabajadorId: 61, secuencia: 1, numeroCuenta: 'CC-10-61',
      totalTurnos: 2, totalHoras: 16, valorTotal: 130000,
    }));
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 69,
      tipo: 'cuenta_cobro.pendiente_firma',
      data: { cuenta_cobro_id: 555, periodo_id: 10 },
    }));
  });

  test('con un turno sin firmar NO genera la cuenta y avisa al trabajador y a los gestores', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno(), turno({ asignacion_id: 2, firmado_trabajador: false })]),
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado).toEqual({ generadas: 0, bloqueados: 1 });
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 69,
      tipo: 'cuenta_cobro.bloqueada_sin_firma',
      data: { periodo_id: 10, turnos_sin_firmar: 1 },
    }));
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([5, 6], expect.objectContaining({
      tipo: 'cuenta_cobro.trabajadores_sin_firma',
      mensaje: expect.stringContaining('Ana Pérez'),
    }));
  });

  test('avisarBloqueo=false (al firmar un turno) no repite el aviso de lo que aún falta', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno(), turno({ asignacion_id: 2, firmado_trabajador: false })]),
    ]);

    await CuentasCobroService.generarParaPeriodo(7, 10, { trabajadorId: 61, avisarBloqueo: false });

    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });

  test('turno fallido por fuerza mayor (sin contrato) cuenta como firmado y no bloquea', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno({ estado: 'fallido', firmado_trabajador: true })]),
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado.generadas).toBe(1);
  });

  test('cuenta ya firmada + bono posterior → cuenta complementaria solo por la diferencia', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno({ pago_total: 80000, bono_monto: 20000 })]), // el bono sube el turno a 80.000
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado.generadas).toBe(1);
    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({
      secuencia: 2, numeroCuenta: 'CC-10-61-2', totalTurnos: 1, totalHoras: 0, valorTotal: 20000,
      items: [expect.objectContaining({ asignacion_id: 1, valor: 20000, horas: 0, bono_monto: 0 })],
    }));
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'cuenta_cobro.pendiente_firma',
      titulo: 'Tienes una cuenta de cobro complementaria',
    }));
  });

  test('cuenta firmada + turno firmado tarde → complementaria con el valor completo del turno nuevo', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno(), turno({ asignacion_id: 2, oferta_fecha: '2026-09-07', pago_total: 70000 })]),
    ]);

    await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({
      secuencia: 2, valorTotal: 70000, totalHoras: 8,
      items: [expect.objectContaining({ asignacion_id: 2, valor: 70000 })],
    }));
  });

  test('diferencia negativa o cero no genera cuenta', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }, { asignacion_id: 2, valor: 70000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno({ pago_total: 55000 }), turno({ asignacion_id: 2, pago_total: 70000 })]),
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado.generadas).toBe(0);
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
  });

  test('turno ya cobrado que quedó sin firma (bono) no bloquea ni genera nada hasta que lo vuelva a firmar', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno({ pago_total: 80000, firmado_trabajador: false })]),
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado).toEqual({ generadas: 0, bloqueados: 0 });
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });

  test('cuenta aún sin firmar se refresca en el lugar (misma secuencia) y no vuelve a avisar', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 0, items: [{ asignacion_id: 1, valor: 60000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno({ pago_total: 50000, descuento_monto: 10000 })]),
    ]);

    await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({
      secuencia: 1, valorTotal: 50000,
    }));
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('cuenta sin firmar que ya no tiene nada que cobrar (bono quitado) se elimina; la firmada nunca', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }] },
      { id: 501, secuencia: 2, firmado_trabajador: 0, items: [{ asignacion_id: 1, valor: 20000 }] }, // el bono ya no existe
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([trabajador([turno({ pago_total: 60000 })])]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado.generadas).toBe(0);
    expect(CuentasCobroModel.eliminarSinFirmar).toHaveBeenCalledTimes(1);
    expect(CuentasCobroModel.eliminarSinFirmar).toHaveBeenCalledWith(7, 501);
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
  });

  test('sin cuenta sin firmar y sin nada que cobrar no elimina nada', async () => {
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([
      { id: 500, secuencia: 1, firmado_trabajador: 1, items: [{ asignacion_id: 1, valor: 60000 }] },
    ]);
    AsignacionesModel.liquidacion.mockResolvedValue([trabajador([turno({ pago_total: 60000 })])]);

    await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(CuentasCobroModel.eliminarSinFirmar).not.toHaveBeenCalled();
  });

  test('trabajadorId limita la generación a ese trabajador', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno()]),
      { ...trabajador([turno({ asignacion_id: 9 })]), trabajador_id: 62, usuario_id: 70 },
    ]);

    await CuentasCobroService.generarParaPeriodo(7, 10, { trabajadorId: 62 });

    expect(CuentasCobroModel.crear).toHaveBeenCalledTimes(1);
    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({ trabajadorId: 62 }));
  });

  test('período no encontrado → AppError 404', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue(null);
    AsignacionesModel.liquidacion.mockResolvedValue([]);

    await expect(CuentasCobroService.generarParaPeriodo(7, 999)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('CuentasCobroService.actualizarPorTurnoFirmado', () => {
  const periodo = { id: 10, empresa_id: 7, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-15' };

  beforeEach(() => {
    PeriodosModel.obtenerPorId.mockResolvedValue(periodo);
    CuentasCobroModel.crear.mockResolvedValue(555);
    CuentasCobroModel.listarPorPeriodoYTrabajador.mockResolvedValue([]);
  });

  test('período cerrado → genera para ese trabajador: avisa de la cuenta nueva pero no de lo que aún falta', async () => {
    CuentasCobroModel.periodoCerradoDeAsignacion.mockResolvedValue(10);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno()]),
      { ...trabajador([turno({ asignacion_id: 9, firmado_trabajador: false })]), trabajador_id: 62, usuario_id: 70 },
    ]);

    const resultado = await CuentasCobroService.actualizarPorTurnoFirmado(7, 1, 61);

    expect(CuentasCobroModel.periodoCerradoDeAsignacion).toHaveBeenCalledWith(7, 1);
    expect(resultado).toEqual({ generadas: 1, bloqueados: 0 });
    expect(CuentasCobroModel.crear).toHaveBeenCalledTimes(1);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'cuenta_cobro.pendiente_firma',
    }));
  });

  test('período cerrado pero aún le faltan turnos por firmar → no genera ni vuelve a avisar el bloqueo', async () => {
    CuentasCobroModel.periodoCerradoDeAsignacion.mockResolvedValue(10);
    AsignacionesModel.liquidacion.mockResolvedValue([
      trabajador([turno(), turno({ asignacion_id: 2, firmado_trabajador: false })]),
    ]);

    await CuentasCobroService.actualizarPorTurnoFirmado(7, 1, 61);

    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('período aún abierto → no hace nada (lo genera el cierre)', async () => {
    CuentasCobroModel.periodoCerradoDeAsignacion.mockResolvedValue(null);

    const resultado = await CuentasCobroService.actualizarPorTurnoFirmado(7, 1, 61);

    expect(resultado).toBeNull();
    expect(AsignacionesModel.liquidacion).not.toHaveBeenCalled();
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
  });
});
