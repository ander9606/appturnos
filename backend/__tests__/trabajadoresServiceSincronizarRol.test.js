'use strict';

// El rol de la cuenta (qué interfaz ve el trabajador) se fija una sola vez al
// activar la cuenta a partir de trabajadores.tipo, y nunca se revisaba de
// nuevo — si el gestor cambiaba el tipo desde "Editar trabajador", la app le
// seguía mostrando la interfaz vieja. TrabajadoresService.actualizar debe
// resincronizar usuarios.rol cuando el tipo realmente cambia.
//
// turnos/ambos → nomina es distinto: nómina ata la cuenta a una sola empresa
// y un trabajador_turnos tiene usuarios.empresa_id = NULL por diseño (vive en
// trabajador_empresa) — resincronizar el rol ahí sin más deja la cuenta con
// rol nómina y empresa_id NULL (huérfana). Ese camino queda bloqueado; el
// único válido es la invitación de trabajador-empresa.service (aceptar con
// tipo_ofrecido='nomina'), que sí fija empresa_id y pide consentimiento.
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
  test('cambiar tipo de nomina a turnos (democión) actualiza usuarios.rol', async () => {
    TrabajadoresModel.obtenerPorId
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'nomina', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'turnos' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_TURNOS, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
  });

  test('cambiar tipo de turnos a ambos (sin cambio de rol) actualiza usuarios.rol', async () => {
    TrabajadoresModel.obtenerPorId
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 })
      .mockResolvedValueOnce({ id: 5, empresa_id: 1, tipo: 'ambos', usuario_id: 42 });

    await TrabajadoresService.actualizar(1, 5, { tipo: 'ambos' });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE usuarios SET rol = ? WHERE id = ? AND rol IN (?, ?)',
      [ROLES.TRABAJADOR_TURNOS, 42, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA]
    );
  });

  test('cambiar tipo de turnos a nomina se bloquea (evita huérfano de empresa)', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: 42 });

    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' })).rejects.toMatchObject({
      statusCode: 409,
    });

    // La ficha ya se había guardado con el UPDATE genérico — se revierte a su tipo original.
    expect(TrabajadoresModel.actualizar).toHaveBeenNthCalledWith(2, 1, 5, { tipo: 'turnos' });
    // Nunca debe tocar usuarios.rol/empresa_id por esta vía.
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('cambiar tipo de ambos a nomina también se bloquea', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, tipo: 'ambos', usuario_id: 42 });

    await expect(TrabajadoresService.actualizar(1, 5, { tipo: 'nomina' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(pool.query).not.toHaveBeenCalled();
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
