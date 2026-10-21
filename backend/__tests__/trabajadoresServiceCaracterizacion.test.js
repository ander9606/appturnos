'use strict';

// Test de caracterización de las consultas de TrabajadoresService que antes
// estaban sin cubrir: cupo del plan, gestor-no-es-trabajador, identidad para
// nómina (SQL dinámico), aviso de cambio de sueldo y el UPDATE de usuarios.rol
// dentro de la transacción de actualizar(). Usa el model REAL y simula solo el
// borde (pool / conexión), así que vale igual si el SQL vive en el service o en el model.
jest.mock('../config/database', () => {
  const llamadas = [];
  let respuestas = [];
  const ejecutar = async (sql, params) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    llamadas.push([sql, params]);
    for (const [re, valor] of respuestas) {
      if (re.test(sql)) {
        if (valor instanceof Error) throw valor;
        return valor;
      }
    }
    return [[]];
  };
  const conn = {
    query: ejecutar,
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
  return {
    pool: { query: ejecutar, execute: ejecutar, getConnection: jest.fn(async () => conn) },
    __conn: conn,
    __llamadas: llamadas,
    __responder: (r) => { respuestas = r; },
  };
});
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __conn: conn, __llamadas: llamadas, __responder: responder } = require('../config/database');
const { ROLES } = require('../config/constants');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

const planes = [
  { codigo: 'basico', orden: 1, max_trabajadores: 10, precio_cop: 129000 },
  { codigo: 'empresarial', orden: 3, max_trabajadores: null, precio_cop: 299000 },
];
const PLANES = [/FROM planes ORDER BY orden/, [planes]];

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder([]);
});

describe('notificarCambioSalario', () => {
  const datos = { trabajadorId: 7, usuarioId: 99, nombre: 'Ana Pérez' };

  test('lo hizo un jefe_nomina: busca a los admin_empresa activos y les avisa, además del trabajador', async () => {
    responder([[/SELECT id FROM usuarios WHERE empresa_id = \? AND rol = \?/, [[{ id: 1 }, { id: 2 }]]]]);
    await TrabajadoresService.notificarCambioSalario(1, datos, { usuario_rol: ROLES.JEFE_NOMINA, usuario_nombre: 'Luis' });

    expect(llamadas).toEqual([['SELECT id FROM usuarios WHERE empresa_id = ? AND rol = ? AND activo = 1', [1, ROLES.ADMIN_EMPRESA]]]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([1, 2], expect.objectContaining({ mensaje: 'Luis modificó el sueldo de Ana Pérez.' }));
    expect(Notificaciones.notificar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 99 }));
  });

  test('lo hizo un admin_empresa: no consulta admins, solo avisa al trabajador', async () => {
    await TrabajadoresService.notificarCambioSalario(1, datos, { usuario_rol: ROLES.ADMIN_EMPRESA, usuario_nombre: 'Marta' });
    expect(llamadas).toHaveLength(0);
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
    expect(Notificaciones.notificar).toHaveBeenCalledTimes(1);
  });
});

describe('obtenerCupoPlan / verificarCupoPlan', () => {
  test('empresa inexistente o inactiva → 404', async () => {
    responder([[/SELECT plan FROM empresas/, [[]]]]);
    await expect(TrabajadoresService.obtenerCupoPlan(1)).rejects.toMatchObject({ statusCode: 404 });
    expect(llamadas[0]).toEqual(['SELECT plan FROM empresas WHERE id = ? AND activo = 1 LIMIT 1', [1]]);
  });

  test('plan con tope: cuenta los activos y marca alTope cuando se alcanza', async () => {
    responder([[/SELECT plan FROM empresas/, [[{ plan: 'basico' }]]], PLANES, [/SELECT COUNT\(\*\) AS total FROM trabajadores/, [[{ total: 10 }]]]]);
    await expect(TrabajadoresService.obtenerCupoPlan(1)).resolves.toEqual({ plan: 'basico', limite: 10, total: 10, alTope: true });
    expect(llamadas.find(([s]) => s.includes('COUNT(*)'))).toEqual(['SELECT COUNT(*) AS total FROM trabajadores WHERE empresa_id = ? AND activo = 1', [1]]);
  });

  test('plan sin tope: no cuenta trabajadores', async () => {
    responder([[/SELECT plan FROM empresas/, [[{ plan: 'empresarial' }]]], PLANES]);
    await expect(TrabajadoresService.obtenerCupoPlan(1)).resolves.toEqual({ plan: 'empresarial', limite: null, total: null, alTope: false });
    expect(llamadas.some(([s]) => s.includes('COUNT(*)'))).toBe(false);
  });

  test('verificarCupoPlan lanza 402 al llegar al tope', async () => {
    responder([[/SELECT plan FROM empresas/, [[{ plan: 'basico' }]]], PLANES, [/COUNT\(\*\)/, [[{ total: 10 }]]]]);
    await expect(TrabajadoresService.verificarCupoPlan(1)).rejects.toMatchObject({ statusCode: 402, message: expect.stringContaining('plan basico permite máximo 10') });
  });
});

