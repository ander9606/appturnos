'use strict';

// Seguridad: el refresh token nunca se guarda ni se busca en claro (migración
// 116) — un leak de la tabla (backup, inyección SQL) no debe alcanzar para
// hacerse pasar por el usuario sin el token original.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));

const crypto = require('crypto');
const { pool } = require('../config/database');
const AuthModel = require('../modules/auth/auth.model');

const hashEsperado = (token) => crypto.createHash('sha256').update(token).digest('hex');

afterEach(() => jest.clearAllMocks());

test('guardarRefreshToken inserta el hash, nunca el token en claro', async () => {
  pool.query.mockResolvedValue([{ insertId: 1 }]);
  const token = 'token-super-secreto';

  await AuthModel.guardarRefreshToken({ usuario_id: 9, token, expira_at: '2026-11-01' });

  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/token_hash/);
  expect(params).toEqual([9, hashEsperado(token), '2026-11-01']);
  expect(params).not.toContain(token);
});

test('buscarRefreshToken busca por el hash del token recibido, no por el token', async () => {
  pool.query.mockResolvedValue([[{ id: 1, usuario_id: 9 }]]);
  const token = 'token-super-secreto';

  const fila = await AuthModel.buscarRefreshToken(token);

  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/WHERE rt\.token_hash = \?/);
  expect(params).toEqual([hashEsperado(token)]);
  expect(fila).toEqual({ id: 1, usuario_id: 9 });
});

test('revocarRefreshToken revoca por el hash del token', async () => {
  pool.query.mockResolvedValue([{ affectedRows: 1 }]);
  const token = 'token-super-secreto';

  await AuthModel.revocarRefreshToken(token);

  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toMatch(/SET revocado = 1 WHERE token_hash = \?/);
  expect(params).toEqual([hashEsperado(token)]);
});
