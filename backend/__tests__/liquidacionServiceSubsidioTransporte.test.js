'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/nomina/liquidacion/liquidacion.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/nomina/descuentos/descuentos.model');

const LiquidacionModel = require('../modules/nomina/liquidacion/liquidacion.model');
const PeriodosModel    = require('../modules/nomina/periodos/periodos.model');
const EmpresasModel    = require('../modules/empresas/empresas.model');
const DescuentosModel  = require('../modules/nomina/descuentos/descuentos.model');
const LiquidacionService = require('../modules/nomina/liquidacion/liquidacion.service');

// Quincena de 15 días (2026-06-01 al 2026-06-15) — ni domingo ni festivo cruza este rango.
const PERIODO = { id: 1, tipo: 'quincenal', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-15', estado: 'abierto' };

function filaBase({ dias_sin_subsidio = 0 } = {}) {
  return {
    trabajador_id: 5, nombre: 'Ana', apellido: 'Gomez', cedula: '123',
    salario_base: 1500000, tarifa_hora: null,
    banco: null, tipo_cuenta: null, numero_cuenta: null,
    valor_hora_snapshot: null, salario_base_snapshot: null,
    dias_registrados: 15, dias_sin_subsidio,
    horas_ordinarias: 120, horas_extra_diurnas: 0, horas_extra_nocturnas: 0,
    horas_nocturnas: 0, horas_festivo: 0,
  };
}

describe('LiquidacionService.generar — auxilio de transporte prorrateado', () => {
  beforeEach(() => {
    PeriodosModel.obtenerPorId.mockResolvedValue(PERIODO);
    EmpresasModel.obtenerTipoContrato.mockResolvedValue('laboral');
    EmpresasModel.obtenerConfigRecargos.mockResolvedValue({ sumarNocturnasFestivo: true, reglaDomingoHabitual: 'ley' });
    DescuentosModel.aceptadosPorPeriodo.mockResolvedValue([]);
  });

  test('sin ausencia/incapacidad/licencia/vacación → auxilio completo de los 15 días de la quincena', async () => {
    LiquidacionModel.resumenPorPeriodo.mockResolvedValue([filaBase()]);

    const { lineas } = await LiquidacionService.generar(1, 1);

    expect(lineas[0].subsidio_transporte).toBeCloseTo(249095 * 15 / 30, 2);
  });

  // dias_sin_subsidio ya viene sumado desde el modelo (ausencia + incapacidad +
  // licencia + vacación, ver liquidacion.model.js) — el service solo resta el total.
  test('3 días sin auxilio (incapacidad, licencia o vacación) → se prorratea solo a los 12 días restantes', async () => {
    LiquidacionModel.resumenPorPeriodo.mockResolvedValue([filaBase({ dias_sin_subsidio: 3 })]);

    const { lineas } = await LiquidacionService.generar(1, 1);

    expect(lineas[0].subsidio_transporte).toBeCloseTo(249095 * 12 / 30, 2);
  });

  test('dias_sin_subsidio nunca deja el auxilio negativo aunque supere los días del período', async () => {
    LiquidacionModel.resumenPorPeriodo.mockResolvedValue([filaBase({ dias_sin_subsidio: 20 })]);

    const { lineas } = await LiquidacionService.generar(1, 1);

    expect(lineas[0].subsidio_transporte).toBe(0);
  });
});
