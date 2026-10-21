'use strict';

// Test de caracterización: a quién avisa PeriodosService al abrir, liquidar y cambiar el ciclo.
// Simula solo el borde (pool), con el model real de notificaciones, así que vale igual
// si la consulta de "trabajadores de nómina" vive en el service o en un model.
jest.mock('../config/database', () => {
  const llamadas = [];
  let respuestas = [];
  const ejecutar = async (sql, params) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    llamadas.push([sql, params]);
    for (const [re, valor] of respuestas) if (re.test(sql)) return valor;
    return [[]];
  };
  return { pool: { query: ejecutar, execute: ejecutar }, __llamadas: llamadas, __responder: (r) => { respuestas = r; } };
});
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/nomina/registros/registros.service', () => ({ rellenarDiasVaciosComoDescanso: jest.fn() }));
jest.mock('../modules/cuentas-cobro/cuentas-cobro.service', () => ({ generarParaPeriodo: jest.fn().mockResolvedValue({ generadas: 0 }) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({ notificarVarios: jest.fn().mockResolvedValue(undefined) }));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const PeriodosService = require('../modules/nomina/periodos/periodos.service');

const TRABAJADORES = [/FROM trabajadores t JOIN usuarios u/, [[{ usuario_id: 101 }, { usuario_id: 102 }]]];
const GESTORES = [/rol IN \('jefe_nomina'/, [[{ id: 3 }, { id: 102 }]]]; // 102 es gestor Y trabajador: no debe repetirse
const periodo = { id: 5, estado: 'cerrado', fecha_inicio: '2026-01-01', fecha_fin: '2026-01-15' };

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([TRABAJADORES, GESTORES]);
});

test('período nuevo: avisa a los trabajadores de nómina activos (consulta literal)', async () => {
  PeriodosModel.crear.mockResolvedValue({ id: 5, esNuevo: true });
  PeriodosModel.obtenerPorId.mockResolvedValue(periodo);

  await PeriodosService.crear(1, { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-15' });

  expect(llamadas).toEqual([[
    "SELECT u.id AS usuario_id FROM trabajadores t JOIN usuarios u ON u.id = t.usuario_id WHERE t.empresa_id = ? AND t.activo = 1 AND u.rol = 'trabajador_nomina' AND u.activo = 1",
    [1],
  ]]);
  expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([101, 102], expect.objectContaining({
    empresaId: 1, tipo: 'nomina.periodo_abierto', data: { periodo_id: 5 },
  }));
});

test('período que ya existía (carrera): no consulta ni avisa', async () => {
  PeriodosModel.crear.mockResolvedValue({ id: 5, esNuevo: false });
  PeriodosModel.obtenerPorId.mockResolvedValue(periodo);

  await PeriodosService.crear(1, { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-15' });

  expect(llamadas).toHaveLength(0);
  expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
});

test('liquidar: avisa a los trabajadores de nómina que su nómina fue pagada', async () => {
  PeriodosModel.obtenerPorId.mockResolvedValue(periodo);
  PeriodosModel.liquidar.mockResolvedValue(undefined);

  await PeriodosService.liquidar(1, 5);

  expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([101, 102], expect.objectContaining({
    empresaId: 1, tipo: 'nomina.periodo_liquidado',
  }));
});

test('liquidar sin trabajadores de nómina: no avisa a nadie', async () => {
  responder([]);
  PeriodosModel.obtenerPorId.mockResolvedValue(periodo);
  await PeriodosService.liquidar(1, 5);
  expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
});

test('cambio de ciclo: avisa a trabajadores + gestores de nómina, sin repetir a quien es ambos', async () => {
  PeriodosModel.obtenerAbiertoPorFecha.mockResolvedValue(null);
  jest.spyOn(PeriodosService, 'autoCrear').mockResolvedValue({ id: 9, fecha_inicio: '2026-02-01', fecha_fin: '2026-02-15' });

  await PeriodosService.recalcularPorCambioDeCiclo(1, 7);

  expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([101, 102, 3], expect.objectContaining({
    empresaId: 1, tipo: 'nomina.ciclo_cambiado', data: { periodo_id: 9 },
  }));
});
