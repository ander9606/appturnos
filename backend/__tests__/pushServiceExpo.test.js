'use strict';

// enviarExpo() no debe lanzar nunca (best-effort) y solo debe borrar el token
// cuando Expo responde DeviceNotRegistered — otros errores se loguean, no se
// borran (el token puede seguir siendo válido, ej. rate limit o mal formado).
jest.mock('https');
jest.mock('../modules/notificaciones/push/push.model');

const https = require('https');
const PushModel = require('../modules/notificaciones/push/push.model');
const PushService = require('../modules/notificaciones/push/push.service');

function mockExpoResponse(statusCode, body) {
  https.request.mockImplementation((_options, callback) => {
    const res = {
      statusCode,
      on: (event, handler) => {
        if (event === 'data') handler(Buffer.from(JSON.stringify(body)));
        if (event === 'end') handler();
      },
    };
    callback(res);
    return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
  });
}

beforeEach(() => jest.clearAllMocks());

describe('PushService.enviarExpo', () => {
  test('DeviceNotRegistered → borra el token', async () => {
    PushModel.listarExpoTokensPorUsuario.mockResolvedValue(['tok-1']);
    mockExpoResponse(200, { data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] });

    await PushService.enviarExpo(5, { titulo: 't', mensaje: 'm' });

    expect(PushModel.eliminarExpoToken).toHaveBeenCalledWith(5, 'tok-1');
  });

  test('otro error de Expo (ej. rate limit) → no borra el token', async () => {
    PushModel.listarExpoTokensPorUsuario.mockResolvedValue(['tok-2']);
    mockExpoResponse(200, { data: [{ status: 'error', details: { error: 'MessageRateExceeded' }, message: 'slow down' }] });

    await PushService.enviarExpo(5, { titulo: 't', mensaje: 'm' });

    expect(PushModel.eliminarExpoToken).not.toHaveBeenCalled();
  });

  test('falla de red no lanza (best-effort)', async () => {
    PushModel.listarExpoTokensPorUsuario.mockResolvedValue(['tok-3']);
    https.request.mockImplementation(() => ({
      on: (event, handler) => { if (event === 'error') handler(new Error('ECONNRESET')); },
      write: jest.fn(),
      end: jest.fn(),
    }));

    await expect(PushService.enviarExpo(5, { titulo: 't', mensaje: 'm' })).resolves.toBeUndefined();
    expect(PushModel.eliminarExpoToken).not.toHaveBeenCalled();
  });
});
