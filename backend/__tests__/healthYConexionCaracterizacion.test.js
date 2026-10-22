'use strict';

// Caracterización del health check (GET /api/health de server.js) y de verificarConexion
// (arranque, config/database.js), ANTES de que ambos compartan una función de ping.
// El borde simulado es mysql2/promise, así que se prueba el config/database REAL y vale
// igual si el ping vive en server.js o en config/database.
jest.mock('mysql2/promise', () => {
  const conn = { ping: jest.fn(), release: jest.fn() };
  const fakePool = { getConnection: jest.fn(), query: jest.fn() };
  return { createPool: jest.fn(() => fakePool), __fakePool: fakePool, __conn: conn };
});
jest.mock('../instrument', () => ({ captureException: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

process.env.JWT_SECRET = 'secreto-test';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const { verificarConexion } = require('../config/database');

const { __fakePool: pool, __conn: conn } = mysql;
let eventos;

beforeEach(() => {
  eventos = [];
  jest.clearAllMocks();
  pool.getConnection.mockImplementation(async () => { eventos.push('getConnection'); return conn; });
  conn.ping.mockImplementation(async () => { eventos.push('ping'); });
  conn.release.mockImplementation(() => { eventos.push('release'); });
});

describe('verificarConexion (arranque)', () => {
  test('conexión → ping → log con el nombre de la base → release', async () => {
    process.env.DB_NAME = 'mi_base';
    await expect(verificarConexion()).resolves.toBeUndefined();
    expect(eventos).toEqual(['getConnection', 'ping', 'release']);
    expect(logger.info).toHaveBeenCalledWith('DB conectada: mi_base');
  });

  test('si el ping falla: libera la conexión, propaga el error y NO registra "conectada"', async () => {
    conn.ping.mockRejectedValue(new Error('ping roto'));
    await expect(verificarConexion()).rejects.toThrow('ping roto');
    expect(eventos).toEqual(['getConnection', 'release']);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('si no consigue conexión: rechaza sin liberar nada', async () => {
    pool.getConnection.mockRejectedValue(new Error('pool agotado'));
    await expect(verificarConexion()).rejects.toThrow('pool agotado');
    expect(conn.release).not.toHaveBeenCalled();
  });
});

describe('GET /api/health', () => {
  let servidor;
  let base;

  beforeAll(async () => {
    const app = require('../server');
    await new Promise((ok) => { servidor = app.listen(0, '127.0.0.1', ok); });
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  afterAll(() => new Promise((ok) => servidor.close(ok)));

  const pedir = async () => {
    const res = await fetch(`${base}/api/health`);
    return { status: res.status, cuerpo: await res.json() };
  };

  test('base ok → 200 y estado ok; abre, hace ping y libera la conexión', async () => {
    const { status, cuerpo } = await pedir();
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ success: true, data: { status: 'ok', db: 'ok' }, message: 'App Turnos API ok' });
    expect(typeof cuerpo.data.uptime).toBe('number');
    expect(eventos).toEqual(['getConnection', 'ping', 'release']);
  });

  test('ping falla → 503 degradado, y la conexión se devuelve al pool', async () => {
    conn.ping.mockRejectedValue(new Error('ping roto'));
    const { status, cuerpo } = await pedir();
    expect(status).toBe(503);
    expect(cuerpo).toMatchObject({ success: false, data: { status: 'degraded', db: 'error' }, message: 'App Turnos API degraded' });
    // Antes (bug): el release() estaba dentro del try, después del ping, y si el ping fallaba
    // la conexión se quedaba fuera del pool. Ahora ping() la libera siempre (try/finally).
    expect(eventos).toEqual(['getConnection', 'release']);
  });

  test('sin conexión disponible → 503 degradado y no hay nada que liberar', async () => {
    pool.getConnection.mockRejectedValue(new Error('pool agotado'));
    const { status, cuerpo } = await pedir();
    expect(status).toBe(503);
    expect(cuerpo.data).toMatchObject({ status: 'degraded', db: 'error' });
    expect(conn.release).not.toHaveBeenCalled();
  });
});
