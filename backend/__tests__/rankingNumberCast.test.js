'use strict';

// mysql2 devuelve las columnas DECIMAL (ranking) como string, no number.
// Sentry reportó un crash en producción (WorkerView.equipo.tsx) porque el
// cliente llama ranking.toFixed(1) esperando un number. Estos tests
// verifican que ambos puntos donde se arma la respuesta casteen el valor.

jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajadores/trabajadores.model');

const { pool } = require('../config/database');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');

describe('TrabajadoresService.me — ranking castea a number', () => {
  test('ranking DECIMAL string del driver se devuelve como number', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 1, ranking: '4.50' });
    TrabajadoresModel.listarExperiencias.mockResolvedValue([]);
    TrabajadoresModel.listarDiplomas.mockResolvedValue([]);
    TrabajadoresModel.listarCargos.mockResolvedValue([]);

    const perfil = await TrabajadoresService.me(99);

    expect(perfil.ranking).toBe(4.5);
    expect(typeof perfil.ranking).toBe('number');
  });

  test('ranking null se mantiene null (trabajador sin calificaciones)', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 1, ranking: null });
    TrabajadoresModel.listarExperiencias.mockResolvedValue([]);
    TrabajadoresModel.listarDiplomas.mockResolvedValue([]);
    TrabajadoresModel.listarCargos.mockResolvedValue([]);

    const perfil = await TrabajadoresService.me(99);

    expect(perfil.ranking).toBeNull();
  });
});

describe('TrabajadorEmpresaModel.listarPorUsuario — ranking castea a number', () => {
  test('ROUND(AVG(...)) del driver se devuelve como number', async () => {
    pool.query.mockResolvedValue([[{ id: 1, ranking: '3.75', total_calificaciones: 4 }]]);

    const vinculos = await TrabajadorEmpresaModel.listarPorUsuario(99);

    expect(vinculos[0].ranking).toBe(3.75);
    expect(typeof vinculos[0].ranking).toBe('number');
  });
});
