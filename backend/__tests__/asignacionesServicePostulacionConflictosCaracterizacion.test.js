'use strict';

// Test de caracterización de las 4 consultas de asignaciones.postulacion.service: horario de la asignación y de la
// oferta, jornada de nómina solapada y turno solapado del mismo usuario en OTRA empresa. Usa los models REALES
// (solo se espían las operaciones de escritura) y simula solo el borde (pool), así que vale igual si el SQL
// vive en el service o en un model.
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
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/integracion/integracion.service');
jest.mock('../modules/integracion/cobertura.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const Postulacion = require('../modules/turnos/asignaciones/asignaciones.postulacion.service');

const EMPRESA = 7;
const ASIG = 50;
const SQL_HORARIO_ASIGNACION = 'SELECT o.fecha, o.hora_inicio, o.hora_fin_estimada FROM asignaciones_turno a JOIN ofertas_turno o ON o.id = a.oferta_id WHERE a.id = ? AND a.empresa_id = ?';
const SQL_JORNADA = "SELECT id FROM registros_diarios WHERE empresa_id = ? AND trabajador_id = ? AND fecha = ? AND hora_entrada IS NOT NULL AND hora_entrada < ? AND COALESCE(hora_salida,'23:59:00') > ? LIMIT 1";
const SQL_SOLAPE_USUARIO = "SELECT a.id FROM asignaciones_turno a JOIN ofertas_turno o ON o.id = a.oferta_id JOIN trabajadores t2 ON t2.id = a.trabajador_id WHERE t2.usuario_id = ? AND a.id != ? AND a.estado IN ('confirmado', 'en_progreso') AND o.fecha = ? AND o.hora_inicio < ? AND COALESCE(o.hora_fin_estimada, '23:59:59') > ? LIMIT 1";
const SQL_HORARIO_OFERTA = 'SELECT fecha, hora_inicio, hora_fin_estimada FROM ofertas_turno WHERE id = ? AND empresa_id = ?';

const horario = (fin = '17:00:00') => [/^SELECT o\.fecha, o\.hora_inicio/, [[{ fecha: '2026-06-01', hora_inicio: '09:00:00', hora_fin_estimada: fin }]]];
const horarioOferta = (fin = '17:00:00') => [/^SELECT fecha, hora_inicio, hora_fin_estimada FROM ofertas_turno/, [[{ fecha: '2026-06-01', hora_inicio: '09:00:00', hora_fin_estimada: fin }]]];
const jornadaSolapada = [/FROM registros_diarios/, [[{ id: 1 }]]];
const solapeOtraEmpresa = [/JOIN trabajadores t2/, [[{ id: 77 }]]];
const sqls = () => llamadas.map(([s]) => s);

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
  jest.spyOn(AsignacionesModel, 'obtenerPorId').mockResolvedValue({ id: ASIG, trabajador_id: 5, oferta_id: 9 });
  jest.spyOn(AsignacionesModel, 'confirmar').mockResolvedValue({ ok: false, motivo: 'estado' }); // corta el flujo después de los chequeos
  jest.spyOn(AsignacionesModel, 'asignarDirecto').mockResolvedValue({ ok: false, motivo: 'cargo' });
});

