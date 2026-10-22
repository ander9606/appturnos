'use strict';

// Caracterización de CÓMO se abre, se cierra y se deshace cada transacción de estos tres
// sitios, ANTES de unificarlos en un único helper (utils/enTransaccion.js):
//   - TrabajadoresService.actualizar     (orquesta ficha + sueldo + rol en una transacción)
//   - TrabajadoresModel (enTransaccion con conn opcional: se une a la de quien llama)
//   - TrabajadorEmpresaModel.aceptarConversionANomina (su propia copia del helper)
// Simula solo el borde (pool/conexión) y anota TODO en un único registro, para fijar el
// orden getConnection → begin → pasos → commit/rollback → release.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');

let log;
let conn;
let fallas; // { begin, commit, rollback, release, getConnection }

beforeEach(() => {
  log = [];
  fallas = {};
  conn = {
    query: jest.fn(async (sql, params) => { log.push(['conn.query', sql.replace(/\s+/g, ' ').trim(), params]); return [[]]; }),
    beginTransaction: jest.fn(async () => { log.push(['begin']); if (fallas.begin) throw fallas.begin; }),
    commit: jest.fn(async () => { log.push(['commit']); if (fallas.commit) throw fallas.commit; }),
    rollback: jest.fn(async () => { log.push(['rollback']); if (fallas.rollback) throw fallas.rollback; }),
    release: jest.fn(() => { log.push(['release']); }),
  };
  pool.getConnection.mockImplementation(async () => {
    log.push(['getConnection']);
    if (fallas.getConnection) throw fallas.getConnection;
    return conn;
  });
  pool.query.mockResolvedValue([[]]);
});
afterEach(() => jest.restoreAllMocks());

const nombres = () => log.map((l) => l[0]);

// ── TrabajadoresService.actualizar ───────────────────────────────────────────

