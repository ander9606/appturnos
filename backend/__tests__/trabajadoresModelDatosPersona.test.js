'use strict';

// La cédula no se cambia desde una empresa si el trabajador tiene ficha activa en
// otra (la cambia él desde su perfil). El resto de datos de la persona sí lo edita
// un gestor y se copia a sus otras fichas activas.
jest.mock('../config/database', () => {
  const conn = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
  return { pool: { query: jest.fn(), getConnection: jest.fn().mockResolvedValue(conn) }, conn };
});

const { pool, conn } = require('../config/database');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');

const DUP = Object.assign(new Error("Duplicate entry '1-123' for key 'uk_empresa_cedula'"), { code: 'ER_DUP_ENTRY' });

beforeEach(() => {
  conn.query.mockReset();
  conn.beginTransaction.mockClear();
  conn.commit.mockClear();
  conn.rollback.mockClear();
  conn.release.mockClear();
  pool.query.mockReset();
});

test('cambiar cédula con otra ficha activa del trabajador → 409, sin UPDATE, rollback', async () => {
  conn.query
    .mockResolvedValueOnce([[{ usuario_id: 99, cedula: '111' }]]) // ficha actual
    .mockResolvedValueOnce([[{ 1: 1 }]]); // existe otra ficha activa

  await expect(TrabajadoresModel.actualizar(1, 7, { cedula: '222' }))
    .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('cédula') });

  expect(conn.query).toHaveBeenCalledTimes(2);
  expect(conn.rollback).toHaveBeenCalled();
  expect(conn.commit).not.toHaveBeenCalled();
});

test('cambiar cédula sin otra ficha activa → UPDATE local y commit', async () => {
  conn.query
    .mockResolvedValueOnce([[{ usuario_id: 99, cedula: '111' }]])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);

  await expect(TrabajadoresModel.actualizar(1, 7, { cedula: '222' })).resolves.toBe(1);

  expect(conn.query.mock.calls[2][0]).toBe('UPDATE trabajadores SET cedula = ? WHERE id = ? AND empresa_id = ?');
  expect(conn.commit).toHaveBeenCalled();
  expect(conn.rollback).not.toHaveBeenCalled();
});

test('cédula igual a la actual con otra ficha → no bloquea', async () => {
  conn.query
    .mockResolvedValueOnce([[{ usuario_id: 99, cedula: '111' }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);

  await expect(TrabajadoresModel.actualizar(1, 7, { cedula: '111', telefono: '3000000000' })).resolves.toBe(1);

  expect(conn.query).toHaveBeenCalledTimes(2); // SELECT + UPDATE, sin consultar otras fichas
  expect(conn.commit).toHaveBeenCalled();
});

test('gestor cambia un dato de la persona (EPS) con otra ficha → se permite y se copia a las otras fichas', async () => {
  conn.query
    .mockResolvedValueOnce([[{ usuario_id: 99, cedula: '111' }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);

  await expect(TrabajadoresModel.actualizar(1, 7, { eps: 'Sura' })).resolves.toBe(1);

  const copia = conn.query.mock.calls[2];
  expect(copia[0]).toBe('UPDATE trabajadores SET eps = ? WHERE usuario_id = ? AND id != ? AND activo = 1');
  expect(copia[1]).toEqual(['Sura', 99, 7]);
  expect(conn.commit).toHaveBeenCalled();
  expect(conn.rollback).not.toHaveBeenCalled();
});

test('trabajador sin cuenta (usuario_id null) → cambio de cédula libre', async () => {
  conn.query
    .mockResolvedValueOnce([[{ usuario_id: null, cedula: '111' }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);

  await expect(TrabajadoresModel.actualizar(1, 7, { cedula: '222' })).resolves.toBe(1);
  expect(conn.commit).toHaveBeenCalled();
});

test('el propio trabajador: cédula duplicada en una de sus empresas → 409', async () => {
  pool.query.mockRejectedValueOnce(DUP);

  await expect(TrabajadoresModel.actualizarPorUsuarioId(99, { cedula: '222' }))
    .rejects.toMatchObject({ statusCode: 409 });
});