describe('confirmar', () => {
  test('asignación inexistente: no hace ningún chequeo de horario', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue(null);
    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ statusCode: 409, message: 'La asignación no está pendiente de confirmación' });
    expect(llamadas).toHaveLength(0);
  });

  test('otro rol (ni nómina ni turnos): no consulta el horario', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'admin_empresa', usuario_id: 1 });
    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ statusCode: 409 });
    expect(llamadas).toHaveLength(0);
  });

  test('trabajador_nomina: consulta el horario y la jornada del día (consultas y parámetros literales)', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_nomina', usuario_id: 42 });
    responder([horario()]);

    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ message: 'La asignación no está pendiente de confirmación' });

    expect(sqls()).toEqual([SQL_HORARIO_ASIGNACION, SQL_JORNADA]);
    expect(llamadas[0][1]).toEqual([ASIG, EMPRESA]);
    expect(llamadas[1][1]).toEqual([EMPRESA, 5, '2026-06-01', '17:00:00', '09:00:00']);
    expect(AsignacionesModel.confirmar).toHaveBeenCalled();
  });

  test('trabajador_nomina sin hora de fin estimada: la jornada se compara hasta 23:59:00', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_nomina', usuario_id: 42 });
    responder([horario(null)]);
    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toThrow();
    expect(llamadas[1][1][3]).toBe('23:59:00');
  });

  test('trabajador_nomina con jornada laboral ese día y horario → 409 y no confirma', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_nomina', usuario_id: 42 });
    responder([horario(), jornadaSolapada]);

    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ statusCode: 409, message: 'Conflicto con jornada laboral registrada para ese día y horario' });
    expect(AsignacionesModel.confirmar).not.toHaveBeenCalled();
  });

  test('trabajador_turnos con cuenta: busca turno solapado en otras empresas (consulta y parámetros literales)', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_turnos', usuario_id: 42 });
    responder([horario()]);

    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ message: 'La asignación no está pendiente de confirmación' });

    expect(sqls()).toEqual([SQL_HORARIO_ASIGNACION, SQL_SOLAPE_USUARIO]);
    expect(llamadas[1][1]).toEqual([42, ASIG, '2026-06-01', '17:00:00', '09:00:00']);
  });

  test('trabajador_turnos sin hora de fin estimada: el solape se compara hasta 23:59:59', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_turnos', usuario_id: 42 });
    responder([horario(null)]);
    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toThrow();
    expect(llamadas[1][1][3]).toBe('23:59:59');
  });

  test('trabajador_turnos con turno confirmado en otra empresa → 409 y no confirma', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_turnos', usuario_id: 42 });
    responder([horario(), solapeOtraEmpresa]);

    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('en otra empresa') });
    expect(AsignacionesModel.confirmar).not.toHaveBeenCalled();
  });

  test('trabajador_turnos sin cuenta (usuario_id nulo): consulta el horario pero no busca solape', async () => {
    TrabajadoresModel.obtenerUsuarioIdYRol.mockResolvedValue({ rol: 'trabajador_turnos', usuario_id: null });
    responder([horario()]);
    await expect(Postulacion.confirmar(EMPRESA, ASIG)).rejects.toThrow();
    expect(sqls()).toEqual([SQL_HORARIO_ASIGNACION]);
  });
});

describe('asignarDirecto', () => {
  const datos = { puesto_id: 20, trabajador_id: 5 };

  test('trabajador_turnos con cuenta: consulta el horario de la oferta y busca solape en otras empresas (literal)', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, rol: 'trabajador_turnos', usuario_id: 42 });
    responder([horarioOferta()]);

    await expect(Postulacion.asignarDirecto(EMPRESA, 9, datos)).rejects.toMatchObject({ statusCode: 403 }); // el cargo corta el flujo

    expect(sqls()).toEqual([SQL_HORARIO_OFERTA, SQL_SOLAPE_USUARIO]);
    expect(llamadas[0][1]).toEqual([9, EMPRESA]);
    expect(llamadas[1][1]).toEqual([42, 0, '2026-06-01', '17:00:00', '09:00:00']); // sin asignación previa que excluir
    expect(AsignacionesModel.asignarDirecto).toHaveBeenCalledWith(EMPRESA, 9, 20, 5);
  });

  test('con turno confirmado en otra empresa → 409 y no asigna', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, rol: 'trabajador_turnos', usuario_id: 42 });
    responder([horarioOferta(), solapeOtraEmpresa]);

    await expect(Postulacion.asignarDirecto(EMPRESA, 9, datos)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('en otra empresa') });
    expect(AsignacionesModel.asignarDirecto).not.toHaveBeenCalled();
  });

  test('oferta no encontrada: se omite el chequeo y sigue el flujo normal', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, rol: 'trabajador_turnos', usuario_id: 42 });
    await expect(Postulacion.asignarDirecto(EMPRESA, 9, datos)).rejects.toMatchObject({ statusCode: 403 });
    expect(sqls()).toEqual([SQL_HORARIO_OFERTA]);
  });

  test('otro rol: no consulta nada antes de asignar', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, rol: 'trabajador_nomina', usuario_id: 42 });
    await expect(Postulacion.asignarDirecto(EMPRESA, 9, datos)).rejects.toMatchObject({ statusCode: 403 });
    expect(llamadas).toHaveLength(0);
  });
});
