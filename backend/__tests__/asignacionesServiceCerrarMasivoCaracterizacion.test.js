'use strict';

// Test de caracterización de las 3 consultas de cerrarMasivo (marcaje): pertenencia de la oferta a la empresa y
// las dos listas de a quién avisar (en curso / no llegaron), con y sin excepciones. Usa los models REALES
// (la escritura masiva de AsignacionesModel.cerrarMasivo se espía) y simula solo el borde (pool), así que vale
// igual si el SQL vive en el service o en un model.
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
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/contratos/contratos.service');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/turnos/periodos/periodos-turnos.service');
jest.mock('../modules/integracion/integracion.service');
jest.mock('../modules/integracion/costo-labor.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosService = require('../modules/contratos/contratos.service');
const CostoLaborService = require('../modules/integracion/costo-labor.service');
const PeriodosTurnosService = require('../modules/turnos/periodos/periodos-turnos.service');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const MarcajeService = require('../modules/turnos/asignaciones/asignaciones.marcaje.service');

const EMPRESA = 7;
const OFERTA = 9;
const SQL_PERTENENCIA = 'SELECT id FROM ofertas_turno WHERE id = ? AND empresa_id = ? LIMIT 1';
const sqlEnProgreso = (exc = '') => `SELECT a.id, t.usuario_id, t.tipo AS trabajador_tipo FROM asignaciones_turno a JOIN trabajadores t ON t.id = a.trabajador_id WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'en_progreso' AND a.hora_ingreso_real IS NOT NULL ${exc}`.trim();
const sqlConfirmados = (exc = '') => `SELECT t.usuario_id FROM asignaciones_turno a JOIN trabajadores t ON t.id = a.trabajador_id WHERE a.oferta_id = ? AND a.empresa_id = ? AND a.estado = 'confirmado' ${exc}`.trim();

const existe = [/^SELECT id FROM ofertas_turno/, [[{ id: OFERTA }]]];
const enProgreso = (filas) => [/^SELECT a\.id, t\.usuario_id, t\.tipo AS trabajador_tipo/, [filas]];
const confirmados = (filas) => [/^SELECT t\.usuario_id FROM asignaciones_turno/, [filas]];
const consulta = (frag) => llamadas.find(([s]) => s.includes(frag));

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
  jest.spyOn(AsignacionesModel, 'cerrarMasivo').mockResolvedValue({ cerradas: 2, noPresentados: 1 });
  ContratosService.generarParaAsignacion.mockResolvedValue(undefined);
  CostoLaborService.verificarYEmitir.mockResolvedValue(undefined);
  PeriodosTurnosService.autoCrear.mockResolvedValue(undefined);
});

test('oferta que no es de la empresa → 404 (consulta literal), sin listar ni cerrar nada', async () => {
  await expect(MarcajeService.cerrarMasivo(EMPRESA, OFERTA)).rejects.toMatchObject({ statusCode: 404, message: 'Oferta no encontrada' });
  expect(llamadas).toEqual([[SQL_PERTENENCIA, [OFERTA, EMPRESA]]]);
  expect(AsignacionesModel.cerrarMasivo).not.toHaveBeenCalled();
});

test('sin excepciones: lista en curso y confirmados con sus consultas literales', async () => {
  responder([existe]);

  await MarcajeService.cerrarMasivo(EMPRESA, OFERTA);

  expect(llamadas.map(([s]) => s)).toEqual([SQL_PERTENENCIA, sqlEnProgreso(), sqlConfirmados()]);
  expect(llamadas[1][1]).toEqual([OFERTA, EMPRESA]);
  expect(llamadas[2][1]).toEqual([OFERTA, EMPRESA]);
});

test('con excepciones: ambas listas las excluyen con NOT IN y sus ids viajan como parámetros', async () => {
  responder([existe]);

  await MarcajeService.cerrarMasivo(EMPRESA, OFERTA, [5, 6]);

  const exc = 'AND a.trabajador_id NOT IN (?,?)';
  expect(llamadas.map(([s]) => s)).toEqual([SQL_PERTENENCIA, sqlEnProgreso(exc), sqlConfirmados(exc)]);
  expect(llamadas[1][1]).toEqual([OFERTA, EMPRESA, 5, 6]);
  expect(llamadas[2][1]).toEqual([OFERTA, EMPRESA, 5, 6]);
  expect(AsignacionesModel.cerrarMasivo).toHaveBeenCalledWith(EMPRESA, OFERTA, [5, 6], { capearHoras: true });
});

test('avisa a quienes cerraron (salvo nómina) y a los no presentados; contrato solo para quien no es nómina', async () => {
  responder([
    existe,
    enProgreso([{ id: 1, usuario_id: 501, trabajador_tipo: 'turnos' }, { id: 2, usuario_id: 502, trabajador_tipo: 'nomina' }]),
    confirmados([{ usuario_id: 601 }, { usuario_id: null }]),
  ]);

  const r = await MarcajeService.cerrarMasivo(EMPRESA, OFERTA, [], { capearHoras: false });

  expect(ContratosService.generarParaAsignacion).toHaveBeenCalledTimes(1);
  expect(ContratosService.generarParaAsignacion).toHaveBeenCalledWith(EMPRESA, 1);
  expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([501], expect.objectContaining({ tipo: 'turno.cerrado_gestor', data: { oferta_id: OFERTA } }));
  expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([601], expect.objectContaining({ tipo: 'turno.no_presentado_gestor' }));
  expect(AsignacionesModel.cerrarMasivo).toHaveBeenCalledWith(EMPRESA, OFERTA, [], { capearHoras: false });
  expect(r).toEqual({ cerradas: 2, noPresentados: 1, excluidos: 0 });
});

test('sin nadie en curso ni confirmado: no avisa a nadie pero igual cierra y verifica costo', async () => {
  responder([existe]);

  await MarcajeService.cerrarMasivo(EMPRESA, OFERTA);

  expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
  expect(CostoLaborService.verificarYEmitir).toHaveBeenCalledWith(EMPRESA, OFERTA);
});
