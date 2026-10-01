'use strict';

// Una persona no puede ser gestor y trabajador de la misma empresa (mismo email).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/auth/auth.model');

const { pool } = require('../config/database');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const AuthModel = require('../modules/auth/auth.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const AuthService = require('../modules/auth/auth.service');

beforeEach(() => {
  pool.query.mockReset();
  AuthModel.buscarUsuarioPorEmail.mockResolvedValue(null);
});

test('crear trabajador con email de un gestor → 409', async () => {
  pool.query.mockResolvedValueOnce([[{ 1: 1 }]]);
  await expect(
    TrabajadoresService.crear(1, { nombre: 'Ana', apellido: 'P', email: 'Jefe@x.com' })
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(TrabajadoresModel.crear).not.toHaveBeenCalled();
});

test('crear trabajador con email libre sigue funcionando', async () => {
  pool.query.mockResolvedValueOnce([[]]).mockResolvedValue([[{ plan: 'gratis' }]]);
  TrabajadoresModel.crear.mockResolvedValue(7);
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 7 });
  await expect(TrabajadoresService.crear(1, { nombre: 'Ana', apellido: 'P', email: 'a@x.com' })).resolves.toEqual({ id: 7 });
});

test('crear gestor con email de un trabajador de la empresa → 409', async () => {
  AuthModel.existeTrabajadorConEmail.mockResolvedValue(true);
  await expect(
    AuthService.crearGestor(1, { nombre: 'Luis', email: 'a@x.com', rol: 'jefe_turnos' })
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(AuthModel.crearGestor).not.toHaveBeenCalled();
});