describe('TrabajadoresService.actualizar — una transacción para ficha, sueldo y rol', () => {
  const actual = { id: 5, empresa_id: 1, tipo: 'nomina', usuario_id: 42, email: 'a@x.com' };
  const actor = { usuario_rol: ROLES.ADMIN_EMPRESA, usuario_nombre: 'Marta' };
  let notificarSueldo;

  beforeEach(() => {
    const paso = (nombre, valor) => async (...a) => { log.push([nombre, ...a.map((x) => (x === conn ? 'CONN' : x))]); return typeof valor === 'function' ? valor() : valor; };
    jest.spyOn(TrabajadoresModel, 'obtenerPorId').mockImplementation(paso('obtenerPorId', actual));
    jest.spyOn(TrabajadoresModel, 'actualizar').mockImplementation(paso('actualizar', 1));
    jest.spyOn(TrabajadoresModel, 'actualizarSalarioConAuditoria').mockImplementation(paso('sueldo', { cambio: true, trabajadorId: 5, usuarioId: 42, nombre: 'Ana' }));
    jest.spyOn(TrabajadoresModel, 'sincronizarRolUsuario').mockImplementation(paso('rol', 1));
    notificarSueldo = jest.spyOn(TrabajadoresService, 'notificarCambioSalario').mockImplementation(paso('avisoSueldo', undefined));
  });

  test('camino completo: begin → ficha → sueldo → rol (todos con la MISMA conexión) → commit → release → aviso', async () => {
    await TrabajadoresService.actualizar(1, 5, { nombre: 'Ana', tarifa_hora: 9000, tipo: 'turnos' }, actor);

    expect(nombres()).toEqual(['obtenerPorId', 'getConnection', 'begin', 'actualizar', 'sueldo', 'rol', 'commit', 'release', 'avisoSueldo', 'obtenerPorId']);
    expect(log[3]).toEqual(['actualizar', 1, 5, { nombre: 'Ana', tipo: 'turnos' }, 'CONN']); // sin tarifa/salario
    expect(log[4]).toEqual(['sueldo', 1, 5, { tarifa_hora: 9000, salario_base: undefined }, actor, 'CONN']);
    expect(log[5]).toEqual(['rol', 42, ROLES.TRABAJADOR_TURNOS, 'CONN']);
    expect(log[8].slice(0, 2)).toEqual(['avisoSueldo', 1]);
  });

  test('sin sueldo ni cambio de tipo: solo la ficha; sin aviso de sueldo', async () => {
    await TrabajadoresService.actualizar(1, 5, { nombre: 'Ana' }, actor);
    expect(nombres()).toEqual(['obtenerPorId', 'getConnection', 'begin', 'actualizar', 'commit', 'release', 'obtenerPorId']);
    expect(notificarSueldo).not.toHaveBeenCalled();
  });

  test('sueldo sin cambio real (cambio: false): hay transacción, pero no aviso', async () => {
    TrabajadoresModel.actualizarSalarioConAuditoria.mockImplementation(async () => { log.push(['sueldo']); return { cambio: false }; });
    await TrabajadoresService.actualizar(1, 5, { salario_base: 1 }, actor);
    expect(nombres()).toEqual(['obtenerPorId', 'getConnection', 'begin', 'actualizar', 'sueldo', 'commit', 'release', 'obtenerPorId']);
  });

  test.each([
    ['ficha', 'actualizar', ['getConnection', 'begin', 'actualizar', 'rollback', 'release']],
    ['sueldo', 'sueldo', ['getConnection', 'begin', 'actualizar', 'sueldo', 'rollback', 'release']],
    ['rol', 'rol', ['getConnection', 'begin', 'actualizar', 'sueldo', 'rol', 'rollback', 'release']],
  ])('si falla el paso de %s: rollback, sin commit, libera la conexión y propaga el error', async (_n, paso, esperado) => {
    const boom = new Error(`falla ${paso}`);
    const metodo = { actualizar: 'actualizar', sueldo: 'actualizarSalarioConAuditoria', rol: 'sincronizarRolUsuario' }[paso];
    TrabajadoresModel[metodo].mockImplementation(async () => { log.push([paso]); throw boom; });

    await expect(TrabajadoresService.actualizar(1, 5, { tarifa_hora: 9000, tipo: 'turnos' }, actor)).rejects.toBe(boom);

    expect(nombres().slice(1)).toEqual(esperado); // [0] es obtenerPorId del 404
    expect(notificarSueldo).not.toHaveBeenCalled();
  });

  test('ER_DUP_ENTRY al actualizar la ficha → AppError 409 (mensaje de cédula repetida); en otro paso NO se traduce', async () => {
    TrabajadoresModel.actualizar.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    await expect(TrabajadoresService.actualizar(1, 5, { cedula: '1' }, actor)).rejects.toMatchObject({
      statusCode: 409, message: 'Ya existe un trabajador con esa cédula en tu empresa',
    });
    expect(nombres()).toContain('rollback');

    const dup = Object.assign(new Error('dup2'), { code: 'ER_DUP_ENTRY' });
    TrabajadoresModel.actualizar.mockResolvedValue(1);
    TrabajadoresModel.actualizarSalarioConAuditoria.mockRejectedValue(dup);
    await expect(TrabajadoresService.actualizar(1, 5, { tarifa_hora: 1 }, actor)).rejects.toBe(dup);
  });

  test('si el commit falla: rollback y release; no hay aviso', async () => {
    fallas.commit = new Error('commit roto');
    await expect(TrabajadoresService.actualizar(1, 5, { tarifa_hora: 9000 }, actor)).rejects.toThrow('commit roto');
    expect(nombres().slice(-3)).toEqual(['commit', 'rollback', 'release']);
    expect(notificarSueldo).not.toHaveBeenCalled();
  });

  test('si falla beginTransaction: igual se llama rollback y release, y no se ejecuta ningún paso', async () => {
    fallas.begin = new Error('begin roto');
    await expect(TrabajadoresService.actualizar(1, 5, { nombre: 'Ana' }, actor)).rejects.toThrow('begin roto');
    expect(nombres().slice(1)).toEqual(['getConnection', 'begin', 'rollback', 'release']);
  });

  test('si falla el rollback: el error del rollback gana, y la conexión se libera igual', async () => {
    TrabajadoresModel.actualizar.mockRejectedValue(new Error('original'));
    fallas.rollback = new Error('rollback roto');
    await expect(TrabajadoresService.actualizar(1, 5, { nombre: 'Ana' }, actor)).rejects.toThrow('rollback roto');
    expect(nombres().slice(-2)).toEqual(['rollback', 'release']);
  });

  test('si no se puede obtener la conexión: rechaza sin tocar begin/rollback/release', async () => {
    fallas.getConnection = new Error('pool agotado');
    await expect(TrabajadoresService.actualizar(1, 5, { nombre: 'Ana' }, actor)).rejects.toThrow('pool agotado');
    expect(nombres().slice(1)).toEqual(['getConnection']);
  });

  test('el aviso de sueldo ocurre DESPUÉS del commit y si falla no tumba la actualización', async () => {
    TrabajadoresService.notificarCambioSalario.mockRejectedValue(new Error('push caído'));
    await expect(TrabajadoresService.actualizar(1, 5, { tarifa_hora: 9000 }, actor)).resolves.toBeDefined();
    expect(nombres().indexOf('commit')).toBeLessThan(nombres().indexOf('release'));
  });

  test('validaciones previas (403 jefe_nomina sin permiso, turnos→nómina 409) cortan ANTES de abrir la conexión', async () => {
    await expect(TrabajadoresService.actualizar(1, 5, { campo_inventado: 1 }, { usuario_rol: ROLES.JEFE_NOMINA })).rejects.toMatchObject({ statusCode: 403 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ ...actual, tipo: 'turnos' });
    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(nombres()).not.toContain('getConnection');
  });
});

// ── TrabajadoresModel: enTransaccion con conn opcional ───────────────────────

