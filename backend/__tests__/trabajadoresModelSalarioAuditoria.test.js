'use strict';

// Invariante legal: un cambio de sueldo y su fila de auditoría van en la misma
// transacción. Si la auditoría falla, el sueldo no cambia (rollback, sin commit).
jest.mock('../config/database', () => {
  const conn = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
  return { pool: { getConnection: jest.fn().mockResolvedValue(conn), query: jest.fn() }, conn };
});

const { pool, conn } = require('../config/database');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');

const auditoria = { usuario_id: 5, usuario_nombre: 'Luis', usuario_rol: 'jefe_nomina', ip: '10.0.0.1' };
const actual = { usuario_id: 99, nombre: 'Ana', apellido: 'Pérez', tarifa_hora: null, salario_base: '1500000.00' };

beforeEach(() => {
  conn.query.mockReset();
  conn.beginTransaction.mockClear();
  conn.commit.mockClear();
  conn.rollback.mockClear();
  conn.release.mockClear();
});

test('sin cambio de valor → no escribe nada y hace commit', async () => {
  conn.query.mockResolvedValueOnce([[actual]]);

  const r = await TrabajadoresModel.actualizarSalarioConAuditoria(1, 7, { tarifa_hora: null, salario_base: 1500000 }, auditoria);

  expect(r).toEqual({ cambio: false });
  expect(conn.query).toHaveBeenCalledTimes(1); // solo el SELECT ... FOR UPDATE
  expect(conn.commit).toHaveBeenCalled();
  expect(conn.release).toHaveBeenCalled();
});

test('cambio → UPDATE y auditoría en la misma transacción, con valores anterior y nuevo', async () => {
  conn.query.mockResolvedValueOnce([[actual]]).mockResolvedValue([{ affectedRows: 1 }]);

  const r = await TrabajadoresModel.actualizarSalarioConAuditoria(1, 7, { tarifa_hora: null, salario_base: 1800000 }, auditoria);

  expect(r).toMatchObject({ cambio: true, trabajadorId: 7, usuarioId: 99, nombre: 'Ana Pérez' });
  const sqls = conn.query.mock.calls.map(([sql]) => sql);
  expect(sqls[1]).toMatch(/^UPDATE trabajadores/);
  expect(sqls[2]).toMatch(/^INSERT INTO trabajadores_salario_auditoria/);
  expect(conn.query.mock.calls[2][1]).toEqual([
    1, 7, 'Ana Pérez', null, null, '1500000.00', 1800000, 5, 'Luis', 'jefe_nomina', '10.0.0.1',
  ]);
  expect(conn.commit).toHaveBeenCalled();
  expect(conn.rollback).not.toHaveBeenCalled();
});

test('si falla la auditoría → rollback, nunca commit (el sueldo no cambia)', async () => {
  conn.query
    .mockResolvedValueOnce([[actual]])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockRejectedValueOnce(new Error('disk full'));

  await expect(
    TrabajadoresModel.actualizarSalarioConAuditoria(1, 7, { tarifa_hora: null, salario_base: 1800000 }, auditoria)
  ).rejects.toThrow('disk full');

  expect(conn.rollback).toHaveBeenCalled();
  expect(conn.commit).not.toHaveBeenCalled();
  expect(conn.release).toHaveBeenCalled();
});

test('trabajador de otra empresa o inexistente → null, sin escrituras', async () => {
  conn.query.mockResolvedValueOnce([[]]);

  const r = await TrabajadoresModel.actualizarSalarioConAuditoria(1, 999, { salario_base: 1 }, auditoria);

  expect(r).toBeNull();
  expect(conn.query).toHaveBeenCalledTimes(1);
  expect(conn.rollback).toHaveBeenCalled();
  expect(pool.query).not.toHaveBeenCalled();
});