describe('verificarNoEsGestor', () => {
  test('email de un gestor de la empresa → 409; el email se normaliza (trim + minúsculas)', async () => {
    responder([[/SELECT 1 FROM usuarios/, [[{ 1: 1 }]]]]);
    await expect(TrabajadoresService.verificarNoEsGestor(1, '  Jefe@X.com ')).rejects.toMatchObject({ statusCode: 409 });
    expect(llamadas[0]).toEqual([
      'SELECT 1 FROM usuarios WHERE empresa_id = ? AND email = ? AND rol IN (?, ?, ?, ?) LIMIT 1',
      [1, 'jefe@x.com', ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA],
    ]);
  });

  test('email libre pasa; sin email no consulta nada', async () => {
    await expect(TrabajadoresService.verificarNoEsGestor(1, 'a@x.com')).resolves.toBeUndefined();
    llamadas.length = 0;
    await TrabajadoresService.verificarNoEsGestor(1, null);
    expect(llamadas).toHaveLength(0);
  });
});

describe('verificarIdentidadParaNomina', () => {
  const SQL_BASE = 'SELECT u.rol FROM usuarios u INNER JOIN trabajadores t ON t.usuario_id = u.id WHERE';

  test("tipo 'turnos', sin tipo, o sin cédula ni email → no consulta", async () => {
    await TrabajadoresService.verificarIdentidadParaNomina('turnos', '1', 'a@x.com');
    await TrabajadoresService.verificarIdentidadParaNomina(undefined, '1', 'a@x.com');
    await TrabajadoresService.verificarIdentidadParaNomina('nomina', null, null);
    expect(llamadas).toHaveLength(0);
  });

  test('solo cédula: filtra por cédula', async () => {
    await TrabajadoresService.verificarIdentidadParaNomina('nomina', '123', null);
    expect(llamadas[0]).toEqual([`${SQL_BASE} t.cedula = ? LIMIT 1`, ['123']]);
  });

  test('cédula y email: los combina con OR y normaliza el email', async () => {
    await TrabajadoresService.verificarIdentidadParaNomina('ambos', '123', ' Ana@X.com ');
    expect(llamadas[0]).toEqual([`${SQL_BASE} t.cedula = ? OR t.email = ? LIMIT 1`, ['123', 'ana@x.com']]);
  });

  test('nadie con esa identidad → pasa', async () => {
    await expect(TrabajadoresService.verificarIdentidadParaNomina('nomina', '123', null)).resolves.toBeUndefined();
  });

  test('ya tiene cuenta de turnos → 409 que manda a "Invitar por cédula"', async () => {
    responder([[/SELECT u\.rol/, [[{ rol: ROLES.TRABAJADOR_TURNOS }]]]]);
    await expect(TrabajadoresService.verificarIdentidadParaNomina('nomina', '123', null)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Invitar por cédula') });
  });

  test('ya tiene cuenta con otro rol → 409 distinto', async () => {
    responder([[/SELECT u\.rol/, [[{ rol: ROLES.TRABAJADOR_NOMINA }]]]]);
    await expect(TrabajadoresService.verificarIdentidadParaNomina('nomina', '123', null)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('otro rol') });
  });
});

describe('actualizar — rol de la cuenta dentro de la transacción', () => {
  beforeEach(() => {
    jest.spyOn(TrabajadoresModel, 'obtenerPorId')
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'nomina', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });
    jest.spyOn(TrabajadoresModel, 'actualizar').mockResolvedValue(1);
  });

  test('bajar de nómina a turnos ejecuta el UPDATE de usuarios.rol en la MISMA conexión y hace commit', async () => {
    await TrabajadoresService.actualizar(1, 5, { tipo: 'turnos' });

    expect(llamadas).toEqual([[
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_TURNOS, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA],
    ]]);
    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test('si el UPDATE de rol falla: rollback y sin commit', async () => {
    responder([[/UPDATE usuarios SET rol/, new Error('boom')]]);
    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'turnos' })).rejects.toThrow('boom');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});
