'use strict';

// generarParaPeriodo agrega turnos firmados de AsignacionesModel.liquidacion()
// en una cuenta de cobro por trabajador — lógica de dinero, no trivial.
// Regresión clave: solo debe contar turnos con firmado_trabajador=true, y
// nunca debe crear una cuenta para un trabajador sin ningún turno firmado.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('./../modules/cuentas-cobro/cuentas-cobro.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
}));

const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const CuentasCobroModel = require('../modules/cuentas-cobro/cuentas-cobro.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const CuentasCobroService = require('../modules/cuentas-cobro/cuentas-cobro.service');

afterEach(() => jest.clearAllMocks());

describe('CuentasCobroService.generarParaPeriodo', () => {
  const periodo = { id: 10, empresa_id: 7, fecha_inicio: '2026-09-01', fecha_fin: '2026-09-15' };

  beforeEach(() => {
    PeriodosModel.obtenerPorId.mockResolvedValue(periodo);
    CuentasCobroModel.crear.mockResolvedValue(555);
  });

  test('solo cuenta turnos firmados; ignora turnos completados sin firma', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      {
        trabajador_id: 61,
        usuario_id: 69,
        turnos: [
          { asignacion_id: 1, oferta_titulo: 'Turno A', oferta_fecha: '2026-09-03', hora_inicio: '08:00', hora_fin_estimada: '16:00', horas_trabajadas: 8, pago_total: 60000, firmado_trabajador: true },
          { asignacion_id: 2, oferta_titulo: 'Turno B', oferta_fecha: '2026-09-05', hora_inicio: '08:00', hora_fin_estimada: '16:00', horas_trabajadas: 8, pago_total: 70000, firmado_trabajador: false },
        ],
      },
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado).toEqual({ generadas: 1 });
    expect(CuentasCobroModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({
      periodoId: 10,
      trabajadorId: 61,
      totalTurnos: 1,
      totalHoras: 8,
      valorTotal: 60000,
      items: [expect.objectContaining({ asignacion_id: 1, valor: 60000 })],
    }));
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 69,
      tipo: 'cuenta_cobro.pendiente_firma',
      data: { cuenta_cobro_id: 555, periodo_id: 10 },
    }));
  });

  test('trabajador sin ningún turno firmado no genera cuenta de cobro', async () => {
    AsignacionesModel.liquidacion.mockResolvedValue([
      {
        trabajador_id: 61,
        usuario_id: 69,
        turnos: [
          { asignacion_id: 1, oferta_titulo: 'Turno A', oferta_fecha: '2026-09-03', horas_trabajadas: 8, pago_total: 60000, firmado_trabajador: false },
        ],
      },
    ]);

    const resultado = await CuentasCobroService.generarParaPeriodo(7, 10);

    expect(resultado).toEqual({ generadas: 0 });
    expect(CuentasCobroModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('período no encontrado → AppError 404', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue(null);
    AsignacionesModel.liquidacion.mockResolvedValue([]);

    await expect(CuentasCobroService.generarParaPeriodo(7, 999)).rejects.toMatchObject({ statusCode: 404 });
  });
});
