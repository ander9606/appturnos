'use strict';

// 'fallido' (compensación por fuerza mayor) debe reportarse a logiq360 igual
// que 'completado' — antes TERMINALES no lo conocía, así que verificarYEmitir
// se quedaba esperando para siempre a una asignación que ya nunca cambia de
// estado, y nunca emitía costo_labor.calculado ni para esa oferta ni para
// el resto de sus asignaciones normales.
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/integracion/integracion.service', () => ({
  emitir: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const IntegracionService = require('../modules/integracion/integracion.service');
const CostoLaborService = require('../modules/integracion/costo-labor.service');

afterEach(() => jest.clearAllMocks());

describe('CostoLaborService.verificarYEmitir — turno fallido', () => {
  test('emite el costo de la compensación y NO sobreescribe la oferta cancelada a completada', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 1, external_ref: 'EXT-1', alquiler_ref: null, estado: 'cancelada',
    });
    AsignacionesModel.listarConTrabajadorRef.mockResolvedValue([
      {
        id: 100, estado: 'fallido', pago_total: 120000, tarifa_dia: 120000, horas_trabajadas: 2,
        trabajador_external_ref: 'W-1', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz', trabajador_tipo: 'turnos',
      },
    ]);

    await CostoLaborService.verificarYEmitir(7, 1);

    expect(IntegracionService.emitir).toHaveBeenCalledWith(7, 'costo_labor.calculado', expect.objectContaining({
      total_pagado: 120000,
      total_trabajadores: 1,
    }));
    // La oferta sigue 'cancelada' — eso es lo que de verdad pasó, no se marca 'completada'.
    expect(OfertasModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('una oferta normal (sin fallidos) sigue marcándose completada como siempre', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 2, external_ref: 'EXT-2', alquiler_ref: null, estado: 'publicada',
    });
    AsignacionesModel.listarConTrabajadorRef.mockResolvedValue([
      { id: 200, estado: 'completado', pago_total: 90000, tarifa_dia: 90000, horas_trabajadas: 8, trabajador_tipo: 'turnos' },
    ]);

    await CostoLaborService.verificarYEmitir(7, 2);

    expect(OfertasModel.cambiarEstado).toHaveBeenCalledWith(7, 2, 'completada');
  });
});
