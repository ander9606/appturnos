'use strict';

jest.mock('../modules/auth/auth.model');
jest.mock('../config/database', () => {
  const conn = { execute: jest.fn().mockResolvedValue([[]]), release: jest.fn() };
  return { pool: { getConnection: jest.fn().mockResolvedValue(conn) }, __conn: conn };
});
jest.mock('../utils/mailer', () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/sms', () => ({ enviarSms: jest.fn() }));

const AuthModel = require('../modules/auth/auth.model');
const { enviarEmail } = require('../utils/mailer');
const { enviarOtpRecuperacion } = require('../modules/auth/verificacion.service');

const esperarEnvio = () => new Promise((r) => setImmediate(r));

beforeEach(() => jest.clearAllMocks());

describe('enviarOtpRecuperacion', () => {
  test('email sin cuenta → no envía nada y no lanza error', async () => {
    AuthModel.buscarUsuarioPorEmail.mockResolvedValue(null);
    await expect(enviarOtpRecuperacion('atacante@x.com')).resolves.toBeUndefined();
    await esperarEnvio();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test('cuenta inactiva → no envía', async () => {
    AuthModel.buscarUsuarioPorEmail.mockResolvedValue({ id: 1, activo: 0 });
    await enviarOtpRecuperacion('inactivo@x.com');
    await esperarEnvio();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test('cuenta activa → envía el código al email', async () => {
    AuthModel.buscarUsuarioPorEmail.mockResolvedValue({ id: 1, activo: 1 });
    await enviarOtpRecuperacion('real@x.com');
    await esperarEnvio();
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('real@x.com');
  });
});
