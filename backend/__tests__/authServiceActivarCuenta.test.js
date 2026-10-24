'use strict';

// Seguridad: activar-cuenta identifica al trabajador solo por cédula (dato
// semi-público) — si la empresa ya registró un correo para esa persona, activar
// con uno distinto debe rechazarse (si no, cualquiera que conozca la cédula
// podría secuestrar la identidad con su propio correo). El OTP (email_token,
// validado en el controller) prueba que el activador controla el correo que
// manda, pero no que sea el correo correcto — por eso este chequeo es aparte.
jest.mock('../modules/auth/auth.model');
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hash-inutil') }));

const AuthModel = require('../modules/auth/auth.model');
const AuthService = require('../modules/auth/auth.service');

const TRABAJADOR = { id: 5, empresa_id: 1, tipo: 'turnos', usuario_id: null, nombre: 'Ana', apellido: 'Ruiz' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthService.activarCuenta — email debe coincidir con el que tiene la empresa', () => {
  test('empresa tiene otro correo registrado → AppError 403, no busca email en uso ni crea el usuario', async () => {
    AuthModel.buscarTrabajadoresPorCedula.mockResolvedValue([{ ...TRABAJADOR, email: 'ana@empresa.com' }]);

    await expect(
      AuthService.activarCuenta({ cedula: '123', email: 'atacante@gmail.com', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(AuthModel.buscarUsuarioPorEmail).not.toHaveBeenCalled();
    expect(AuthModel.activarCuentaTrabajador).not.toHaveBeenCalled();
  });

  test('email coincide (case-insensitive) con el de la empresa → pasa el chequeo y sigue el flujo normal', async () => {
    AuthModel.buscarTrabajadoresPorCedula.mockResolvedValue([{ ...TRABAJADOR, email: 'Ana@Empresa.com' }]);
    AuthModel.buscarUsuarioPorEmail.mockResolvedValue({ id: 99 }); // simula email ya en uso, para no mockear todo el flujo de éxito

    await expect(
      AuthService.activarCuenta({ cedula: '123', email: 'ana@empresa.com', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 409 }); // el 409 (no el 403) confirma que pasó el chequeo de email
  });

  test('trabajador sin email registrado por la empresa → no aplica el chequeo', async () => {
    AuthModel.buscarTrabajadoresPorCedula.mockResolvedValue([{ ...TRABAJADOR, email: null }]);
    AuthModel.buscarUsuarioPorEmail.mockResolvedValue({ id: 99 });

    await expect(
      AuthService.activarCuenta({ cedula: '123', email: 'cualquiera@gmail.com', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
