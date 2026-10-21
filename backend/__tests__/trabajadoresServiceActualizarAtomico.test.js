'use strict';

// TrabajadoresService.actualizar escribe ficha + sueldo (con auditoría) + rol de
// la cuenta en UNA transacción: si cualquiera falla, no queda nada a medias.
// El aviso de sueldo va después del commit y no puede deshacer el cambio.
jest.mock('../config/database', () => {
  const conn = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };
  return { pool: { query: jest.fn().mockResolvedValue([[]]), getConnection: jest.fn().mockResolvedValue(conn) }, conn };
});
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn(),
  notificarVarios: jest.fn(),
}));

const { conn } = require('../config/database');
const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

const EMPRESA = 1;
const ID = 7;
const ficha = { id: ID, nombre: 'Ana', apellido: 'Pérez', usuario_id: 99, email: null, tipo: 'nomina', tarifa_hora: null, salario_base: '1500000' };
const admin = { usuario_id: 2, usuario_nombre: 'Marta', usuario_rol: ROLES.ADMIN_EMPRESA, ip: '10.0.0.2' };

beforeEach(() => {
  conn.query.mockReset().mockResolvedValue([{}]);
  conn.beginTransaction.mockReset().mockResolvedValue(undefined);
  conn.commit.mockReset().mockResolvedValue(undefined);
  conn.rollback.mockReset().mockResolvedValue(undefined);
  conn.release.mockReset();
  TrabajadoresModel.obtenerPorId.mockReset().mockResolvedValue(ficha);
  TrabajadoresModel.actualizar.mockReset().mockResolvedValue(1);
  TrabajadoresModel.sincronizarRolUsuario.mockReset().mockResolvedValue(undefined);
  TrabajadoresModel.actualizarSalarioConAuditoria.mockReset().mockResolvedValue({ cambio: false });
  NotificacionesService.notificar.mockReset().mockResolvedValue(undefined);
  NotificacionesService.notificarVarios.mockReset().mockResolvedValue(undefined);
});

test('el sueldo falla después de escribir el perfil → rollback del perfil, sin commit', async () => {
  TrabajadoresModel.actualizarSalarioConAuditoria.mockRejectedValue(new Error('auditoría caída'));

  await expect(
    TrabajadoresService.actualizar(EMPRESA, ID, { telefono: '3000000000', salario_base: 1800000 }, admin)
  ).rejects.toThrow('auditoría caída');

  // El perfil sí se escribió, pero dentro de la misma conexión/transacción.
  expect(TrabajadoresModel.actualizar).toHaveBeenCalledWith(EMPRESA, ID, { telefono: '3000000000' }, conn);
  expect(conn.rollback).toHaveBeenCalled();
  expect(conn.commit).not.toHaveBeenCalled();
  expect(conn.release).toHaveBeenCalled();
});

test('el rol de la cuenta falla → rollback de ficha y sueldo, sin commit', async () => {
  TrabajadoresModel.sincronizarRolUsuario.mockRejectedValueOnce(new Error('db caída'));

  await expect(
    TrabajadoresService.actualizar(EMPRESA, ID, { tipo: 'turnos', salario_base: 1800000 }, admin)
  ).rejects.toThrow('db caída');

  expect(conn.rollback).toHaveBeenCalled();
  expect(conn.commit).not.toHaveBeenCalled();
});

test('el aviso de sueldo falla después del commit → el cambio queda guardado y no rechaza', async () => {
  TrabajadoresModel.actualizarSalarioConAuditoria.mockResolvedValue({
    cambio: true, trabajadorId: ID, usuarioId: 99, nombre: 'Ana Pérez',
  });
  NotificacionesService.notificar.mockRejectedValue(new Error('push caído'));

  await expect(
    TrabajadoresService.actualizar(EMPRESA, ID, { salario_base: 1800000 }, admin)
  ).resolves.toBeDefined();

  expect(conn.commit).toHaveBeenCalled();
  expect(conn.rollback).not.toHaveBeenCalled();
});
