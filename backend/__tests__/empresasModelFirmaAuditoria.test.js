'use strict';

// Invariante de seguridad: la firma del representante legal se guarda SIEMPRE
// cifrada (nunca en claro) y el cambio queda auditado (quién/cuándo/IP) en la
// misma transacción — ver empresas.firma_representante_b64 / migración 117.
process.env.FIRMA_ENCRYPTION_KEY = process.env.FIRMA_ENCRYPTION_KEY
  || '1e307b0cccfa3f3c759291df3b8dc09d49325845672911ab77f707f8372729c2';

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
const EmpresasModel = require('../modules/empresas/empresas.model');
const { cifrar } = require('../utils/firmaCrypto');

const auditoria = { usuario_id: 5, usuario_nombre: 'Camila', usuario_rol: 'admin_empresa', ip: '10.0.0.1' };

beforeEach(() => {
  conn.query.mockReset();
  conn.beginTransaction.mockClear();
  conn.commit.mockClear();
  conn.rollback.mockClear();
  conn.release.mockClear();
});

test('sin firma anterior y sin firma nueva → no escribe nada y hace commit', async () => {
  conn.query.mockResolvedValueOnce([[{ firma_representante_b64: null }]]);

  const r = await EmpresasModel.actualizarFirmaConAuditoria(1, '', auditoria);

  expect(r).toEqual({ cambio: false });
  expect(conn.query).toHaveBeenCalledTimes(1); // solo el SELECT ... FOR UPDATE
  expect(conn.commit).toHaveBeenCalled();
});

test('primera firma (creada) → guarda cifrado (nunca en claro) y audita hash_anterior=null', async () => {
  conn.query.mockResolvedValueOnce([[{ firma_representante_b64: null }]]).mockResolvedValue([{ affectedRows: 1 }]);

  const r = await EmpresasModel.actualizarFirmaConAuditoria(1, 'firma-svg-nueva', auditoria);

  expect(r).toMatchObject({ cambio: true, accion: 'creada' });
  const [updateSql, updateParams] = conn.query.mock.calls[1];
  expect(updateSql).toMatch(/^UPDATE empresas SET firma_representante_b64/);
  expect(updateParams[0]).not.toBe('firma-svg-nueva'); // nunca en claro
  expect(updateParams[0]).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);

  const [auditSql, auditParams] = conn.query.mock.calls[2];
  expect(auditSql).toMatch(/^INSERT INTO empresas_firma_auditoria/);
  expect(auditParams[1]).toBe('creada');
  expect(auditParams[2]).toBeNull(); // hash_anterior
  expect(auditParams[3]).toHaveLength(64); // hash_nueva (sha256 hex)
  expect(auditParams.slice(4)).toEqual([5, 'Camila', 'admin_empresa', '10.0.0.1']);
  expect(conn.commit).toHaveBeenCalled();
});

test('quitar la firma (eliminada) → guarda NULL y audita hash_nueva=null', async () => {
  conn.query
    .mockResolvedValueOnce([[{ firma_representante_b64: cifrar('firma-vieja') }]])
    .mockResolvedValue([{ affectedRows: 1 }]);

  const r = await EmpresasModel.actualizarFirmaConAuditoria(1, '', auditoria);

  expect(r).toMatchObject({ cambio: true, accion: 'eliminada' });
  expect(conn.query.mock.calls[1][1][0]).toBeNull(); // UPDATE ... = NULL
  expect(conn.query.mock.calls[2][1][3]).toBeNull(); // hash_nueva
});

test('mismo valor (re-guardar sin cambios reales) → no escribe, aunque el cifrado almacenado sea distinto cada vez', async () => {
  conn.query.mockResolvedValueOnce([[{ firma_representante_b64: cifrar('misma-firma') }]]);

  const r = await EmpresasModel.actualizarFirmaConAuditoria(1, 'misma-firma', auditoria);

  expect(r).toEqual({ cambio: false });
  expect(conn.query).toHaveBeenCalledTimes(1);
});

test('si falla el INSERT de auditoría → rollback, la firma no queda a medias', async () => {
  conn.query
    .mockResolvedValueOnce([[{ firma_representante_b64: null }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockRejectedValueOnce(new Error('disk full'));

  await expect(
    EmpresasModel.actualizarFirmaConAuditoria(1, 'firma', auditoria)
  ).rejects.toThrow('disk full');

  expect(conn.rollback).toHaveBeenCalled();
  expect(conn.commit).not.toHaveBeenCalled();
  expect(conn.release).toHaveBeenCalled();
});

test('empresa inexistente o inactiva → null, sin escrituras', async () => {
  conn.query.mockResolvedValueOnce([[]]);

  const r = await EmpresasModel.actualizarFirmaConAuditoria(999, 'firma', auditoria);

  expect(r).toBeNull();
  expect(conn.query).toHaveBeenCalledTimes(1);
  expect(pool.query).not.toHaveBeenCalled();
});
