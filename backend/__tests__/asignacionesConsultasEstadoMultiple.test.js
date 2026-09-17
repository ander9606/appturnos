'use strict';

// La pestaña "Aceptados" de postulaciones.tsx necesita ver todo lo que alguna
// vez se confirmó (confirmado/en_progreso/completado/no_presentado), no solo
// 'confirmado' — si no, un turno desaparecía de la lista en cuanto el worker
// o un gestor lo resolvía. `estado` ahora acepta una lista separada por comas.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[{ total: 0 }]]) },
}));

const { pool } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.consultas.model');

afterEach(() => jest.clearAllMocks());

describe('AsignacionesModel.listar — filtro estado', () => {
  test('un solo estado → WHERE a.estado = ?', async () => {
    await AsignacionesModel.listar(1, { estado: 'confirmado', limit: 20, offset: 0 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.estado = \?/);
    expect(params).toContain('confirmado');
  });

  test('varios estados separados por coma → WHERE a.estado IN (?,?,?,?)', async () => {
    await AsignacionesModel.listar(1, {
      estado: 'confirmado,en_progreso,completado,no_presentado',
      limit: 20,
      offset: 0,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/a\.estado IN \(\?,\?,\?,\?\)/);
    expect(params).toEqual(
      expect.arrayContaining(['confirmado', 'en_progreso', 'completado', 'no_presentado'])
    );
  });
});
