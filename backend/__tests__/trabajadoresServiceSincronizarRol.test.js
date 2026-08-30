'use strict';

// El rol de la cuenta (qué interfaz ve el trabajador) se fija una sola vez al
// activar la cuenta a partir de trabajadores.tipo, y nunca se revisaba de
// nuevo — si el gestor cambiaba el tipo desde "Editar trabajador", la app le
// seguía mostrando la interfaz vieja. TrabajadoresService.actualizar debe
// resincronizar usuarios.rol cuando el tipo realmente cambia.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajadores/trabajadores.model');

const { pool } = require('../config/database');
const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

beforeEach(() => {
  pool.query.mockReset().mockResolvedValue([{}]);
  TrabajadoresModel.actualizar.mockReset().mockResolvedValue(1);
  TrabajadoresModel.obtenerPorId.mockReset();
});

describe('TrabajadoresService.actualizar — resincronizar rol de cuenta', () => {
  test('cambiar tipo de turnos a nomina actualiza usuarios.rol', async () => {
    TrabajadoresModel.obtenerPorId
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'nomina', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_NOMINA, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
  });

  test('sin cambio real de tipo no toca usuarios', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'turnos', telefono: '3000000000' });

    expect(pool.query).not.toHaveBeenCalled();
  });

  test('trabajador sin cuenta activada (usuario_id null) no toca usuarios', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: null });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' });

    expect(pool.query).not.toHaveBeenCalled();
  });
});
