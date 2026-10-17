'use strict';

// El rol de la cuenta (qué interfaz ve el trabajador) se fija una sola vez al
// activar la cuenta a partir de trabajadores.tipo, y nunca se revisaba de
// nuevo — si el gestor cambiaba el tipo desde "Editar trabajador", la app le
// seguía mostrando la interfaz vieja. TrabajadoresService.actualizar debe
// resincronizar usuarios.rol cuando el tipo realmente cambia, en la misma
// transacción que la ficha.
//
// turnos/ambos → nomina es distinto: nómina ata la cuenta a una sola empresa
// y un trabajador_turnos tiene usuarios.empresa_id = NULL por diseño — ese
// camino queda bloqueado ANTES de escribir nada.
jest.mock('../config/database', () => {
  const conn = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };
  return { pool: { query: jest.fn(), getConnection: jest.fn().mockResolvedValue(conn) }, conn };
});
jest.mock('../modules/trabajadores/trabajadores.model');

const { pool, conn } = require('../config/database');
const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

beforeEach(() => {
  pool.query.mockReset();
  pool.getConnection.mockClear();
  conn.query.mockReset().mockResolvedValue([{}]);
  conn.beginTransaction.mockReset().mockResolvedValue(undefined);
  conn.commit.mockReset().mockResolvedValue(undefined);
  conn.rollback.mockReset().mockResolvedValue(undefined);
  conn.release.mockReset();
  TrabajadoresModel.actualizar.mockReset().mockResolvedValue(1);
  TrabajadoresModel.obtenerPorId.mockReset();
});

describe('TrabajadoresService.actualizar — resincronizar rol de cuenta', () => {
  test('cambiar tipo de nomina a turnos (democión) actualiza usuarios.rol dentro de la transacción', async () => {
    TrabajadoresModel.obtenerPorId
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'nomina', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'turnos' });

    expect(conn.query).toHaveBeenCalledWith(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_TURNOS, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
    expect(TrabajadoresModel.actualizar).toHaveBeenCalledWith(1, 5, { tipo: 'turnos' }, conn);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  test('cambiar tipo de turnos a ambos (sin cambio de rol) actualiza usuarios.rol', async () => {
    TrabajadoresModel.obtenerPorId
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'ambos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'ambos' });

    expect(conn.query).toHaveBeenCalledWith(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_TURNOS, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
  });

  test('cambiar tipo de turnos a nomina se bloquea antes de escribir nada', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' })).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(TrabajadoresModel.actualizar).not.toHaveBeenCalled();
    expect(conn.query).not.toHaveBeenCalled();
  });

  test('cambiar tipo de ambos a nomina también se bloquea', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'ambos', usuario_id: 42 });

    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(TrabajadoresModel.actualizar).not.toHaveBeenCalled();
    expect(conn.query).not.toHaveBeenCalled();
  });

  test('sin cambio real de tipo no toca usuarios', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'turnos', telefono: '3000000000' });

    expect(conn.query).not.toHaveBeenCalled();
  });

  test('trabajador sin cuenta activada (usuario_id null) no toca usuarios', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: null });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' });

    expect(conn.query).not.toHaveBeenCalled();
  });
});
