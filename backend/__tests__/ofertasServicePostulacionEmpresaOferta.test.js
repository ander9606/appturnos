'use strict';

// Test de caracterización: cómo aplicar() y retirar() resuelven la empresa dueña de la oferta cuando
// el JWT del trabajador no trae empresa_id (trabajador multi-empresa). Usa OfertasModel REAL y simula solo
// el borde (pool), así que vale igual si la consulta vive en el service o en el model. retirar() no tenía tests.
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
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

const SQL_EMPRESA = 'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1';
const ofertaDeEmpresa = (id) => [/^SELECT empresa_id FROM ofertas_turno/, [[{ empresa_id: id }]]];
const usuarioTurnos = { rol: 'trabajador_turnos' };

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
});

describe('aplicar — empresa dueña de la oferta', () => {
  test('sin puesto_id → 400, sin tocar la base', async () => {
    await expect(OfertasService.aplicar(null, 9, null, 42, [7], usuarioTurnos)).rejects.toMatchObject({ statusCode: 400 });
    expect(llamadas).toHaveLength(0);
  });

  test('empresaId nulo y la oferta no existe → 404, con la consulta literal', async () => {
    await expect(OfertasService.aplicar(null, 9, 20, 42, [7], usuarioTurnos)).rejects.toMatchObject({ statusCode: 404, message: 'Oferta no encontrada' });
    expect(llamadas).toEqual([[SQL_EMPRESA, [9]]]);
  });

  test('la oferta es de una empresa donde el trabajador NO está vinculado → 404, sin buscar al trabajador', async () => {
    responder([ofertaDeEmpresa(99)]);
    await expect(OfertasService.aplicar(null, 9, 20, 42, [7, 8], usuarioTurnos)).rejects.toMatchObject({ statusCode: 404, message: 'Oferta no encontrada' });
    expect(TrabajadoresModel.obtenerPorUsuarioId).not.toHaveBeenCalled();
  });

  test('sin empresasActivas en el JWT, las pide al model; con la empresa de la oferta continúa hacia el trabajador', async () => {
    responder([ofertaDeEmpresa(99)]);
    TrabajadorEmpresaModel.listarEmpresaIds.mockResolvedValue([99]);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue(null);

    await expect(OfertasService.aplicar(null, 9, 20, 42, [], usuarioTurnos)).rejects.toMatchObject({ statusCode: 403 });
    expect(TrabajadorEmpresaModel.listarEmpresaIds).toHaveBeenCalledWith(42);
    expect(TrabajadoresModel.obtenerPorUsuarioId).toHaveBeenCalledWith(99, 42); // usó la empresa de la oferta
  });
});

describe('retirar', () => {
  const asignacion = (estado) => ({ id: 500, estado });

  test('sin puesto_id → 400', async () => {
    await expect(OfertasService.retirar(null, 9, null, 42, [7])).rejects.toMatchObject({ statusCode: 400 });
    expect(llamadas).toHaveLength(0);
  });

  test('empresaId nulo y la oferta no existe → 404 "No estás postulado a esta oferta", con la consulta literal', async () => {
    await expect(OfertasService.retirar(null, 9, 20, 42, [7])).rejects.toMatchObject({ statusCode: 404, message: 'No estás postulado a esta oferta' });
    expect(llamadas).toEqual([[SQL_EMPRESA, [9]]]);
  });

  test('empresaId nulo: usa la empresa de la oferta; sin postulación en ese puesto → 404', async () => {
    responder([ofertaDeEmpresa(7)]);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99 });
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(null);

    await expect(OfertasService.retirar(null, 9, '20', 42, [7])).rejects.toMatchObject({ statusCode: 404, message: 'No estás postulado a este puesto' });
    expect(TrabajadoresModel.obtenerPorUsuarioId).toHaveBeenCalledWith(7, 42);
    expect(AsignacionesModel.obtenerPorPuestoYTrabajador).toHaveBeenCalledWith(20, 99); // puesto convertido a número
  });

  test('postulación ya confirmada o en curso → 409 y no se elimina', async () => {
    responder([ofertaDeEmpresa(7)]);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99 });
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(asignacion('confirmado'));

    await expect(OfertasService.retirar(null, 9, 20, 42, [7])).rejects.toMatchObject({ statusCode: 409 });
    expect(AsignacionesModel.eliminar).not.toHaveBeenCalled();
  });

  test('postulación pendiente → se elimina en la empresa de la oferta', async () => {
    responder([ofertaDeEmpresa(7)]);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99 });
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(asignacion('pendiente'));

    await expect(OfertasService.retirar(null, 9, 20, 42, [7])).resolves.toBeUndefined();
    expect(AsignacionesModel.eliminar).toHaveBeenCalledWith(7, 500);
  });

  test('con empresaId en el JWT no consulta de qué empresa es la oferta', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99 });
    AsignacionesModel.obtenerPorPuestoYTrabajador.mockResolvedValue(asignacion('pendiente'));

    await OfertasService.retirar(7, 9, 20, 42, [7]);

    expect(llamadas).toHaveLength(0);
    expect(AsignacionesModel.eliminar).toHaveBeenCalledWith(7, 500);
  });
});
