'use strict';

jest.mock('../modules/auth/auth.model');
jest.mock('../modules/trabajador-empresa/trabajador-empresa.service');
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hash-inutil'),
}));

const bcrypt = require('bcrypt');
const AuthModel = require('../modules/auth/auth.model');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');
const AuthService = require('../modules/auth/auth.service');

const SIN_EMPRESAS = { activas: [], pendientes: [], invitaciones: [], archivadas: [] };

beforeEach(() => {
  jest.clearAllMocks();
  AuthModel.obtenerPasswordHash.mockResolvedValue('hash-actual');
  bcrypt.compare.mockResolvedValue(true);
  AuthModel.listarTrabajadorIdsPorUsuario.mockResolvedValue([]);
  AuthModel.tieneAsignacionActiva.mockResolvedValue(false);
  TrabajadorEmpresaService.misEmpresas.mockResolvedValue(SIN_EMPRESAS);
  AuthModel.eliminarCuenta.mockResolvedValue(undefined);
});

describe('AuthService.eliminarCuenta', () => {
  test('password incorrecta → AppError 400, no anonimiza nada', async () => {
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      AuthService.eliminarCuenta(1, 'trabajador_turnos', null, 'mala-clave')
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(AuthModel.eliminarCuenta).not.toHaveBeenCalled();
  });

  test('turno confirmado o en curso pendiente → AppError 409, no anonimiza nada', async () => {
    AuthModel.listarTrabajadorIdsPorUsuario.mockResolvedValue([10]);
    AuthModel.tieneAsignacionActiva.mockResolvedValue(true);

    await expect(
      AuthService.eliminarCuenta(1, 'trabajador_turnos', null, 'clave-correcta')
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(AuthModel.eliminarCuenta).not.toHaveBeenCalled();
  });

  test('único admin_empresa activo de la empresa → AppError 409, no anonimiza nada', async () => {
    AuthModel.contarAdminsActivos.mockResolvedValue(1);

    await expect(
      AuthService.eliminarCuenta(2, 'admin_empresa', 7, 'clave-correcta')
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(AuthModel.eliminarCuenta).not.toHaveBeenCalled();
  });

  test('admin_empresa con otro admin activo → sí procede', async () => {
    AuthModel.contarAdminsActivos.mockResolvedValue(2);

    await AuthService.eliminarCuenta(2, 'admin_empresa', 7, 'clave-correcta');

    expect(AuthModel.eliminarCuenta).toHaveBeenCalledWith(2, [], 'hash-inutil');
  });

  test('caso exitoso sin bloqueos: archiva empresas activas y anonimiza', async () => {
    AuthModel.listarTrabajadorIdsPorUsuario.mockResolvedValue([10, 11]);
    TrabajadorEmpresaService.misEmpresas.mockResolvedValue({
      ...SIN_EMPRESAS,
      activas: [{ id: 5 }, { id: 6 }],
    });

    await AuthService.eliminarCuenta(1, 'trabajador_turnos', null, 'clave-correcta');

    expect(TrabajadorEmpresaService.archivar).toHaveBeenCalledWith(1, 'trabajador_turnos', 5);
    expect(TrabajadorEmpresaService.archivar).toHaveBeenCalledWith(1, 'trabajador_turnos', 6);
    expect(AuthModel.eliminarCuenta).toHaveBeenCalledWith(1, [10, 11], 'hash-inutil');
  });
});