describe('TrabajadoresModel.actualizarSalarioConAuditoria — transacción propia o la de quien llama', () => {
  const llamar = (c) => TrabajadoresModel.actualizarSalarioConAuditoria(1, 5, { tarifa_hora: 1 }, { usuario_id: 9 }, c);

  test('sin conn: abre la suya (begin → consulta → commit → release)', async () => {
    await expect(llamar(undefined)).resolves.toBeNull(); // ficha inexistente
    expect(nombres()).toEqual(['getConnection', 'begin', 'conn.query', 'commit', 'release']);
    expect(log[2][1]).toContain('SELECT usuario_id, nombre, apellido, tarifa_hora, salario_base FROM trabajadores');
  });

  test('sin conn y la consulta falla: rollback + release, sin commit', async () => {
    conn.query.mockRejectedValueOnce(new Error('falla'));
    await expect(llamar(undefined)).rejects.toThrow('falla');
    expect(nombres()).toEqual(['getConnection', 'begin', 'rollback', 'release']);
  });

  test('con conn: se une a la transacción de quien llama (sin begin/commit/rollback/release ni pedir otra conexión)', async () => {
    await expect(llamar(conn)).resolves.toBeNull();
    expect(nombres()).toEqual(['conn.query']);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('con conn y falla: propaga el error sin rollback (lo hace quien abrió la transacción)', async () => {
    conn.query.mockRejectedValueOnce(new Error('falla'));
    await expect(llamar(conn)).rejects.toThrow('falla');
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(nombres()).toEqual([]); // ni begin, ni rollback, ni release, ni otra conexión
  });
});

// ── TrabajadorEmpresaModel.aceptarConversionANomina ──────────────────────────

describe('TrabajadorEmpresaModel.aceptarConversionANomina — su propia transacción', () => {
  const args = { relacionId: 10, trabajadorId: 5, usuarioId: 42, empresaId: 1, rolNomina: 'trabajador_nomina' };
  beforeEach(() => {
    const paso = (nombre, valor) => async (...a) => { log.push([nombre, ...a.map((x) => (x === conn ? 'CONN' : x))]); return valor; };
    jest.spyOn(TrabajadorEmpresaModel, 'cambiarEstado').mockImplementation(paso('cambiarEstado', 1));
    jest.spyOn(TrabajadorEmpresaModel, 'convertirANomina').mockImplementation(paso('convertirANomina', 1));
    jest.spyOn(TrabajadorEmpresaModel, 'archivarOtrasRelacionesDeUsuario').mockImplementation(paso('archivar', [{ id: 20 }]));
  });

  test('begin → 3 pasos con la misma conexión → commit → release, y devuelve lo archivado', async () => {
    await expect(TrabajadorEmpresaModel.aceptarConversionANomina(args)).resolves.toEqual([{ id: 20 }]);
    expect(log).toEqual([
      ['getConnection'], ['begin'],
      ['cambiarEstado', 10, 'activo', { trabajadorId: 5, activoAntesDeOferta: false }, 'CONN'],
      ['convertirANomina', 5, 42, 1, 'trabajador_nomina', 'CONN'],
      ['archivar', 42, 10, 'CONN'],
      ['commit'], ['release'],
    ]);
  });

  test.each([
    ['cambiarEstado', ['getConnection', 'begin', 'cambiarEstado', 'rollback', 'release']],
    ['convertirANomina', ['getConnection', 'begin', 'cambiarEstado', 'convertirANomina', 'rollback', 'release']],
    ['archivarOtrasRelacionesDeUsuario', ['getConnection', 'begin', 'cambiarEstado', 'convertirANomina', 'archivar', 'rollback', 'release']],
  ])('si falla %s: rollback, sin commit y release', async (metodo, esperado) => {
    const nombreLog = { cambiarEstado: 'cambiarEstado', convertirANomina: 'convertirANomina', archivarOtrasRelacionesDeUsuario: 'archivar' }[metodo];
    TrabajadorEmpresaModel[metodo].mockImplementation(async () => { log.push([nombreLog]); throw new Error('falla'); });
    await expect(TrabajadorEmpresaModel.aceptarConversionANomina(args)).rejects.toThrow('falla');
    expect(nombres()).toEqual(esperado);
  });

  test('si falla beginTransaction: rollback y release igualmente; si falla getConnection: nada más', async () => {
    fallas.begin = new Error('begin roto');
    await expect(TrabajadorEmpresaModel.aceptarConversionANomina(args)).rejects.toThrow('begin roto');
    expect(nombres()).toEqual(['getConnection', 'begin', 'rollback', 'release']);

    log.length = 0; fallas = { getConnection: new Error('pool agotado') };
    await expect(TrabajadorEmpresaModel.aceptarConversionANomina(args)).rejects.toThrow('pool agotado');
    expect(nombres()).toEqual(['getConnection']);
  });

  test('si falla el commit: rollback y release', async () => {
    fallas.commit = new Error('commit roto');
    await expect(TrabajadorEmpresaModel.aceptarConversionANomina(args)).rejects.toThrow('commit roto');
    expect(nombres().slice(-3)).toEqual(['commit', 'rollback', 'release']);
  });
});
